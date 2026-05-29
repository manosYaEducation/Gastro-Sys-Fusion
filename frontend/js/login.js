/**
 * login.js
 * Lógica del formulario de inicio de sesión de Gastro-Sys-Fusion.
 * Maneja: selección de rol, envío de credenciales, redirección por perfil.
 */

(function () {
  'use strict';

  // ── Elementos del DOM ──
  const form          = document.getElementById('login-form');
  const emailInput    = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  const submitBtn     = document.getElementById('login-btn');
  const togglePwdBtn  = document.getElementById('toggle-password');
  const roleCards     = document.querySelectorAll('.login-role-card');
  const devHintContent = document.getElementById('dev-hint-content');

  // ── Credenciales de prueba por rol ──
  const DEV_CREDENTIALS = {
    cliente:       { email: 'cliente@gastro.cl',  password: 'cliente123'  },
    jefe_cocina:   { email: 'chef@gastro.cl',     password: 'cocina123'   },
    administrador: { email: 'admin@gastro.cl',    password: 'admin123'    },
    gerente:       { email: 'gerente@gastro.cl',  password: 'gerente123'  },
  };

  // ── Redirección por rol ──
  const ROLE_REDIRECTS = {
    cliente:       '../index.html',
    jefe_cocina:   'cocina.html',
    administrador: 'inventario.html',
    gerente:       '../index.html',
  };

  // ── Nombres legibles de los roles ──
  const ROLE_NAMES = {
    cliente:       'Cliente',
    jefe_cocina:   'Jefe de Cocina',
    administrador: 'Administrador',
    gerente:       'Gerente',
  };

  // ── Toast ──
  const toast     = document.getElementById('login-toast');
  const toastIcon = document.getElementById('login-toast-icon');
  const toastMsg  = document.getElementById('login-toast-msg');
  let toastTimer  = null;

  function showToast(message, type = 'error') {
    clearTimeout(toastTimer);
    toast.className = 'login-toast login-toast--' + type;
    toastIcon.textContent = type === 'error' ? '⚠️' : '✅';
    toastMsg.textContent  = message;
    requestAnimationFrame(() => toast.classList.add('show'));
    toastTimer = setTimeout(() => toast.classList.remove('show'), 4000);
  }

  // ══════════════════════════════════════════
  // SELECCIÓN DE ROL (visual + auto-fill)
  // ══════════════════════════════════════════
  roleCards.forEach(card => {
    card.addEventListener('click', () => selectRole(card));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectRole(card);
      }
    });
  });

  function selectRole(card) {
    const role = card.dataset.role;

    // UI: activar tarjeta
    roleCards.forEach(c => {
      c.classList.remove('active');
      c.setAttribute('aria-checked', 'false');
    });
    card.classList.add('active');
    card.setAttribute('aria-checked', 'true');

    // Auto-llenar credenciales de prueba
    const creds = DEV_CREDENTIALS[role];
    if (creds) {
      emailInput.value    = creds.email;
      passwordInput.value = creds.password;

      devHintContent.innerHTML =
        `<strong>${ROLE_NAMES[role]}:</strong> ` +
        `<code>${creds.email}</code> / <code>${creds.password}</code>`;
    }

    emailInput.focus();
  }

  // ══════════════════════════════════════════
  // TOGGLE VISIBILIDAD CONTRASEÑA
  // ══════════════════════════════════════════
  togglePwdBtn.addEventListener('click', () => {
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';
    togglePwdBtn.textContent = isPassword ? '🙈' : '👁️';
    togglePwdBtn.title = isPassword ? 'Ocultar contraseña' : 'Mostrar contraseña';
  });

  // ══════════════════════════════════════════
  // ENVÍO DEL FORMULARIO
  // ══════════════════════════════════════════
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email    = emailInput.value.trim();
    const password = passwordInput.value;

    // Validación básica
    if (!email || !password) {
      showToast('Ingresa tu correo y contraseña.');
      return;
    }

    // UI: loading
    submitBtn.classList.add('login-btn--loading');
    submitBtn.disabled = true;

    try {
      const res = await fetch(window.API.auth, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', email, password }),
      });

      const json = await res.json();

      if (!json.success) {
        showToast(json.error || 'Error al iniciar sesión.');
        submitBtn.classList.remove('login-btn--loading');
        submitBtn.disabled = false;
        return;
      }

      // Guardar datos del usuario en sessionStorage para uso del frontend
      const userData = Array.isArray(json.data) ? json.data[0] : json.data;
      sessionStorage.setItem('gastro_usuario', JSON.stringify(userData));

      showToast(`¡Bienvenido, ${userData.nombre}!`, 'success');

      // Redireccionar según rol después de un breve delay visual
      const redirect = ROLE_REDIRECTS[userData.rol] || '../index.html';
      setTimeout(() => {
        window.location.href = redirect;
      }, 800);

    } catch (err) {
      console.error('Login error:', err);
      showToast('Error de conexión. Verifica que el servidor esté activo.');
      submitBtn.classList.remove('login-btn--loading');
      submitBtn.disabled = false;
    }
  });

  // ══════════════════════════════════════════
  // CHECK: Si ya hay sesión, redirigir
  // ══════════════════════════════════════════
  (async function checkExistingSession() {
    try {
      const res = await fetch(window.API.auth + '?action=check');
      const json = await res.json();
      if (json.success) {
        const userData = Array.isArray(json.data) ? json.data[0] : json.data;
        sessionStorage.setItem('gastro_usuario', JSON.stringify(userData));
        const redirect = ROLE_REDIRECTS[userData.rol] || '../index.html';
        window.location.href = redirect;
      }
    } catch (_) {
      // No hay sesión, mostrar login normalmente
    }
  })();

  // ══════════════════════════════════════════
  // Si viene con ?error=sin_permiso
  // ══════════════════════════════════════════
  const params = new URLSearchParams(window.location.search);
  if (params.get('error') === 'sin_permiso') {
    showToast('No tienes permiso para acceder a esa sección.');
  }

})();
