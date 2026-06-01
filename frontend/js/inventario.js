'use strict';

/* ============================================================
   ESTADO
   ============================================================ */
const estado = {
  soloAlerta: false,
  insumos: [],
};

/* ============================================================
   ELEMENTOS DOM
   ============================================================ */
const elems = {
  loading:      document.getElementById('inv-loading'),
  error:        document.getElementById('inv-error'),
  errorMsg:     document.getElementById('inv-error-msg'),
  empty:        document.getElementById('inv-empty'),
  tableWrapper: document.getElementById('inv-table-wrapper'),
  tbody:        document.getElementById('inv-tbody'),

  statTotal:  document.getElementById('stat-total-num'),
  statOk:     document.getElementById('stat-ok-num'),
  statAlerta: document.getElementById('stat-alerta-num'),

  btnFiltro: document.getElementById('btn-filtro-alerta'),
  btnReload: document.getElementById('btn-reload'),
  btnRetry:  document.getElementById('btn-retry'),
};

/* ============================================================
   MOSTRAR / OCULTAR ESTADOS
   ============================================================ */
function mostrarEstado(cual) {
  [elems.loading, elems.error, elems.empty, elems.tableWrapper]
    .forEach(el => (el.style.display = 'none'));

  switch (cual) {
    case 'loading': elems.loading.style.display      = 'flex';  break;
    case 'error':   elems.error.style.display        = 'flex';  break;
    case 'empty':   elems.empty.style.display        = 'flex';  break;
    case 'table':   elems.tableWrapper.style.display = 'block'; break;
  }
}

/* ============================================================
   STATS
   ============================================================ */
function actualizarStats(meta) {
  elems.statTotal.textContent  = meta?.total     ?? '—';
  elems.statOk.textContent     = meta?.ok        ?? '—';
  elems.statAlerta.textContent = meta?.en_alerta ?? '—';
}

/* ============================================================
   TOAST DE FEEDBACK
   ============================================================ */
function mostrarToast(mensaje, tipo = 'ok') {
  document.getElementById('inv-toast')?.remove();

  const toast = document.createElement('div');
  toast.id        = 'inv-toast';
  toast.className = `inv-toast inv-toast--${tipo}`;
  toast.innerHTML = `<span>${tipo === 'ok' ? '✓' : '✕'}</span> ${escHtml(mensaje)}`;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('inv-toast--visible'));

  setTimeout(() => {
    toast.classList.remove('inv-toast--visible');
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

/* ============================================================
   RENDER TABLA
   ============================================================ */
function renderTabla(insumos) {
  elems.tbody.innerHTML = '';

  insumos.forEach((insumo, i) => {
    const enAlerta = insumo.alerta_stock;
    const tr = document.createElement('tr');
    tr.className  = enAlerta ? 'inv-tr inv-tr--alerta' : 'inv-tr';
    tr.dataset.id = insumo.id;

    tr.innerHTML = `
      <td class="inv-td inv-td--id">${String(i + 1).padStart(2, '0')}</td>
      <td class="inv-td inv-td--nombre">${escHtml(insumo.nombre)}</td>
      <td class="inv-td inv-td--center">${escHtml(insumo.unidad_medida)}</td>
      <td class="inv-td inv-td--stock inv-td--center" data-stock-cell="${insumo.id}">
        ${formatNum(insumo.stock_actual)}
      </td>
      <td class="inv-td inv-td--stock inv-td--center">${formatNum(insumo.stock_minimo)}</td>
      <td class="inv-td inv-td--center" data-badge-cell="${insumo.id}">
        ${badgeAlerta(enAlerta)}
      </td>

      <!-- ── COLUMNA AGREGAR ─────────────────────────────── -->
      <td class="inv-td inv-td--center inv-td--accion">
        <div class="inv-accion-group">
          <input
            type="number"
            class="inv-accion-input"
            id="input-add-${insumo.id}"
            min="0.001" step="0.5" value="1"
            aria-label="Cantidad a agregar de ${escHtml(insumo.nombre)}"
          />
          <button
            class="inv-accion-btn inv-accion-btn--add"
            id="btn-add-${insumo.id}"
            data-id="${insumo.id}"
            data-op="add"
            title="Agregar stock"
            aria-label="Agregar stock a ${escHtml(insumo.nombre)}"
          >+</button>
        </div>
      </td>

      <!-- ── COLUMNA REDUCIR ─────────────────────────────── -->
      <td class="inv-td inv-td--center inv-td--accion">
        <div class="inv-accion-group">
          <input
            type="number"
            class="inv-accion-input"
            id="input-sub-${insumo.id}"
            min="0.001" step="0.5" value="1"
            aria-label="Cantidad a reducir de ${escHtml(insumo.nombre)}"
          />
          <button
            class="inv-accion-btn inv-accion-btn--sub"
            id="btn-sub-${insumo.id}"
            data-id="${insumo.id}"
            data-op="sub"
            title="Reducir stock"
            aria-label="Reducir stock de ${escHtml(insumo.nombre)}"
          >−</button>
        </div>
      </td>
    `;

    elems.tbody.appendChild(tr);
  });

  // Delegación de eventos en el tbody
  elems.tbody.addEventListener('click', onAccionClick);
}

/* ============================================================
   ACCIÓN: AJUSTAR STOCK (PATCH /api/inventario.php)
   ============================================================ */
async function onAccionClick(e) {
  const btn = e.target.closest('.inv-accion-btn');
  if (!btn) return;

  const insumoId = parseInt(btn.dataset.id, 10);
  const op       = btn.dataset.op; // 'add' | 'sub'
  const inputEl  = document.getElementById(`input-${op}-${insumoId}`);
  const cantidad = parseFloat(inputEl?.value);

  if (!cantidad || cantidad <= 0) {
    mostrarToast('Ingresa una cantidad mayor a 0.', 'error');
    return;
  }

  const delta = op === 'add' ? cantidad : -cantidad;

  // Deshabilitar botón mientras procesa
  btn.disabled      = true;
  btn.textContent   = '…';
  btn.style.opacity = '0.5';

  try {
    const resp = await fetch(window.API.inventario, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ insumo_id: insumoId, delta }),
    });

    const json = await resp.json();
    if (!json.success) throw new Error(json.error ?? 'Error al ajustar stock');

    const d = json.data;

    // Actualizar celda de stock en tiempo real
    const stockCell = document.querySelector(`[data-stock-cell="${insumoId}"]`);
    const badgeCell = document.querySelector(`[data-badge-cell="${insumoId}"]`);
    const fila      = stockCell?.closest('tr');

    if (stockCell) stockCell.textContent = formatNum(d.stock_actual);

    if (fila) {
      const insumoLocal = estado.insumos.find(i => i.id === insumoId);
      if (insumoLocal) {
        insumoLocal.stock_actual = d.stock_actual;
        const enAlerta = d.stock_actual <= insumoLocal.stock_minimo;
        fila.className = enAlerta ? 'inv-tr inv-tr--alerta' : 'inv-tr';
        if (badgeCell) badgeCell.innerHTML = badgeAlerta(enAlerta);
      }
    }

    // Toast de confirmación
    const accion = op === 'add' ? 'agregó' : 'redujo';
    let msg = `"${d.nombre}": stock ${accion} ${d.stock_anterior} → ${d.stock_actual}`;
    if (d.platos_afectados?.length > 0) {
      msg += `. Platos afectados: ${d.platos_afectados.map(p => p.nombre).join(', ')}`;
    }
    mostrarToast(msg, 'ok');

    // Recargar stats
    cargarInsumos();

  } catch (err) {
    mostrarToast(err.message, 'error');
  } finally {
    btn.disabled      = false;
    btn.textContent   = op === 'add' ? '+' : '−';
    btn.style.opacity = '';
  }
}

