/* =============================================================================
 * app.js  ·  LÓGICA COMÚN A TODAS LAS PÁGINAS
 * -----------------------------------------------------------------------------
 * Se carga en TODAS las páginas y se encarga de lo compartido:
 *   1. Sembrar datos de ejemplo la primera vez (Datos.init).
 *   2. Cachear los AJUSTES en memoria (así formatearMoneda es síncrono).
 *   3. Aplicar el tema (claro/oscuro) y su toggle.
 *   4. Inyectar el LAYOUT común: sidebar + navbar.
 *   5. Sidebar responsivo (hamburguesa + backdrop).
 *   6. Selector de MES y aviso a la página cuando cambia.
 *   7. Utilidades: formato de moneda/fecha, color tenue, toasts y confirmación.
 *
 * Se expone bajo `App`. Como el arranque es asíncrono, las páginas deben
 * esperar `await App.listo` antes de dibujar (garantiza ajustes y navbar listos).
 * Depende de: data.js (Datos), Bootstrap 5, Bootstrap Icons.
 * ========================================================================== */

const App = (() => {
  'use strict';

  const PAGINAS = [
    { id: 'dashboard',    href: 'index.html',        icono: 'bi-speedometer2',     texto: 'Dashboard' },
    { id: 'movimientos',  href: 'movimientos.html',  icono: 'bi-arrow-left-right', texto: 'Movimientos' },
    { id: 'timeline',     href: 'timeline.html',     icono: 'bi-clock-history',    texto: 'Todo el historial' },
    { id: 'categorias',   href: 'categorias.html',   icono: 'bi-tags',             texto: 'Categorías' },
    { id: 'presupuestos', href: 'presupuestos.html', icono: 'bi-wallet2',          texto: 'Presupuestos' },
    { id: 'ahorro',       href: 'ahorro.html',       icono: 'bi-piggy-bank',       texto: 'Ahorro' },
    { id: 'recurrentes',  href: 'recurrentes.html',  icono: 'bi-arrow-repeat',     texto: 'Recurrentes' },
    { id: 'ajustes',      href: 'ajustes.html',      icono: 'bi-gear',             texto: 'Ajustes' },
  ];

  const NOMBRES_MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  const CLAVE_PERIODO_UI = 'fin_ui_periodo';

  /* Caché en memoria de los ajustes. Se rellena en el arranque. Permite que
   * formatearMoneda (llamada dentro de bucles de render) sea SÍNCRONA aunque
   * Datos.getAjustes sea asíncrona. */
  let ajustesCache = { moneda: 'MXN', simbolo: '$', nombre_usuario: 'Usuario', tema: 'oscuro' };

  /* Promesa que se resuelve cuando el arranque terminó. Las páginas hacen
   * `await App.listo` antes de dibujar. */
  let marcarListo;
  const listo = new Promise(res => { marcarListo = res; });


  /* ===========================================================================
   * TEMA
   * ========================================================================= */

  function aplicarTema(tema) {
    document.documentElement.setAttribute('data-theme', tema === 'oscuro' ? 'dark' : 'light');
    const icono = document.getElementById('icono-tema');
    if (icono) icono.className = tema === 'oscuro' ? 'bi bi-sun-fill' : 'bi bi-moon-stars-fill';
  }

  async function alternarTema() {
    const nuevo = ajustesCache.tema === 'oscuro' ? 'claro' : 'oscuro';
    await Datos.saveAjustes({ tema: nuevo });
    ajustesCache.tema = nuevo;
    aplicarTema(nuevo);
    // Avisar: algunos elementos (gráficas de Chart.js) leen los colores del
    // tema al dibujarse y necesitan redibujarse.
    document.dispatchEvent(new CustomEvent('temaCambiado', { detail: nuevo }));
  }

  /** Recarga la caché de ajustes desde la capa Datos (tras guardar en Ajustes). */
  async function refrescarAjustes() {
    ajustesCache = await Datos.getAjustes();
    return ajustesCache;
  }


  /* ===========================================================================
   * PERIODO (mes/año seleccionado, en sessionStorage)
   * ========================================================================= */

  function getPeriodo() {
    try {
      const g = JSON.parse(sessionStorage.getItem(CLAVE_PERIODO_UI));
      if (g && typeof g.anio === 'number' && typeof g.mes === 'number') return g;
    } catch (e) { /* al mes actual */ }
    const hoy = new Date();
    return { anio: hoy.getFullYear(), mes: hoy.getMonth() };
  }

  function setPeriodo(periodo) {
    sessionStorage.setItem(CLAVE_PERIODO_UI, JSON.stringify(periodo));
    actualizarEtiquetaPeriodo();
    document.dispatchEvent(new CustomEvent('periodoCambiado', { detail: periodo }));
  }

  function cambiarMes(delta) {
    const p = getPeriodo();
    const d = new Date(p.anio, p.mes + delta, 1);
    setPeriodo({ anio: d.getFullYear(), mes: d.getMonth() });
  }

  function etiquetaPeriodo() {
    const p = getPeriodo();
    return `${NOMBRES_MES[p.mes]} ${p.anio}`;
  }

  function esDelPeriodo(fechaISO) {
    if (!fechaISO) return false;
    const [anio, mes] = fechaISO.split('-').map(Number);
    const p = getPeriodo();
    return anio === p.anio && (mes - 1) === p.mes;
  }

  function filtrarPorPeriodo(lista, campoFecha = 'fecha') {
    return lista.filter(item => esDelPeriodo(item[campoFecha]));
  }

  function actualizarEtiquetaPeriodo() {
    const el = document.getElementById('etiqueta-periodo');
    if (el) el.textContent = etiquetaPeriodo();
  }


  /* ===========================================================================
   * UTILIDADES DE FORMATO Y COLOR
   * ========================================================================= */

  /** Formatea como moneda usando la caché de ajustes. Negativos: "-$1,250.00". */
  function formatearMoneda(monto) {
    const n = Number(monto || 0);
    const abs = Math.abs(n).toLocaleString('es-MX', {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    });
    return (n < 0 ? '-' : '') + (ajustesCache.simbolo || '$') + abs;
  }

  function formatearFecha(fechaISO) {
    if (!fechaISO) return '';
    const [anio, mes, dia] = fechaISO.split('-').map(Number);
    const mesCorto = NOMBRES_MES[mes - 1].slice(0, 3).toLowerCase();
    return `${dia} ${mesCorto} ${anio}`;
  }

  function hoyISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  /** Formatea un timestamp ISO (creado_en) como "13 jul 2026, 14:30". */
  function formatearFechaHora(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const mesCorto = NOMBRES_MES[d.getMonth()].slice(0, 3).toLowerCase();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${d.getDate()} ${mesCorto} ${d.getFullYear()}, ${hh}:${mm}`;
  }

  /**
   * Convierte un color HEX (#rrggbb) en un fondo translúcido rgba(...).
   * Si no es hex (ej. una var() CSS), devuelve un gris tenue por defecto.
   * Centralizado aquí para no repetir esta función en cada página.
   */
  function colorTenue(color, alpha = 0.15) {
    if (typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color)) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      return `rgba(${r},${g},${b},${alpha})`;
    }
    return `rgba(148,163,184,${alpha})`;
  }


  /* ===========================================================================
   * TOASTS
   * ========================================================================= */

  function contenedorToasts() {
    let cont = document.getElementById('contenedor-toasts');
    if (!cont) {
      cont = document.createElement('div');
      cont.id = 'contenedor-toasts';
      cont.className = 'toast-container position-fixed bottom-0 end-0 p-3';
      cont.style.zIndex = '1090';
      document.body.appendChild(cont);
    }
    return cont;
  }

  function mostrarToast(mensaje, tipo = 'exito') {
    const estilos = {
      exito: { icono: 'bi-check-circle-fill', color: 'var(--ingreso)' },
      error: { icono: 'bi-exclamation-triangle-fill', color: 'var(--gasto)' },
      info:  { icono: 'bi-info-circle-fill', color: 'var(--acento)' },
    };
    const est = estilos[tipo] || estilos.exito;

    const toast = document.createElement('div');
    toast.className = 'toast glass align-items-center border-0 animate__animated animate__fadeInUp';
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `
      <div class="d-flex">
        <div class="toast-body d-flex align-items-center gap-2">
          <i class="bi ${est.icono}" style="color:${est.color};font-size:1.2rem"></i>
          <span>${mensaje}</span>
        </div>
        <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast" aria-label="Cerrar"></button>
      </div>`;
    contenedorToasts().appendChild(toast);
    const bsToast = new bootstrap.Toast(toast, { delay: 3000 });
    bsToast.show();
    toast.addEventListener('hidden.bs.toast', () => toast.remove());
  }


  /* ===========================================================================
   * MODAL DE CONFIRMACIÓN reutilizable → Promesa (true/false)
   * ========================================================================= */

  function confirmar(mensaje, { titulo = 'Confirmar', textoOk = 'Aceptar', peligro = false } = {}) {
    return new Promise(resolve => {
      let modalEl = document.getElementById('modal-confirmar');
      if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = 'modal-confirmar';
        modalEl.className = 'modal fade';
        modalEl.tabIndex = -1;
        modalEl.innerHTML = `
          <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content glass animate__animated animate__fadeInDown animate__faster">
              <div class="modal-header">
                <h5 class="modal-title" id="modal-confirmar-titulo"></h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
              </div>
              <div class="modal-body" id="modal-confirmar-cuerpo"></div>
              <div class="modal-footer">
                <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>
                <button type="button" class="btn" id="modal-confirmar-ok"></button>
              </div>
            </div>
          </div>`;
        document.body.appendChild(modalEl);
      }

      modalEl.querySelector('#modal-confirmar-titulo').textContent = titulo;
      modalEl.querySelector('#modal-confirmar-cuerpo').textContent = mensaje;
      const btnOk = modalEl.querySelector('#modal-confirmar-ok');
      btnOk.textContent = textoOk;
      btnOk.className = 'btn ' + (peligro ? 'btn-danger' : 'btn-acento');

      const modal = new bootstrap.Modal(modalEl);
      let resultado = false;
      const alAceptar = () => { resultado = true; modal.hide(); };
      btnOk.addEventListener('click', alAceptar, { once: true });
      modalEl.addEventListener('hidden.bs.modal', () => {
        btnOk.removeEventListener('click', alAceptar);
        resolve(resultado);
      }, { once: true });
      modal.show();
    });
  }


  /* ===========================================================================
   * INYECCIÓN DEL LAYOUT y arranque
   * ========================================================================= */

  function inyectarSidebar(paginaActual) {
    const enlaces = PAGINAS.map(p => `
      <a href="${p.href}" class="nav-link ${p.id === paginaActual ? 'active' : ''}">
        <i class="bi ${p.icono}"></i><span>${p.texto}</span>
      </a>`).join('');

    const sidebar = document.createElement('aside');
    sidebar.className = 'sidebar';
    sidebar.id = 'sidebar';
    sidebar.innerHTML = `
      <div class="marca"><i class="bi bi-wallet-fill"></i><span>Finanzas</span></div>
      <nav class="nav flex-column">${enlaces}</nav>`;
    document.body.prepend(sidebar);

    const backdrop = document.createElement('div');
    backdrop.className = 'sidebar-backdrop';
    backdrop.id = 'sidebar-backdrop';
    backdrop.addEventListener('click', cerrarSidebar);
    document.body.appendChild(backdrop);
  }

  function inyectarNavbar(titulo, usaPeriodo) {
    const selectorMes = usaPeriodo ? `
      <div class="nav-periodo d-flex align-items-center gap-2">
        <button class="btn-icono" id="mes-anterior" title="Mes anterior" aria-label="Mes anterior"><i class="bi bi-chevron-left"></i></button>
        <span id="etiqueta-periodo" class="fw-semibold" style="min-width:130px;text-align:center"></span>
        <button class="btn-icono" id="mes-siguiente" title="Mes siguiente" aria-label="Mes siguiente"><i class="bi bi-chevron-right"></i></button>
      </div>` : '';

    const navbar = document.createElement('header');
    navbar.className = 'navbar-top';
    navbar.innerHTML = `
      <div class="d-flex align-items-center gap-2">
        <button class="btn-icono btn-menu" id="abrir-menu" title="Menú" aria-label="Abrir menú"><i class="bi bi-list"></i></button>
        <h1 class="h5 mb-0">${titulo}</h1>
      </div>
      ${selectorMes}
      <div class="d-flex align-items-center gap-2">
        <span class="text-suave d-none d-sm-inline"><i class="bi bi-person-circle me-1"></i><span id="nombre-usuario">${ajustesCache.nombre_usuario || 'Usuario'}</span></span>
        <button class="btn-tema" id="toggle-tema" title="Cambiar tema" aria-label="Cambiar tema"><i id="icono-tema" class="bi bi-moon-stars-fill"></i></button>
      </div>`;

    const contenido = document.querySelector('.contenido');
    if (contenido) contenido.prepend(navbar);

    document.getElementById('toggle-tema').addEventListener('click', alternarTema);
    document.getElementById('abrir-menu').addEventListener('click', abrirSidebar);
    if (usaPeriodo) {
      document.getElementById('mes-anterior').addEventListener('click', () => cambiarMes(-1));
      document.getElementById('mes-siguiente').addEventListener('click', () => cambiarMes(1));
      actualizarEtiquetaPeriodo();
    }
  }

  function abrirSidebar() {
    document.getElementById('sidebar')?.classList.add('abierto');
    document.getElementById('sidebar-backdrop')?.classList.add('visible');
  }
  function cerrarSidebar() {
    document.getElementById('sidebar')?.classList.remove('abierto');
    document.getElementById('sidebar-backdrop')?.classList.remove('visible');
  }

  /** Arranque común (asíncrono). Al terminar, resuelve App.listo. */
  async function iniciar() {
    await Datos.init();          // sembrar mock la primera vez
    await refrescarAjustes();    // llenar la caché de ajustes

    const body = document.body;
    const paginaActual = body.dataset.pagina || '';
    const titulo = body.dataset.titulo || 'Finanzas';
    const usaPeriodo = body.dataset.periodo === 'true';

    aplicarTema(ajustesCache.tema);
    inyectarSidebar(paginaActual);
    inyectarNavbar(titulo, usaPeriodo);

    marcarListo(); // desbloquea a las páginas que esperan `await App.listo`
  }

  document.addEventListener('DOMContentLoaded', iniciar);


  /* ---------------------------------------------------------------------------
   * API PÚBLICA
   * ------------------------------------------------------------------------- */
  return {
    listo,
    formatearMoneda, formatearFecha, formatearFechaHora, hoyISO, colorTenue,
    getPeriodo, setPeriodo, cambiarMes, etiquetaPeriodo, esDelPeriodo, filtrarPorPeriodo,
    mostrarToast, confirmar,
    alternarTema, refrescarAjustes,
  };
})();
