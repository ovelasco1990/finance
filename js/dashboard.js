/* =============================================================================
 * dashboard.js  ·  LÓGICA DEL DASHBOARD (index.html)
 * -----------------------------------------------------------------------------
 * Tarjetas de resumen, dona (gastos por categoría), barras (ingresos vs gastos
 * por mes) y últimos movimientos. Todo filtrado por el MES seleccionado.
 *
 * La capa Datos es asíncrona: se usa `await`. En cada render pre-cargamos las
 * categorías UNA vez en un Map (patrón correcto también para el futuro backend:
 * no se consulta la BD una vez por fila).
 * ========================================================================== */

(() => {
  'use strict';

  let graficaDona = null;
  let graficaBarras = null;

  function sumarPorTipo(movimientos, tipo) {
    return movimientos.filter(m => m.tipo === tipo).reduce((t, m) => t + Number(m.monto), 0);
  }

  /** Devuelve un Map id→categoría (para buscar sin consultar por cada fila). */
  async function mapaCategorias() {
    const cats = await Datos.getCategorias();
    return new Map(cats.map(c => [c.id, c]));
  }

  /* --- Tarjetas de resumen ------------------------------------------------ */
  async function pintarResumen() {
    const todos = await Datos.getMovimientos();
    const delMes = App.filtrarPorPeriodo(todos);

    const ingresosMes = sumarPorTipo(delMes, 'ingreso');
    const gastosMes = sumarPorTipo(delMes, 'gasto');
    const balanceMes = ingresosMes - gastosMes;
    const balanceTotal = sumarPorTipo(todos, 'ingreso') - sumarPorTipo(todos, 'gasto');
    const totalAhorrado = await Datos.getTotalAhorrado();

    document.getElementById('resumen-balance').textContent = App.formatearMoneda(balanceTotal);
    document.getElementById('resumen-ingresos').textContent = App.formatearMoneda(ingresosMes);
    document.getElementById('resumen-gastos').textContent = App.formatearMoneda(gastosMes);
    document.getElementById('resumen-ahorro').textContent = App.formatearMoneda(totalAhorrado);

    // Balance del mes: ¿ese mes ahorraste (verde) o gastaste de más (rojo)?
    const elMes = document.getElementById('resumen-balance-mes');
    const signo = balanceMes >= 0 ? '+' : '';
    elMes.textContent = `${signo}${App.formatearMoneda(balanceMes)} este mes`;
    elMes.className = 'small mt-1 ' + (balanceMes >= 0 ? 'text-ingreso' : 'text-gasto');
  }

  /* --- Dona: gastos por categoría ---------------------------------------- */
  async function pintarDona() {
    const cats = await mapaCategorias();
    const gastosMes = App.filtrarPorPeriodo(await Datos.getMovimientos()).filter(m => m.tipo === 'gasto');

    const porCategoria = {};
    gastosMes.forEach(m => {
      porCategoria[m.categoria_id] = (porCategoria[m.categoria_id] || 0) + Number(m.monto);
    });

    const ids = Object.keys(porCategoria);
    const contDona = document.getElementById('cont-dona');
    const vacioDona = document.getElementById('dona-vacio');

    if (ids.length === 0) {
      contDona.classList.add('d-none');
      vacioDona.classList.remove('d-none');
      if (graficaDona) { graficaDona.destroy(); graficaDona = null; }
      return;
    }
    contDona.classList.remove('d-none');
    vacioDona.classList.add('d-none');

    const etiquetas = ids.map(id => cats.get(id)?.nombre || 'Sin categoría');
    const valores = ids.map(id => porCategoria[id]);
    const colores = ids.map(id => cats.get(id)?.color || '#94a3b8');

    if (graficaDona) graficaDona.destroy();
    graficaDona = new Chart(document.getElementById('grafica-dona'), {
      type: 'doughnut',
      data: { labels: etiquetas, datasets: [{ data: valores, backgroundColor: colores, borderWidth: 0 }] },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '62%',
        plugins: {
          legend: { position: 'bottom', labels: { color: colorTexto(), padding: 14 } },
          tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${App.formatearMoneda(ctx.parsed)}` } },
        },
      },
    });
  }

  /* --- Barras: ingresos vs gastos por mes (últimos 6) -------------------- */
  async function pintarBarras() {
    const p = App.getPeriodo();
    const todos = await Datos.getMovimientos();

    const etiquetas = [], datosIngresos = [], datosGastos = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(p.anio, p.mes - i, 1);
      const anio = d.getFullYear(), mes = d.getMonth();
      const delMes = todos.filter(m => {
        const [a, me] = m.fecha.split('-').map(Number);
        return a === anio && (me - 1) === mes;
      });
      etiquetas.push(MESES_CORTOS[mes] + ' ' + String(anio).slice(2));
      datosIngresos.push(sumarPorTipo(delMes, 'ingreso'));
      datosGastos.push(sumarPorTipo(delMes, 'gasto'));
    }

    if (graficaBarras) graficaBarras.destroy();
    graficaBarras = new Chart(document.getElementById('grafica-barras'), {
      type: 'bar',
      data: {
        labels: etiquetas,
        datasets: [
          { label: 'Ingresos', data: datosIngresos, backgroundColor: leerColor('--ingreso'), borderRadius: 6 },
          { label: 'Gastos', data: datosGastos, backgroundColor: leerColor('--gasto'), borderRadius: 6 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: colorTexto() } } },
        scales: {
          x: { ticks: { color: colorTexto() }, grid: { display: false } },
          y: { ticks: { color: colorTexto(), callback: (v) => App.formatearMoneda(v) }, grid: { color: 'rgba(148,163,184,0.15)' } },
        },
      },
    });
  }

  /* --- Últimos 5 movimientos del mes ------------------------------------ */
  async function pintarUltimos() {
    const cont = document.getElementById('ultimos-movimientos');
    const cats = await mapaCategorias();
    const delMes = App.filtrarPorPeriodo(await Datos.getMovimientos())
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .slice(0, 5);

    if (delMes.length === 0) {
      cont.innerHTML = `<div class="estado-vacio"><i class="bi bi-inbox"></i>Aún no hay movimientos en este mes.</div>`;
      return;
    }

    cont.innerHTML = delMes.map(m => {
      const cat = cats.get(m.categoria_id);
      const esIngreso = m.tipo === 'ingreso';
      const signo = esIngreso ? '+' : '−';
      const clase = esIngreso ? 'text-ingreso' : 'text-gasto';
      const icono = cat?.icono || (esIngreso ? 'bi-arrow-down-circle' : 'bi-arrow-up-circle');
      const color = cat?.color || (esIngreso ? 'var(--ingreso)' : 'var(--gasto)');
      return `
        <div class="timeline-item">
          <span class="punto" style="background:${App.colorTenue(color)};color:${color}">
            <i class="bi ${icono}"></i>
          </span>
          <div class="flex-grow-1">
            <div class="fw-semibold">${cat?.nombre || 'Sin categoría'}</div>
            <div class="small text-suave">${m.nota || ''} · ${App.formatearFecha(m.fecha)}</div>
          </div>
          <div class="fw-bold ${clase}">${signo} ${App.formatearMoneda(m.monto)}</div>
        </div>`;
    }).join('');
  }

  /* --- Utilidades de color/mes ------------------------------------------ */
  function leerColor(nombreVar) {
    return getComputedStyle(document.documentElement).getPropertyValue(nombreVar).trim() || '#6366f1';
  }
  function colorTexto() { return leerColor('--texto-suave'); }
  const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  /* --- Orquestación ------------------------------------------------------ */
  async function dibujar() {
    await pintarResumen();
    await pintarDona();
    await pintarBarras();
    await pintarUltimos();
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await App.listo;                 // esperar arranque (ajustes + navbar listos)
    await dibujar();
    document.addEventListener('periodoCambiado', dibujar);
    document.addEventListener('temaCambiado', dibujar);
  });
})();
