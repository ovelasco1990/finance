/* =============================================================================
 * ajustes.js  ·  CONFIGURACIÓN Y RESPALDO (ajustes.html)
 * -----------------------------------------------------------------------------
 * Preferencias (nombre, moneda/símbolo, tema), exportar/importar JSON, borrar
 * todo y restablecer datos de ejemplo. Capa Datos asíncrona (await).
 * ========================================================================== */

(() => {
  'use strict';

  const el = (id) => document.getElementById(id);

  /* --- Preferencias ------------------------------------------------------- */
  async function cargarFormulario() {
    const a = await Datos.getAjustes();
    el('aj-nombre').value = a.nombre_usuario || '';
    el('aj-moneda').value = a.moneda || 'MXN';
    el('aj-simbolo').value = a.simbolo || '$';
    el('aj-tema').value = a.tema || 'oscuro';
    // Notificaciones
    el('aj-notif-os').checked = !!a.notif_os;
    el('aj-dias-aviso').value = a.dias_aviso || 5;
    pintarEstadoNotif();
  }

  async function guardarPreferencias(evento) {
    evento.preventDefault();
    const tema = el('aj-tema').value;
    const nombre = el('aj-nombre').value.trim() || 'Usuario';

    await Datos.saveAjustes({
      nombre_usuario: nombre,
      moneda: el('aj-moneda').value.trim() || 'MXN',
      simbolo: el('aj-simbolo').value.trim() || '$',
      tema: tema,
    });
    // Refrescar la caché de App para que formatearMoneda use el nuevo símbolo.
    await App.refrescarAjustes();

    // Aplicar de inmediato lo que se ve: tema y nombre en la navbar.
    document.documentElement.setAttribute('data-theme', tema === 'oscuro' ? 'dark' : 'light');
    const iconoTema = el('icono-tema');
    if (iconoTema) iconoTema.className = tema === 'oscuro' ? 'bi bi-sun-fill' : 'bi bi-moon-stars-fill';
    const nombreNav = el('nombre-usuario');
    if (nombreNav) nombreNav.textContent = nombre;

    App.mostrarToast('Ajustes guardados ✓', 'exito');
  }

  /* --- Notificaciones ----------------------------------------------------- */

  /** Muestra el estado del permiso del navegador bajo el switch. */
  function pintarEstadoNotif() {
    const cont = el('aj-notif-estado');
    if (!cont) return;
    const p = Notificaciones.permiso();
    const mapa = {
      granted:     { icono: 'bi-check-circle-fill', color: 'var(--ingreso)', txt: 'Permiso concedido: verás las notificaciones del sistema.' },
      denied:      { icono: 'bi-x-octagon-fill',    color: 'var(--gasto)',   txt: 'Permiso bloqueado por el navegador. Habilítalo desde el candado 🔒 de la barra de direcciones; mientras tanto los avisos se muestran dentro de la app.' },
      default:     { icono: 'bi-question-circle-fill', color: 'var(--acento)', txt: 'Permiso pendiente: al activar el switch el navegador te lo pedirá.' },
      unsupported: { icono: 'bi-slash-circle-fill', color: 'var(--texto-suave)', txt: 'Tu navegador no soporta notificaciones del sistema; los avisos se mostrarán dentro de la app.' },
    };
    const e = mapa[p] || mapa.default;
    cont.innerHTML = `<i class="bi ${e.icono} me-1" style="color:${e.color}"></i>${e.txt}`;
  }

  /** Al activar el switch, si el permiso está pendiente, pedirlo (gesto del usuario). */
  async function alCambiarSwitchNotif() {
    if (el('aj-notif-os').checked && Notificaciones.permiso() === 'default') {
      await Notificaciones.pedirPermiso();
      pintarEstadoNotif();
    }
  }

  async function guardarNotificaciones(evento) {
    evento.preventDefault();
    let dias = parseInt(el('aj-dias-aviso').value, 10);
    if (isNaN(dias) || dias < 1) dias = 5;
    if (dias > 60) dias = 60;
    el('aj-dias-aviso').value = dias;

    await Datos.saveAjustes({ notif_os: el('aj-notif-os').checked, dias_aviso: dias });
    await App.refrescarAjustes();
    pintarEstadoNotif();
    App.mostrarToast('Notificaciones guardadas ✓', 'exito');
  }

  /* --- Exportar ----------------------------------------------------------- */
  async function exportar() {
    const datos = await Datos.exportarTodo();
    const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `respaldo-finanzas-${App.hoyISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    App.mostrarToast('Respaldo descargado ✓', 'exito');
  }

  /* --- Importar ----------------------------------------------------------- */
  function importar(evento) {
    const archivo = evento.target.files[0];
    if (!archivo) return;

    const lector = new FileReader();
    lector.onload = async (e) => {
      let datos;
      try {
        datos = JSON.parse(e.target.result);
      } catch (err) {
        App.mostrarToast('El archivo no es un JSON válido.', 'error');
        limpiarInputArchivo();
        return;
      }

      const ok = await App.confirmar(
        'Importar reemplazará TODOS tus datos actuales por los del archivo. ¿Continuar?',
        { titulo: 'Importar datos', textoOk: 'Sí, importar', peligro: true }
      );
      if (!ok) { limpiarInputArchivo(); return; }

      // La capa Datos valida la estructura antes de sobrescribir.
      const resultado = await Datos.importarTodo(datos);
      if (!resultado.ok) {
        App.mostrarToast(resultado.motivo, 'error');
        limpiarInputArchivo();
        return;
      }
      App.mostrarToast('Datos importados ✓ Recargando…', 'exito');
      setTimeout(() => location.reload(), 900);
    };
    lector.readAsText(archivo);
  }

  function limpiarInputArchivo() {
    el('input-importar').value = '';
  }

  /* --- Borrar todo (doble confirmación) ---------------------------------- */
  async function borrarTodo() {
    const paso1 = await App.confirmar(
      '¿Seguro que quieres borrar TODOS los datos? Esta acción no se puede deshacer.',
      { titulo: 'Borrar todo', textoOk: 'Continuar', peligro: true }
    );
    if (!paso1) return;

    const paso2 = await App.confirmar(
      'Última confirmación: se eliminarán movimientos, categorías, presupuestos, ahorro y recurrentes.',
      { titulo: '¿Estás totalmente seguro?', textoOk: 'Sí, borrar todo', peligro: true }
    );
    if (!paso2) return;

    await Datos.borrarTodo();
    App.mostrarToast('Todos los datos fueron borrados. Recargando…', 'info');
    setTimeout(() => location.reload(), 900);
  }

  /* --- Restablecer datos de ejemplo -------------------------------------- */
  async function restablecer() {
    const ok = await App.confirmar(
      'Esto reemplazará tus datos actuales por los datos de ejemplo iniciales. ¿Continuar?',
      { titulo: 'Restablecer ejemplo', textoOk: 'Restablecer', peligro: true }
    );
    if (!ok) return;
    await Datos.restablecerEjemplo();
    App.mostrarToast('Datos de ejemplo restaurados. Recargando…', 'info');
    setTimeout(() => location.reload(), 900);
  }

  /* --- Arranque ----------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', async () => {
    await App.listo;
    await cargarFormulario();
    el('form-ajustes').addEventListener('submit', guardarPreferencias);
    el('form-notif').addEventListener('submit', guardarNotificaciones);
    el('aj-notif-os').addEventListener('change', alCambiarSwitchNotif);
    el('btn-notif-prueba').addEventListener('click', () => Notificaciones.probar());
    el('btn-exportar').addEventListener('click', exportar);
    el('input-importar').addEventListener('change', importar);
    el('btn-borrar').addEventListener('click', borrarTodo);
    el('btn-restablecer').addEventListener('click', restablecer);
  });
})();
