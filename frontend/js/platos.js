/**
 * platos.js
 * Fetches dishes from the DB via get_platos.php and renders the cards dynamically.
 * Integrated with an interactive Weather Suggestion System (Open-Meteo API + Simulation).
 *
 * Esquema de BD actual:
 *   - tabla: cat_platos / cat_categorias
 *   - campo imagen: imagen_url
 *   - campo clima:  clima_recomendar (valores: 'frio', 'calido', 'lluvioso', 'templado', 'todos')
 *   - campos temp:  temp_min_recomendar, temp_max_recomendar
 */

document.addEventListener('DOMContentLoaded', () => {
  const grid  = document.getElementById('dishes-grid');
  const error = document.getElementById('dishes-error');

  // Weather elements
  const weatherWidget      = document.getElementById('weather-widget');
  const weatherWidgetBody  = document.getElementById('weather-widget-body');
  const weatherWidgetToggle = document.getElementById('weather-widget-toggle');
  const weatherIcon        = document.getElementById('weather-icon');
  const weatherTemp        = document.getElementById('weather-temp');
  const weatherDesc        = document.getElementById('weather-desc');
  const weatherLocation    = document.getElementById('weather-location');
  const suggestionsSection = document.getElementById('weather-suggestions-section');
  const suggestionsGrid    = document.getElementById('weather-suggestions-grid');
  const weatherConditionSpan = document.getElementById('weather-condition-span');

  const apiBase = window.API_URL_PHP || 'http://localhost/Gastro-Sys-Fusion/backend/';
  const imgBase = window.API_URL    || 'http://localhost/Gastro-Sys-Fusion/';

  let todosLosPlatos = [];
  let climaActual    = 'templado';
  let widgetMinimizado = false;

  // Configuración de climas
  const CLIMAS = {
    calido: {
      nombre: 'Soleado y Cálido',
      icono:  '☀️',
      claseBadge: '',
    },
    frio: {
      nombre: 'Frío e Invernal',
      icono:  '❄️',
      claseBadge: '',
    },
    lluvioso: {
      nombre: 'Lluvioso o Húmedo',
      icono:  '🌧️',
      claseBadge: '',
    },
    templado: {
      nombre: 'Templado y Agradable',
      icono:  '⛅',
      claseBadge: 'dish-card__weather-badge--neutral',
    }
  };

  /** Formatea número como peso chileno: 16900 → "$16.900" */
  function formatPrecio(valor) {
    return '$' + Number(valor).toLocaleString('es-CL');
  }

  /**
   * Verifica si un plato coincide con el clima actual.
   * Usa el campo clima_recomendar del nuevo esquema.
   */
  function matchesWeather(plato, weatherTag) {
    const campo = plato.clima_recomendar;
    if (!campo) return false;
    const tags = campo.split(',').map(t => t.trim().toLowerCase());
    return tags.includes(weatherTag) || tags.includes('todos');
  }

  /**
   * Construye una tarjeta de plato desde el objeto plato.
   * Compatible con el nuevo esquema (imagen_url, clima_recomendar).
   */
  function buildCard(plato, index, isSuggestion = false) {
    // Nuevo campo: imagen_url (antes: imagen)
    const imgSrc = plato.imagen_url
      ? `${imgBase}assets/img/${plato.imagen_url}`
      : `${imgBase}assets/img/placeholder.png`;

    const badge = plato.destacado == 1 ? 'Destacado' : (plato.categoria ?? 'Plato');

    // Badge "Ideal hoy" en tarjetas del menú principal (no en sugerencias)
    let weatherBadgeHTML = '';
    if (!isSuggestion && matchesWeather(plato, climaActual)) {
      const tags      = (plato.clima_recomendar || '').split(',').map(t => t.trim().toLowerCase());
      const matchedTag = tags.includes(climaActual) ? climaActual : tags[0];
      const cfg       = CLIMAS[matchedTag] || CLIMAS.templado;
      weatherBadgeHTML = `
        <div class="dish-card__weather-badge ${cfg.claseBadge}" title="Recomendado para clima ${cfg.nombre}">
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
        <img
          class="dish-card__img"
          src="${imgSrc}"
          alt="${plato.nombre}"
          width="480" height="240"
          loading="eager"
          onerror="this.src='${imgBase}assets/img/placeholder.png'"
        />
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
      </div>
    `;
    return article;
  }

  /** Renderiza menú principal + sección de sugerencias según clima actual. */
  function renderAll() {
    // Menú principal
    grid.innerHTML = '';
    if (todosLosPlatos.length === 0) {
      grid.innerHTML = '<p style="color:var(--color-text-muted);text-align:center;grid-column:1/-1">No hay platos disponibles por el momento.</p>';
    } else {
      todosLosPlatos.forEach((p, i) => grid.appendChild(buildCard(p, i, false)));
    }

    // Sección de sugerencias
    suggestionsGrid.innerHTML = '';
    const sugeridos = todosLosPlatos.filter(p => matchesWeather(p, climaActual));

    if (sugeridos.length > 0) {
      const cfg = CLIMAS[climaActual];
      weatherConditionSpan.innerHTML = `${cfg.nombre} ${cfg.icono}`;
      sugeridos.forEach((p, i) => suggestionsGrid.appendChild(buildCard(p, i, true)));
      suggestionsSection.hidden = false;
    } else {
      suggestionsSection.hidden = true;
    }

    // Botón activo en simulador
    document.querySelectorAll('.weather-sim-btn').forEach(btn => {
      btn.classList.toggle('weather-sim-btn--active', btn.dataset.weather === climaActual);
    });
  }

  /**
   * Mapea temperatura real + WMO weathercode a uno de nuestros climas.
   * Prioridad: lluvia > frío > cálido > templado
   */
  function mapToClima(temp, wmoCode) {
    if (wmoCode >= 51 && wmoCode <= 99) return 'lluvioso'; // lluvia/nieve/tormenta
    if (temp < 15)  return 'frio';
    if (temp >= 22) return 'calido';
    return 'templado';
  }

  /** Obtiene clima real desde Open-Meteo y actualiza la UI. */
  async function fetchRealWeather(lat, lon, cityName = 'Tu ubicación') {
    try {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`
      );
      if (!res.ok) throw new Error('Open-Meteo API error');

      const data    = await res.json();
      const cw      = data.current_weather;
      const temp    = Math.round(cw.temperature);
      const detected = mapToClima(temp, cw.weathercode);

      climaActual = detected;
      weatherTemp.textContent     = `${temp}°C`;
      weatherDesc.textContent     = CLIMAS[detected].nombre;
      weatherLocation.textContent = `📍 ${cityName}`;
      weatherIcon.textContent     = CLIMAS[detected].icono;

      renderAll();
    } catch (err) {
      console.warn('[Gastro-Sys-Fusion] Clima real no disponible, usando fallback:', err);
      useFallbackWeather();
    }
  }

  /** Fallback estacional basado en hemisferio sur (Chile). */
  function useFallbackWeather() {
    const month = new Date().getMonth(); // 0-11
    let temp, clima;

    if (month >= 11 || month <= 1) { clima = 'calido';   temp = 28; } // Dic-Feb → Verano
    else if (month >= 5 && month <= 7) { clima = 'frio'; temp = 10; } // Jun-Ago → Invierno
    else { clima = 'templado'; temp = 18; }                            // Primavera/Otoño

    climaActual                 = clima;
    weatherTemp.textContent     = `${temp}°C`;
    weatherDesc.textContent     = CLIMAS[clima].nombre;
    weatherLocation.textContent = '📍 Santiago, CL (estimado)';
    weatherIcon.textContent     = CLIMAS[clima].icono;

    renderAll();
  }

  /** Detecta ubicación y consulta Open-Meteo; usa Santiago como fallback. */
  function detectLocationAndWeather() {
    if (!navigator.geolocation) { useFallbackWeather(); return; }

    navigator.geolocation.getCurrentPosition(
      pos => fetchRealWeather(pos.coords.latitude, pos.coords.longitude, 'Tu ubicación'),
      ()  => fetchRealWeather(-33.4489, -70.6693, 'Santiago, CL'),
      { timeout: 5000 }
    );
  }

  /** Inicializa botones del simulador de clima. */
  function initSimulation() {
    const mockTemps = { calido: '30°C', frio: '8°C', lluvioso: '12°C', templado: '19°C' };

    document.querySelectorAll('.weather-sim-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        const sim = btn.dataset.weather;
        climaActual = sim;

        weatherTemp.textContent     = mockTemps[sim];
        weatherDesc.textContent     = `${CLIMAS[sim].nombre} (Simulado)`;
        weatherIcon.textContent     = CLIMAS[sim].icono;
        weatherLocation.textContent = '📍 Clima Simulado';

        renderAll();
      });
    });
  }

  /** Minimizar / maximizar widget. */
  function initWidgetToggle() {
    weatherWidgetToggle.addEventListener('click', e => {
      e.stopPropagation();
      toggleWidget();
    });
    weatherWidget.addEventListener('click', () => {
      if (widgetMinimizado) toggleWidget();
    });
  }

  function toggleWidget() {
    widgetMinimizado = !widgetMinimizado;

    if (widgetMinimizado) {
      weatherWidget.classList.add('weather-widget--minimized');
      weatherWidgetBody.style.display = 'none';
      weatherWidgetToggle.innerHTML   = '➕';

      if (!document.getElementById('weather-minimized-info')) {
        const minDiv = document.createElement('div');
        minDiv.id        = 'weather-minimized-info';
        minDiv.className = 'weather-widget__minimized-content';
        minDiv.innerHTML = `
          <span class="weather-widget__minimized-icon">${CLIMAS[climaActual].icono}</span>
          <span class="weather-widget__minimized-temp">${weatherTemp.textContent}</span>`;
        weatherWidget.querySelector('.weather-widget__header')
          .insertBefore(minDiv, weatherWidgetToggle);
      }
    } else {
      weatherWidget.classList.remove('weather-widget--minimized');
      weatherWidgetBody.style.display = 'block';
      weatherWidgetToggle.innerHTML   = '➖';
      document.getElementById('weather-minimized-info')?.remove();
    }
  }

  /** Punto de entrada principal: carga platos y arranca detección de clima. */
  async function cargarPlatos() {
    try {
      const res  = await fetch(`${apiBase}get_platos.php?destacados=1`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = await res.json();
      if (!json.success || !Array.isArray(json.data)) {
        throw new Error('Respuesta inesperada de la API');
      }

      todosLosPlatos = json.data;
      detectLocationAndWeather();

    } catch (err) {
      console.error('[Gastro-Sys-Fusion] Error al cargar platos:', err);
      if (grid)  grid.innerHTML = '';
      if (error) error.hidden   = false;
    }
  }

  // Inicializar
  initSimulation();
  initWidgetToggle();
  cargarPlatos();
});
