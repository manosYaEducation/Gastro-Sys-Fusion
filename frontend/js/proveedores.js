/**
 * proveedores.js — T2.4 / US-2.4
 * CRUD de proveedores, asociación insumo→proveedor y órdenes de compra.
 */

/* ============================================================
   Config
   ============================================================ */
const API_PRV = window.API?.proveedores ?? '/Gastro-Sys-Fusion/api/proveedores.php';
const API_INV = window.API?.inventario  ?? '/Gastro-Sys-Fusion/api/inventario.php';

/* ============================================================
   Estado global
   ============================================================ */
let proveedores = [];   // cache lista proveedores
let insumos     = [];   // cache lista insumos

/* ============================================================
   Helpers
   ============================================================ */
const $ = (id) => document.getElementById(id);

function fmt(n) {
  return new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function showToast(elId, msg, tipo = 'ok') {
  const el = $(elId);
  if (!el) return;
  el.textContent = (tipo === 'ok' ? '✅ ' : '❌ ') + msg;
  el.className = `prv-toast prv-toast--${tipo}`;
  el.hidden = false;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.hidden = true; }, 3500);
}

async function apiFetch(url, opts = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  const json = await res.json();
  if (json.success === false) {
    throw new Error(json.error || `HTTP ${res.status}`);
  }
  // La API estándar siempre devuelve { success, data, meta }
  return json.data !== undefined ? json.data : json;
}

/* ============================================================
   Cargar insumos (para selects)
   ============================================================ */
async function cargarInsumos() {
  try {
    const data = await apiFetch(API_INV);
    // La API de inventario devuelve un array directamente en data
    insumos = Array.isArray(data) ? data : [];

    // Select en modal proveedor
    const selPrincipal = $('prv-insumo-principal');
    selPrincipal.innerHTML = '<option value="">— Sin asignar —</option>';
    insumos.forEach(i => {
      const opt = document.createElement('option');
      opt.value = i.id;
      opt.textContent = `${i.nombre} (${i.unidad_medida ?? '—'})`;
      selPrincipal.appendChild(opt);
    });

    // Select en modal orden
    const selOrdInsumo = $('ord-insumo');
    selOrdInsumo.innerHTML = '<option value="">— Selecciona —</option>';
    insumos.forEach(i => {
      const opt = document.createElement('option');
      opt.value = i.id;
      opt.textContent = `${i.nombre} (${i.unidad_medida ?? '—'})`;
      selOrdInsumo.appendChild(opt);
    });

  } catch (e) {
    console.warn('No se pudieron cargar insumos:', e.message);
  }
}

/* ============================================================
   PROVEEDORES — Listar
   ============================================================ */

/** Muestra solo uno de los estados de la tabla */
function setTableState(state) {
  const loading = document.getElementById('prv-table-loading');
  const empty   = document.getElementById('prv-table-empty');
  const wrap    = document.getElementById('prv-table-wrap');

  loading.style.display = state === 'loading' ? 'flex'  : 'none';
  empty.style.display   = state === 'empty'   ? 'flex'  : 'none';
  wrap.style.display    = state === 'data'    ? 'block' : 'none';

  loading.hidden = state !== 'loading';
  empty.hidden   = state !== 'empty';
  wrap.hidden    = state !== 'data';
}

async function cargarProveedores() {
  setTableState('loading');
  let data;
  try {
    data = await apiFetch(API_PRV);
  } catch (e) {
    console.error('[cargarProveedores] Error de API:', e);
    setTableState('empty');
    showToast('prv-toast-global', 'Error: ' + e.message, 'err');
    return;
  }
  proveedores = Array.isArray(data) ? data : [];
  renderTablaProveedores(proveedores);
  actualizarStats();
  poblarSelectProveedores();
}

function actualizarStats() {
  $('stat-total-proveedores').textContent = proveedores.length;
  const totalOrd   = proveedores.reduce((s, p) => s + (p.total_ordenes ?? 0), 0);
  const montoTotal = proveedores.reduce((s, p) => s + (p.monto_total   ?? 0), 0);
  $('stat-total-ordenes').textContent = totalOrd;
  $('stat-monto-total').textContent   = 'S/ ' + fmt(montoTotal);
}

function poblarSelectProveedores() {
  const selFiltro = $('filtro-proveedor');
  const selOrden  = $('ord-proveedor');

  [selFiltro, selOrden].forEach(sel => {
    const def = sel.options[0].cloneNode(true);
    sel.innerHTML = '';
    sel.appendChild(def);
    proveedores.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.nombre;
      sel.appendChild(opt);
    });
  });
}

