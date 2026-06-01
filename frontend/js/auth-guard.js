/**
 * auth-guard.js
 * Guard de autenticación para páginas protegidas de Gastro-Sys-Fusion.
 *
 * Uso en el HTML protegido (ANTES de otros scripts):
 *   <script>window.__ROLES_PERMITIDOS = ['jefe_cocina','administrador','gerente'];</script>
 *   <script src="js/config.js"></script>
 *   <script src="js/auth-guard.js"></script>
 *
 * Expone:  window.USUARIO  (objeto con id, nombre, email, rol)
 */

(function () {
  'use strict';

  const ROLES_PERMITIDOS = window.__ROLES_PERMITIDOS || [];

  // Nombres legibles de los roles
  const ROLE_DISPLAY = {
    cliente:       'Cliente',
    jefe_cocina:   'Jefe de Cocina',
    administrador: 'Administrador',
    gerente:       'Gerente',
  };

  /**
   * Determina la URL del login relativa a la página actual.
   */
  function loginUrl(params) {
    const path = window.location.pathname;
    // Si estamos en /frontend/xxx.html → login.html
    // Si estamos en /index.html o raíz → frontend/login.html
    const base = path.includes('/frontend/') ? 'login.html' : 'frontend/login.html';
    return params ? base + '?' + params : base;
  }

  /**
   * Verifica la sesión contra el backend y protege la página.
   */
  async function guardarSesion() {
    try {
      const res  = await fetch(window.API.auth + '?action=check', {
        credentials: 'include',
      });
      const json = await res.json();

      if (!json.success) {
        // No hay sesión
        sessionStorage.removeItem('gastro_usuario');
        
        // Si es una página protegida (no pública), redirigir al login
        if (!window.__PAGINA_PUBLICA) {
          window.location.href = loginUrl();
          return;
        }

        // Si es pública, actualizar navbar para modo anónimo
        actualizarNavbar(null);
        return;
      }

      const user = Array.isArray(json.data) ? json.data[0] : json.data;

      // Verificar rol si hay restricción
      if (ROLES_PERMITIDOS.length > 0 && !ROLES_PERMITIDOS.includes(user.rol)) {
        // Rol no autorizado
        window.location.href = loginUrl('error=sin_permiso');
        return;
      }

      // Guardar usuario globalmente
      window.USUARIO = user;
      sessionStorage.setItem('gastro_usuario', JSON.stringify(user));

      // Actualizar el navbar si existe
      actualizarNavbar(user);

    } catch (err) {
      console.error('[auth-guard] Error verificando sesión:', err);
      if (!window.__PAGINA_PUBLICA) {
        window.location.href = loginUrl();
      } else {
        actualizarNavbar(null);
      }
    }
  }

  /**
   * Actualiza el navbar para mostrar el usuario logueado o el botón de iniciar sesión.
   */
  function actualizarNavbar(user) {
    // Roles definidos una sola vez para evitar re-declaración (fix SyntaxError strict mode)
    const rolesInternos = ['jefe_cocina', 'administrador', 'gerente'];
    const rolesMermas   = ['administrador', 'gerente'];

    // Buscar conmutador central y mostrarlo/ocultarlo según rol
    const switcher = document.getElementById('navbar-center-switcher');
    if (switcher) {
      if (user && rolesInternos.includes(user.rol)) {
        switcher.style.display = 'flex';
      } else {
        switcher.style.display = 'none';
      }
    }

    const nav = document.querySelector('.navbar__nav');
    if (!nav) return;

    // Buscar y ocultar/mostrar enlaces según rol
    const enlacesCocina     = nav.querySelector('a[href*="cocina"]');
    const enlacesInventario = nav.querySelector('a[href*="inventario"]');
    const enlacesMermas     = nav.querySelector('a[href*="mermas"]');

    if (!user) {
      // Si no está logueado, ocultar todas las opciones administrativas
      if (enlacesCocina) enlacesCocina.parentElement.style.display = 'none';
      if (enlacesInventario) enlacesInventario.parentElement.style.display = 'none';
      if (enlacesMermas) enlacesMermas.parentElement.style.display = 'none';

      // Asegurar que exista el botón "Iniciar Sesión"
      let loginLink = nav.querySelector('a[href*="login"]') || nav.querySelector('#nav-reservar-link') || nav.querySelector('#nav-login-link');
      if (loginLink) {
        loginLink.textContent = 'Iniciar Sesión';
        loginLink.setAttribute('href', loginUrl());
        loginLink.style.display = 'inline-block';
        
        // Si había un widget de usuario antes, limpiarlo y restaurar el link original
        const li = loginLink.parentElement;
        const userWidget = li.querySelector('.navbar__user');
        if (userWidget) {
          li.innerHTML = '';
          const a = document.createElement('a');
          a.href = loginUrl();
          a.className = 'navbar__cta';
          a.id = 'nav-login-link';
          a.textContent = 'Iniciar Sesión';
          li.appendChild(a);
        }
      }
      return;
    }

    // Si está logueado:
    if (enlacesCocina) {
      enlacesCocina.parentElement.style.display = rolesInternos.includes(user.rol) ? 'block' : 'none';
    }
    if (enlacesInventario) {
      enlacesInventario.parentElement.style.display = rolesInternos.includes(user.rol) ? 'block' : 'none';
    }
    if (enlacesMermas) {
      enlacesMermas.parentElement.style.display = rolesMermas.includes(user.rol) ? 'block' : 'none';
    }

    // Reemplazar enlace "Reservar" / login por info del usuario
    const loginLink = nav.querySelector('a[href*="login"]') || nav.querySelector('#nav-reservar-link') || nav.querySelector('#nav-login-link');
    if (loginLink) {
      const li = loginLink.parentElement;
      li.innerHTML = '';

      const userWidget = document.createElement('div');
      userWidget.className = 'navbar__user';
      userWidget.innerHTML = `
        <div class="navbar__user-info">
          <span class="navbar__user-name">${user.nombre}</span>
          <span class="navbar__user-role">${ROLE_DISPLAY[user.rol] || user.rol}</span>
        </div>
        <button class="navbar__logout-btn" id="navbar-logout-btn" title="Cerrar sesión">
          Salir
        </button>
      `;
      li.appendChild(userWidget);

      // Evento de logout
      document.getElementById('navbar-logout-btn').addEventListener('click', cerrarSesion);
    }
  }

  /**
   * Cierra la sesión del usuario.
   */
  async function cerrarSesion() {
    try {
      await fetch(window.API.auth, {
        method: 'POST',
        credentials: 'include',          // <-- envía la cookie de sesión PHP
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' }),
      });
    } catch (_) {
      // Ignorar errores de red al cerrar sesión
    }
    sessionStorage.removeItem('gastro_usuario');
    window.location.href = loginUrl();
  }

  // Exponer logout globalmente
  window.cerrarSesion = cerrarSesion;

  // Ejecutar la verificación
  guardarSesion();

})();
