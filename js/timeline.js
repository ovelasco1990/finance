/* =============================================================================
 * timeline.js  ·  VISTA UNIFICADA / LÍNEA DE TIEMPO (timeline.html)
 * -----------------------------------------------------------------------------
 * Junta ingresos, gastos y abonos de ahorro del mes seleccionado, ordenados por
 * fecha (recientes primero). SOLO LECTURA: agrega desde la capa Datos, no
 * duplica. Filtros: tipo de origen y mes de la navbar. Capa asíncrona (await).
 * ========================================================================== */

(() => {
  'use strict';

  const el = (id) => document.getElementById(id);

  /** Construye una lista unificada y normalizada de eventos desde 2 fuentes. */
  async function eventosUnificados() {
    const eventos = [];
    const cats = new Map((await Datos.getCategorias()).map(c => [c.id, c]));

    (await Datos.getMovimientos()).forEach(m => {
      const cat = cats.get(m.categoria_id);
      eventos.push({
        origen: m.tipo, fecha: m.fecha, monto: Number(m.monto),
        titulo: cat?.nombre || 'Sin categoría', nota: m.nota || '',
        icono: cat?.icono || (m.tipo === 'ingreso' ? 'bi-arrow-down-circle' : 'bi-arrow-up-circle'),
        color: cat?.color || (m.tipo === 'ingreso' ? 'var(--ingreso)' : 'var(--gasto)'),
        signo: m.tipo === 'ingreso' ? '+' : '−',
        clase: m.tipo === 'ingreso' ? 'text-ingreso' : 'text-gasto',
        creado_en: m.creado_en,
      });
    });

    (await Datos.getAbonosAhorro()).forEach(a => {
      const esAbono = a.tipo !== 'retiro';
      eventos.push({
        origen: 'ahorro', fecha: a.fecha, monto: Number(a.monto),
        titulo: esAbono ? 'Abono a ahorro' : 'Retiro de ahorro', nota: a.nota || '',
        icono: 'bi-piggy-bank', color: 'var(--ahorro)',
        signo: esAbono ? '+' : '−', clase: 'text-ahorro',
        creado_en: a.creado_en,
      });
    });

    return eventos;
  }

  function etiquetaOrigen(origen) {
    return { ingreso: 'Ingreso', gasto: 'Gasto', ahorro: 'Ahorro' }[origen] || origen;
  }
  function badgeOrigen(origen) {
    const clase = { ingreso: 'text-bg-success', gasto: 'text-bg-danger', ahorro: 'text-bg-info' }[origen] || 'text-bg-secondary';
    return `<span class="badge ${clase}">${etiquetaOrigen(origen)}</span>`;
  }

  async function pintar() {
    const cont = el('timeline');
    const filtro = document.querySelector('input[name="f-tipo"]:checked').value;

    const eventos = (await eventosUnificados())
      .filter(ev => App.esDelPeriodo(ev.fecha))
      .filter(ev => !filtro || ev.origen === filtro)
      .sort((a, b) => b.fecha.localeCompare(a.fecha));

    if (eventos.length === 0) {
      cont.innerHTML = `<div class="estado-vacio"><i class="bi bi-clock-history"></i>No hay movimientos en este mes con el filtro seleccionado.</div>`;
      return;
    }

    cont.innerHTML = eventos.map(ev => {
      const registro = ev.creado_en ? `Registrado el ${App.formatearFechaHora(ev.creado_en)}` : '';
      const btnInfo = registro
        ? ` <button class="btn-info-registro" data-info="${registro}" title="${registro}" aria-label="Ver detalle de registro"><i class="bi bi-info-circle"></i></button>`
        : '';
      return `
      <div class="timeline-item">
        <span class="punto" style="background:${App.colorTenue(ev.color)};color:${ev.color}">
          <i class="bi ${ev.icono}"></i>
        </span>
        <div class="flex-grow-1">
          <div class="d-flex align-items-center gap-2">
            <span class="fw-semibold">${ev.titulo}</span>
            ${badgeOrigen(ev.origen)}
          </div>
          <div class="small text-suave">${ev.nota ? ev.nota + ' · ' : ''}${App.formatearFecha(ev.fecha)}${btnInfo}</div>
        </div>
        <div class="fw-bold ${ev.clase}">${ev.signo} ${App.formatearMoneda(ev.monto)}</div>
      </div>`;
    }).join('');
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await App.listo;
    await pintar();
    document.querySelectorAll('input[name="f-tipo"]').forEach(r => r.addEventListener('change', pintar));
    document.addEventListener('periodoCambiado', pintar);

    // Tocar el iconito de info muestra la fecha de registro (útil en móvil).
    el('timeline').addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-info-registro');
      if (btn) App.mostrarToast(btn.dataset.info, 'info');
    });
  });
})();
