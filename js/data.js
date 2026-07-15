/* =============================================================================
 * data.js  ·  CAPA DE ACCESO A DATOS
 * -----------------------------------------------------------------------------
 * REGLA DE ORO del proyecto:
 *   Ninguna pantalla (dashboard.js, movimientos.js, etc.) toca localStorage
 *   directamente. TODO pasa por las funciones de este archivo.
 *
 * ¿Por qué? Porque hoy los datos viven en localStorage, pero mañana vivirán en
 * una base de datos MySQL detrás de una API PHP. El día de la migración solo se
 * cambia el INTERIOR de estas funciones (de localStorage a fetch()) y el resto
 * de la app ni se entera.
 *
 * IMPORTANTE — TODAS las funciones públicas son ASÍNCRONAS (devuelven Promesas)
 * aunque hoy respondan al instante. Se hizo así a propósito: cuando migremos a
 * `fetch()` (que es asíncrono), la firma NO cambia y las páginas —que ya usan
 * `await`— siguen funcionando sin tocarlas. Ese es el único punto donde, si no
 * lo previéramos ahora, habría que reescribir la UI después.
 *
 * Uso desde una pantalla:  const lista = await Datos.getMovimientos();
 * ========================================================================== */

const Datos = (() => {
  'use strict';

  /* ---------------------------------------------------------------------------
   * CLAVES de localStorage. Prefijo `fin_`. Cada clave = futura TABLA de la BD.
   * ------------------------------------------------------------------------- */
  const CLAVES = {
    movimientos:   'fin_movimientos',
    categorias:    'fin_categorias',
    presupuestos:  'fin_presupuestos',
    ahorro:        'fin_ahorro',        // objeto único: la alcancía (objetivo)
    abonosAhorro:  'fin_abonos_ahorro', // movimientos de la alcancía
    recurrentes:   'fin_recurrentes',
    pendientes:    'fin_pendientes',    // cargos previstos que aún NO afectan el balance
    ajustes:       'fin_ajustes',
    sembrado:      'fin_sembrado',      // bandera: ¿ya cargamos el mock inicial?
  };

  /* ===========================================================================
   * ESQUEMA DE DATOS  (así serán las tablas en MySQL v2)
   * ---------------------------------------------------------------------------
   * movimientos      { id, tipo:'ingreso'|'gasto', monto:Number, fecha:'YYYY-MM-DD',
   *                    categoria_id:String, nota:String,
   *                    creado_en:String,        // ISO: cuándo se REGISTRÓ (≠ fecha contable)
   *                    recurrente_id?:String }  // opcional: si nació de un recurrente
   *
   * categorias       { id, nombre:String, tipo:'ingreso'|'gasto',
   *                    color:'#rrggbb', icono:'bi-...' }  // icono = Bootstrap Icons
   *
   * presupuestos     { id, categoria_id:String, limite_mensual:Number }
   *
   * ahorro (único)   { objetivo:Number|null }  // meta opcional de la alcancía
   *
   * abonos_ahorro    { id, tipo:'abono'|'retiro', monto:Number,
   *                    fecha:'YYYY-MM-DD', nota:String, creado_en:String }
   *
   * recurrentes      { id, nombre:String, tipo:'ingreso'|'gasto', monto:Number,
   *                    categoria_id:String, frecuencia:'mensual'|'semanal',
   *                    dia:Number, activo:Boolean }
   *
   * pendientes       { id, nombre:String, tipo:'ingreso'|'gasto', monto:Number,
   *                    fecha:'YYYY-MM-DD',       // fecha de VENCIMIENTO (cuándo toca pagar)
   *                    categoria_id:String, nota:String,
   *                    origen:'recurrente'|'manual',
   *                    recurrente_id?:String,    // si nació de un recurrente
   *                    creado_en:String }
   *   ↑ Un "cargo pendiente" es un pago previsto. NO afecta el balance (el balance
   *     solo suma `movimientos`). Al APLICARLO se convierte en un movimiento real
   *     y el pendiente se elimina.
   *
   * ajustes (único)  { moneda:String, simbolo:String, nombre_usuario:String,
   *                    tema:'claro'|'oscuro' }
   * ========================================================================= */


  /* ---------------------------------------------------------------------------
   * UTILIDADES INTERNAS (privadas y SÍNCRONAS: solo tocan localStorage)
   * ------------------------------------------------------------------------- */

  /** Genera un id único tipo "UUID simple". En v2 lo dará la BD. */
  function generarId() {
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  /** Lee y parsea una clave; si no existe o está corrupta, devuelve el default. */
  function leer(clave, porDefecto) {
    try {
      const crudo = localStorage.getItem(clave);
      return crudo === null ? porDefecto : JSON.parse(crudo);
    } catch (e) {
      console.error('Error leyendo', clave, e);
      return porDefecto;
    }
  }

  /** Escribe un valor (serializado a JSON) en localStorage. */
  function escribir(clave, valor) {
    localStorage.setItem(clave, JSON.stringify(valor));
  }


  /* ---------------------------------------------------------------------------
   * DATOS DE EJEMPLO (mock). Fechas relativas a HOY para que el mes actual tenga
   * contenido sin importar cuándo se abra la app.
   * ------------------------------------------------------------------------- */

  function fechaRelativa(offsetMes, dia) {
    const base = new Date();
    const d = new Date(base.getFullYear(), base.getMonth() + offsetMes, dia);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }

  function datosDeEjemplo() {
    const categorias = [
      { id: 'cat_sueldo',    nombre: 'Sueldo',     tipo: 'ingreso', color: '#22c55e', icono: 'bi-cash-stack' },
      { id: 'cat_freelance', nombre: 'Freelance',  tipo: 'ingreso', color: '#10b981', icono: 'bi-laptop' },
      { id: 'cat_comida',    nombre: 'Comida',     tipo: 'gasto',   color: '#ef4444', icono: 'bi-egg-fried' },
      { id: 'cat_transporte',nombre: 'Transporte', tipo: 'gasto',   color: '#f97316', icono: 'bi-bus-front' },
      { id: 'cat_ocio',      nombre: 'Ocio',       tipo: 'gasto',   color: '#a855f7', icono: 'bi-controller' },
      { id: 'cat_servicios', nombre: 'Servicios',  tipo: 'gasto',   color: '#3b82f6', icono: 'bi-house-gear' },
      { id: 'cat_salud',     nombre: 'Salud',      tipo: 'gasto',   color: '#ec4899', icono: 'bi-heart-pulse' },
    ];

    const movimientos = [
      { id: generarId(), tipo: 'ingreso', monto: 18000, fecha: fechaRelativa(0, 1),  categoria_id: 'cat_sueldo',     nota: 'Sueldo mensual' },
      { id: generarId(), tipo: 'ingreso', monto: 3500,  fecha: fechaRelativa(0, 8),  categoria_id: 'cat_freelance',  nota: 'Proyecto web' },
      { id: generarId(), tipo: 'gasto',   monto: 2400,  fecha: fechaRelativa(0, 3),  categoria_id: 'cat_comida',     nota: 'Despensa quincena' },
      { id: generarId(), tipo: 'gasto',   monto: 650,   fecha: fechaRelativa(0, 5),  categoria_id: 'cat_transporte', nota: 'Gasolina' },
      { id: generarId(), tipo: 'gasto',   monto: 1200,  fecha: fechaRelativa(0, 6),  categoria_id: 'cat_servicios',  nota: 'Luz e internet' },
      { id: generarId(), tipo: 'gasto',   monto: 800,   fecha: fechaRelativa(0, 10), categoria_id: 'cat_ocio',       nota: 'Cine y salida' },
      { id: generarId(), tipo: 'gasto',   monto: 450,   fecha: fechaRelativa(0, 11), categoria_id: 'cat_comida',     nota: 'Restaurante' },
      { id: generarId(), tipo: 'ingreso', monto: 18000, fecha: fechaRelativa(-1, 1), categoria_id: 'cat_sueldo',     nota: 'Sueldo mensual' },
      { id: generarId(), tipo: 'gasto',   monto: 2600,  fecha: fechaRelativa(-1, 4), categoria_id: 'cat_comida',     nota: 'Despensa' },
      { id: generarId(), tipo: 'gasto',   monto: 900,   fecha: fechaRelativa(-1, 7), categoria_id: 'cat_salud',      nota: 'Consulta médica' },
      { id: generarId(), tipo: 'gasto',   monto: 700,   fecha: fechaRelativa(-1, 9), categoria_id: 'cat_transporte', nota: 'Gasolina' },
    ];

    const presupuestos = [
      { id: generarId(), categoria_id: 'cat_comida',     limite_mensual: 3000 },
      { id: generarId(), categoria_id: 'cat_transporte', limite_mensual: 1000 },
      { id: generarId(), categoria_id: 'cat_ocio',       limite_mensual: 1500 },
    ];

    const ahorro = { objetivo: 20000 };
    const abonosAhorro = [
      { id: generarId(), tipo: 'abono', monto: 2000, fecha: fechaRelativa(-1, 15), nota: 'Ahorro del mes' },
      { id: generarId(), tipo: 'abono', monto: 1500, fecha: fechaRelativa(0, 9),   nota: 'Ahorro extra' },
    ];

    const recurrentes = [
      { id: generarId(), nombre: 'Sueldo',   tipo: 'ingreso', monto: 18000, categoria_id: 'cat_sueldo',    frecuencia: 'mensual', dia: 1, activo: true },
      { id: generarId(), nombre: 'Netflix',  tipo: 'gasto',   monto: 219,   categoria_id: 'cat_ocio',      frecuencia: 'mensual', dia: 5, activo: true },
      { id: generarId(), nombre: 'Internet', tipo: 'gasto',   monto: 600,   categoria_id: 'cat_servicios', frecuencia: 'mensual', dia: 6, activo: true },
    ];

    const pendientes = [
      { id: generarId(), nombre: 'Internet', tipo: 'gasto', monto: 600, fecha: fechaRelativa(0, 20),
        categoria_id: 'cat_servicios', nota: '', origen: 'manual', creado_en: new Date().toISOString() },
    ];

    const ajustes = { moneda: 'MXN', simbolo: '$', nombre_usuario: 'Usuario', tema: 'oscuro' };

    return { categorias, movimientos, presupuestos, ahorro, abonosAhorro, recurrentes, pendientes, ajustes };
  }

  /** Escribe TODO el mock en localStorage (privada, síncrona). */
  function sembrar() {
    const ej = datosDeEjemplo();
    escribir(CLAVES.categorias,   ej.categorias);
    escribir(CLAVES.movimientos,  ej.movimientos);
    escribir(CLAVES.presupuestos, ej.presupuestos);
    escribir(CLAVES.ahorro,       ej.ahorro);
    escribir(CLAVES.abonosAhorro, ej.abonosAhorro);
    escribir(CLAVES.recurrentes,  ej.recurrentes);
    escribir(CLAVES.pendientes,   ej.pendientes);
    escribir(CLAVES.ajustes,      ej.ajustes);
    escribir(CLAVES.sembrado,     true);
  }

  /** Siembra el mock SOLO la primera vez (bandera fin_sembrado). */
  async function init() {
    if (leer(CLAVES.sembrado, false)) return;
    sembrar();
  }

  /** Restablece los datos de ejemplo (borra todo y vuelve a sembrar el mock). */
  async function restablecerEjemplo() {
    Object.values(CLAVES).forEach(c => localStorage.removeItem(c));
    sembrar();
  }


  /* ===========================================================================
   * MOVIMIENTOS
   * ========================================================================= */

  async function getMovimientos() {
    return leer(CLAVES.movimientos, []);
  }

  async function getMovimiento(id) {
    return leer(CLAVES.movimientos, []).find(m => m.id === id) || null;
  }

  /** Upsert: si trae `id` existente edita, si no crea. Devuelve el guardado. */
  async function saveMovimiento(mov) {
    const lista = leer(CLAVES.movimientos, []);
    if (mov.id) {
      const i = lista.findIndex(m => m.id === mov.id);
      if (i !== -1) lista[i] = { ...lista[i], ...mov };
      else lista.push(mov);
    } else {
      mov.id = generarId();
      // Sello de registro: cuándo se creó realmente (distinto de la fecha
      // contable). Equivale al futuro created_at de la BD y sirve de bitácora.
      if (!mov.creado_en) mov.creado_en = new Date().toISOString();
      lista.push(mov);
    }
    escribir(CLAVES.movimientos, lista);
    return mov;
  }

  async function deleteMovimiento(id) {
    escribir(CLAVES.movimientos, leer(CLAVES.movimientos, []).filter(m => m.id !== id));
  }


  /* ===========================================================================
   * CATEGORÍAS
   * ========================================================================= */

  async function getCategorias() {
    return leer(CLAVES.categorias, []);
  }

  async function getCategoria(id) {
    return leer(CLAVES.categorias, []).find(c => c.id === id) || null;
  }

  async function saveCategoria(cat) {
    const lista = leer(CLAVES.categorias, []);
    if (cat.id) {
      const i = lista.findIndex(c => c.id === cat.id);
      if (i !== -1) lista[i] = { ...lista[i], ...cat };
      else lista.push(cat);
    } else {
      cat.id = generarId();
      lista.push(cat);
    }
    escribir(CLAVES.categorias, lista);
    return cat;
  }

  /**
   * Elimina una categoría SOLO si no tiene registros asociados.
   * Devuelve { ok:Boolean, motivo?:String }. La regla de negocio vive aquí.
   */
  async function deleteCategoria(id) {
    const enUso =
      leer(CLAVES.movimientos, []).some(m => m.categoria_id === id) ||
      leer(CLAVES.recurrentes, []).some(r => r.categoria_id === id) ||
      leer(CLAVES.presupuestos, []).some(p => p.categoria_id === id);
    if (enUso) {
      return { ok: false, motivo: 'La categoría tiene movimientos, recurrentes o presupuestos asociados.' };
    }
    escribir(CLAVES.categorias, leer(CLAVES.categorias, []).filter(c => c.id !== id));
    return { ok: true };
  }


  /* ===========================================================================
   * PRESUPUESTOS
   * ========================================================================= */

  async function getPresupuestos() {
    return leer(CLAVES.presupuestos, []);
  }

  async function savePresupuesto(pre) {
    const lista = leer(CLAVES.presupuestos, []);
    if (pre.id) {
      const i = lista.findIndex(p => p.id === pre.id);
      if (i !== -1) lista[i] = { ...lista[i], ...pre };
      else lista.push(pre);
    } else {
      pre.id = generarId();
      lista.push(pre);
    }
    escribir(CLAVES.presupuestos, lista);
    return pre;
  }

  async function deletePresupuesto(id) {
    escribir(CLAVES.presupuestos, leer(CLAVES.presupuestos, []).filter(p => p.id !== id));
  }


  /* ===========================================================================
   * AHORRO (una sola alcancía)
   * ========================================================================= */

  async function getAhorro() {
    return leer(CLAVES.ahorro, { objetivo: null });
  }

  async function setObjetivoAhorro(objetivo) {
    escribir(CLAVES.ahorro, { objetivo: objetivo });
  }

  async function getAbonosAhorro() {
    return leer(CLAVES.abonosAhorro, []);
  }

  async function saveAbonoAhorro(abono) {
    const lista = leer(CLAVES.abonosAhorro, []);
    if (abono.id) {
      const i = lista.findIndex(a => a.id === abono.id);
      if (i !== -1) lista[i] = { ...lista[i], ...abono };
      else lista.push(abono);
    } else {
      abono.id = generarId();
      if (!abono.creado_en) abono.creado_en = new Date().toISOString();
      lista.push(abono);
    }
    escribir(CLAVES.abonosAhorro, lista);
    return abono;
  }

  async function deleteAbonoAhorro(id) {
    escribir(CLAVES.abonosAhorro, leer(CLAVES.abonosAhorro, []).filter(a => a.id !== id));
  }

  /** Total acumulado = suma de abonos menos retiros. */
  async function getTotalAhorrado() {
    return leer(CLAVES.abonosAhorro, []).reduce((total, a) => {
      const monto = Number(a.monto) || 0; // proteger contra montos vacíos/corruptos
      return a.tipo === 'retiro' ? total - monto : total + monto;
    }, 0);
  }


  /* ===========================================================================
   * RECURRENTES
   * ========================================================================= */

  async function getRecurrentes() {
    return leer(CLAVES.recurrentes, []);
  }

  async function saveRecurrente(rec) {
    const lista = leer(CLAVES.recurrentes, []);
    if (rec.id) {
      const i = lista.findIndex(r => r.id === rec.id);
      if (i !== -1) lista[i] = { ...lista[i], ...rec };
      else lista.push(rec);
    } else {
      rec.id = generarId();
      if (rec.activo === undefined) rec.activo = true;
      lista.push(rec);
    }
    escribir(CLAVES.recurrentes, lista);
    return rec;
  }

  async function deleteRecurrente(id) {
    escribir(CLAVES.recurrentes, leer(CLAVES.recurrentes, []).filter(r => r.id !== id));
  }


  /* ===========================================================================
   * PENDIENTES  (cargos previstos que NO afectan el balance)
   * ---------------------------------------------------------------------------
   * Viven en su propia tabla, aparte de `movimientos`. Sirven para ver "lo que
   * se viene". Al APLICAR un pendiente se crea un movimiento real (que sí impacta
   * el balance) y el pendiente se elimina.
   * ========================================================================= */

  async function getPendientes() {
    return leer(CLAVES.pendientes, []);
  }

  /** Upsert: si trae `id` existente edita, si no crea. Devuelve el guardado. */
  async function savePendiente(pen) {
    const lista = leer(CLAVES.pendientes, []);
    if (pen.id) {
      const i = lista.findIndex(p => p.id === pen.id);
      if (i !== -1) lista[i] = { ...lista[i], ...pen };
      else lista.push(pen);
    } else {
      pen.id = generarId();
      if (!pen.origen) pen.origen = 'manual';
      if (!pen.creado_en) pen.creado_en = new Date().toISOString();
      lista.push(pen);
    }
    escribir(CLAVES.pendientes, lista);
    return pen;
  }

  async function deletePendiente(id) {
    escribir(CLAVES.pendientes, leer(CLAVES.pendientes, []).filter(p => p.id !== id));
  }

  /**
   * Aplica un pendiente: crea el movimiento real (impacta balance) y borra el
   * pendiente. Devuelve { ok, movimiento? }. La regla de negocio vive aquí para
   * que ninguna pantalla tenga que orquestar los dos pasos por su cuenta.
   */
  async function aplicarPendiente(id) {
    const pen = leer(CLAVES.pendientes, []).find(p => p.id === id);
    if (!pen) return { ok: false, motivo: 'El pendiente ya no existe.' };
    const movimiento = await saveMovimiento({
      tipo: pen.tipo, monto: pen.monto, fecha: pen.fecha,
      categoria_id: pen.categoria_id,
      nota: pen.nota || pen.nombre,
      recurrente_id: pen.recurrente_id,   // conserva la traza si venía de un recurrente
    });
    await deletePendiente(id);
    return { ok: true, movimiento };
  }


  /* ===========================================================================
   * AJUSTES
   * ========================================================================= */

  async function getAjustes() {
    return leer(CLAVES.ajustes, {
      moneda: 'MXN', simbolo: '$', nombre_usuario: 'Usuario', tema: 'oscuro',
    });
  }

  async function saveAjustes(ajustes) {
    const actual = leer(CLAVES.ajustes, {
      moneda: 'MXN', simbolo: '$', nombre_usuario: 'Usuario', tema: 'oscuro',
    });
    const nuevo = { ...actual, ...ajustes };
    escribir(CLAVES.ajustes, nuevo);
    return nuevo;
  }


  /* ===========================================================================
   * RESPALDO: exportar / importar / borrar todo
   * ========================================================================= */

  async function exportarTodo() {
    return {
      version: 1,
      exportado_en: new Date().toISOString(),
      movimientos:   leer(CLAVES.movimientos, []),
      categorias:    leer(CLAVES.categorias, []),
      presupuestos:  leer(CLAVES.presupuestos, []),
      ahorro:        leer(CLAVES.ahorro, { objetivo: null }),
      abonos_ahorro: leer(CLAVES.abonosAhorro, []),
      recurrentes:   leer(CLAVES.recurrentes, []),
      pendientes:    leer(CLAVES.pendientes, []),
      ajustes:       leer(CLAVES.ajustes, {}),
    };
  }

  /**
   * Restaura desde un objeto de respaldo. Valida la ESTRUCTURA antes de
   * sobrescribir (las tablas que deben ser arrays lo son, ahorro es objeto),
   * para no corromper los datos con un archivo equivocado.
   * Devuelve { ok, motivo? }.
   */
  async function importarTodo(datos) {
    if (!datos || typeof datos !== 'object') {
      return { ok: false, motivo: 'El archivo no contiene datos válidos.' };
    }
    // Las claves que existan deben tener el tipo correcto.
    const debenSerArray = ['movimientos', 'categorias', 'presupuestos', 'abonos_ahorro', 'recurrentes', 'pendientes'];
    for (const clave of debenSerArray) {
      if (clave in datos && !Array.isArray(datos[clave])) {
        return { ok: false, motivo: `El campo "${clave}" del archivo no tiene el formato esperado.` };
      }
    }
    if ('ahorro' in datos && (typeof datos.ahorro !== 'object' || Array.isArray(datos.ahorro))) {
      return { ok: false, motivo: 'El campo "ahorro" del archivo no tiene el formato esperado.' };
    }
    // Debe traer al menos una tabla reconocible (evita importar un JSON ajeno).
    const tieneAlgo = debenSerArray.some(c => c in datos) || 'ahorro' in datos || 'ajustes' in datos;
    if (!tieneAlgo) {
      return { ok: false, motivo: 'El archivo no parece un respaldo de esta app.' };
    }

    if (datos.movimientos)   escribir(CLAVES.movimientos,  datos.movimientos);
    if (datos.categorias)    escribir(CLAVES.categorias,   datos.categorias);
    if (datos.presupuestos)  escribir(CLAVES.presupuestos, datos.presupuestos);
    if (datos.ahorro)        escribir(CLAVES.ahorro,       datos.ahorro);
    if (datos.abonos_ahorro) escribir(CLAVES.abonosAhorro, datos.abonos_ahorro);
    if (datos.recurrentes)   escribir(CLAVES.recurrentes,  datos.recurrentes);
    if (datos.pendientes)    escribir(CLAVES.pendientes,   datos.pendientes);
    if (datos.ajustes)       escribir(CLAVES.ajustes,      datos.ajustes);
    escribir(CLAVES.sembrado, true); // evitar que init() vuelva a sembrar
    return { ok: true };
  }

  /** Borra TODOS los datos y deja la app vacía (no re-siembra el mock). */
  async function borrarTodo() {
    Object.values(CLAVES).forEach(c => localStorage.removeItem(c));
    escribir(CLAVES.sembrado, true);
  }


  /* ---------------------------------------------------------------------------
   * API PÚBLICA (todo asíncrono)
   * ------------------------------------------------------------------------- */
  return {
    init, restablecerEjemplo,
    getMovimientos, getMovimiento, saveMovimiento, deleteMovimiento,
    getCategorias, getCategoria, saveCategoria, deleteCategoria,
    getPresupuestos, savePresupuesto, deletePresupuesto,
    getAhorro, setObjetivoAhorro, getAbonosAhorro, saveAbonoAhorro,
    deleteAbonoAhorro, getTotalAhorrado,
    getRecurrentes, saveRecurrente, deleteRecurrente,
    getPendientes, savePendiente, deletePendiente, aplicarPendiente,
    getAjustes, saveAjustes,
    exportarTodo, importarTodo, borrarTodo,
  };
})();
