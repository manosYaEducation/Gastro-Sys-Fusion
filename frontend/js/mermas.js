'use strict';

/* ============================================================
   mermas.js — T2.3 / US-2.3
   Reporte de Mermas:
     · Gráfico de barras: top 5 insumos perdidos de la semana
     · Formulario para registrar merma manual
     · Historial reciente (últimas 10 mermas)
   ============================================================ */

/* ============================================================
   DATOS MOCK (fallback cuando la API no está disponible)
   ============================================================ */
const MOCK_TOP5 = [
  { nombre: 'Tomate cherry',  cantidad: 4.5,  unidad: 'kg' },
  { nombre: 'Carne molida',   cantidad: 3.2,  unidad: 'kg' },
  { nombre: 'Leche entera',   cantidad: 6.0,  unidad: 'lt' },
  { nombre: 'Aceite de oliva',cantidad: 1.8,  unidad: 'lt' },
  { nombre: 'Harina 0000',    cantidad: 2.75, unidad: 'kg' },
];

const MOCK_HISTORIAL = [
  { id: 9,  insumo: 'Leche entera',    cantidad: 2.0, unidad: 'lt', motivo: 'vencimiento',       fecha: '2026-05-27' },
  { id: 8,  insumo: 'Tomate cherry',   cantidad: 1.5, unidad: 'kg', motivo: 'danio_fisico',       fecha: '2026-05-27' },
  { id: 7,  insumo: 'Carne molida',    cantidad: 0.8, unidad: 'kg', motivo: 'error_preparacion',  fecha: '2026-05-26' },
  { id: 6,  insumo: 'Aceite de oliva', cantidad: 0.5, unidad: 'lt', motivo: 'contaminacion',      fecha: '2026-05-26' },
  { id: 5,  insumo: 'Harina 0000',     cantidad: 1.0, unidad: 'kg', motivo: 'exceso_produccion',  fecha: '2026-05-25' },
  { id: 4,  insumo: 'Tomate cherry',   cantidad: 1.8, unidad: 'kg', motivo: 'vencimiento',        fecha: '2026-05-25' },
  { id: 3,  insumo: 'Leche entera',    cantidad: 1.5, unidad: 'lt', motivo: 'vencimiento',        fecha: '2026-05-24' },
  { id: 2,  insumo: 'Carne molida',    cantidad: 1.2, unidad: 'kg', motivo: 'danio_fisico',       fecha: '2026-05-24' },
  { id: 1,  insumo: 'Aceite de oliva', cantidad: 0.7, unidad: 'lt', motivo: 'otro',               fecha: '2026-05-23' },
  { id: 0,  insumo: 'Harina 0000',     cantidad: 0.5, unidad: 'kg', motivo: 'error_preparacion',  fecha: '2026-05-23' },
];

const MOCK_INSUMOS_SELECT = [
  { id: 1,  nombre: 'Tomate cherry',     unidad: 'kg'   },
  { id: 2,  nombre: 'Carne molida',      unidad: 'kg'   },
  { id: 3,  nombre: 'Leche entera',      unidad: 'lt'   },
  { id: 4,  nombre: 'Aceite de oliva',   unidad: 'lt'   },
  { id: 5,  nombre: 'Harina 0000',       unidad: 'kg'   },
  { id: 6,  nombre: 'Queso mozzarella',  unidad: 'kg'   },
  { id: 7,  nombre: 'Pechuga de pollo',  unidad: 'kg'   },
  { id: 8,  nombre: 'Camarones',         unidad: 'kg'   },
  { id: 9,  nombre: 'Vino tinto',        unidad: 'bt'   },
  { id: 10, nombre: 'Crema de leche',    unidad: 'lt'   },
];

/* ============================================================
   ETIQUETAS DE MOTIVO
   ============================================================ */
const MOTIVOS = {
  vencimiento:       '📅 Vencimiento',
  danio_fisico:      '💥 Daño físico',
  error_preparacion: '🍳 Error prep.',
  contaminacion:     '🦠 Contaminación',
  exceso_produccion: '📦 Exceso prod.',
  otro:              '🔖 Otro',
};

/* ============================================================
   ELEMENTOS DOM
   ============================================================ */
