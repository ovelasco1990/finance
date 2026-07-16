/* =============================================================================
 * pendientes.js  ·  CARGOS PENDIENTES / PRÓXIMOS PAGOS (pendientes.html)
 * -----------------------------------------------------------------------------
 * Un "pendiente" es un pago previsto que NO afecta el balance (vive en su propia
 * tabla, aparte de `movimientos`). Sirve para ver "lo que se viene". Al APLICARLO
 * se convierte en un movimiento real (que sí impacta el balance) y desaparece de
 * aquí. Se puede crear a mano o generar a partir de los recurrentes del mes.
 * Todo filtrado por el MES seleccionado. Capa de datos asíncrona (await).
 * ========================================================================== */

(() => {
  'use strict';

  let modal;
  const el = (id) => document.getElementById(id);
  const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  /* --- Listado ------------------------------------------------------------ */
  async function pintar() {
    const cuerpo = el('tabla-pendientes');
    const vacio = el('pendientes-vacio');
    const lista = App.filtrarPorPeriodo(await Datos.getPendientes())
      .sort((a, b) => a.fecha.localeCompare(b.fecha));

    el('pen-etiqueta-mes').textContent = App.etiquetaPeriodo();

    // Totales del mes (gastos e ingresos por separado).
    const totalGasto = lista.filter(p => p.tipo === 'gasto').reduce((t, p) => t + Number(p.monto), 0);
    const totalIngreso = lista.filter(p => p.tipo === 'ingreso').reduce((t, p) => t + Number(p.monto), 0);
    el('pen-total-gasto').textContent = App.formatearMoneda(totalGasto);
    const elIng = el('pen-total-ingreso');
    if (totalIngreso > 0) {
      elIng.textContent = '+ ' + App.formatearMoneda(totalIngreso) + ' por cobrar';
      elIng.classList.remove('d-none');
    } else {
      elIng.classList.add('d-none');
    }

    if (lista.length === 0) {
      cuerpo.innerHTML = '';
      vacio.classList.remove('d-none');
      return;
    }
    vacio.classList.add('d-none');

    const cats = new Map((await Datos.getCategorias()).map(c => [c.id, c]));

    cuerpo.innerHTML = lista.map(p => {
      const cat = cats.get(p.categoria_id);
      const esIngreso = p.tipo === 'ingreso';
      const badge = esIngreso
        ? '<span class="badge text-bg-success">Ingreso</span>'
        : '<span class="badge text-bg-danger">Gasto</span>';
      const origen = p.origen === 'recurrente'
        ? '<span class="badge text-bg-secondary"><i class="bi bi-arrow-repeat"></i> Recurrente</span>'
        : '<span class="badge text-bg-light text-dark"><i class="bi bi-hand-index"></i> Manual</span>';
      const clase = esIngreso ? 'text-ingreso' : 'text-gasto';

      return `
        <tr>
          <td class="fw-semibold">${p.nombre}</td>
          <td>${badge}</td>
          <td><i class="bi ${cat?.icono || 'bi-tag'}" style="color:${cat?.color || 'var(--texto-suave)'}"></i> ${cat?.nombre || '—'}</td>
          <td class="small text-suave">${App.formatearFecha(p.fecha)}</td>
          <td>${origen}</td>
          <td class="text-end fw-bold ${clase}">${App.formatearMoneda(p.monto)}</td>
          <td class="text-end text-nowrap">
            <button class="btn-icono btn-aplicar" data-id="${p.id}" title="Aplicar (convertir en movimiento)" aria-label="Aplicar pendiente"><i class="bi bi-check2-circle"></i></button>
            <button class="btn-icono btn-calendario" data-id="${p.id}" title="Agregar al calendario" aria-label="Agregar al calendario"><i class="bi bi-calendar-plus"></i></button>
            <button class="btn-icono btn-editar" data-id="${p.id}" title="Editar" aria-label="Editar pendiente"><i class="bi bi-pencil"></i></button>
            <button class="btn-icono btn-eliminar" data-id="${p.id}" title="Eliminar" aria-label="Eliminar pendiente"><i class="bi bi-trash"></i></button>
          </td>
        </tr>`;
    }).join('');
  }

  /* --- Formulario --------------------------------------------------------- */
  async function llenarCategorias(tipo, seleccionada = '') {
    const cats = (await Datos.getCategorias()).filter(c => c.tipo === tipo);
    el('pen-categoria').innerHTML = '<option value="">Selecciona…</option>' +
      cats.map(c => `<option value="${c.id}" ${c.id === seleccionada ? 'selected' : ''}>${c.nombre}</option>`).join('');
  }

  function tipoSeleccionado() {
    return document.querySelector('input[name="pen-tipo"]:checked').value;
  }

  /** Fecha por defecto: día 1 del mes seleccionado (o el vencimiento existente). */
  function fechaPorDefecto() {
    const p = App.getPeriodo();
    return `${p.anio}-${String(p.mes + 1).padStart(2, '0')}-01`;
  }

  async function abrirNuevo() {
    el('form-pendiente').reset();
    el('pen-id').value = '';
    el('titulo-modal').textContent = 'Nuevo pendiente';
    el('pen-gasto').checked = true;
    el('pen-fecha').value = fechaPorDefecto();
    limpiarValidacion();
    await llenarCategorias('gasto');
    modal.show();
  }

  async function abrirEdicion(id) {
    const p = (await Datos.getPendientes()).find(x => x.id === id);
    if (!p) return;
    el('form-pendiente').reset();
    el('pen-id').value = p.id;
    el('titulo-modal').textContent = 'Editar pendiente';
    el('pen-nombre').value = p.nombre;
    document.querySelector(`input[name="pen-tipo"][value="${p.tipo}"]`).checked = true;
    el('pen-monto').value = p.monto;
    el('pen-fecha').value = p.fecha;
    el('pen-nota').value = p.nota || '';
    limpiarValidacion();
    await llenarCategorias(p.tipo, p.categoria_id);
    modal.show();
  }

  function limpiarValidacion() {
    ['pen-nombre', 'pen-monto', 'pen-fecha', 'pen-categoria'].forEach(id => el(id).classList.remove('is-invalid'));
  }

  async function guardar(evento) {
    evento.preventDefault();
    const nombre = el('pen-nombre').value.trim();
    const monto = parseFloat(el('pen-monto').value);
    const fecha = el('pen-fecha').value;
    const categoria = el('pen-categoria').value;
    const nota = el('pen-nota').value.trim();

    const nombreOk = !!nombre;
    const montoOk = !isNaN(monto) && monto > 0;
    const fechaOk = !!fecha;
    const catOk = !!categoria;
    el('pen-nombre').classList.toggle('is-invalid', !nombreOk);
    el('pen-monto').classList.toggle('is-invalid', !montoOk);
    el('pen-fecha').classList.toggle('is-invalid', !fechaOk);
    el('pen-categoria').classList.toggle('is-invalid', !catOk);
    if (!nombreOk || !montoOk || !fechaOk || !catOk) return;

    const id = el('pen-id').value;
    const existente = id ? (await Datos.getPendientes()).find(x => x.id === id) : null;
    await Datos.savePendiente({
      id: id || undefined,
      nombre, tipo: tipoSeleccionado(), monto, fecha,
      categoria_id: categoria, nota,
      // Al editar conservamos el origen; los creados a mano son 'manual'.
      origen: existente ? existente.origen : 'manual',
      recurrente_id: existente ? existente.recurrente_id : undefined,
    });

    modal.hide();
    await pintar();
    App.mostrarToast(id ? 'Pendiente actualizado ✓' : 'Pendiente creado ✓', 'exito');
  }

  /* --- Exportar a calendario (.ics) --------------------------------------- *
   * Genera un evento de calendario estándar (RFC 5545) para el cargo. Es la
   * mejor forma de "recordar" sin backend: el móvil lo mete en su Calendario y
   * te avisa de forma NATIVA, offline y con la app cerrada. Incluye dos alarmas:
   * una `dias_aviso` días antes y otra el mismo día.
   * ----------------------------------------------------------------------- */

  /** Escapa texto para un campo ICS: barra, punto y coma, coma y saltos de línea. */
  function escaparICS(texto) {
    return String(texto || '')
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\r?\n/g, '\\n');
  }

  /** Sello de fecha/hora actual en UTC compacto: 20260715T203000Z */
  function selloAhora() {
    return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  }

  async function descargarICS(id) {
    const p = (await Datos.getPendientes()).find(x => x.id === id);
    if (!p) return;
    const ajustes = await Datos.getAjustes();
    const dias = Number(ajustes.dias_aviso) || 5;

    const fecha = p.fecha.replace(/-/g, '');   // YYYYMMDD
    const inicio = `${fecha}T090000`;          // 09:00 hora local (floating time)
    const fin = `${fecha}T093000`;             // +30 min
    const verbo = p.tipo === 'ingreso' ? '💰 Cobrar' : '💸 Pagar';
    const resumen = `${verbo}: ${p.nombre} (${App.formatearMoneda(p.monto)})`;
    const descripcion = `Cargo pendiente (${p.tipo}) registrado en Finanzas.` +
      (p.nota ? ` Nota: ${p.nota}` : '');

    // Nota: CRLF (\r\n) entre líneas, como exige el estándar iCalendar.
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Finanzas//Pendientes//ES',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      `UID:pendiente-${p.id}@finanzas.local`,
      `DTSTAMP:${selloAhora()}`,
      `DTSTART:${inicio}`,
      `DTEND:${fin}`,
      `SUMMARY:${escaparICS(resumen)}`,
      `DESCRIPTION:${escaparICS(descripcion)}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escaparICS('Se acerca: ' + p.nombre)}`,
      `TRIGGER:-P${dias}D`,
      'END:VALARM',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escaparICS('Hoy: ' + p.nombre)}`,
      'TRIGGER:PT0S',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pendiente-${p.nombre.replace(/[^\w\-]+/g, '_')}.ics`;
    a.click();
    URL.revokeObjectURL(url);
    App.mostrarToast('Evento de calendario descargado ✓', 'exito');
  }

  /* --- Aplicar / eliminar ------------------------------------------------- */
  async function aplicar(id) {
    const p = (await Datos.getPendientes()).find(x => x.id === id);
    if (!p) return;
    const ok = await App.confirmar(
      `Se registrará "${p.nombre}" (${App.formatearMoneda(p.monto)}) como ${p.tipo} real y afectará tu balance. ¿Continuar?`,
      { titulo: 'Aplicar pendiente', textoOk: 'Aplicar' }
    );
    if (!ok) return;
    const res = await Datos.aplicarPendiente(id);
    await pintar();
    App.mostrarToast(res.ok ? `"${p.nombre}" aplicado ✓` : (res.motivo || 'No se pudo aplicar'), res.ok ? 'exito' : 'error');
  }

  async function eliminar(id) {
    const p = (await Datos.getPendientes()).find(x => x.id === id);
    const ok = await App.confirmar(`¿Eliminar el pendiente "${p?.nombre}"?`, {
      titulo: 'Eliminar pendiente', textoOk: 'Eliminar', peligro: true,
    });
    if (!ok) return;
    await Datos.deletePendiente(id);
    await pintar();
    App.mostrarToast('Pendiente eliminado', 'info');
  }

  /* --- Generar desde recurrentes del mes ---------------------------------- */
  function formato(anio, mes, dia) {
    return `${anio}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  }

  function fechasDelRecurrente(rec, anio, mes) {
    const fechas = [];
    const ultimoDia = new Date(anio, mes + 1, 0).getDate();
    if (rec.frecuencia === 'mensual') {
      fechas.push(formato(anio, mes, Math.min(rec.dia, ultimoDia)));
    } else {
      for (let d = 1; d <= ultimoDia; d++) {
        if (new Date(anio, mes, d).getDay() === rec.dia) fechas.push(formato(anio, mes, d));
      }
    }
    return fechas;
  }

  async function generarDesdeRecurrentes() {
    const p = App.getPeriodo();
    const activos = (await Datos.getRecurrentes()).filter(r => r.activo);
    if (activos.length === 0) {
      App.mostrarToast('No hay recurrentes activos para generar.', 'info');
      return;
    }

    // No duplicar: ni contra pendientes ya generados, ni contra movimientos ya
    // aplicados (ambos identificados por recurrente_id + fecha).
    const yaPendientes = (await Datos.getPendientes())
      .filter(x => x.recurrente_id).map(x => x.recurrente_id + '|' + x.fecha);
    const yaAplicados = App.filtrarPorPeriodo(await Datos.getMovimientos())
      .filter(m => m.recurrente_id).map(m => m.recurrente_id + '|' + m.fecha);

    let generados = 0;
    for (const rec of activos) {
      for (const fecha of fechasDelRecurrente(rec, p.anio, p.mes)) {
        const clave = rec.id + '|' + fecha;
        if (yaPendientes.includes(clave) || yaAplicados.includes(clave)) continue;
        await Datos.savePendiente({
          nombre: rec.nombre, tipo: rec.tipo, monto: rec.monto, fecha,
          categoria_id: rec.categoria_id, nota: rec.nombre + ' (recurrente)',
          origen: 'recurrente', recurrente_id: rec.id,
        });
        generados++;
      }
    }

    await pintar();
    const mes = App.etiquetaPeriodo();
    App.mostrarToast(
      generados === 0
        ? `Los recurrentes de ${mes} ya estaban generados o aplicados.`
        : `Se generaron ${generados} pendiente(s) de ${mes} ✓`,
      generados === 0 ? 'info' : 'exito'
    );
  }

  /* --- Arranque ----------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', async () => {
    await App.listo;
    modal = new bootstrap.Modal(el('modal-pendiente'));
    await pintar();

    el('btn-nuevo').addEventListener('click', abrirNuevo);
    el('btn-generar').addEventListener('click', generarDesdeRecurrentes);
    el('form-pendiente').addEventListener('submit', guardar);

    document.querySelectorAll('input[name="pen-tipo"]').forEach(radio => {
      radio.addEventListener('change', () => llenarCategorias(tipoSeleccionado()));
    });

    el('tabla-pendientes').addEventListener('click', (e) => {
      const aplicarBtn = e.target.closest('.btn-aplicar');
      const calendarioBtn = e.target.closest('.btn-calendario');
      const editar = e.target.closest('.btn-editar');
      const eliminarBtn = e.target.closest('.btn-eliminar');
      if (aplicarBtn) aplicar(aplicarBtn.dataset.id);
      if (calendarioBtn) descargarICS(calendarioBtn.dataset.id);
      if (editar) abrirEdicion(editar.dataset.id);
      if (eliminarBtn) eliminar(eliminarBtn.dataset.id);
    });

    // Redibujar al cambiar de mes en la navbar.
    document.addEventListener('periodoCambiado', pintar);
  });
})();
