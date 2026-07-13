/* =============================================================================
 * ahorro.js  ·  ALCANCÍA / CUENTA DE AHORRO (ahorro.html)
 * -----------------------------------------------------------------------------
 * UNA alcancía: abonos y (opcional) retiros. Total acumulado + historial. Meta
 * OPCIONAL: con meta → barra de progreso; sin meta → solo el total. Capa Datos
 * asíncrona (await).
 * ========================================================================== */

(() => {
  'use strict';

  let modalAhorro, modalMeta;
  const el = (id) => document.getElementById(id);

  /* --- Pintar ------------------------------------------------------------- */
  async function pintar() {
    const total = await Datos.getTotalAhorrado();
    el('total-ahorrado').textContent = App.formatearMoneda(total);
    await pintarMeta(total);
    await pintarHistorial();
  }

  async function pintarMeta(total) {
    const bloque = el('bloque-meta');
    const objetivo = (await Datos.getAhorro()).objetivo;

    if (!objetivo || objetivo <= 0) {
      bloque.innerHTML = `
        <button class="btn btn-sm btn-outline-secondary" id="btn-meta">
          <i class="bi bi-flag me-1"></i> Definir meta de ahorro
        </button>`;
    } else {
      const porcentaje = Math.min((total / objetivo) * 100, 100);
      const alcanzada = total >= objetivo;
      bloque.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-1">
          <span class="small text-suave">Meta: ${App.formatearMoneda(objetivo)}</span>
          <button class="btn-icono" id="btn-meta" title="Editar meta" aria-label="Editar meta" style="width:32px;height:32px;font-size:.9rem">
            <i class="bi bi-pencil"></i>
          </button>
        </div>
        <div class="barra-progreso mb-2"><span style="width:${porcentaje}%"></span></div>
        <div class="small ${alcanzada ? 'text-ingreso fw-semibold' : 'text-suave'}">
          ${alcanzada
            ? '<i class="bi bi-trophy-fill me-1"></i>¡Meta alcanzada!'
            : `${porcentaje.toFixed(0)}% · te faltan ${App.formatearMoneda(objetivo - total)}`}
        </div>`;
    }
    el('btn-meta').addEventListener('click', abrirMeta);
  }

  async function pintarHistorial() {
    const cont = el('historial-ahorro');
    const lista = (await Datos.getAbonosAhorro()).slice().sort((a, b) => b.fecha.localeCompare(a.fecha));

    if (lista.length === 0) {
      cont.innerHTML = `<div class="estado-vacio"><i class="bi bi-piggy-bank"></i>Aún no hay movimientos de ahorro. Registra tu primer abono.</div>`;
      return;
    }

    cont.innerHTML = lista.map(a => {
      const esAbono = a.tipo !== 'retiro';
      const signo = esAbono ? '+' : '−';
      const clase = esAbono ? 'text-ingreso' : 'text-gasto';
      const color = esAbono ? 'var(--ingreso)' : 'var(--gasto)';
      return `
        <div class="timeline-item">
          <span class="punto" style="background:${esAbono ? 'rgba(22,163,74,.15)' : 'rgba(220,38,38,.15)'};color:${color}">
            <i class="bi ${esAbono ? 'bi-plus-circle' : 'bi-dash-circle'}"></i>
          </span>
          <div class="flex-grow-1">
            <div class="fw-semibold">${esAbono ? 'Abono' : 'Retiro'}</div>
            <div class="small text-suave">${a.nota || ''} ${a.nota ? '·' : ''} ${App.formatearFecha(a.fecha)}</div>
          </div>
          <div class="fw-bold ${clase}">${signo} ${App.formatearMoneda(a.monto)}</div>
          <button class="btn-icono btn-eliminar ms-2" data-id="${a.id}" title="Eliminar" aria-label="Eliminar movimiento de ahorro"><i class="bi bi-trash"></i></button>
        </div>`;
    }).join('');
  }

  /* --- Abono / retiro ----------------------------------------------------- */
  function abrirMovimiento(tipo) {
    el('form-ahorro').reset();
    el('aho-tipo').value = tipo;
    el('titulo-modal').textContent = tipo === 'abono' ? 'Registrar abono' : 'Registrar retiro';
    el('aho-fecha').value = App.hoyISO();
    el('aho-monto').classList.remove('is-invalid');
    el('aho-fecha').classList.remove('is-invalid');
    modalAhorro.show();
  }

  async function guardarMovimiento(evento) {
    evento.preventDefault();
    const monto = parseFloat(el('aho-monto').value);
    const fecha = el('aho-fecha').value;
    const tipo = el('aho-tipo').value;

    const montoOk = !isNaN(monto) && monto > 0;
    const fechaOk = !!fecha;
    el('aho-monto').classList.toggle('is-invalid', !montoOk);
    el('aho-fecha').classList.toggle('is-invalid', !fechaOk);
    if (!montoOk || !fechaOk) return;

    await Datos.saveAbonoAhorro({ tipo, monto, fecha, nota: el('aho-nota').value.trim() });
    modalAhorro.hide();
    await pintar();
    App.mostrarToast(tipo === 'abono' ? 'Abono registrado ✓' : 'Retiro registrado ✓', 'exito');
  }

  async function eliminar(id) {
    const ok = await App.confirmar('¿Eliminar este movimiento de ahorro?', {
      titulo: 'Eliminar del historial', textoOk: 'Eliminar', peligro: true,
    });
    if (!ok) return;
    await Datos.deleteAbonoAhorro(id);
    await pintar();
    App.mostrarToast('Movimiento eliminado', 'info');
  }

  /* --- Meta --------------------------------------------------------------- */
  async function abrirMeta() {
    el('meta-objetivo').value = (await Datos.getAhorro()).objetivo || '';
    modalMeta.show();
  }

  async function guardarMeta(evento) {
    evento.preventDefault();
    const valor = parseFloat(el('meta-objetivo').value);
    const objetivo = (!isNaN(valor) && valor > 0) ? valor : null; // vacío = quitar meta
    await Datos.setObjetivoAhorro(objetivo);
    modalMeta.hide();
    await pintar();
    App.mostrarToast(objetivo ? 'Meta guardada ✓' : 'Meta eliminada', 'exito');
  }

  /* --- Arranque ----------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', async () => {
    await App.listo;
    modalAhorro = new bootstrap.Modal(el('modal-ahorro'));
    modalMeta = new bootstrap.Modal(el('modal-meta'));
    await pintar();

    el('btn-abonar').addEventListener('click', () => abrirMovimiento('abono'));
    el('btn-retirar').addEventListener('click', () => abrirMovimiento('retiro'));
    el('form-ahorro').addEventListener('submit', guardarMovimiento);
    el('form-meta').addEventListener('submit', guardarMeta);

    el('historial-ahorro').addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-eliminar');
      if (btn) eliminar(btn.dataset.id);
    });
  });
})();