function renderTablaProveedores(lista) {
  console.log('[render] lista.length =', lista.length);
  if (!lista.length) {
    setTableState('empty');
    return;
  }
  try {
    document.getElementById('prv-tbody').innerHTML = lista.map(p => {
      const nombre   = String(p.nombre   ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
      const contacto = String(p.contacto ?? '—').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
      const telefono = String(p.telefono ?? '—').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
      const email    = String(p.email    ?? '—').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
      const ordenes  = Number(p.total_ordenes ?? 0);
      const monto    = Number(p.monto_total   ?? 0);

      // Chips de insumos asociados
      const nombres = Array.isArray(p.insumos_nombres) ? p.insumos_nombres : [];
      const insumosHtml = nombres.length
        ? nombres.map(n => `<span class="prv-insumo-chip">${String(n).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</span>`).join('')
        : `<span class="prv-insumo-chip prv-insumo-chip--empty">Sin asignar</span>`;

      return `
        <tr class="prv-tr" data-id="${p.id}">
          <td class="prv-td prv-td--muted">${p.id}</td>
          <td class="prv-td prv-td--nombre">${nombre}</td>
          <td class="prv-td prv-td--muted">${contacto}</td>
          <td class="prv-td prv-td--muted">${telefono}</td>
          <td class="prv-td prv-td--muted">${email}</td>
          <td class="prv-td"><div class="prv-insumos-chips">${insumosHtml}</div></td>
          <td class="prv-td prv-td--center"><span class="prv-badge prv-badge--purple">${ordenes}</span></td>
          <td class="prv-td prv-td--right" style="color:var(--prv-amber-lt);font-weight:600">S/ ${fmt(monto)}</td>
          <td class="prv-td">
            <div class="prv-actions">
              <button class="prv-btn-icon prv-btn-icon--edit" data-action="edit" data-id="${p.id}" title="Editar">✏️</button>
              <button class="prv-btn-icon prv-btn-icon--del"  data-action="del"  data-id="${p.id}" title="Eliminar">🗑️</button>
            </div>
          </td>
        </tr>`;
    }).join('');
  } catch(err) {
    console.error('[render] Error al generar filas:', err);
  }
  console.log('[render] llamando setTableState(data)');
  setTableState('data');
}

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ============================================================
   MODAL Proveedor — Abrir / Cerrar
   ============================================================ */
function abrirModalProveedor(prov = null) {
  $('modal-prv-title').textContent    = prov ? 'Editar Proveedor' : 'Nuevo Proveedor';
  $('modal-prv-save-text').textContent = prov ? 'Guardar cambios' : 'Guardar';
  $('prv-id').value        = prov?.id ?? '';
  $('prv-nombre').value    = prov?.nombre    ?? '';
  $('prv-contacto').value  = prov?.contacto  ?? '';
  $('prv-telefono').value  = prov?.telefono  ?? '';
  $('prv-email').value     = prov?.email     ?? '';
  $('prv-ruc').value       = prov?.ruc       ?? '';
  $('prv-direccion').value = prov?.direccion ?? '';

  // Pre-seleccionar el PRIMER insumo asociado (si existe)
  const primerInsumoId = (prov?.insumos_ids && prov.insumos_ids.length)
    ? prov.insumos_ids[0]
    : '';
  $('prv-insumo-principal').value = primerInsumoId;

  $('prv-toast-modal').hidden = true;
  limpiarHints();
  $('modal-proveedor').hidden = false;
  $('prv-nombre').focus();
}

function cerrarModalProveedor() {
  $('modal-proveedor').hidden = true;
}

function limpiarHints() {
  ['prv-nombre-hint'].forEach(id => { $(id).textContent = ''; });
}

/* ============================================================
   MODAL Proveedor — Submit
   ============================================================ */
$('form-proveedor').addEventListener('submit', async (e) => {
  e.preventDefault();
  limpiarHints();

  const nombre = $('prv-nombre').value.trim();
  if (!nombre) {
    $('prv-nombre-hint').textContent = 'El nombre es obligatorio.';
    $('prv-nombre').focus();
    return;
  }

  const id = $('prv-id').value;
  const insumoId = $('prv-insumo-principal').value;   // puede ser ''
  const body = {
    id:         id ? parseInt(id) : undefined,
    nombre,
    contacto:   $('prv-contacto').value.trim(),
    telefono:   $('prv-telefono').value.trim(),
    email:      $('prv-email').value.trim(),
    direccion:  $('prv-direccion').value.trim(),
    ruc:        $('prv-ruc').value.trim(),
    // Enviar insumo_id para que la API persista la asociación
    insumo_id:  insumoId ? parseInt(insumoId) : undefined,
  };

  const btn = $('modal-prv-save');
  btn.disabled = true;

  try {
    if (id) {
      await apiFetch(API_PRV, { method: 'PUT', body: JSON.stringify(body) });
    } else {
      await apiFetch(API_PRV, { method: 'POST', body: JSON.stringify(body) });
    }

    showToast('prv-toast-modal', id ? 'Proveedor actualizado.' : 'Proveedor creado.', 'ok');
    setTimeout(() => {
      cerrarModalProveedor();
      cargarProveedores();
    }, 900);
  } catch (err) {
    showToast('prv-toast-modal', err.message, 'err');
  } finally {
    btn.disabled = false;
  }
});

/* ============================================================
   Eliminar proveedor
   ============================================================ */
async function eliminarProveedor(id) {
  const prov = proveedores.find(p => p.id === id);
  if (!prov) return;
  if (!confirm(`¿Eliminar al proveedor "${prov.nombre}"?\nEsta acción no se puede deshacer.`)) return;

  try {
    await apiFetch(`${API_PRV}?id=${id}`, { method: 'DELETE' });
    showToast('prv-toast-global', 'Proveedor eliminado.', 'ok');
    cargarProveedores();
  } catch (err) {
    showToast('prv-toast-global', err.message, 'err');
  }
}

/* ============================================================
   Delegación de eventos en tabla proveedores
   ============================================================ */
$('prv-tbody').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const id   = parseInt(btn.dataset.id);
  const prov = proveedores.find(p => p.id === id);

  if (btn.dataset.action === 'edit') abrirModalProveedor(prov);
  if (btn.dataset.action === 'del')  eliminarProveedor(id);
});

