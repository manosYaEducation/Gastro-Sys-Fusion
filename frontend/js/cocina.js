/**
 * cocina.js
 * Lógica del dashboard de cocina. Hace polling de pedidos y actualiza estados.
 */

document.addEventListener('DOMContentLoaded', () => {
    const API = window.API || {};
    const imgBase = window.API_URL || 'http://localhost/Gastro-Sys-Fusion/';
    const URL_PEDIDOS = `${imgBase}api/pedidos.php`;

    const grid = document.getElementById('orders-grid');
    const loadingState = document.getElementById('loading-state');
    const emptyState = document.getElementById('empty-state');
    const template = document.getElementById('order-card-template');

    let orders = [];

    // Calcular minutos transcurridos
    function getElapsedMinutes(dateString) {
        // Asume ISO o formato de base de datos
        // Aseguramos parseo correcto reemplazando espacio por T si es necesario (ej: "2026-05-26 15:30:00")
        const safeDateString = dateString.replace(' ', 'T'); 
        const created = new Date(safeDateString);
        const now = new Date();
        const diffMs = now - created;
        return Math.floor(diffMs / 60000);
    }

    // Renderizar un pedido individual
    function createOrderCard(order) {
        const clone = template.content.cloneNode(true);
        const card = clone.querySelector('.order-card');
        
        // Datos básicos
        clone.querySelector('.order-id').textContent = `#${order.id}`;
        clone.querySelector('.order-status').textContent = order.estado.replace('_', ' ');
        
        // Calcular tiempo
        const mins = getElapsedMinutes(order.creado_en);
        clone.querySelector('.order-time').textContent = `${mins}m`;

        // Colores de estado basados en el tiempo (umbral: 10m normal, 15m warning, >15m danger)
        if (mins >= 15) {
            card.classList.add('status-danger');
        } else if (mins >= 10) {
            card.classList.add('status-warning');
        } else {
            card.classList.add('status-normal');
        }

        // Lista de platos
        const ul = clone.querySelector('.order-items');
        order.platos.forEach(plato => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span class="item-qty">${plato.cantidad}x</span>
                <span class="item-name">${plato.nombre}</span>
            `;
            ul.appendChild(li);
        });

        // Botón Listo
        const btn = clone.querySelector('.btn-ready');
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
                    // Remover visualmente con animación
                    card.style.transform = 'scale(0.9)';
                    card.style.opacity = '0';
                    setTimeout(() => {
                        fetchOrders(); // Refrescar grilla real
                    }, 300);
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

        return card;
    }

    // Traer datos de API
    async function fetchOrders() {
        try {
            const res = await fetch(URL_PEDIDOS);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            
            if (data.success) {
                orders = data.data || [];
                renderOrders();
            }
        } catch (err) {
            console.error('Error fetching orders:', err);
        }
    }

    // Renderizar grilla
    function renderOrders() {
        loadingState.hidden = true;
        grid.innerHTML = '';

        if (orders.length === 0) {
            emptyState.hidden = false;
        } else {
            emptyState.hidden = true;
            orders.forEach(order => {
                grid.appendChild(createOrderCard(order));
            });
        }
    }

    // Inicializar y configurar polling
    fetchOrders();
    setInterval(fetchOrders, 10000); // Polling cada 10s
    
    // Timer local para actualizar los minutos en pantalla sin hacer request
    setInterval(() => {
        if (orders.length > 0) renderOrders();
    }, 60000); // Actualizar reloj visual cada 1 minuto
});