const $  = (id) => document.getElementById(id);
const el = {
  // Stats
  statEventos: $('mrm-stat-eventos-num'),
  statCantidad: $('mrm-stat-cantidad-num'),
  statMotivo: $('mrm-stat-motivo-num'),

  // Chart
  chartLoading: $('mrm-chart-loading'),
  chartError:   $('mrm-chart-error'),
  chartErrorMsg:$('mrm-chart-error-msg'),
  chartCard:    $('mrm-chart-card'),
  chartCanvas:  $('mrm-chart-canvas'),
  btnReload:    $('mrm-btn-reload'),
  btnRetryChart:$('mrm-btn-retry-chart'),

  // Formulario
  form:         $('mrm-form'),
  id:           $('mrm-id'),
  selInsumo:    $('mrm-insumo'),
  inputCantidad:$('mrm-cantidad'),
  unitBadge:    $('mrm-unidad-display'),
  selMotivo:    $('mrm-motivo'),
  inputFecha:   $('mrm-fecha'),
  textarea:     $('mrm-observaciones'),
  charcount:    $('mrm-charcount'),
  hintInsumo:   $('mrm-insumo-hint'),
  hintCantidad: $('mrm-cantidad-hint'),
  hintMotivo:   $('mrm-motivo-hint'),
  btnSubmit:    $('mrm-btn-submit'),
  toast:        $('mrm-toast'),

  // Historial
  histLoading:    $('mrm-historial-loading'),
  histEmpty:      $('mrm-historial-empty'),
  histTableWrap:  $('mrm-historial-table-wrap'),
  histTbody:      $('mrm-historial-tbody'),
};

/* ============================================================
   ESTADO LOCAL
   ============================================================ */
let chartInstance = null;
let insumosCache  = [];    // lista de insumos para el select
let historialData = [];    // últimas mermas

/* ============================================================
   HELPERS
   ============================================================ */