/* ============================================================
   ÓRDENES DE COMPRA — Listar
   ============================================================ */
async function cargarOrdenes(proveedorId = '') {
  $('ord-loading').hidden = false;
  $('ord-table-wrap').hidden = true;
  $('ord-empty').hidden = true;

  let url = `${API_PRV}?ordenes=1&limit=50`;
  if (proveedorId) url += `&proveedor_id=${proveedorId}`;

  try {
    const data = await apiFetch(url);
    const lista = Array.isArray(data) ? data : [];
    renderTablaOrdenes(lista);
  } catch (e) {
    $('ord-loading').hidden = true;
    $('ord-empty').hidden = false;
    showToast('prv-toast-ord', 'Error: ' + e.message, 'err');
  }
}

function renderTablaOrdenes(lista) {
  $('ord-loading').hidden = true;

  if (!lista.length) {
    $('ord-empty').hidden = false;
    return;
  }

  $('ord-tbody').innerHTML = lista.map(o => `
    <tr class="prv-tr">
      <td class="prv-td prv-td--muted">${o.id}</td>
      <td class="prv-td prv-td--nombre">${escHtml(o.proveedor)}</td>
      <td class="prv-td">${escHtml(o.insumo)} <small style="color:var(--color-text-muted)">(${escHtml(o.unidad)})</small></td>
      <td class="prv-td prv-td--center">
        <span class="prv-badge prv-badge--amber">${o.fecha}</span>
      </td>
      <td class="prv-td prv-td--center">${fmt(o.cantidad)}</td>
      <td class="prv-td prv-td--precio">S/ ${fmt(o.precio_unitario)}</td>
      <td class="prv-td prv-td--total">S/ ${fmt(o.total)}</td>
      <td class="prv-td">
        <div class="prv-actions">
          <button class="prv-btn-icon prv-btn-icon--del"
                  data-ord-del="${o.id}" title="Eliminar orden" aria-label="Eliminar orden #${o.id}">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');

  $('ord-table-wrap').hidden = false;
}

/* Eliminar orden */
$('ord-tbody').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-ord-del]');
  if (!btn) return;
  const id = parseInt(btn.dataset.ordDel);
  if (!confirm(`¿Eliminar la orden #${id}?`)) return;
  try {
    await apiFetch(`${API_PRV}?orden_id=${id}`, { method: 'DELETE' });
    showToast('prv-toast-ord', 'Orden eliminada.', 'ok');
    cargarOrdenes($('filtro-proveedor').value);
  } catch (err) {
    showToast('prv-toast-ord', err.message, 'err');
  }
});

/* Filtro */
$('filtro-proveedor').addEventListener('change', () => {
  cargarOrdenes($('filtro-proveedor').value);
});

/* ============================================================
   MODAL Orden — Abrir / Cerrar
   ============================================================ */
function abrirModalOrden() {
  $('ord-proveedor').value    = '';
  $('ord-insumo').value       = '';
  $('ord-fecha').value        = new Date().toISOString().split('T')[0];
  $('ord-cantidad').value     = '';
  $('ord-precio').value       = '';
  $('ord-total-display').textContent = 'S/ 0.00';
  $('ord-observaciones').value = '';
  ['ord-proveedor-hint','ord-cantidad-hint','ord-precio-hint','ord-insumo-hint','ord-fecha-hint']
    .forEach(id => { $(id).textContent = ''; });
  $('prv-toast-ord-modal').hidden = true;
  $('modal-orden').hidden = false;
  $('ord-proveedor').focus();
}

