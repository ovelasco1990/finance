/* =============================================================================
 * presupuestos.js  ·  PRESUPUESTOS POR CATEGORÍA (presupuestos.html)
 * -----------------------------------------------------------------------------
 * Límite mensual por categoría de gasto + barra gastado-vs-límite del mes
 * seleccionado. Estados de color: normal (<80%), aviso (80–100%), excedido.
 * Capa Datos asíncrona (await). Se recalcula al cambiar de mes.
 * ========================================================================== */

(() => {
  'use strict';

  let modal;
  const el = (id) => document.getElementById(id);

  /* --- Listado ------------------------------------------------------------ */
  async function pintar() {
    const cont = el('lista-presupuestos');
    const vacio = el('presupuestos-vacio');
    const presupuestos = await Datos.getPresupuestos();

    if (presupuestos.length === 0) {
      cont.innerHTML = '';
      vacio.classList.remove('d-none');
      return;
    }
    vacio.classList.add('d-none');

    // Cargamos categorías y movimientos del mes UNA vez (no por presupuesto).
    const cats = new Map((await Datos.getCategorias()).map(c => [c.id, c]));
    const gastosMes = App.filtrarPorPeriodo(await Datos.getMovimientos()).filter(m => m.tipo === 'gasto');
    const gastadoPorCat = {};
    gastosMes.forEach(m => { gastadoPorCat[m.categoria_id] = (gastadoPorCat[m.categoria_id] || 0) + Number(m.monto); });

    cont.innerHTML = presupuestos.map(p => {
      const cat = cats.get(p.categoria_id);
      const gastado = gastadoPorCat[p.categoria_id] || 0;
      const limite = Number(p.limite_mensual);
      const porcentaje = limite > 0 ? (gastado / limite) * 100 : 0;
      const restante = limite - gastado;

      let claseBarra = '', alerta = '';
      if (porcentaje >= 100) {
        claseBarra = 'excedido';
        alerta = '<span class="text-gasto small"><i class="bi bi-exclamation-triangle-fill me-1"></i>Límite superado</span>';
      } else if (porcentaje >= 80) {
        claseBarra = 'aviso';
        alerta = '<span class="small" style="color:var(--alerta)"><i class="bi bi-exclamation-circle me-1"></i>Cerca del límite</span>';
      }

      return `
        <div class="col-12 col-lg-6">
          <div class="glass p-4 h-100 animate__animated animate__fadeIn">
            <div class="d-flex align-items-center gap-2 mb-3">
              <span class="icono" style="background:${App.colorTenue(cat?.color)};color:${cat?.color || 'var(--gasto)'};width:42px;height:42px;font-size:1.1rem">
                <i class="bi ${cat?.icono || 'bi-tag'}"></i>
              </span>
              <div class="flex-grow-1">
                <div class="fw-semibold">${cat?.nombre || 'Sin categoría'}</div>
                <div class="small text-suave">Límite: ${App.formatearMoneda(limite)}</div>
              </div>
              <div class="text-nowrap">
                <button class="btn-icono btn-editar" data-id="${p.id}" title="Editar" aria-label="Editar presupuesto"><i class="bi bi-pencil"></i></button>
                <button class="btn-icono btn-eliminar" data-id="${p.id}" title="Eliminar" aria-label="Eliminar presupuesto"><i class="bi bi-trash"></i></button>
              </div>
            </div>

            <div class="barra-progreso ${claseBarra} mb-2"><span style="width:${Math.min(porcentaje, 100)}%"></span></div>

            <div class="d-flex justify-content-between align-items-center">
              <span class="small"><strong>${App.formatearMoneda(gastado)}</strong> <span class="text-suave">de ${App.formatearMoneda(limite)}</span></span>
              <span class="small fw-semibold">${porcentaje.toFixed(0)}%</span>
            </div>
            <div class="d-flex justify-content-between align-items-center mt-1">
              <span class="small text-suave">
                ${restante >= 0 ? `Te quedan ${App.formatearMoneda(restante)}` : `Te pasaste ${App.formatearMoneda(Math.abs(restante))}`}
              </span>
              ${alerta}
            </div>
          </div>
        </div>`;
    }).join('');
  }

  /* --- Formulario --------------------------------------------------------- */
  /**
   * Llena el select con TODAS las categorías de gasto. Las que ya tienen
   * presupuesto se muestran deshabilitadas con la nota "— ya tiene presupuesto"
   * (una categoría, un presupuesto), salvo la que estamos editando. Al final se
   * fija el valor de forma explícita para que la edición muestre su categoría.
   */
  async function llenarCategorias(seleccionada = '') {
    const gastoCats = (await Datos.getCategorias()).filter(c => c.tipo === 'gasto');
    const conPresupuesto = new Set((await Datos.getPresupuestos()).map(p => p.categoria_id));

    const opciones = gastoCats.map(c => {
      // Ocupada = ya tiene presupuesto y no es la que estamos editando.
      const ocupada = conPresupuesto.has(c.id) && c.id !== seleccionada;
      return `<option value="${c.id}" ${ocupada ? 'disabled' : ''}>${c.nombre}${ocupada ? ' — ya tiene presupuesto' : ''}</option>`;
    }).join('');

    el('pre-categoria').innerHTML = '<option value="">Selecciona…</option>' + opciones;
    el('pre-categoria').value = seleccionada || ''; // fija la selección al editar
  }

  async function abrirNuevo() {
    el('form-presupuesto').reset();
    el('pre-id').value = '';
    el('titulo-modal').textContent = 'Nuevo presupuesto';
    el('pre-categoria').classList.remove('is-invalid');
    el('pre-limite').classList.remove('is-invalid');
    el('pre-categoria').disabled = false;
    await llenarCategorias();
    modal.show();
  }

  async function abrirEdicion(id) {
    const p = (await Datos.getPresupuestos()).find(x => x.id === id);
    if (!p) return;
    el('form-presupuesto').reset();
    el('pre-id').value = p.id;
    el('titulo-modal').textContent = 'Editar presupuesto';
    el('pre-categoria').classList.remove('is-invalid');
    el('pre-limite').classList.remove('is-invalid');
    await llenarCategorias(p.categoria_id);
    el('pre-categoria').disabled = true; // no se cambia la categoría al editar
    el('pre-limite').value = p.limite_mensual;
    modal.show();
  }

  async function guardar(evento) {
    evento.preventDefault();
    const categoria = el('pre-categoria').value;
    const limite = parseFloat(el('pre-limite').value);

    const catOk = !!categoria;
    const limiteOk = !isNaN(limite) && limite > 0;
    el('pre-categoria').classList.toggle('is-invalid', !catOk);
    el('pre-limite').classList.toggle('is-invalid', !limiteOk);
    if (!catOk || !limiteOk) return;

    const id = el('pre-id').value;
    await Datos.savePresupuesto({ id: id || undefined, categoria_id: categoria, limite_mensual: limite });

    modal.hide();
    await pintar();
    App.mostrarToast(id ? 'Presupuesto actualizado ✓' : 'Presupuesto creado ✓', 'exito');
  }

  async function eliminar(id) {
    const p = (await Datos.getPresupuestos()).find(x => x.id === id);
    const cat = await Datos.getCategoria(p?.categoria_id);
    const ok = await App.confirmar(`¿Eliminar el presupuesto de "${cat?.nombre}"?`, {
      titulo: 'Eliminar presupuesto', textoOk: 'Eliminar', peligro: true,
    });
    if (!ok) return;
    await Datos.deletePresupuesto(id);
    await pintar();
    App.mostrarToast('Presupuesto eliminado', 'info');
  }

  /* --- Arranque ----------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', async () => {
    await App.listo;
    modal = new bootstrap.Modal(el('modal-presupuesto'));
    await pintar();

    el('btn-nuevo').addEventListener('click', abrirNuevo);
    el('form-presupuesto').addEventListener('submit', guardar);

    el('lista-presupuestos').addEventListener('click', (e) => {
      const editar = e.target.closest('.btn-editar');
      const eliminarBtn = e.target.closest('.btn-eliminar');
      if (editar) abrirEdicion(editar.dataset.id);
      if (eliminarBtn) eliminar(eliminarBtn.dataset.id);
    });

    document.addEventListener('periodoCambiado', pintar);
  });
})();