function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatFecha(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function modoMas(arr) {
  const freq = {};
  arr.forEach(m => { freq[m.motivo] = (freq[m.motivo] || 0) + 1; });
  const top = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
  return top ? (MOTIVOS[top[0]] ?? top[0]) : '—';
}

/* ============================================================
   FECHA DE HOY (default del input)
   ============================================================ */
function setFechaHoy() {
  const hoy = new Date().toISOString().slice(0, 10);
  el.inputFecha.value = hoy;
  el.inputFecha.setAttribute('max', hoy);
}

/* ============================================================
   POBLAR SELECT DE INSUMOS
   ============================================================ */
function poblarSelectInsumos(insumos) {
  insumosCache = insumos;
  el.selInsumo.innerHTML = '<option value="">— Selecciona un insumo —</option>';
  insumos.forEach(ins => {
    const opt = document.createElement('option');
    opt.value       = ins.id;
    opt.textContent = ins.nombre;
    opt.dataset.unidad = ins.unidad_medida ?? ins.unidad ?? 'unid.';
    opt.dataset.stock = ins.stock_actual ?? 0;
    el.selInsumo.appendChild(opt);
  });
}

/* ============================================================
   ACTUALIZAR STATS
   ============================================================ */
function actualizarStats(historial) {
  const totalCantidad = historial.reduce((acc, m) => acc + parseFloat(m.cantidad || 0), 0);
  el.statEventos.textContent  = historial.length;
  el.statCantidad.textContent = totalCantidad.toLocaleString('es-CL', { maximumFractionDigits: 1 });
  el.statMotivo.textContent   = modoMas(historial);
}

/* ============================================================
   RENDER CHART.JS — Top 5 insumos perdidos
   ============================================================ */
function renderChart(top5) {
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  const labels   = top5.map(d => d.nombre);
  const valores  = top5.map(d => parseFloat(d.cantidad || 0));
  const unidades = top5.map(d => d.unidad ?? d.unidad_medida ?? '');

  chartInstance = new Chart(el.chartCanvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Cantidad perdida',
        data: valores,
        backgroundColor: [
          'rgba(255, 59,  48,  0.75)',
          'rgba(255, 107, 97,  0.65)',
          'rgba(255, 149, 0,   0.70)',
          'rgba(255, 179, 64,  0.65)',
          'rgba(255, 214, 10,  0.60)',
        ],
        borderColor: [
          'rgba(255, 59,  48,  1)',
          'rgba(255, 107, 97,  1)',
          'rgba(255, 149, 0,   1)',
          'rgba(255, 179, 64,  1)',
          'rgba(255, 214, 10,  1)',
        ],
        borderWidth: 1.5,
        borderRadius: 8,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 2.2,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(18, 18, 18, 0.92)',
          titleColor: '#fff',
          bodyColor: '#ccc',
          borderColor: 'rgba(255, 59, 48, 0.4)',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 10,
          callbacks: {
            label: (ctx) => {
              const u = unidades[ctx.dataIndex];
              return `  Perdido: ${ctx.parsed.y.toLocaleString('es-CL', { maximumFractionDigits: 2 })} ${u}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: {
            color: '#aaa',
            font: { family: 'Inter', size: 12 },
            maxRotation: 25,
          },
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: {
            color: '#aaa',
            font: { family: 'Inter', size: 11 },
            callback: (v) => v.toLocaleString('es-CL'),
          },
        },
      },
      animation: {
        duration: 700,
        easing: 'easeOutQuart',
      },
    },
  });
}

/* ============================================================
   RENDER HISTORIAL
   ============================================================ */
function renderHistorial(mermas) {
  el.histTbody.innerHTML = '';

  mermas.forEach((m, i) => {
    const tr = document.createElement('tr');
    tr.className = 'mrm-tr';

    tr.innerHTML = `
      <td class="mrm-td mrm-td--id">
        ${String(i + 1).padStart(2, '0')}
      </td>

      <td class="mrm-td mrm-td--nombre">
        ${escHtml(m.insumo ?? m.nombre_insumo ?? '—')}
      </td>

      <td class="mrm-td mrm-td--cantidad">
        ${parseFloat(m.cantidad).toLocaleString('es-CL', {
          maximumFractionDigits: 2
        })} ${escHtml(m.unidad ?? m.unidad_medida ?? '')}
      </td>

      <td class="mrm-td">
        <span class="mrm-motivo-badge">
          ${escHtml(MOTIVOS[m.motivo] ?? m.motivo ?? '—')}
        </span>
      </td>

      <td class="mrm-td mrm-td--center">
        ${escHtml(formatFecha(m.fecha))}
      </td>

      <td class="mrm-td mrm-td--center">
        <button
          class="mrm-btn-edit"
          data-id="${m.id}"
          aria-label="Modificar merma de ${escHtml(m.insumo ?? m.nombre_insumo ?? '—')}">
          ✏️ Modificar
        </button>

        <button
          class="mrm-btn-delete"
          data-id="${m.id}"
          aria-label="Eliminar merma de ${escHtml(m.insumo ?? m.nombre_insumo ?? '—')}">
          🗑️ Eliminar
        </button>
      </td>
    `;

    el.histTbody.appendChild(tr);
  });
}

/* ============================================================
   MOSTRAR ESTADO DEL GRÁFICO
   ============================================================ */
function mostrarChart(cual) {
  el.chartLoading.style.display = 'none';
  el.chartError.style.display   = 'none';
  el.chartCard.hidden            = true;

  if (cual === 'loading') el.chartLoading.style.display = 'flex';
  if (cual === 'error')   el.chartError.style.display   = 'flex';
  if (cual === 'chart')   el.chartCard.hidden            = false;
}

/* ============================================================
   MOSTRAR ESTADO DEL HISTORIAL
   ============================================================ */
function mostrarHistorial(cual) {
  el.histLoading.style.display    = 'none';
  el.histEmpty.hidden              = true;
  el.histTableWrap.hidden          = true;

  if (cual === 'loading') el.histLoading.style.display = 'flex';
  if (cual === 'empty')   el.histEmpty.hidden            = false;
  if (cual === 'table')   el.histTableWrap.hidden        = false;
}

/* ============================================================
   FETCH MERMAS (top5 + historial)
   ============================================================ */
async function cargarMermas() {
  mostrarChart('loading');
  mostrarHistorial('loading');

  const apiUrl = (window.API?.mermas) ?? null;

  try {
    let top5     = MOCK_TOP5;
    let historial = MOCK_HISTORIAL;

    if (apiUrl) {
      const [r5, rh] = await Promise.all([
        fetch(`${apiUrl}?top5=1&periodo=semana`),
        fetch(`${apiUrl}?historial=1&limit=10`),
      ]);

      if (r5.ok && rh.ok) {
        const j5 = await r5.json();
        const jh = await rh.json();

        if (j5.success) top5     = j5.data ?? MOCK_TOP5;
        if (jh.success) historial = jh.data ?? MOCK_HISTORIAL;
      }
    }

    historialData = historial;

    // Chart
    if (top5.length === 0) {
      mostrarChart('error');
      el.chartErrorMsg.textContent = 'Sin datos de mermas esta semana.';
    } else {
      renderChart(top5);
      mostrarChart('chart');
    }

    // Historial
    if (historial.length === 0) {
      mostrarHistorial('empty');
    } else {
      renderHistorial(historial);
      mostrarHistorial('table');
    }

    // Stats
    actualizarStats(historial);

  } catch (err) {
    console.warn('[mermas.js] API no disponible, usando datos mock.', err);

    historialData = MOCK_HISTORIAL;
    renderChart(MOCK_TOP5);
    mostrarChart('chart');
    renderHistorial(MOCK_HISTORIAL);
    mostrarHistorial('table');
    actualizarStats(MOCK_HISTORIAL);
  }
}

/* ============================================================
   FETCH INSUMOS PARA SELECT
   ============================================================ */
async function cargarInsumosSelect() {
  const apiUrl = (window.API?.inventario) ?? null;

  try {
    if (!apiUrl) throw new Error('no api');
    const r = await fetch(apiUrl);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    if (!j.success) throw new Error(j.error ?? 'API error');
    poblarSelectInsumos(j.data ?? MOCK_INSUMOS_SELECT);
  } catch {
    poblarSelectInsumos(MOCK_INSUMOS_SELECT);
  }
}

/* ============================================================
   VALIDACIÓN DEL FORMULARIO
   ============================================================ */
function limpiarHints() {
  [el.hintInsumo, el.hintCantidad, el.hintMotivo].forEach(h => (h.textContent = ''));
  const fechaHint = document.getElementById('mrm-fecha-hint');
  if (fechaHint) {
    fechaHint.textContent = 'Por defecto: hoy';
    fechaHint.style.color = '';
  }
}

function validarForm() {
  limpiarHints();
  let ok = true;

  if (!el.selInsumo.value) {
    el.hintInsumo.textContent = 'Selecciona un insumo.';
    ok = false;
  }

  const cant = parseFloat(el.inputCantidad.value);
  if (!el.inputCantidad.value || isNaN(cant) || cant <= 0) {
    el.hintCantidad.textContent = 'Ingresa una cantidad mayor a 0.';
    ok = false;
  } else {
    const optSel = el.selInsumo.options[el.selInsumo.selectedIndex];
    if (optSel && optSel.value) {
      const stockDisponible = parseFloat(optSel.dataset.stock) || 0;
      if (cant > stockDisponible) {
        el.hintCantidad.textContent = `La cantidad no puede superar el stock disponible (${stockDisponible} ${optSel.dataset.unidad ?? ''}).`;
        ok = false;
      }
    }
  }

  if (!el.selMotivo.value) {
    el.hintMotivo.textContent = 'Selecciona el motivo de la merma.';
    ok = false;
  }

  const fechaVal = el.inputFecha.value;
  if (fechaVal) {
    const dateVal = new Date(fechaVal + 'T00:00:00');
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (dateVal > today) {
      const fechaHint = document.getElementById('mrm-fecha-hint');
      if (fechaHint) {
        fechaHint.textContent = 'La fecha no puede ser futura.';
        fechaHint.style.color = 'var(--mrm-danger-lt)';
      }
      ok = false;
    }
  }

  return ok;
}

/* ============================================================
   TOAST
   ============================================================ */
let toastTimer = null;

function mostrarToast(msg, tipo = 'ok') {
  clearTimeout(toastTimer);
  el.toast.textContent = tipo === 'ok' ? `✅  ${msg}` : `❌  ${msg}`;
  el.toast.className   = `mrm-toast mrm-toast--${tipo}`;
  el.toast.hidden      = false;
  toastTimer = setTimeout(() => { el.toast.hidden = true; }, 4500);
}

/* ============================================================
   SUBMIT DEL FORMULARIO
   ============================================================ */
async function manejarSubmit(e) {
  e.preventDefault();
  if (!validarForm()) return;

  const optSel       = el.selInsumo.options[el.selInsumo.selectedIndex];
  const insumoNombre = optSel?.text ?? '';
  const editando = el.id.value;
  const payload = {
    id: editando ? parseInt(editando,10) : null,
    insumo_id: parseInt(el.selInsumo.value, 10),
    cantidad: parseFloat(el.inputCantidad.value),
    motivo: el.selMotivo.value,
    fecha: el.inputFecha.value || new Date().toISOString().slice(0,10),
    observaciones: el.textarea.value.trim(),
};

  
  const metodo = editando ? 'PUT' : 'POST';

  el.btnSubmit.disabled = true;
  el.btnSubmit.querySelector('.mrm-btn-submit__text').textContent = 'Registrando…';

  const apiUrl = (window.API?.mermas) ?? null;

  try {
    if (apiUrl) {
      let r;
      try {
        r = await fetch(apiUrl,
  {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }
);
      } catch (netErr) {
        // Sin conexión — caemos al update optimista sin error visible
        console.warn('[mermas.js] API no accesible, registro local:', netErr.message);
        r = null;
      }

      if (r) {
        // Solo intentamos parsear JSON si el Content-Type es el correcto
        const ct = r.headers.get('Content-Type') ?? '';
        if (r.ok && ct.includes('application/json')) {
          const j = await r.json();
          if (!j.success) throw new Error(j.error ?? 'Error al registrar');
        } else if (!r.ok) {
          // API devolvió HTML (404, error PHP, tabla inexistente, etc.)
          // → actualizamos en local y avisamos con un warning suave
          console.warn(`[mermas.js] API respondió ${r.status}, usando modo local.`);
        }
      }
    }

    // ── Update optimista local ─────────────────────────────────────────────
    if (editando) {

    const index = historialData.findIndex(
        m => m.id == editando
    );

    if (index !== -1) {

        historialData[index] = {
            ...historialData[index],
            insumo_id: payload.insumo_id,
            insumo: insumoNombre,
            cantidad: payload.cantidad,
            unidad: optSel?.dataset?.unidad ?? '',
            motivo: payload.motivo,
            fecha: payload.fecha,
            observaciones: payload.observaciones
        };

    }

} else {

    historialData.unshift({
        id: Date.now(),
        insumo_id: payload.insumo_id,
        insumo: insumoNombre,
        cantidad: payload.cantidad,
        unidad: optSel?.dataset?.unidad ?? '',
        motivo: payload.motivo,
        fecha: payload.fecha,
        observaciones: payload.observaciones
    });

    if (historialData.length > 10) {
        historialData.pop();
    }

}

    renderHistorial(historialData);
    mostrarHistorial('table');
    actualizarStats(historialData);

    mostrarToast(
    editando
        ? `Merma de "${insumoNombre}" modificada correctamente.`
        : `Merma de "${insumoNombre}" registrada correctamente.`,
    'ok'
);
    el.form.reset();
    setFechaHoy();
    el.id.value = "";

el.btnSubmit
    .querySelector(".mrm-btn-submit__text")
    .textContent = "Registrar Merma";

    document.getElementById('mrm-form-title').innerHTML =
    '<span aria-hidden="true">📝</span> Registrar Merma Manual';

    el.unitBadge.textContent = 'unid.';
    limpiarHints();
    el.charcount.textContent = '0 / 500';

  } catch (err) {
    mostrarToast(err.message || 'No se pudo registrar la merma.', 'err');
  } finally {
    el.btnSubmit.disabled = false;
    el.btnSubmit.querySelector('.mrm-btn-submit__text').textContent = 'Registrar Merma';
  }
}


/* ============================================================
   EDITAR MERMA
   ============================================================ */
function editarMerma(id) {

    const merma = historialData.find(m => m.id === id);

    if (!merma) return;

    el.id.value = merma.id;

    el.selInsumo.value = merma.insumo_id;

    el.inputCantidad.value = merma.cantidad;

    el.selMotivo.value = merma.motivo;

    el.inputFecha.value = merma.fecha;

    const option = el.selInsumo.selectedOptions[0];

    if (option) {
        el.unitBadge.textContent = option.dataset.unidad;
    }

    el.btnSubmit
    .querySelector('.mrm-btn-submit__text')
    .textContent = "Modificar Merma";

    document.getElementById('mrm-form-title').innerHTML =
    '<span aria-hidden="true">✏️</span> Modificar Merma';

    const section = document.querySelector('.mrm-form-section');

    window.scrollTo({
    top: section.offsetTop - 80, 
    behavior: 'smooth'
    });

}


/* ============================================================
   ELIMINAR MERMA (DELETE /api/mermas.php?id=...)
   ============================================================ */
async function eliminarMerma(id, insumoNombre) {
  if (!confirm(`¿Estás seguro de que deseas eliminar la merma de "${insumoNombre}"?`)) {
    return;
  }

  const apiUrl = (window.API?.mermas) ?? null;

  try {
    if (apiUrl) {
      const resp = await fetch(`${apiUrl}?id=${id}`, {
        method: 'DELETE',
      });

      if (resp.ok) {
        const json = await resp.json();
        if (!json.success) throw new Error(json.error ?? 'Error al eliminar');
      } else {
        throw new Error(`Error en el servidor: HTTP ${resp.status}`);
      }
    }

    // Actualizar historial localmente
    historialData = historialData.filter(m => m.id !== id);
    
    if (historialData.length === 0) {
      mostrarHistorial('empty');
    } else {
      renderHistorial(historialData);
      mostrarHistorial('table');
    }

    // Recargar gráfico y stats
    cargarMermas();
    mostrarToast(`Merma eliminada correctamente.`, 'ok');

  } catch (err) {
    console.error(err);
    if (id < 10) {
      // Remover de manera local e interactiva si es mock/prueba
      historialData = historialData.filter(m => m.id !== id);
      renderHistorial(historialData);
      actualizarStats(historialData);
      mostrarToast(`Merma de prueba eliminada localmente.`, 'ok');
    } else {
      mostrarToast(err.message || 'No se pudo eliminar la merma.', 'err');
    }
  }
}

/* ============================================================
   EVENTOS
   ============================================================ */
// Click en botón eliminar o modificar (delegación)
el.histTbody.addEventListener('click', (e) => {

  const editBtn = e.target.closest('.mrm-btn-edit');
  const deleteBtn = e.target.closest('.mrm-btn-delete');

  if (editBtn) {

    const id = parseInt(editBtn.dataset.id);
    editarMerma(id);

    return;
  }

  if (deleteBtn) {

    const id = parseInt(deleteBtn.dataset.id);

    const item = historialData.find(
      m => m.id === id
    );

    const nombre = item ? item.insumo : '';

    eliminarMerma(id, nombre);

  }

});
// Reload gráfico
el.btnReload.addEventListener('click', () => {
  el.btnReload.style.transform = 'rotate(360deg)';
  setTimeout(() => { el.btnReload.style.transform = ''; }, 400);
  cargarMermas();
});

el.btnRetryChart.addEventListener('click', cargarMermas);

// Actualizar badge de unidad al cambiar insumo
el.selInsumo.addEventListener('change', () => {
  const opt = el.selInsumo.options[el.selInsumo.selectedIndex];
  const unidad = opt?.dataset?.unidad ?? 'unid.';
  el.unitBadge.textContent = unidad;
  if (el.hintInsumo.textContent) el.hintInsumo.textContent = '';
});

// Limpiar hints al cambiar campos
el.inputCantidad.addEventListener('input', () => {
  if (el.hintCantidad.textContent) el.hintCantidad.textContent = '';
});
el.selMotivo.addEventListener('change', () => {
  if (el.hintMotivo.textContent) el.hintMotivo.textContent = '';
});

// Contador de caracteres
el.textarea.addEventListener('input', () => {
  el.charcount.textContent = `${el.textarea.value.length} / 500`;
});

// Submit
el.form.addEventListener('submit', manejarSubmit);

// Reset
el.form.addEventListener('reset', () => {
  setTimeout(() => {
    limpiarHints();
    el.unitBadge.textContent = 'unid.';
    el.charcount.textContent = '0 / 500';
    setFechaHoy();
    el.toast.hidden = true;
    el.id.value = "";

    el.btnSubmit
      .querySelector('.mrm-btn-submit__text')
      .textContent = 'Registrar Merma';

    document.getElementById('mrm-form-title').innerHTML =
      '<span aria-hidden="true">📝</span> Registrar Merma Manual';
  }, 0);
});

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  setFechaHoy();
  cargarInsumosSelect();
  cargarMermas();
});
