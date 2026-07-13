/* =============================================================================
 * categorias.js  ·  GESTIÓN DE CATEGORÍAS (categorias.html)
 * -----------------------------------------------------------------------------
 * CRUD con nombre, tipo, color e icono (Bootstrap Icons). No se permite borrar
 * una categoría en uso: esa regla vive en la capa Datos. Capa asíncrona (await).
 * ========================================================================== */

(() => {
  'use strict';

  let modal;
  const el = (id) => document.getElementById(id);

  const ICONOS = [
    'bi-cash-stack', 'bi-wallet2', 'bi-piggy-bank', 'bi-laptop', 'bi-briefcase',
    'bi-egg-fried', 'bi-cup-hot', 'bi-cart', 'bi-bag', 'bi-bus-front',
    'bi-fuel-pump', 'bi-house-gear', 'bi-lightning-charge', 'bi-wifi', 'bi-phone',
    'bi-controller', 'bi-film', 'bi-music-note-beamed', 'bi-heart-pulse', 'bi-capsule',
    'bi-mortarboard', 'bi-book', 'bi-gift', 'bi-airplane', 'bi-house-heart',
    'bi-credit-card', 'bi-piggy-bank-fill', 'bi-tag', 'bi-star', 'bi-tools',
  ];

  /* --- Listado ------------------------------------------------------------ */
  async function pintar() {
    const cats = await Datos.getCategorias();
    pintarGrupo(cats.filter(c => c.tipo === 'ingreso'), 'lista-ingresos', 'vacio-ingresos');
    pintarGrupo(cats.filter(c => c.tipo === 'gasto'), 'lista-gastos', 'vacio-gastos');
  }

  function pintarGrupo(lista, idLista, idVacio) {
    const cont = el(idLista);
    const vacio = el(idVacio);
    if (lista.length === 0) {
      cont.innerHTML = '';
      vacio.classList.remove('d-none');
      return;
    }
    vacio.classList.add('d-none');
    cont.innerHTML = lista.map(c => `
      <div class="col-12 col-sm-6 col-lg-4">
        <div class="glass p-3 d-flex align-items-center gap-3 h-100">
          <span class="icono" style="background:${App.colorTenue(c.color)};color:${c.color}">
            <i class="bi ${c.icono}"></i>
          </span>
          <div class="flex-grow-1">
            <div class="fw-semibold">${c.nombre}</div>
            <div class="small text-suave">${c.tipo === 'ingreso' ? 'Ingreso' : 'Gasto'}</div>
          </div>
          <div class="text-nowrap">
            <button class="btn-icono btn-editar" data-id="${c.id}" title="Editar" aria-label="Editar categoría"><i class="bi bi-pencil"></i></button>
            <button class="btn-icono btn-eliminar" data-id="${c.id}" title="Eliminar" aria-label="Eliminar categoría"><i class="bi bi-trash"></i></button>
          </div>
        </div>
      </div>`).join('');
  }

  /* --- Formulario --------------------------------------------------------- */
  function pintarSelectorIconos(iconoActivo) {
    el('selector-iconos').innerHTML = ICONOS.map(ic => `
      <button type="button" class="btn-icono btn-icono-opcion ${ic === iconoActivo ? 'activo' : ''}" data-icono="${ic}" aria-label="Icono ${ic}">
        <i class="bi ${ic}"></i>
      </button>`).join('');
  }

  function actualizarPreview() {
    const preview = el('cat-preview');
    const color = el('cat-color').value;
    const icono = el('cat-icono').value || 'bi-tag';
    preview.style.background = App.colorTenue(color);
    preview.style.color = color;
    preview.querySelector('i').className = 'bi ' + icono;
  }

  function seleccionarIcono(icono) {
    el('cat-icono').value = icono;
    document.querySelectorAll('.btn-icono-opcion').forEach(b => {
      b.classList.toggle('activo', b.dataset.icono === icono);
    });
    actualizarPreview();
  }

  function abrirNueva() {
    el('form-categoria').reset();
    el('form-categoria').classList.remove('was-validated');
    el('cat-id').value = '';
    el('titulo-modal').textContent = 'Nueva categoría';
    el('cat-ingreso').checked = true;
    el('cat-color').value = '#6366f1';
    el('cat-nombre').classList.remove('is-invalid');
    pintarSelectorIconos(ICONOS[0]);
    seleccionarIcono(ICONOS[0]);
    modal.show();
  }

  async function abrirEdicion(id) {
    const c = await Datos.getCategoria(id);
    if (!c) return;
    el('form-categoria').reset();
    el('form-categoria').classList.remove('was-validated');
    el('cat-id').value = c.id;
    el('titulo-modal').textContent = 'Editar categoría';
    el('cat-nombre').value = c.nombre;
    el('cat-nombre').classList.remove('is-invalid');
    document.querySelector(`input[name="cat-tipo"][value="${c.tipo}"]`).checked = true;
    el('cat-color').value = c.color;
    pintarSelectorIconos(c.icono);
    seleccionarIcono(c.icono);
    modal.show();
  }

  async function guardar(evento) {
    evento.preventDefault();
    const nombre = el('cat-nombre').value.trim();
    if (!nombre) {
      el('cat-nombre').classList.add('is-invalid');
      return;
    }

    const id = el('cat-id').value;
    await Datos.saveCategoria({
      id: id || undefined,
      nombre: nombre,
      tipo: document.querySelector('input[name="cat-tipo"]:checked').value,
      color: el('cat-color').value,
      icono: el('cat-icono').value || 'bi-tag',
    });

    modal.hide();
    await pintar();
    App.mostrarToast(id ? 'Categoría actualizada ✓' : 'Categoría creada ✓', 'exito');
  }

  async function eliminar(id) {
    const c = await Datos.getCategoria(id);
    const ok = await App.confirmar(`¿Eliminar la categoría "${c?.nombre}"?`, {
      titulo: 'Eliminar categoría', textoOk: 'Eliminar', peligro: true,
    });
    if (!ok) return;

    // La capa Datos decide si se puede borrar (no si está en uso).
    const resultado = await Datos.deleteCategoria(id);
    if (!resultado.ok) {
      App.mostrarToast(resultado.motivo, 'error');
      return;
    }
    await pintar();
    App.mostrarToast('Categoría eliminada', 'info');
  }

  /* --- Arranque ----------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', async () => {
    await App.listo;
    modal = new bootstrap.Modal(el('modal-categoria'));
    await pintar();

    el('btn-nueva').addEventListener('click', abrirNueva);
    el('form-categoria').addEventListener('submit', guardar);
    el('cat-color').addEventListener('input', actualizarPreview);

    el('selector-iconos').addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-icono-opcion');
      if (btn) seleccionarIcono(btn.dataset.icono);
    });

    ['lista-ingresos', 'lista-gastos'].forEach(idLista => {
      el(idLista).addEventListener('click', (e) => {
        const editar = e.target.closest('.btn-editar');
        const eliminarBtn = e.target.closest('.btn-eliminar');
        if (editar) abrirEdicion(editar.dataset.id);
        if (eliminarBtn) eliminar(eliminarBtn.dataset.id);
      });
    });
  });
})();
