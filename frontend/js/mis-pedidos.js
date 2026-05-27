/**
 * mis-pedidos.js
 * Lógica para traer el historial del cliente (US-H1.5)
 */

document.addEventListener('DOMContentLoaded', () => {
    const API_URL = window.API_URL || 'http://localhost/Gastro-Sys-Fusion/';
    const URL_HISTORIAL = `${API_URL}api/historial_pedidos.php?usuario_id=1`; // Quemado ID 1 temporalmente

    const loadingEl = document.getElementById('loading-history');
    const emptyEl = document.getElementById('empty-history');
    const listEl = document.getElementById('history-list');
    const template = document.getElementById('history-card-template');

    // Función para formatear fechas a algo amigable
    function formatDate(dateStr) {
        const date = new Date(dateStr.replace(' ', 'T'));
        const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        return date.toLocaleDateString('es-ES', options);
    }

    function createHistoryCard(order) {
        const clone = template.content.cloneNode(true);
        const card = clone.querySelector('.history-card');
        
        // Cabecera
        clone.querySelector('.history-card__date').textContent = formatDate(order.creado_en);
        
        const statusSpan = clone.querySelector('.history-card__status');
        statusSpan.textContent = order.estado.replace('_', ' ');
        statusSpan.classList.add(`status-${order.estado}`);

        clone.querySelector('.history-card__total').textContent = `$${parseInt(order.total_pedido).toLocaleString('es-CL')}`;

        // Platos
        const ul = clone.querySelector('.history-card__items');
        order.platos.forEach(plato => {
            const li = document.createElement('li');
            li.className = 'history-item';
            
            const subtotal = plato.cantidad * plato.precio_unit;
            li.innerHTML = `
                <div class="qty-name">
                    <span class="qty">${plato.cantidad}x</span>
                    <span class="name">${plato.nombre}</span>
                </div>
                <div class="price">$${parseInt(subtotal).toLocaleString('es-CL')}</div>
            `;
            ul.appendChild(li);
        });

        // Botón repetir pedido
        const btnRepeat = clone.querySelector('.btn-repeat-order');
        btnRepeat.addEventListener('click', () => {
            // Lógica para repoblar el carrito
            repeatOrder(order.platos);
        });

        return card;
    }

    function repeatOrder(platos) {
        // En una app real de e-commerce, el carrito suele estar en localStorage o Context.
        // Aquí simulamos que lo inyectamos en un array `cart` en localStorage
        // y redirigimos al menú (que es el que lee el carrito, asumiendo que esa lógica existe o existirá).
        
        const cart = [];
        platos.forEach(p => {
            cart.push({
                id: p.plato_id,
                name: p.nombre,
                price: parseInt(p.precio_unit),
                quantity: parseInt(p.cantidad)
            });
        });

        localStorage.setItem('gastro_cart', JSON.stringify(cart));
        
        // Efecto visual
        alert('¡Carrito recuperado! Te redirigiremos al menú.');
        window.location.href = 'menu.html';
    }

    async function fetchHistory() {
        try {
            const res = await fetch(URL_HISTORIAL);
            const data = await res.json();
            
            loadingEl.hidden = true;

            if (data.success) {
                if (data.data.length === 0) {
                    emptyEl.hidden = false;
                } else {
                    data.data.forEach(order => {
                        listEl.appendChild(createHistoryCard(order));
                    });
                }
            } else {
                emptyEl.textContent = "Error al cargar historial: " + data.error;
                emptyEl.hidden = false;
            }
        } catch (error) {
            loadingEl.hidden = true;
            emptyEl.textContent = "Problemas de conexión con el servidor.";
            emptyEl.hidden = false;
            console.error("Error fetching history:", error);
        }
    }

    fetchHistory();
});
