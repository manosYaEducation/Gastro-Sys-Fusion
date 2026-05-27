/**
 * cocina.js
 * Lógica del dashboard de cocina.
 * - Hace polling de pedidos desde la API
 * - También lee pedidos locales del localStorage (gastro_pending_orders)
 *   generados al confirmar pedido en index.html (sin backend)
 */

document.addEventListener('DOMContentLoaded', () => {
    const imgBase = window.API_URL || 'http://localhost/Gastro-Sys-Fusion/';
    const URL_PEDIDOS = `${imgBase}api/pedidos.php`;

    const grid = document.getElementById('orders-grid');
    const loadingState = document.getElementById('loading-state');
    const emptyState = document.getElementById('empty-state');
    const template = document.getElementById('order-card-template');

    let apiOrders = [];

    // ─── Helpers ────────────────────────────────────────────────────────────────

    function getElapsedMinutes(dateString) {
        const safeDateString = dateString.replace(' ', 'T');
        const created = new Date(safeDateString);
        const now = new Date();
        return Math.floor((now - created) / 60000);
    }

    function formatCL(value) {
        return '$' + Number(value).toLocaleString('es-CL');
    }

    // Leer pedidos locales desde localStorage
    function getLocalOrders() {
        try {
            return JSON.parse(localStorage.getItem('gastro_pending_orders') || '[]');
        } catch (e) {
            return [];
        }
    }

    // Eliminar un pedido local por ID
    function removeLocalOrder(id) {
        const orders = getLocalOrders().filter(o => o.id !== id);
        localStorage.setItem('gastro_pending_orders', JSON.stringify(orders));
    }

    // ─── Renderizar Tarjeta ──────────────────────────────────────────────────────

    function createOrderCard(order) {
        const clone = template.content.cloneNode(true);
        const card = clone.querySelector('.order-card');

        // Datos básicos
        const idEl = clone.querySelector('.order-id');
        idEl.textContent = `#${order.id}`;

        // Badge LOCAL para pedidos que vienen del carrito (sin API)
        if (order._local) {
            const badge = document.createElement('span');
            badge.textContent = '📲 MESA';
            badge.style.cssText = `
                display: inline-block;
                background: rgba(212,146,10,0.18);
                border: 1px solid rgba(212,146,10,0.5);
                color: #f0b429;
                font-size: 0.65rem;
                font-weight: 700;
                letter-spacing: 0.08em;
                padding: 2px 8px;
                border-radius: 50px;
                margin-left: 6px;
                vertical-align: middle;
                text-transform: uppercase;
            `;
            idEl.appendChild(badge);
            card.style.borderLeft = '4px solid #d4920a';
        }

        // Estado
        clone.querySelector('.order-status').textContent =
            (order.estado || 'pendiente').replace('_', ' ').toUpperCase();

        // Tiempo
        const mins = getElapsedMinutes(order.creado_en);
        clone.querySelector('.order-time').textContent = `${mins}m`;

        // Color por urgencia
        if (mins >= 15) {
            card.classList.add('status-danger');
        } else if (mins >= 10) {
            card.classList.add('status-warning');
        } else {
            card.classList.add('status-normal');
        }

        // Lista de platos
        const ul = clone.querySelector('.order-items');
        (order.platos || []).forEach(plato => {
            const li = document.createElement('li');

            // Modificadores en sub-lista si existen
            const modsText = (plato.modificadores || [])
                .map(m => {
                    const cleanGroup = (m.grupo || '').replace('_', ' ');
                    const cleanOpt   = (m.opcion_id || '').replace('_', ' ');
                    return `${cleanGroup}: ${cleanOpt}`;
                })
                .join(' · ');

            const notesText = plato.notas
                ? `<span style="display:block;font-size:0.78rem;color:#b5451b;font-style:italic;margin-top:3px;">📝 ${plato.notas}</span>`
                : '';

            const modsHTML = modsText
                ? `<span style="display:block;font-size:0.78rem;color:#888;margin-top:2px;">✦ ${modsText}</span>`
                : '';

            li.innerHTML = `
                <span class="item-qty">${plato.cantidad}x</span>
                <span class="item-name">
                    ${plato.nombre}
                    ${modsHTML}
                    ${notesText}
                </span>
            `;
            ul.appendChild(li);
        });

        // Total (solo pedidos locales)
        if (order._local && order.total) {
            const totalEl = document.createElement('div');
            totalEl.style.cssText = `
                font-size: 0.85rem;
                color: #d4920a;
                font-weight: 700;
                margin-top: 4px;
                padding-top: 8px;
                border-top: 1px dashed rgba(255,255,255,0.08);
                text-align: right;
            `;
            totalEl.textContent = `Total: ${formatCL(order.total)}`;
            ul.after(totalEl);
        }

        // Botón Marcar como Listo
        const btn = clone.querySelector('.btn-ready');

        if (order._local) {
            // Pedido local → eliminar del localStorage
            btn.addEventListener('click', () => {
                btn.textContent = 'Procesando...';
                btn.disabled = true;

                // Animación de salida
                card.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
                card.style.transform = 'scale(0.9)';
                card.style.opacity = '0';

                setTimeout(() => {
                    removeLocalOrder(order.id);
                    renderAll(); // Volver a pintar
                }, 300);
            });
        } else {
            // Pedido API → llamar al endpoint
            btn.addEventListener('click', async () => {
                const originalText = btn.textContent;
                btn.textContent = 'Enviando...';
                btn.disabled = true;

                try {
                    const res = await fetch(URL_PEDIDOS, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'marcar_listo', pedido_id: order.id })
                    });
                    const data = await res.json();

                    if (data.success) {
                        card.style.transform = 'scale(0.9)';
                        card.style.opacity = '0';
                        setTimeout(() => fetchOrders(), 300);
                    } else {
                        alert('Error: ' + data.error);
                        btn.textContent = originalText;
                        btn.disabled = false;
                    }
                } catch (err) {
                    console.error(err);
                    alert('Error de conexión');
                    btn.textContent = originalText;
                    btn.disabled = false;
                }
            });
        }

        return card;
    }

    // ─── Render Principal ────────────────────────────────────────────────────────

    function renderAll() {
        loadingState.hidden = true;
        grid.innerHTML = '';

        // Mezclar: primero pedidos locales (más recientes al frente), luego API
        const localOrders = getLocalOrders();
        const allOrders   = [...localOrders, ...apiOrders];

        if (allOrders.length === 0) {
            emptyState.hidden = false;
        } else {
            emptyState.hidden = true;
            allOrders.forEach(order => {
                grid.appendChild(createOrderCard(order));
            });
        }
    }

    // ─── Fetch API ───────────────────────────────────────────────────────────────

    async function fetchOrders() {
        try {
            const res = await fetch(URL_PEDIDOS);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            if (data.success) {
                apiOrders = data.data || [];
            }
        } catch (err) {
            // Si la API no responde, sólo mostramos los locales
            console.warn('API no disponible, mostrando solo pedidos locales:', err.message);
            apiOrders = [];
        } finally {
            renderAll();
        }
    }

    // ─── Polling y actualización de reloj ───────────────────────────────────────

    fetchOrders();
    setInterval(fetchOrders, 10000);

    // Actualizar minutos en pantalla sin hacer request extra
    setInterval(() => renderAll(), 60000);

    // Escuchar cambios en localStorage desde otras pestañas
    window.addEventListener('storage', (e) => {
        if (e.key === 'gastro_pending_orders') {
            renderAll();
        }
    });
});