/* ============================================================
   HELPERS
   ============================================================ */
function badgeAlerta(enAlerta) {
  return enAlerta
    ? `<span class="inv-badge inv-badge--alerta">⚠️ Stock bajo</span>`
    : `<span class="inv-badge inv-badge--ok">✓ OK</span>`;
}

function formatNum(valor) {
  return Number(valor).toLocaleString('es-CL');
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ============================================================
   FETCH PRINCIPAL
   ============================================================ */
async function cargarInsumos() {
  mostrarEstado('loading');

  const url = window.API.inventario +
    (estado.soloAlerta ? '?alerta=stock_minimo' : '');

  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const json = await resp.json();
    if (!json.success) throw new Error(json.error ?? 'Error en API');

    estado.insumos = json.data ?? [];
    actualizarStats(json.meta);

    if (estado.insumos.length === 0) {
      mostrarEstado('empty');
      return;
    }

    renderTabla(estado.insumos);
    mostrarEstado('table');

  } catch (err) {
    elems.errorMsg.textContent = err.message;
    mostrarEstado('error');
  }
}

/* ============================================================
   EVENTOS
   ============================================================ */
elems.btnFiltro.addEventListener('click', () => {
  estado.soloAlerta = !estado.soloAlerta;
  elems.btnFiltro.classList.toggle('inv-btn-filtro--active', estado.soloAlerta);
  elems.btnFiltro.setAttribute('aria-pressed', estado.soloAlerta);

  const textSpan = elems.btnFiltro.querySelector('.inv-btn-filtro__text');
  const icon     = elems.btnFiltro.querySelector('.inv-btn-filtro__icon');
  if (textSpan && icon) {
    textSpan.textContent = estado.soloAlerta ? ' Mostrando solo alertas' : ' Ver solo en alerta';
    icon.textContent     = estado.soloAlerta ? '✕' : '⚠️';
  }
  cargarInsumos();
});

elems.btnReload.addEventListener('click', cargarInsumos);
elems.btnRetry.addEventListener('click', cargarInsumos);

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', cargarInsumos);