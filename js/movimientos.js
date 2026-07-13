/* =============================================================================
 * movimientos.js  ·  REGISTRO DE INGRESOS Y GASTOS (movimientos.html)
 * -----------------------------------------------------------------------------
 * Alta/edición (modal), validaciones, tabla con filtros (texto, tipo, categoría,
 * rango de fechas), totales de lo filtrado, editar/eliminar con confirmación y
 * toasts. Capa Datos asíncrona (await).
 * ========================================================================== */

(() => {
  'use strict';

  let modal;
  const el = (id) => document.getElementById(id);

  /* Estado de ordenamiento de la tabla. Por defecto, fecha descendente. */
  const orden = { campo: 'fecha', dir: 'desc' };

  /* --- Categorías: mapa cacheado por render ------------------------------ */
  async function mapaCategorias() {
    const cats = await Datos.getCategorias();
    return new Map(cats.map(c => [c.id, c]));
  }

  async function llenarFiltroCategorias() {
    const cats = await Datos.getCategorias();
    el('filtro-categoria').innerHTML = '<option value="">Todas</option>' +
      cats.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
  }

  /* --- Filtrado y ordenamiento -------------------------------------------- */
  async function movimientosFiltrados(cats) {
    const texto = el('filtro-texto').value.trim().toLowerCase();
    const tipo = el('filtro-tipo').value;
    const categoria = el('filtro-categoria').value;
    const desde = el('filtro-desde').value;
    const hasta = el('filtro-hasta').value;

    return (await Datos.getMovimientos())
      .filter(m => !tipo || m.tipo === tipo)
      .filter(m => !categoria || m.categoria_id === categoria)
      .filter(m => !desde || m.fecha >= desde)   // 'YYYY-MM-DD' se compara como texto
      .filter(m => !hasta || m.fecha <= hasta)
      .filter(m => {
        if (!texto) return true;
        const nombreCat = (cats.get(m.categoria_id)?.nombre || '').toLowerCase();
        return (m.nota || '').toLowerCase().includes(texto) || nombreCat.includes(texto);
      })
      .sort((a, b) => comparar(a, b, cats));
  }

  /** Comparador según la columna y dirección activas (orden). */
  function comparar(a, b, cats) {
    const dir = orden.dir === 'asc' ? 1 : -1;
    let va, vb;
    switch (orden.campo) {
      case 'monto':     va = Number(a.monto); vb = Number(b.monto); return (va - vb) * dir;
      case 'tipo':      va = a.tipo; vb = b.tipo; break;
      case 'nota':      va = (a.nota || '').toLowerCase(); vb = (b.nota || '').toLowerCase(); break;
      case 'categoria': va = (cats.get(a.categoria_id)?.nombre || '').toLowerCase();
                        vb = (cats.get(b.categoria_id)?.nombre || '').toLowerCase(); break;
      default:          va = a.fecha; vb = b.fecha; // fecha
    }
    return va < vb ? -1 * dir : va > vb ? 1 * dir : 0;
  }

  /** Actualiza las flechitas de los encabezados según la columna activa. */
  function actualizarFlechas() {
    document.querySelectorAll('.th-sort').forEach(th => {
      const activa = th.dataset.campo === orden.campo;
      th.classList.toggle('activo', activa);
      const icono = th.querySelector('i');
      if (!activa) icono.className = 'bi bi-chevron-expand';
      else icono.className = orden.dir === 'asc' ? 'bi bi-chevron-up' : 'bi bi-chevron-down';
    });
  }

  async function pintarTabla() {
    const cats = await mapaCategorias();
    const cuerpo = el('tabla-movimientos');
    const vacio = el('movimientos-vacio');
    const pie = el('pie-movimientos');
    const lista = await movimientosFiltrados(cats);

    if (lista.length === 0) {
      cuerpo.innerHTML = '';
      vacio.classList.remove('d-none');
      pie.classList.add('d-none');
      return;
    }
    vacio.classList.add('d-none');

    cuerpo.innerHTML = lista.map(m => {
      const cat = cats.get(m.categoria_id);
      const esIngreso = m.tipo === 'ingreso';
      const badge = esIngreso
        ? '<span class="badge text-bg-success">Ingreso</span>'
        : '<span class="badge text-bg-danger">Gasto</span>';
      const signo = esIngreso ? '+' : '−';
      const clase = esIngreso ? 'text-ingreso' : 'text-gasto';
      // Info de registro: se junta el sello creado_en y el origen recurrente en
      // un solo mensaje que se muestra al tocar el iconito (funciona en móvil).
      const partesInfo = [];
      if (m.creado_en) partesInfo.push(`Registrado el ${App.formatearFechaHora(m.creado_en)}`);
      if (m.recurrente_id) partesInfo.push('Generado por un recurrente');
      const info = partesInfo.join(' · ');
      const btnInfo = info
        ? ` <button class="btn-info-registro" data-info="${info}" title="${info}" aria-label="Ver detalle de registro"><i class="bi bi-info-circle"></i></button>`
        : '';
      const marcaRec = m.recurrente_id
        ? ` <i class="bi bi-arrow-repeat text-suave" aria-label="Recurrente"></i>`
        : '';
      return `
        <tr>
          <td class="text-nowrap">${App.formatearFecha(m.fecha)}${btnInfo}</td>
          <td>${badge}</td>
          <td><i class="bi ${cat?.icono || 'bi-tag'}" style="color:${cat?.color || 'var(--texto-suave)'}"></i> ${cat?.nombre || 'Sin categoría'}</td>
          <td class="text-suave">${m.nota || '—'}${marcaRec}</td>
          <td class="text-end fw-bold ${clase}">${signo} ${App.formatearMoneda(m.monto)}</td>
          <td class="text-end text-nowrap">
            <button class="btn-icono btn-editar" data-id="${m.id}" title="Editar" aria-label="Editar movimiento"><i class="bi bi-pencil"></i></button>
            <button class="btn-icono btn-eliminar" data-id="${m.id}" title="Eliminar" aria-label="Eliminar movimiento"><i class="bi bi-trash"></i></button>
          </td>
        </tr>`;
    }).join('');

    // Totales de lo que se está viendo (respeta los filtros activos).
    const ingresos = lista.filter(m => m.tipo === 'ingreso').reduce((t, m) => t + Number(m.monto), 0);
    const gastos = lista.filter(m => m.tipo === 'gasto').reduce((t, m) => t + Number(m.monto), 0);
    const neto = ingresos - gastos;
    el('total-ingresos').textContent = '+ ' + App.formatearMoneda(ingresos);
    el('total-gastos').textContent = '− ' + App.formatearMoneda(gastos);
    el('total-neto').textContent = App.formatearMoneda(neto);
    el('total-neto').className = 'fw-bold ' + (neto >= 0 ? 'text-ingreso' : 'text-gasto');
    pie.classList.remove('d-none');

    actualizarFlechas();
  }

  /* --- Formulario --------------------------------------------------------- */
  async function llenarCategoriasForm(tipo, seleccionada = '') {
    const cats = (await Datos.getCategorias()).filter(c => c.tipo === tipo);
    el('mov-categoria').innerHTML = '<option value="">Selecciona…</option>' +
      cats.map(c => `<option value="${c.id}" ${c.id === seleccionada ? 'selected' : ''}>${c.nombre}</option>`).join('');
  }

  function tipoSeleccionado() {
    return document.querySelector('input[name="mov-tipo"]:checked').value;
  }

  async function abrirNuevo() {
    const form = el('form-movimiento');
    form.reset();
    form.classList.remove('was-validated');
    el('mov-id').value = '';
    el('titulo-modal').textContent = 'Nuevo movimiento';
    el('tipo-ingreso').checked = true;
    el('mov-fecha').value = App.hoyISO();
    limpiarValidacion();
    await llenarCategoriasForm('ingreso');
    modal.show();
  }

  async function abrirEdicion(id) {
    const m = await Datos.getMovimiento(id);
    if (!m) return;
    const form = el('form-movimiento');
    form.reset();
    form.classList.remove('was-validated');
    el('mov-id').value = m.id;
    el('titulo-modal').textContent = 'Editar movimiento';
    document.querySelector(`input[name="mov-tipo"][value="${m.tipo}"]`).checked = true;
    el('mov-monto').value = m.monto;
    el('mov-fecha').value = m.fecha;
    el('mov-nota').value = m.nota || '';
    limpiarValidacion();
    await llenarCategoriasForm(m.tipo, m.categoria_id);
    modal.show();
  }

  function limpiarValidacion() {
    ['mov-monto', 'mov-fecha', 'mov-categoria'].forEach(id => el(id).classList.remove('is-invalid'));
  }

  async function guardar(evento) {
    evento.preventDefault();
    const monto = parseFloat(el('mov-monto').value);
    const fecha = el('mov-fecha').value;
    const categoria = el('mov-categoria').value;

    const montoOk = !isNaN(monto) && monto > 0;
    const fechaOk = !!fecha;
    const catOk = !!categoria;
    el('mov-monto').classList.toggle('is-invalid', !montoOk);
    el('mov-fecha').classList.toggle('is-invalid', !fechaOk);
    el('mov-categoria').classList.toggle('is-invalid', !catOk);
    if (!montoOk || !fechaOk || !catOk) return;

    const id = el('mov-id').value;
    await Datos.saveMovimiento({
      id: id || undefined,
      tipo: tipoSeleccionado(),
      monto: monto,
      fecha: fecha,
      categoria_id: categoria,
      nota: el('mov-nota').value.trim(),
    });

    modal.hide();
    await pintarTabla();
    App.mostrarToast(id ? 'Movimiento actualizado ✓' : 'Movimiento guardado ✓', 'exito');
  }

  async function eliminar(id) {
    const m = await Datos.getMovimiento(id);
    const ok = await App.confirmar(
      `¿Eliminar este ${m?.tipo === 'ingreso' ? 'ingreso' : 'gasto'} de ${App.formatearMoneda(m?.monto)}?`,
      { titulo: 'Eliminar movimiento', textoOk: 'Eliminar', peligro: true }
    );
    if (!ok) return;
    await Datos.deleteMovimiento(id);
    await pintarTabla();
    App.mostrarToast('Movimiento eliminado', 'info');
  }

  /* --- Arranque ----------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', async () => {
    await App.listo;
    modal = new bootstrap.Modal(el('modal-movimiento'));
    await llenarFiltroCategorias();
    await pintarTabla();

    el('btn-nuevo').addEventListener('click', abrirNuevo);

    document.querySelectorAll('input[name="mov-tipo"]').forEach(radio => {
      radio.addEventListener('change', () => llenarCategoriasForm(tipoSeleccionado()));
    });

    el('form-movimiento').addEventListener('submit', guardar);

    // Filtros: 'input' para el buscador (reactivo al teclear), 'change' el resto.
    el('filtro-texto').addEventListener('input', pintarTabla);
    ['filtro-tipo', 'filtro-categoria', 'filtro-desde', 'filtro-hasta'].forEach(id => {
      el(id).addEventListener('change', pintarTabla);
    });
    el('btn-limpiar').addEventListener('click', () => {
      el('filtro-texto').value = '';
      el('filtro-tipo').value = '';
      el('filtro-categoria').value = '';
      el('filtro-desde').value = '';
      el('filtro-hasta').value = '';
      pintarTabla();
    });

    el('tabla-movimientos').addEventListener('click', (e) => {
      const btnInfo = e.target.closest('.btn-info-registro');
      const btnEditar = e.target.closest('.btn-editar');
      const btnEliminar = e.target.closest('.btn-eliminar');
      if (btnInfo) App.mostrarToast(btnInfo.dataset.info, 'info');
      if (btnEditar) abrirEdicion(btnEditar.dataset.id);
      if (btnEliminar) eliminar(btnEliminar.dataset.id);
    });

    // Ordenar al hacer clic en un encabezado: mismo campo alterna dirección;
    // campo nuevo arranca descendente en fecha/monto y ascendente en texto.
    document.querySelector('table thead').addEventListener('click', (e) => {
      const th = e.target.closest('.th-sort');
      if (!th) return;
      const campo = th.dataset.campo;
      if (orden.campo === campo) {
        orden.dir = orden.dir === 'asc' ? 'desc' : 'asc';
      } else {
        orden.campo = campo;
        orden.dir = (campo === 'fecha' || campo === 'monto') ? 'desc' : 'asc';
      }
      pintarTabla();
    });
  });
})();
