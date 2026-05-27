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
  loading: document.getElementById('inv-loading'),
  error: document.getElementById('inv-error'),
  errorMsg: document.getElementById('inv-error-msg'),
  empty: document.getElementById('inv-empty'),
  tableWrapper: document.getElementById('inv-table-wrapper'),
  tbody: document.getElementById('inv-tbody'),

  statTotal: document.getElementById('stat-total-num'),
  statOk: document.getElementById('stat-ok-num'),
  statAlerta: document.getElementById('stat-alerta-num'),

  btnFiltro: document.getElementById('btn-filtro-alerta'),
  btnReload: document.getElementById('btn-reload'),
  btnRetry: document.getElementById('btn-retry'),
};

/* ============================================================
   MOSTRAR / OCULTAR ESTADOS
   ============================================================ */
function mostrarEstado(cual) {
  const todos = [
    elems.loading,
    elems.error,
    elems.empty,
    elems.tableWrapper
  ];

  // ocultar TODO primero
  todos.forEach(el => {
    el.style.display = 'none';
  });

  // mostrar solo el activo
  switch (cual) {
    case 'loading':
      elems.loading.style.display = 'flex';
      break;

    case 'error':
      elems.error.style.display = 'flex';
      break;

    case 'empty':
      elems.empty.style.display = 'flex';
      break;

    case 'table':
      elems.tableWrapper.style.display = 'block';
      break;
  }
}

/* ============================================================
   STATS
   ============================================================ */
function actualizarStats(meta) {
  elems.statTotal.textContent = meta?.total ?? '—';
  elems.statOk.textContent = meta?.ok ?? '—';
  elems.statAlerta.textContent = meta?.en_alerta ?? '—';
}

/* ============================================================
   RENDER TABLA (compatible con CSS)
   ============================================================ */
function renderTabla(insumos) {
  elems.tbody.innerHTML = '';

  insumos.forEach((insumo, i) => {
    const enAlerta = insumo.alerta_stock;

    const tr = document.createElement('tr');
    tr.className = enAlerta ? 'inv-tr inv-tr--alerta' : 'inv-tr';

    tr.innerHTML = `
      <td class="inv-td inv-td--id">${String(i + 1).padStart(2, '0')}</td>
      <td class="inv-td inv-td--nombre">${escHtml(insumo.nombre)}</td>
      <td class="inv-td inv-td--center">${escHtml(insumo.unidad_medida)}</td>
      <td class="inv-td inv-td--stock inv-td--center">${formatNum(insumo.stock_actual)}</td>
      <td class="inv-td inv-td--stock inv-td--center">${formatNum(insumo.stock_minimo)}</td>
      <td class="inv-td inv-td--center">
        ${enAlerta ? badgeAlerta(true) : badgeAlerta(false)}
      </td>
    `;

    elems.tbody.appendChild(tr);
  });
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
   FETCH
   ============================================================ */
async function cargarInsumos() {
  mostrarEstado('loading');

  const url = window.API.inventario +
    (estado.soloAlerta ? '?alerta=stock_minimo' : '');

  try {
    const resp = await fetch(url);

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }

    const json = await resp.json();

    /* FIX CRÍTICO */
    if (!json.success) {
      throw new Error(json.error ?? 'Error en API');
    }

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

  /* FIX seguro para HTML nuevo */
  const textSpan = elems.btnFiltro.querySelector('.inv-btn-filtro__text');
  const icon = elems.btnFiltro.querySelector('.inv-btn-filtro__icon');

  if (textSpan && icon) {
    textSpan.textContent = estado.soloAlerta
      ? ' Mostrando solo alertas'
      : ' Ver solo en alerta';

    icon.textContent = estado.soloAlerta ? '✕' : '⚠️';
  }

  cargarInsumos();
});

elems.btnReload.addEventListener('click', cargarInsumos);
elems.btnRetry.addEventListener('click', cargarInsumos);

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', cargarInsumos);