function cerrarModalOrden() {
  $('modal-orden').hidden = true;
}

/* Cálculo de total en tiempo real */
['ord-cantidad', 'ord-precio'].forEach(id => {
  $(id).addEventListener('input', () => {
    const q = parseFloat($('ord-cantidad').value) || 0;
    const p = parseFloat($('ord-precio').value)   || 0;
    $('ord-total-display').textContent = 'S/ ' + fmt(q * p);
  });
});

/* Submit orden */
$('form-orden').addEventListener('submit', async (e) => {
  e.preventDefault();

  const proveedorId = parseInt($('ord-proveedor').value);
  const insumoId    = parseInt($('ord-insumo').value);
  const fecha       = $('ord-fecha').value;
  const cantidad    = parseFloat($('ord-cantidad').value);
  const precio      = parseFloat($('ord-precio').value);

  let valid = true;
  if (!proveedorId) { $('ord-proveedor-hint').textContent = 'Requerido.'; valid = false; }
  if (!insumoId)    { $('ord-insumo-hint').textContent    = 'Requerido.'; valid = false; }
  if (!(cantidad > 0)) { $('ord-cantidad-hint').textContent = 'Debe ser > 0.'; valid = false; }
  if (precio < 0)   { $('ord-precio-hint').textContent    = 'No puede ser negativo.'; valid = false; }
  
  if (!fecha) {
    $('ord-fecha-hint').textContent = 'Requerido.';
    valid = false;
  } else {
    const dateVal = new Date(fecha + 'T00:00:00');
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const fiveYearsAgo = new Date(today.getFullYear() - 5, today.getMonth(), today.getDate());

    if (dateVal > today) {
      $('ord-fecha-hint').textContent = 'La fecha no puede ser futura.';
      valid = false;
    } else if (dateVal < fiveYearsAgo) {
      $('ord-fecha-hint').textContent = 'La fecha no puede ser anterior a 5 años.';
      valid = false;
    } else {
      $('ord-fecha-hint').textContent = '';
    }
  }

  if (!valid) return;

  const btn = $('modal-ord-save');
  btn.disabled = true;

  try {
    await apiFetch(`${API_PRV}?orden=1`, {
      method: 'POST',
      body: JSON.stringify({
        proveedor_id:    proveedorId,
        insumo_id:       insumoId,
        fecha,
        cantidad,
        precio_unitario: precio,
        observaciones:   $('ord-observaciones').value.trim(),
      }),
    });
    showToast('prv-toast-ord-modal', 'Orden registrada correctamente.', 'ok');
    setTimeout(() => {
      cerrarModalOrden();
      cargarOrdenes($('filtro-proveedor').value);
      cargarProveedores();   // actualiza stats y conteos
    }, 900);
  } catch (err) {
    showToast('prv-toast-ord-modal', err.message, 'err');
  } finally {
    btn.disabled = false;
  }
});

/* ============================================================
   TABS
   ============================================================ */
document.querySelectorAll('.prv-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.prv-tab-btn').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });
    document.querySelectorAll('.prv-tab-panel').forEach(p => p.classList.remove('active'));

    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    $(btn.getAttribute('aria-controls')).classList.add('active');

    // Cargar órdenes la primera vez que se abre ese tab
    if (btn.id === 'tab-btn-ordenes') {
      cargarOrdenes($('filtro-proveedor').value);
    }
  });
});

/* ============================================================
   Botones de apertura / cierre de modales
   ============================================================ */
$('btn-nuevo-proveedor').addEventListener('click', () => abrirModalProveedor());
$('btn-nuevo-proveedor-empty')?.addEventListener('click', () => abrirModalProveedor());
$('modal-prv-close').addEventListener('click',  cerrarModalProveedor);
$('modal-prv-cancel').addEventListener('click', cerrarModalProveedor);

$('btn-nueva-orden').addEventListener('click', () => abrirModalOrden());
$('modal-ord-close').addEventListener('click',  cerrarModalOrden);
$('modal-ord-cancel').addEventListener('click', cerrarModalOrden);

// Cerrar modales con Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    cerrarModalProveedor();
    cerrarModalOrden();
  }
});

// Cerrar modales al clickear el overlay
$('modal-proveedor').addEventListener('click', (e) => {
  if (e.target === $('modal-proveedor')) cerrarModalProveedor();
});
$('modal-orden').addEventListener('click', (e) => {
  if (e.target === $('modal-orden')) cerrarModalOrden();
});

/* ============================================================
   Inicialización
   ============================================================ */
(async () => {
  await Promise.all([cargarInsumos(), cargarProveedores()]);
})();
