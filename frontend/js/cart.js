/**
 * cart.js
 * Gastro-Carrito — Widget flotante de carrito de compras.
 * - Renderiza ítems desde localStorage (gastro_cart)
 * - Al confirmar, guarda el pedido en gastro_pending_orders para cocina.html
 * - Escucha el evento custom 'cart-updated' que dispara modal.js
 */

document.addEventListener('DOMContentLoaded', () => {
  /* ── Referencias DOM ─────────────────────────────────────── */
  const cartWidget      = document.getElementById('cart-widget');
  const cartToggle      = document.getElementById('cart-widget-toggle');
  const cartBadge       = document.getElementById('cart-badge-count');
  const cartSidebar     = document.getElementById('cart-sidebar');
  const cartClose       = document.getElementById('cart-sidebar-close');
  const cartOverlay     = document.getElementById('cart-sidebar-overlay');
  const cartBody        = document.getElementById('cart-sidebar-body');
  const cartTotalPrice  = document.getElementById('cart-total-price');
  const cartCheckoutBtn = document.getElementById('cart-checkout-btn');
  const cartClearBtn    = document.getElementById('cart-clear-btn');
  const cartFooter      = document.getElementById('cart-sidebar-footer');

  // Overlay de éxito
  const successOverlay  = document.getElementById('cart-success-overlay');
  const successIcon     = document.getElementById('cart-success-icon');
  const successTitle    = document.getElementById('cart-success-title');
  const successDesc     = document.getElementById('cart-success-desc');
  const successProgress = document.getElementById('cart-success-progress');

  /* ── Helpers ─────────────────────────────────────────────── */
  const formatCL = v => '$' + Number(v).toLocaleString('es-CL');

  const getCart = () => JSON.parse(localStorage.getItem('gastro_cart') || '[]');
  const setCart = cart => localStorage.setItem('gastro_cart', JSON.stringify(cart));

  /* ── Renderizar carrito ──────────────────────────────────── */
  function renderCart() {
    const cart = getCart();
    const count = cart.length;

    // Badge
    cartBadge.textContent = count;
    cartBadge.classList.toggle('cart-widget__badge--visible', count > 0);

    cartBody.innerHTML = '';

    if (count === 0) {
      cartBody.innerHTML = `
        <div class="cart-empty">
          <span class="cart-empty__icon">🛒</span>
          <p>Tu carrito está vacío</p>
          <span style="font-size:0.8rem;color:var(--color-text-muted)">
            ¡Agrega deliciosos platos gourmet desde nuestro menú destacado!
          </span>
        </div>`;
      cartFooter.style.display = 'none';
      return;
    }

    cartFooter.style.display = 'flex';
    let totalSum = 0;

    cart.forEach((item, index) => {
      totalSum += item.precio_total;

      // Modificadores
      let modsHTML = '';
      if (item.modificadores?.length) {
        modsHTML = '<ul class="cart-item-row__mods">' +
          item.modificadores.map(m => {
            const extra = m.precio_extra > 0 ? ` (+${formatCL(m.precio_extra)})` : '';
            return `<li>✦ ${m.grupo}: ${m.opcion_id}${extra}</li>`;
          }).join('') +
        '</ul>';
      }

      const notesHTML = item.notas
        ? `<p class="cart-item-row__notes">📝 "${item.notas}"</p>`
        : '';

      const row = document.createElement('div');
      row.className = 'cart-item-row';
      row.innerHTML = `
        <div class="cart-item-row__main">
          <span class="cart-item-row__title">${item.nombre}</span>
          <span class="cart-item-row__price">${formatCL(item.precio_total)}</span>
        </div>
        ${modsHTML}
        ${notesHTML}
        <div class="cart-item-row__footer">
          <button class="cart-item-row__remove-btn" data-index="${index}">🗑️ Eliminar</button>
        </div>`;

      row.querySelector('.cart-item-row__remove-btn').addEventListener('click', e => {
        removeCartItem(parseInt(e.currentTarget.dataset.index, 10));
      });

      cartBody.appendChild(row);
    });

    cartTotalPrice.textContent = formatCL(totalSum);
  }

  /* ── Acciones sobre el carrito ───────────────────────────── */
  function removeCartItem(index) {
    const cart = getCart();
    cart.splice(index, 1);
    setCart(cart);
    renderCart();
  }

  function clearCart() {
    localStorage.removeItem('gastro_cart');
    renderCart();
  }

  /* ── Sidebar ─────────────────────────────────────────────── */
  function toggleSidebar(open) {
    cartSidebar.classList.toggle('cart-sidebar--open', open);
    cartOverlay.classList.toggle('cart-sidebar__overlay--open', open);
    if (open) renderCart();
  }

  /* ── Checkout ────────────────────────────────────────────── */
  function showSuccess(icon, title, desc, progress) {
    successIcon.textContent = icon;
    successTitle.textContent = title;
    successDesc.textContent = desc;
    successProgress.style.width = progress;
  }

  cartCheckoutBtn.addEventListener('click', () => {
    // Guardar pedido en localStorage ANTES de limpiar el carrito
    const cartSnapshot = getCart();
    if (cartSnapshot.length > 0) {
      try {
        const pendingOrders = JSON.parse(localStorage.getItem('gastro_pending_orders') || '[]');
        pendingOrders.push({
          id:         'LOCAL-' + Date.now(),
          estado:     'pendiente',
          creado_en:  new Date().toISOString(),
          platos:     cartSnapshot.map(item => ({
            nombre:       item.nombre,
            cantidad:     1,
            precio_total: item.precio_total,
            modificadores: item.modificadores || [],
            notas:        item.notas || ''
          })),
          total:  cartSnapshot.reduce((s, i) => s + i.precio_total, 0),
          _local: true
        });
        localStorage.setItem('gastro_pending_orders', JSON.stringify(pendingOrders));
      } catch (e) {
        console.error('Error al guardar pedido pendiente:', e);
      }
    }

    // Animación de confirmación paso a paso
    successOverlay.classList.add('cart-success-overlay--visible');
    successIcon.style.animation = 'pulseCartEmpty 1s infinite alternate';

    showSuccess('🍳', 'Enviando a cocina...', 'Preparando la conexión segura con los fogones...', '30%');

    setTimeout(() =>
      showSuccess('🔥', 'Pedido Recibido', '¡Nuestros chefs acaban de aceptar tu pedido!', '70%'),
    1200);

    setTimeout(() => {
      successIcon.style.animation = 'none';
      showSuccess('✅', '¡Pedido en marcha!', 'Tu plato gourmet se está preparando. ¡Buen provecho!', '100%');
    }, 2600);

    setTimeout(() => {
      clearCart();
      successOverlay.classList.remove('cart-success-overlay--visible');
      toggleSidebar(false);
      setTimeout(() => { successProgress.style.width = '0%'; }, 400);
    }, 4500);
  });

  /* ── Eventos ─────────────────────────────────────────────── */
  cartToggle.addEventListener('click',  () => toggleSidebar(true));
  cartClose.addEventListener('click',   () => toggleSidebar(false));
  cartOverlay.addEventListener('click', () => toggleSidebar(false));
  cartClearBtn.addEventListener('click', clearCart);

  // modal.js dispara 'cart-updated' al agregar un plato
  window.addEventListener('cart-updated', () => {
    renderCart();
    cartWidget.classList.add('cart-widget--bounce');
    setTimeout(() => cartWidget.classList.remove('cart-widget--bounce'), 400);
  });

  /* ── Init ────────────────────────────────────────────────── */
  renderCart();
});
