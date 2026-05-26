/**
 * platos.js
 * Controlador principal del menú gastronómico.
 *
 * Flujo de datos (nuevo contrato de API):
 *   1. GET /api/clima.php          → obtener clima real (OWM)
 *   2. GET /api/menu.php?condicion → platos sugeridos para ese clima
 *   3. GET /api/platos.php?disponible=true → todos los platos (menú completo)
 *
 * El widget Gastro-Clima sigue ofreciendo simulación manual y se mantiene
 * sincronizado con el estado del backend.
 */

document.addEventListener('DOMContentLoaded', () => {
  // ── DOM refs ───────────────────────────────────────────────────────────────
  const grid             = document.getElementById('dishes-grid');
  const errorEl          = document.getElementById('dishes-error');
  const weatherWidget    = document.getElementById('weather-widget');
  const weatherWidgetBody = document.getElementById('weather-widget-body');
  const weatherWidgetToggle = document.getElementById('weather-widget-toggle');
  const weatherIcon      = document.getElementById('weather-icon');
  const weatherTemp      = document.getElementById('weather-temp');
  const weatherDesc      = document.getElementById('weather-desc');
  const weatherLocation  = document.getElementById('weather-location');
  const suggestionsSection = document.getElementById('weather-suggestions-section');
  const suggestionsGrid  = document.getElementById('weather-suggestions-grid');
  const weatherConditionSpan = document.getElementById('weather-condition-span');

  // ── Config ─────────────────────────────────────────────────────────────────
  const API    = window.API    || {};
  const imgBase = window.API_URL || 'http://localhost/Gastro-Sys-Fusion/';

  // URLs con fallback por si config.js no carga antes
  const URL_CLIMA  = API.clima  || `${imgBase}api/clima.php`;
  const URL_MENU   = API.menu   || `${imgBase}api/menu.php`;
  const URL_PLATOS = API.platos || `${imgBase}api/platos.php`;

  let todosLosPlatos  = [];
  let climaActual     = { condicion: 'templado', temperatura: 18 };
  let widgetMinimizado = false;

  // ── Configuración visual de climas ────────────────────────────────────────
  // condicion usa el vocabulario del contrato: lluvia | frio | sol | templado
  const CLIMAS = {
    sol:      { nombre: 'Soleado y Cálido',    icono: '☀️',  claseBadge: '' },
    frio:     { nombre: 'Frío e Invernal',      icono: '❄️',  claseBadge: '' },
    lluvia:   { nombre: 'Lluvioso o Húmedo',    icono: '🌧️', claseBadge: '' },
    templado: { nombre: 'Templado y Agradable', icono: '⛅',  claseBadge: 'dish-card__weather-badge--neutral' },
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const formatPrecio = (v) => '$' + Number(v).toLocaleString('es-CL');

  /**
   * Verifica si un plato coincide con la condición actual.
   * Mapea el vocabulario del contrato al de la BD:
   *   lluvia  → lluvioso | todos
   *   sol     → calido   | todos
   *   frio    → frio     | todos
   *   templado→ templado | calido | todos
   */
  function platoCoincidesConClima(plato, condicion) {
    const campo = (plato.clima_recomendar || '').toLowerCase();
    if (!campo) return false;
    const tags = campo.split(',').map(t => t.trim());

    const mapaContrato = {
      lluvia:   ['lluvioso', 'todos'],
      sol:      ['calido',   'todos'],
      frio:     ['frio',     'todos'],
      templado: ['templado', 'calido', 'todos'],
    };

    const permitidos = mapaContrato[condicion] ?? ['todos'];
    return tags.some(t => permitidos.includes(t));
  }

  /** Construye un article .dish-card a partir de un objeto plato. */
  function buildCard(plato, index, isSuggestion = false) {
    const imgSrc = plato.imagen_url
      ? `${imgBase}assets/img/${plato.imagen_url}`
      : `${imgBase}assets/img/placeholder.png`;

    const badge = plato.destacado == 1 ? 'Destacado' : (plato.categoria ?? 'Plato');

    let weatherBadgeHTML = '';
    if (!isSuggestion && platoCoincidesConClima(plato, climaActual.condicion)) {
      const cfg = CLIMAS[climaActual.condicion] ?? CLIMAS.templado;
      weatherBadgeHTML = `
        <div class="dish-card__weather-badge ${cfg.claseBadge}" title="Recomendado para ${cfg.nombre}">
          <span>${cfg.icono}</span> Ideal hoy
        </div>`;
    }

    const article = document.createElement('article');
    article.className = 'dish-card';
    article.setAttribute('role', 'listitem');
    article.setAttribute('id', `${isSuggestion ? 'suggest-' : ''}card-plato-${plato.id}`);
    article.setAttribute('tabindex', '0');
    article.setAttribute('aria-label', plato.nombre);
    article.style.animationDelay = `${0.2 + index * 0.1}s`;

    article.innerHTML = `
      <div class="dish-card__img-wrapper">
        <img class="dish-card__img" src="${imgSrc}" alt="${plato.nombre}"
             width="480" height="240" loading="eager"
             onerror="this.onerror=null;this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22480%22 height=%22240%22%3E%3Crect width=%22100%25%22 height=%22100%25%22 fill=%22%231a1815%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22 font-size=%2248%22%3E%F0%9F%8D%BD%EF%B8%8F%3C/text%3E%3C/svg%3E'" />
        <div class="dish-card__overlay" aria-hidden="true"></div>
        <span class="dish-card__badge">${badge}</span>
        ${weatherBadgeHTML}
      </div>
      <div class="dish-card__body">
        <p class="dish-card__category">${plato.categoria ?? 'Sin categoría'}</p>
        <h2 class="dish-card__name">${plato.nombre}</h2>
        <p class="dish-card__desc">${plato.descripcion ?? ''}</p>
        <div class="dish-card__meta">
          <span class="dish-card__price">${formatPrecio(plato.precio)}</span>
          <div class="dish-card__info">
            ${plato.tiempo_min ? `<span class="dish-card__pill" title="Tiempo de preparación">⏱ ${plato.tiempo_min} min</span>` : ''}
            ${plato.calorias   ? `<span class="dish-card__pill" title="Calorías">🔥 ${plato.calorias} kcal</span>` : ''}
          </div>
        </div>
        <button class="dish-card__btn" id="${isSuggestion ? 'suggest-' : ''}btn-pedir-${plato.id}" type="button">
          Agregar al pedido
        </button>
      </div>`;

    const btn = article.querySelector('.dish-card__btn');
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof window.openCustomizationModal === 'function') {
          window.openCustomizationModal(plato);
        }
      });
    }

    return article;
  }

  /** Actualiza el widget con los datos de clima. */
  function actualizarWidget(clima) {
    const cfg = CLIMAS[clima.condicion] ?? CLIMAS.templado;
    weatherTemp.textContent     = `${clima.temperatura}°C`;
    weatherDesc.textContent     = clima.descripcion ?? cfg.nombre;
    weatherLocation.textContent = `📍 ${clima.ciudad ?? 'Detectando...'}`;
    weatherIcon.textContent     = cfg.icono;
  }

  /** Renderiza el menú principal con todos los platos. */
  function renderMenuPrincipal() {
    grid.innerHTML = '';
    if (!todosLosPlatos.length) {
      grid.innerHTML = '<p style="color:var(--color-text-muted);text-align:center;grid-column:1/-1">No hay platos disponibles.</p>';
      return;
    }
    todosLosPlatos.forEach((p, i) => grid.appendChild(buildCard(p, i, false)));
  }

  /** Renderiza la sección de sugerencias con platos del endpoint /api/menu.php. */
  function renderSugerencias(platosClima) {
    suggestionsGrid.innerHTML = '';

    if (!platosClima.length) {
      suggestionsSection.hidden = true;
      return;
    }

    const cfg = CLIMAS[climaActual.condicion] ?? CLIMAS.templado;
    weatherConditionSpan.innerHTML = `${cfg.nombre} ${cfg.icono}`;
    platosClima.forEach((p, i) => suggestionsGrid.appendChild(buildCard(p, i, true)));
    suggestionsSection.hidden = false;

    // Re-renderiza el menú para actualizar los badges "Ideal hoy"
    renderMenuPrincipal();
  }

  /** Marca el botón activo en el simulador. */
  function actualizarBotonesSimulador() {
    document.querySelectorAll('.weather-sim-btn').forEach(btn => {
      btn.classList.toggle('weather-sim-btn--active', btn.dataset.weather === climaActual.condicion);
    });
  }

  // ── Llamadas a la API ──────────────────────────────────────────────────────

  /** Obtiene el clima real desde /api/clima.php (OpenWeatherMap en el servidor). */
  async function fetchClima() {
    try {
      const res  = await fetch(URL_CLIMA);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      if (json.success && json.data?.[0]) {
        return json.data[0]; // { temperatura, condicion, descripcion, ciudad, fuente }
      }
    } catch (err) {
      console.warn('[Gastro-Clima] /api/clima.php no disponible, usando fallback:', err.message);
    }
    // Fallback cliente: estimación estacional Santiago
    const m = new Date().getMonth();
    if (m >= 11 || m <= 1) return { temperatura: 28, condicion: 'sol',      descripcion: 'Verano (estimado)',      ciudad: 'Santiago, CL' };
    if (m >= 5 && m <= 7)  return { temperatura: 10, condicion: 'frio',     descripcion: 'Invierno (estimado)',    ciudad: 'Santiago, CL' };
    return                         { temperatura: 18, condicion: 'templado', descripcion: 'Templado (estimado)',    ciudad: 'Santiago, CL' };
  }

  /** Obtiene sugerencias del backend para la condición actual. */
  async function fetchMenuClima(condicion, temperatura) {
    try {
      const url  = `${URL_MENU}?clima=${temperatura}&condicion=${condicion}`;
      const res  = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return json.success ? (json.data ?? []).filter(p => p.recomendado_por_clima) : [];
    } catch (err) {
      console.warn('[Gastro-Clima] /api/menu.php no disponible:', err.message);
      // Filtrado local como fallback
      return todosLosPlatos.filter(p => platoCoincidesConClima(p, condicion));
    }
  }

  /** Obtiene todos los platos disponibles desde /api/platos.php. */
  async function fetchTodosLosPlatos() {
    const res  = await fetch(`${URL_PLATOS}?disponible=true`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json.success || !Array.isArray(json.data)) throw new Error('Respuesta inesperada');
    return json.data;
  }

  // ── Simulador manual ───────────────────────────────────────────────────────
  const mockTemp = { sol: 30, frio: 8, lluvia: 12, templado: 19 };

  function initSimulation() {
    document.querySelectorAll('.weather-sim-btn').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.preventDefault();
        const condicion    = btn.dataset.weather;
        const temperatura  = mockTemp[condicion] ?? 18;

        climaActual = { condicion, temperatura, descripcion: `${CLIMAS[condicion]?.nombre} (Simulado)`, ciudad: 'Clima Simulado' };
        actualizarWidget(climaActual);
        actualizarBotonesSimulador();

        const platosClima = await fetchMenuClima(condicion, temperatura);
        renderSugerencias(platosClima);
      });
    });
  }

  // ── Widget minimizar/maximizar ─────────────────────────────────────────────
  function initWidgetToggle() {
    weatherWidgetToggle.addEventListener('click', e => { e.stopPropagation(); toggleWidget(); });
    weatherWidget.addEventListener('click', () => { if (widgetMinimizado) toggleWidget(); });
  }

  function toggleWidget() {
    widgetMinimizado = !widgetMinimizado;

    if (widgetMinimizado) {
      weatherWidget.classList.add('weather-widget--minimized');
      weatherWidgetBody.style.display = 'none';
      weatherWidgetToggle.innerHTML   = '➕';

      if (!document.getElementById('weather-minimized-info')) {
        const cfg    = CLIMAS[climaActual.condicion] ?? CLIMAS.templado;
        const minDiv = document.createElement('div');
        minDiv.id        = 'weather-minimized-info';
        minDiv.className = 'weather-widget__minimized-content';
        minDiv.innerHTML = `
          <span class="weather-widget__minimized-icon">${cfg.icono}</span>
          <span class="weather-widget__minimized-temp">${weatherTemp.textContent}</span>`;
        weatherWidget.querySelector('.weather-widget__header').insertBefore(minDiv, weatherWidgetToggle);
      }
    } else {
      weatherWidget.classList.remove('weather-widget--minimized');
      weatherWidgetBody.style.display = 'block';
      weatherWidgetToggle.innerHTML   = '➖';
      document.getElementById('weather-minimized-info')?.remove();
    }
  }

  // ── Inicialización ─────────────────────────────────────────────────────────
  async function init() {
    try {
      // 1. Cargar todos los platos
      todosLosPlatos = await fetchTodosLosPlatos();
      renderMenuPrincipal();

      // 2. Obtener clima real desde el servidor
      const climaData = await fetchClima();
      climaActual = climaData;
      actualizarWidget(climaData);
      actualizarBotonesSimulador();

      // 3. Cargar sugerencias para el clima detectado
      const platosClima = await fetchMenuClima(climaData.condicion, climaData.temperatura);
      renderSugerencias(platosClima);

    } catch (err) {
      console.error('[Gastro-Sys-Fusion] Error de inicialización:', err);
      if (grid)    grid.innerHTML = '';
      if (errorEl) errorEl.hidden = false;
    }
  }

  initSimulation();
  initWidgetToggle();
  init();
});
