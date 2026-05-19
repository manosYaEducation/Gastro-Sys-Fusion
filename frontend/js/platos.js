/**
 * platos.js
 * Fetches dishes from the DB via get_platos.php and renders the cards dynamically.
 */

document.addEventListener('DOMContentLoaded', () => {
  const grid  = document.getElementById('dishes-grid');
  const error = document.getElementById('dishes-error');

  const apiBase = window.API_URL_PHP || 'http://localhost/Gastro-Sys-Fusion/backend/';
  const imgBase = window.API_URL    || 'http://localhost/Gastro-Sys-Fusion/';

  /**
   * Formats a number as Chilean peso: 16900 → "$16.900"
   */
  function formatPrecio(valor) {
    return '$' + Number(valor).toLocaleString('es-CL');
  }

  /**
   * Builds a dish card DOM element from a plato object.
   */
  function buildCard(plato, index) {
    const imgSrc = plato.imagen
      ? `${imgBase}assets/img/${plato.imagen}`
      : `${imgBase}assets/img/placeholder.png`;

    const badge = plato.destacado == 1 ? 'Destacado' : plato.categoria ?? 'Plato';

    const article = document.createElement('article');
    article.className = 'dish-card';
    article.setAttribute('role', 'listitem');
    article.setAttribute('id', `card-plato-${plato.id}`);
    article.setAttribute('tabindex', '0');
    article.setAttribute('aria-label', plato.nombre);
    article.style.animationDelay = `${0.3 + index * 0.15}s`;

    article.innerHTML = `
      <div class="dish-card__img-wrapper">
        <img
          class="dish-card__img"
          src="${imgSrc}"
          alt="${plato.nombre}"
          width="480"
          height="240"
          loading="eager"
          onerror="this.src='${imgBase}assets/img/placeholder.png'"
        />
        <div class="dish-card__overlay" aria-hidden="true"></div>
        <span class="dish-card__badge">${badge}</span>
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

        <button class="dish-card__btn" id="btn-pedir-${plato.id}" type="button">
          Agregar al pedido
        </button>
      </div>
    `;

    return article;
  }

  /**
   * Main fetch & render function.
   */
  async function cargarPlatos() {
    try {
      const res = await fetch(`${apiBase}get_platos.php?destacados=1`);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = await res.json();

      if (!json.success || !Array.isArray(json.data)) {
        throw new Error('Respuesta inesperada de la API');
      }

      // Clear skeleton
      grid.innerHTML = '';

      if (json.data.length === 0) {
        grid.innerHTML = '<p style="color:var(--color-text-muted);text-align:center;grid-column:1/-1">No hay platos disponibles por el momento.</p>';
        return;
      }

      json.data.forEach((plato, i) => {
        grid.appendChild(buildCard(plato, i));
      });

    } catch (err) {
      console.error('[Gastro-Sys-Fusion] Error al cargar platos:', err);
      grid.innerHTML = '';
      if (error) error.hidden = false;
    }
  }

  cargarPlatos();
});
