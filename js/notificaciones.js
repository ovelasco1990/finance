/* =============================================================================
 * notificaciones.js  ·  MOTOR DE NOTIFICACIONES DEL SISTEMA
 * -----------------------------------------------------------------------------
 * Se carga en TODAS las páginas (después de app.js). Al arrancar revisa si hay
 * avisos que merezcan notificarse y, si el usuario activó las notificaciones y
 * concedió el permiso, dispara notificaciones del SISTEMA OPERATIVO (Web
 * Notifications API). Si no hay permiso, degrada a toasts internos.
 *
 * REPARTO DE RESPONSABILIDADES:
 *   - data.js  → QUÉ avisar (regla de negocio: Datos.getNotificaciones()).
 *   - este     → CÓMO mostrarlo (SO o toast) y NO repetir (anti-duplicados).
 *
 * IMPORTANTE — LÍMITES SIN BACKEND:
 *   Las notificaciones del SO solo se disparan mientras la app está ABIERTA
 *   (al cargar/navegar una página). No hay "push" con la app cerrada: eso
 *   necesitaría un servidor + service worker (queda para la v2 con PHP).
 *   Además la Web Notifications API exige contexto seguro: sirve la app por
 *   http://localhost/finance/ (XAMPP), no como archivo file://.
 *
 * Se expone bajo `Notificaciones`. Depende de: data.js (Datos), app.js (App).
 * ========================================================================== */

const Notificaciones = (() => {
  'use strict';

  const CAP_INDIVIDUALES = 3;   // más avisos que esto → una sola notificación resumen

  /** ¿El navegador soporta la Web Notifications API? */
  function soportado() {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  /** Estado actual del permiso: 'granted' | 'denied' | 'default' | 'unsupported'. */
  function permiso() {
    return soportado() ? Notification.permission : 'unsupported';
  }

  /**
   * Pide permiso al usuario. DEBE llamarse desde un gesto (click), por eso vive
   * aquí y se invoca desde Ajustes, no en la carga automática. Devuelve el
   * estado resultante ('granted'|'denied'|'default'|'unsupported').
   */
  async function pedirPermiso() {
    if (!soportado()) return 'unsupported';
    try {
      return await Notification.requestPermission();
    } catch (e) {
      console.error('Error pidiendo permiso de notificaciones', e);
      return permiso();
    }
  }

  /**
   * Dispara una notificación de PRUEBA a demanda (botón en Ajustes). Sirve para
   * confirmar que el permiso funciona sin depender de que existan avisos reales.
   * Devuelve el canal usado: 'so' | 'toast' | 'sin-permiso'.
   */
  function probar() {
    if (permiso() === 'granted') {
      lanzarSO('🔔 Notificación de prueba', 'Si ves esto, las notificaciones del sistema funcionan.', 'prueba-' + Date.now());
      return 'so';
    }
    if (soportado() && permiso() === 'default') {
      // Aún no concede: la mostramos como toast y avisamos.
      App.mostrarToast('Activa el permiso del navegador para ver notificaciones del sistema.', 'info');
      return 'sin-permiso';
    }
    App.mostrarToast('🔔 Notificación de prueba (dentro de la app)', 'info');
    return 'toast';
  }

  /** Dispara una notificación del SO. `tag` colapsa duplicados en el propio SO. */
  function lanzarSO(titulo, cuerpo, tag) {
    try {
      new Notification(titulo, { body: cuerpo, tag, icon: 'favicon.ico' });
    } catch (e) {
      // Algunos navegadores exigen service worker para notificar; degradamos.
      console.error('No se pudo lanzar la notificación del SO', e);
      App.mostrarToast(titulo + ' — ' + cuerpo, 'info');
    }
  }

  /**
   * Revisa los avisos pendientes y los muestra (una sola vez cada uno).
   * Se ejecuta en cada carga de página; el anti-duplicados evita el spam.
   */
  async function revisar() {
    const ajustes = await Datos.getAjustes();
    if (!ajustes.notif_os) return; // el usuario no las activó

    // 1. Calcular avisos y quitar los ya mostrados antes.
    const todos = await Datos.getNotificaciones();
    if (!todos.length) return;
    const vistas = new Set(await Datos.getNotificacionesVistas());
    const nuevos = todos.filter(a => !vistas.has(a.clave));
    if (!nuevos.length) return;

    // 2. Decidir el canal según el permiso.
    const p = permiso();
    const usarSO = p === 'granted';

    if (usarSO) {
      if (nuevos.length <= CAP_INDIVIDUALES) {
        nuevos.forEach(a => lanzarSO(a.titulo, a.cuerpo, a.clave));
      } else {
        // Muchos avisos: una sola notificación resumen para no saturar.
        lanzarSO(
          `Tienes ${nuevos.length} avisos en tus finanzas`,
          resumen(nuevos),
          'resumen-' + new Date().toDateString()
        );
      }
    } else {
      // Sin permiso (denegado, pendiente o no soportado): fallback a toasts.
      // Mostramos solo los primeros para no llenar la pantalla.
      nuevos.slice(0, CAP_INDIVIDUALES).forEach(a => {
        App.mostrarToast(a.titulo + ' — ' + a.cuerpo, tipoToast(a.tipo));
      });
    }

    // 3. Marcar TODOS como vistos (también en fallback) para no repetir.
    await Datos.marcarNotificacionesVistas(nuevos.map(a => a.clave));
  }

  /** Texto de resumen cuando hay muchos avisos. */
  function resumen(avisos) {
    const cuenta = {};
    avisos.forEach(a => { cuenta[a.tipo] = (cuenta[a.tipo] || 0) + 1; });
    const etq = {
      pendiente_vencido: 'vencidos',
      pendiente_vence: 'por vencer',
      presupuesto: 'de presupuesto',
      movimiento: 'de movimientos',
    };
    return Object.entries(cuenta)
      .map(([tipo, n]) => `${n} ${etq[tipo] || tipo}`)
      .join(' · ');
  }

  /** Mapea el tipo de aviso al estilo del toast de fallback. */
  function tipoToast(tipo) {
    if (tipo === 'pendiente_vencido' || tipo === 'presupuesto') return 'error';
    if (tipo === 'pendiente_vence') return 'info';
    return 'info';
  }

  /* --- Arranque: como cualquier página, espera a que App esté listo -------- */
  document.addEventListener('DOMContentLoaded', async () => {
    await App.listo;
    try {
      await revisar();
    } catch (e) {
      console.error('Error revisando notificaciones', e);
    }
  });

  /* --- API pública -------------------------------------------------------- */
  return { soportado, permiso, pedirPermiso, revisar, probar };
})();
