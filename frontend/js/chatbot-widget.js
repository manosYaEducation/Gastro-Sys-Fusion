/**
 * chatbot-widget.js
 * Inyecta dinámicamente el widget flotante del Chatbot de IA en el panel administrativo.
 */

(function () {
  'use strict';

  // Esperar a que el usuario de auth-guard.js esté cargado
  let attempts = 0;
  const maxAttempts = 30; // 3 segundos max

  const checkUserInterval = setInterval(() => {
    attempts++;
    if (window.USUARIO) {
      clearInterval(checkUserInterval);
      // Validar si el rol es Gerente o Administrador
      if (['gerente', 'administrador'].includes(window.USUARIO.rol)) {
        inicializarChatbot();
      }
    } else if (attempts >= maxAttempts) {
      clearInterval(checkUserInterval);
      // Si el usuario no está, verificar en sessionStorage por si acaso ya se logueó
      const savedUser = sessionStorage.getItem('gastro_usuario');
      if (savedUser) {
        try {
          const userObj = JSON.parse(savedUser);
          if (['gerente', 'administrador'].includes(userObj.rol)) {
            window.USUARIO = userObj;
            inicializarChatbot();
          }
        } catch (_) {}
      }
    }
  }, 100);

  /**
   * Carga la hoja de estilos de forma dinámica
   */
  function cargarEstilos() {
    if (document.getElementById('chatbot-css')) return;
    const link = document.createElement('link');
    link.id = 'chatbot-css';
    link.rel = 'stylesheet';
    link.href = 'css/chatbot.css?v=1.0.3';
    document.head.appendChild(link);
  }

  /**
   * Inicializa el widget del chatbot en la página
   */
  function inicializarChatbot() {
    cargarEstilos();

    // Crear la estructura HTML del Chatbot
    const container = document.createElement('div');
    container.className = 'chatbot-container';
    container.id = 'chatbot-container';
    container.innerHTML = `
      <!-- Botón Flotante -->
      <button class="chatbot-toggle-btn" id="chatbot-toggle-btn" aria-label="Abrir asistente de IA" title="Preguntar al Asistente de IA">
        <span class="chatbot-icon">✦</span>
      </button>
      
      <!-- Ventana del Chat -->
      <div class="chatbot-window" id="chatbot-window" aria-hidden="true">
        <div class="chatbot-header">
          <div class="chatbot-header-title">
            <span class="chatbot-header-spark">✦</span>
            <div>
              <h3>Asistente IA</h3>
              <p>Satoshi v1.0 — Online</p>
            </div>
          </div>
          <button class="chatbot-close-btn" id="chatbot-close-btn" aria-label="Cerrar chat">&times;</button>
        </div>
        
        <div class="chatbot-messages" id="chatbot-messages">
          <div class="chatbot-message assistant">
            <div class="chatbot-message-bubble">
              ¡Hola! Soy <strong>Satoshi</strong>, tu asistente inteligente. ¿En qué puedo ayudarte hoy con la gestión de <strong>Gastro-Sys-Fusion</strong>?
            </div>
          </div>
        </div>
        
        <div class="chatbot-suggestions" id="chatbot-suggestions">
          <button class="chatbot-suggestion-btn">¿Cuánto vendimos hoy?</button>
          <button class="chatbot-suggestion-btn">¿Qué insumos están bajos?</button>
          <button class="chatbot-suggestion-btn">Mermas recientes</button>
          <button class="chatbot-suggestion-btn">Pedidos activos</button>
        </div>
        
        <form class="chatbot-input-area" id="chatbot-form">
          <input type="text" id="chatbot-input" placeholder="Pregunta sobre ventas, mermas, stock..." required autocomplete="off" />
          <button type="submit" class="chatbot-send-btn" id="chatbot-send-btn" aria-label="Enviar mensaje">
            <svg viewBox="0 0 24 24" width="18" height="18"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" fill="currentColor"/></svg>
          </button>
        </form>
      </div>
    `;

    document.body.appendChild(container);

    // Guardar referencias a elementos del DOM
    const toggleBtn = document.getElementById('chatbot-toggle-btn');
    const closeBtn = document.getElementById('chatbot-close-btn');
    const chatWindow = document.getElementById('chatbot-window');
    const chatForm = document.getElementById('chatbot-form');
    const chatInput = document.getElementById('chatbot-input');
    const chatMessages = document.getElementById('chatbot-messages');
    const suggestionsContainer = document.getElementById('chatbot-suggestions');

    // Historial de la conversación
    let chatHistory = [];

    // --- EVENTOS ---

    // Abrir/Cerrar Chat
    toggleBtn.addEventListener('click', () => {
      const isOpen = chatWindow.classList.toggle('open');
      chatWindow.setAttribute('aria-hidden', !isOpen);
      if (isOpen) {
        chatInput.focus();
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }
    });

    closeBtn.addEventListener('click', () => {
      chatWindow.classList.remove('open');
      chatWindow.setAttribute('aria-hidden', 'true');
    });

    // Envío del Formulario
    chatForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = chatInput.value.trim();
      if (!text) return;

      chatInput.value = '';
      await procesarMensajeUsuario(text);
    });

    // Clic en Sugerencias
    suggestionsContainer.addEventListener('click', async (e) => {
      if (e.target.classList.contains('chatbot-suggestion-btn')) {
        const text = e.target.textContent;
        await procesarMensajeUsuario(text);
      }
    });

    /**
     * Envia el mensaje al servidor del agente Next.js y maneja la burbuja de respuesta
     */
    async function procesarMensajeUsuario(message) {
      // 1. Agregar burbuja del usuario en el DOM
      agregarMensaje(message, 'user');

      // 2. Mostrar burbuja de carga ("cargando...")
      const loader = mostrarCargador();

      // 3. Agregar mensaje al historial para contexto del agente
      chatHistory.push({ role: 'user', content: message });

      try {
        // Consultar el servidor Next.js
        const res = await fetch(window.AGENTE_URL || 'http://localhost:3000/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: message,
            history: chatHistory
          })
        });

        loader.remove(); // Quitar cargador

        if (!res.ok) {
          throw new Error(`Error de servidor (${res.status})`);
        }

        const data = await res.json();
        
        if (data.success) {
          // Agregar burbuja del asistente
          agregarMensaje(data.reply, 'assistant');
          // Guardar en el historial
          chatHistory.push({ role: 'assistant', content: data.reply });
        } else {
          agregarMensaje(data.reply || 'Hubo un inconveniente al resolver la pregunta.', 'assistant');
        }

      } catch (err) {
        console.error('[Chatbot Widget] Error de conexión:', err);
        loader.remove();
        agregarMensaje('Disculpa, no puedo comunicarme con el servidor del asistente de IA. Verifica que el servidor de Next.js esté corriendo.', 'assistant');
      }
    }

    /**
     * Inserta un mensaje en el DOM
     */
    function agregarMensaje(text, sender) {
      const msgDiv = document.createElement('div');
      msgDiv.className = `chatbot-message ${sender}`;

      const bubbleDiv = document.createElement('div');
      bubbleDiv.className = 'chatbot-message-bubble';

      if (sender === 'assistant') {
        bubbleDiv.innerHTML = parseMarkdown(text);
      } else {
        bubbleDiv.textContent = text;
      }

      msgDiv.appendChild(bubbleDiv);
      chatMessages.appendChild(msgDiv);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    /**
     * Muestra el loader de tres puntos suspendidos
     */
    function mostrarCargador() {
      const loaderDiv = document.createElement('div');
      loaderDiv.className = 'chatbot-message assistant';
      loaderDiv.innerHTML = `
        <div class="chatbot-message-bubble chatbot-loading-bubble">
          <div class="chatbot-dot"></div>
          <div class="chatbot-dot"></div>
          <div class="chatbot-dot"></div>
        </div>
      `;
      chatMessages.appendChild(loaderDiv);
      chatMessages.scrollTop = chatMessages.scrollHeight;
      return loaderDiv;
    }

    /**
     * Formateador simple de Markdown a HTML (Soporta negritas, listas y tablas)
     */
    function parseMarkdown(text) {
      // Reemplazar caracteres HTML básicos para evitar XSS
      let html = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      // Negritas (**texto**)
      html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

      // Código en línea (`código`)
      html = html.replace(/`(.*?)`/g, '<code>$1</code>');

      // Líneas de listas (- ítem)
      html = html.replace(/^\s*-\s+(.*?)$/gm, '<li>$1</li>');

      // Procesar tablas de Markdown
      const lines = html.split('\n');
      let inTable = false;
      let tableHTML = '';

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line.startsWith('|') && line.endsWith('|')) {
          // Saltar línea divisoria |---|---|
          if (line.match(/^\|[\s:-|]+$/)) {
            lines[i] = '';
            continue;
          }

          const cells = line.split('|').slice(1, -1).map(c => c.trim());

          if (!inTable) {
            inTable = true;
            tableHTML = '<table><thead><tr>' + cells.map(c => `<th>${c}</th>`).join('') + '</tr></thead><tbody>';
          } else {
            tableHTML += '<tr>' + cells.map(c => `<td>${c}</td>`).join('') + '</tr>';
          }
          lines[i] = '';
        } else {
          if (inTable) {
            inTable = false;
            tableHTML += '</tbody></table>';
            lines[i] = tableHTML + '\n' + line;
            tableHTML = '';
          }
        }
      }

      if (inTable) {
        tableHTML += '</tbody></table>';
        lines[lines.length - 1] = tableHTML;
      }

      html = lines.filter(l => l !== '').join('\n');

      // Saltos de línea
      html = html.replace(/\n/g, '<br>');

      // Agrupar elementos <li> consecutivos en un <ul>
      html = html.replace(/(<li>.*?<\/li>)/gs, '<ul>$1</ul>');
      // Limpiar dobles <ul> que se puedan generar por regex recursiva
      html = html.replace(/<\/ul>\s*<ul>/g, '');

      return html;
    }
  }

})();
