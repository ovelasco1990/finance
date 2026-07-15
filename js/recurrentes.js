/* =============================================================================
 * recurrentes.js  ·  MOVIMIENTOS RECURRENTES (recurrentes.html)
 * -----------------------------------------------------------------------------
 * Registra movimientos que se repiten (mensual/semanal), se pueden pausar o
 * eliminar. "Generar pendientes del mes" crea CARGOS PENDIENTES del periodo a
 * partir de los activos (no afectan el balance hasta aplicarlos en la página
 * Pendientes), sin duplicar (marca `recurrente_id`). Capa asíncrona.
 * ========================================================================== */

(() => {
  'use strict';

  let modal;
  const el = (id) => document.getElementById(id);
  const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  /* --- Listado ------------------------------------------------------------ */
  async function pintar() {
    const cuerpo = el('tabla-recurrentes');
    const vacio = el('recurrentes-vacio');
    const lista = await Datos.getRecurrentes();

    if (lista.length === 0) {
      cuerpo.innerHTML = '';
      vacio.classList.remove('d-none');
      return;
    }
    vacio.classList.add('d-none');

    const cats = new Map((await Datos.getCategorias()).map(c => [c.id, c]));

    cuerpo.innerHTML = lista.map(r => {
      const cat = cats.get(r.categoria_id);
      const esIngreso = r.tipo === 'ingreso';
      const badge = esIngreso
        ? '<span class="badge text-bg-success">Ingreso</span>'
        : '<span class="badge text-bg-danger">Gasto</span>';
      const frecTexto = r.frecuencia === 'mensual' ? `Mensual · día ${r.dia}` : `Semanal · ${DIAS_SEMANA[r.dia]}`;
      const estado = r.activo
        ? '<span class="badge text-bg-primary">Activo</span>'
        : '<span class="badge text-bg-secondary">Pausado</span>';
      const clase = esIngreso ? 'text-ingreso' : 'text-gasto';

      return `
        <tr class="${r.activo ? '' : 'opacity-50'}">
          <td class="fw-semibold">${r.nombre}</td>
          <td>${badge}</td>
          <td><i class="bi ${cat?.icono || 'bi-tag'}" style="color:${cat?.color || 'var(--texto-suave)'}"></i> ${cat?.nombre || '—'}</td>
          <td class="small text-suave">${frecTexto}</td>
          <td class="text-end fw-bold ${clase}">${App.formatearMoneda(r.monto)}</td>
          <td>${estado}</td>
          <td class="text-end text-nowrap">
            <button class="btn-icono btn-pausar" data-id="${r.id}" title="${r.activo ? 'Pausar' : 'Reanudar'}" aria-label="${r.activo ? 'Pausar recurrente' : 'Reanudar recurrente'}"><i class="bi ${r.activo ? 'bi-pause-fill' : 'bi-play-fill'}"></i></button>
            <button class="btn-icono btn-editar" data-id="${r.id}" title="Editar" aria-label="Editar recurrente"><i class="bi bi-pencil"></i></button>
            <button class="btn-icono btn-eliminar" data-id="${r.id}" title="Eliminar" aria-label="Eliminar recurrente"><i class="bi bi-trash"></i></button>
          </td>
        </tr>`;
    }).join('');
  }

  /* --- Formulario --------------------------------------------------------- */
  async function llenarCategorias(tipo, seleccionada = '') {
    const cats = (await Datos.getCategorias()).filter(c => c.tipo === tipo);
    el('rec-categoria').innerHTML = '<option value="">Selecciona…</option>' +
      cats.map(c => `<option value="${c.id}" ${c.id === seleccionada ? 'selected' : ''}>${c.nombre}</option>`).join('');
  }

  function tipoSeleccionado() {
    return document.querySelector('input[name="rec-tipo"]:checked').value;
  }

  function alternarCampoDia() {
    const esSemanal = el('rec-frecuencia').value === 'semanal';
    el('campo-dia-mes').classList.toggle('d-none', esSemanal);
    el('campo-dia-semana').classList.toggle('d-none', !esSemanal);
  }

  async function abrirNuevo() {
    el('form-recurrente').reset();
    el('rec-id').value = '';
    el('titulo-modal').textContent = 'Nuevo recurrente';
    el('rec-gasto').checked = true;
    el('rec-frecuencia').value = 'mensual';
    el('rec-dia-mes').value = 1;
    alternarCampoDia();
    limpiarValidacion();
    await llenarCategorias('gasto');
    modal.show();
  }

  async function abrirEdicion(id) {
    const r = (await Datos.getRecurrentes()).find(x => x.id === id);
    if (!r) return;
    el('form-recurrente').reset();
    el('rec-id').value = r.id;
    el('titulo-modal').textContent = 'Editar recurrente';
    el('rec-nombre').value = r.nombre;
    document.querySelector(`input[name="rec-tipo"][value="${r.tipo}"]`).checked = true;
    el('rec-monto').value = r.monto;
    el('rec-frecuencia').value = r.frecuencia;
    alternarCampoDia();
    if (r.frecuencia === 'semanal') el('rec-dia-semana').value = r.dia;
    else el('rec-dia-mes').value = r.dia;
    limpiarValidacion();
    await llenarCategorias(r.tipo, r.categoria_id);
    modal.show();
  }

  function limpiarValidacion() {
    ['rec-nombre', 'rec-monto', 'rec-categoria'].forEach(id => el(id).classList.remove('is-invalid'));
  }

  async function guardar(evento) {
    evento.preventDefault();
    const nombre = el('rec-nombre').value.trim();
    const monto = parseFloat(el('rec-monto').value);
    const categoria = el('rec-categoria').value;
    const frecuencia = el('rec-frecuencia').value;
    const dia = frecuencia === 'semanal'
      ? parseInt(el('rec-dia-semana').value, 10)
      : parseInt(el('rec-dia-mes').value, 10);

    const nombreOk = !!nombre;
    const montoOk = !isNaN(monto) && monto > 0;
    const catOk = !!categoria;
    el('rec-nombre').classList.toggle('is-invalid', !nombreOk);
    el('rec-monto').classList.toggle('is-invalid', !montoOk);
    el('rec-categoria').classList.toggle('is-invalid', !catOk);
    if (!nombreOk || !montoOk || !catOk) return;

    const id = el('rec-id').value;
    const existente = id ? (await Datos.getRecurrentes()).find(x => x.id === id) : null;
    await Datos.saveRecurrente({
      id: id || undefined,
      nombre, tipo: tipoSeleccionado(), monto, categoria_id: categoria,
      frecuencia, dia,
      activo: existente ? existente.activo : true,
    });

    modal.hide();
    await pintar();
    App.mostrarToast(id ? 'Recurrente actualizado ✓' : 'Recurrente creado ✓', 'exito');
  }

  /* --- Pausar / eliminar -------------------------------------------------- */
  async function alternarPausa(id) {
    const r = (await Datos.getRecurrentes()).find(x => x.id === id);
    if (!r) return;
    await Datos.saveRecurrente({ id: r.id, activo: !r.activo });
    await pintar();
    App.mostrarToast(r.activo ? 'Recurrente pausado' : 'Recurrente reanudado', 'info');
  }

  async function eliminar(id) {
    const r = (await Datos.getRecurrentes()).find(x => x.id === id);
    const ok = await App.confirmar(`¿Eliminar el recurrente "${r?.nombre}"?`, {
      titulo: 'Eliminar recurrente', textoOk: 'Eliminar', peligro: true,
    });
    if (!ok) return;
    await Datos.deleteRecurrente(id);
    await pintar();
    App.mostrarToast('Recurrente eliminado', 'info');
  }

  /* --- Aplicar recurrentes del mes --------------------------------------- */
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

  function formato(anio, mes, dia) {
    return `${anio}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  }

  async function aplicarDelMes() {
    const p = App.getPeriodo();
    // Seguridad: aunque el botón se deshabilita, bloqueamos también aquí.
    if (esMesPasado(p)) {
      App.mostrarToast('No se pueden generar pendientes en meses pasados.', 'error');
      return;
    }
    const activos = (await Datos.getRecurrentes()).filter(r => r.activo);
    if (activos.length === 0) {
      App.mostrarToast('No hay recurrentes activos para generar.', 'info');
      return;
    }

    // Generamos CARGOS PENDIENTES (no movimientos): así ves lo que se viene sin
    // que afecte tu balance hasta que los apliques desde la página Pendientes.
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

    const mes = App.etiquetaPeriodo();
    App.mostrarToast(
      generados === 0
        ? `Los recurrentes de ${mes} ya estaban generados o aplicados.`
        : `Se generaron ${generados} pendiente(s) de ${mes}. Revísalos en Pendientes ✓`,
      generados === 0 ? 'info' : 'exito'
    );
  }

  /* --- Estado del botón "Aplicar" ---------------------------------------- */

  /** ¿El periodo seleccionado es un mes anterior al mes actual? */
  function esMesPasado(p) {
    const hoy = new Date();
    return p.anio < hoy.getFullYear() || (p.anio === hoy.getFullYear() && p.mes < hoy.getMonth());
  }

  /** Actualiza texto y estado (habilitado/deshabilitado) del botón "Aplicar". */
  function actualizarEstadoAplicar() {
    const pasado = esMesPasado(App.getPeriodo());
    const btn = el('btn-aplicar');
    btn.disabled = pasado; // no se generan pendientes en meses ya pasados
    el('txt-aplicar').textContent = pasado
      ? 'No disponible en meses pasados'
      : `Generar pendientes de ${App.etiquetaPeriodo()}`;
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await App.listo;
    modal = new bootstrap.Modal(el('modal-recurrente'));
    await pintar();
    actualizarEstadoAplicar();

    el('btn-nuevo').addEventListener('click', abrirNuevo);
    el('btn-aplicar').addEventListener('click', aplicarDelMes);
    el('form-recurrente').addEventListener('submit', guardar);
    el('rec-frecuencia').addEventListener('change', alternarCampoDia);

    document.querySelectorAll('input[name="rec-tipo"]').forEach(radio => {
      radio.addEventListener('change', () => llenarCategorias(tipoSeleccionado()));
    });

    el('tabla-recurrentes').addEventListener('click', (e) => {
      const pausar = e.target.closest('.btn-pausar');
      const editar = e.target.closest('.btn-editar');
      const eliminarBtn = e.target.closest('.btn-eliminar');
      if (pausar) alternarPausa(pausar.dataset.id);
      if (editar) abrirEdicion(editar.dataset.id);
      if (eliminarBtn) eliminar(eliminarBtn.dataset.id);
    });

    document.addEventListener('periodoCambiado', actualizarEstadoAplicar);
  });
})();
