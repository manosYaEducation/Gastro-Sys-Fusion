/**
 * mis-pedidos.js — T1.6 / US-1.5  (v1.1.0)
 * Historial de Pedidos del Cliente.
 *
 * La página ya es protegida (rol: cliente).
 * auth-guard.js garantiza que window.USUARIO existe antes de que
 * este módulo necesite los datos. Cargamos el historial de forma
 * automática — sin formulario de identificación.
 */

document.addEventListener('DOMContentLoaded', () => {

  /* ── Config ────────────────────────────────────────────────── */
  const BASE         = window.API || {};
  const URL_CLIENTES = BASE.clientes || 'http://localhost/Gastro-Sys-Fusion/api/clientes.php';

  /* ── DOM refs ───────────────────────────────────────────────── */
  const profileBar     = document.getElementById('mp-profile-bar');
  const profileName    = document.getElementById('mp-profile-name');
  const profileContact = document.getElementById('mp-profile-contact');
  const profileTotal   = document.getElementById('mp-profile-total');
  const profileGasto   = document.getElementById('mp-profile-gasto');
  const btnLogout      = document.getElementById('mp-btn-logout');
  const heroSubtitle   = document.getElementById('mp-hero-subtitle');

  const ordersContainer = document.getElementById('mp-orders-container');
  const sectionCount    = document.getElementById('mp-section-count');

  const reorderToast     = document.getElementById('mp-reorder-toast');
  const reorderToastText = document.getElementById('mp-reorder-toast-text');
  const reorderToastCta  = document.getElementById('mp-reorder-toast-cta');

  /* ── Estado ─────────────────────────────────────────────────── */
  let toastTimer = null;

  /* ── Helpers ─────────────────────────────────────────────────── */
  const formatCLP = v => '$' + Number(v).toLocaleString('es-CL');

  function formatFecha(isoStr) {
    const d = new Date(isoStr);
    return d.toLocaleDateString('es-CL', {
      weekday: 'long', year: 'numeric',
      month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  function getStatusLabel(estado) {
    const map = {
      pendiente:      { label: 'Pendiente',  cls: 'pendiente',   icon: '⏳' },
      en_preparacion: { label: 'En cocina',  cls: 'preparacion', icon: '🔥' },
      servido:        { label: 'Entregado',  cls: 'servido',     icon: '✅' },
      cancelado:      { label: 'Cancelado',  cls: 'cancelado',   icon: '❌' },
    };
    return map[estado] || { label: estado, cls: 'pendiente', icon: '•' };
  }

  function showHistoryError(msg) {
    ordersContainer.innerHTML = `
      <div class="mp-state">
        <div class="mp-state__icon">⚠️</div>
        <p class="mp-state__title">Algo salió mal</p>
        <p>${msg}</p>
      </div>`;
  }

  /* ── Perfil del cliente ──────────────────────────────────────── */
  function mostrarPerfil(cliente, pedidos) {
    profileName.textContent    = cliente.nombre || 'Cliente';
    profileContact.textContent = [cliente.email, cliente.telefono].filter(Boolean).join(' · ');
    profileTotal.textContent   = pedidos.length;
    profileGasto.textContent   = formatCLP(pedidos.reduce((s, p) => s + Number(p.total_pedido), 0));
    profileBar.classList.add('mp-profile-bar--visible');

    heroSubtitle.textContent = `Bienvenido, ${cliente.nombre?.split(' ')[0] || 'Cliente'} — aquí están tus pedidos anteriores.`;
  }

  /* ── Cargar historial ────────────────────────────────────────── */
  async function cargarHistorial(clienteId) {
    ordersContainer.innerHTML = `
      <div class="mp-state">
        <div class="mp-spinner"></div>
        <p>Cargando historial…</p>
      </div>`;

    try {
      const res  = await fetch(`${URL_CLIENTES}?id=${clienteId}&historial=1`);
      const json = await res.json();

      if (!json.success) { showHistoryError('No se pudo cargar tu historial.'); return; }

      const { cliente, pedidos } = json.data;
      mostrarPerfil(cliente, pedidos);
      renderHistorial(pedidos);

    } catch (err) {
      console.error('[mis-pedidos] historial:', err);
      showHistoryError('Error de conexión con el servidor.');
    }
  }

  /* ── Auto-identificación desde sesión PHP ────────────────────── */
  async function autoIdentificarYCargar(usuario) {
    if (!usuario || usuario.rol !== 'cliente' || !usuario.email) return;

    try {
      const res  = await fetch(URL_CLIENTES, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          action: 'upsert',
          email:  usuario.email,
          nombre: usuario.nombre || '',
        }),
      });
      const json = await res.json();

      if (!json.success) { showHistoryError('No se pudo verificar tu cuenta.'); return; }

      await cargarHistorial(json.data.id);

    } catch (err) {
      console.error('[mis-pedidos] auto-identify:', err);
      showHistoryError('Error de conexión. Verifica que el servidor esté activo.');
    }
  }

  /* ── Renderizar historial ────────────────────────────────────── */
  function renderHistorial(pedidos) {
    sectionCount.textContent = `${pedidos.length} pedido${pedidos.length !== 1 ? 's' : ''}`;
    ordersContainer.innerHTML = '';

    if (pedidos.length === 0) {
      ordersContainer.innerHTML = `
        <div class="mp-state">
          <div class="mp-state__icon">🍽️</div>
          <p class="mp-state__title">Sin pedidos aún</p>
          <p>¡Haz tu primer pedido y aparecerá aquí!</p>
          <a href="../index.html#menu" class="mp-btn-reorder" style="margin-top:0.5rem;text-decoration:none">
            🛒 Ver Menú
          </a>
        </div>`;
      return;
    }

    const list = document.createElement('div');
    list.className = 'mp-orders-list';
    pedidos.forEach((pedido, idx) => list.appendChild(buildOrderCard(pedido, idx)));
    ordersContainer.appendChild(list);
  }

  function buildOrderCard(pedido, index) {
    const card   = document.createElement('div');
    card.className = 'mp-order-card';
    card.style.animationDelay = `${index * 0.07}s`;

    const status  = getStatusLabel(pedido.estado);
    const preview = (pedido.items || [])
      .slice(0, 3).map(i => i.plato_nombre).join(', ')
      + (pedido.items?.length > 3 ? ` +${pedido.items.length - 3} más` : '');

    const itemsHTML = (pedido.items || []).map(item => `
      <div class="mp-order-item">
        <span class="mp-order-item__name">${item.plato_nombre}</span>
        <span class="mp-order-item__qty">×${item.cantidad}</span>
        <span class="mp-order-item__price">${formatCLP(item.subtotal)}</span>
      </div>`).join('');

    card.innerHTML = `
      <div class="mp-order-card__head">
        <span class="mp-order-card__num">#${String(index + 1).padStart(2, '0')}</span>
        <div class="mp-order-card__meta">
          <div class="mp-order-card__date">
            <span class="mp-status-badge mp-status-badge--${status.cls}">
              ${status.icon} ${status.label}
            </span>
            <span style="margin-left:0.6rem;font-size:0.82rem;color:var(--color-text-muted)">
              ${formatFecha(pedido.creado_en)}
            </span>
          </div>
          <div class="mp-order-card__items-preview">${preview || 'Sin ítems'}</div>
        </div>
        <span class="mp-order-card__total">${formatCLP(pedido.total_pedido)}</span>
        <span class="mp-order-card__chevron" aria-hidden="true">▾</span>
      </div>

      <div class="mp-order-card__detail">
        <div class="mp-order-items">
          ${itemsHTML || '<p style="color:var(--color-text-muted);font-size:0.85rem">Sin detalle disponible</p>'}
        </div>
        <div class="mp-order-detail__footer">
          <div>
            <div class="mp-order-detail__total-label">Total pagado</div>
            <div class="mp-order-detail__total-value">${formatCLP(pedido.total_pedido)}</div>
          </div>
          <button
            class="mp-btn-reorder"
            data-pedido-id="${pedido.id}"
            ${!pedido.items?.length ? 'disabled' : ''}
          >
            🔁 Pedir nuevamente
          </button>
        </div>
      </div>`;

    // Acordeón
    card.querySelector('.mp-order-card__head').addEventListener('click', () => {
      card.classList.toggle('mp-order-card--open');
    });

    // Pedir nuevamente
    const btn = card.querySelector('.mp-btn-reorder[data-pedido-id]');
    if (btn) btn.addEventListener('click', e => { e.stopPropagation(); pedirNuevamente(pedido, btn); });

    return card;
  }

  /* ── Pedir nuevamente ────────────────────────────────────────── */
  function pedirNuevamente(pedido, btn) {
    if (!pedido.items?.length) return;

    btn.classList.add('mp-btn-reorder--loading');
    btn.textContent = '⏳ Preparando…';

    const cartItems = pedido.items.map(item => ({
      id:            item.plato_id,
      plato_id:      item.plato_id,
      nombre:        item.plato_nombre,
      precio_unit:   Number(item.precio_unit),
      precio_total:  Number(item.precio_unit) * Number(item.cantidad),
      cantidad:      Number(item.cantidad),
      categoria:     item.categoria || '',
      imagen_url:    item.imagen_url || null,
      modificadores: [],
      notas:         '',
      _from_history: true,
    }));

    try {
      const existing = JSON.parse(localStorage.getItem('gastro_cart') || '[]');
      localStorage.setItem('gastro_cart', JSON.stringify([...existing, ...cartItems]));
      window.dispatchEvent(new CustomEvent('cart-updated'));
    } catch (err) {
      console.error('[mis-pedidos] repoblar carrito:', err);
    }

    setTimeout(() => {
      btn.classList.remove('mp-btn-reorder--loading');
      btn.innerHTML = '✅ Agregado';
      mostrarToast(pedido.items.length);
      setTimeout(() => { btn.innerHTML = '🔁 Pedir nuevamente'; }, 3000);
    }, 500);
  }

  function mostrarToast(n) {
    if (toastTimer) clearTimeout(toastTimer);
    reorderToastText.textContent = `${n} plato${n !== 1 ? 's' : ''} agregado${n !== 1 ? 's' : ''} al carrito`;
    reorderToastCta.href = '../index.html';
    reorderToast.classList.add('mp-reorder-toast--visible');
    toastTimer = setTimeout(() => reorderToast.classList.remove('mp-reorder-toast--visible'), 5000);
  }

  /* ── Salir — cierra sesión PHP completa ──────────────────────── */
  btnLogout.addEventListener('click', () => {
    if (typeof window.cerrarSesion === 'function') {
      window.cerrarSesion();
    } else {
      sessionStorage.clear();
      window.location.href = 'login.html';
    }
  });

  /* ── Init ────────────────────────────────────────────────────── */
  function init() {
    // Intento 1: sessionStorage ya tiene gastro_usuario (navegación normal)
    try {
      const raw = sessionStorage.getItem('gastro_usuario');
      if (raw) {
        const u = JSON.parse(raw);
        if (u?.rol === 'cliente' && u?.email) {
          autoIdentificarYCargar(u);
          return;
        }
      }
    } catch (_) { /* continúa */ }

    // Intento 2: esperar que auth-guard complete su fetch
    // (primer acceso frío — sessionStorage vacío)
    window.addEventListener('gastro:auth-ready', e => {
      autoIdentificarYCargar(e.detail?.user || null);
    }, { once: true });
  }

  init();
});
