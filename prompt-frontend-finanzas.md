# Prompt: Frontend para sistema de finanzas personales

## Rol y objetivo
Actúa como un desarrollador frontend senior. Vas a construir **solo el frontend** (maquetado + interactividad) de un sistema de **finanzas personales**. Aún no hay backend, así que los datos se simulan en el navegador con `localStorage` y datos de ejemplo (mock). El código debe quedar **preparado para conectar a un backend en PHP y una base de datos en el futuro**.

## Contexto del entorno (importante)
- El proyecto vivirá en una carpeta dentro de **`htdocs` de XAMPP** (ej. `htdocs/finanzas-front/`) y más adelante se le agregará **PHP** como backend.
- Por eso, **usa siempre rutas relativas** para CSS, JS e imágenes (ej. `css/styles.css`, no `/css/styles.css`). Así funciona igual servido como archivo estático o bajo Apache/PHP.
- No uses funciones que requieran un servidor para la v1: todo debe correr abriendo el HTML en el navegador o vía `http://localhost/finanzas-front/`.

## Stack obligatorio
- **HTML5 semántico**, **CSS3** y **JavaScript vanilla** (sin frameworks JS como React/Vue).
- **Bootstrap 5** por CDN para layout y componentes.
- **Chart.js** por CDN para las gráficas.
- **Bootstrap Icons** por CDN para iconografía.
- **Google Fonts** (Inter o Poppins) por CDN para tipografía.
- **Animate.css** por CDN para animaciones sutiles de entrada (tarjetas, modales).
- **Toasts nativos de Bootstrap** para notificaciones ("Movimiento guardado ✓").
- Nada de build tools (sin npm, sin webpack). Debe abrirse directamente en el navegador.

## Estilo visual
- Estética **moderna y limpia** con **glassmorphism** (glass): tarjetas semitransparentes, `backdrop-filter: blur(...)`, bordes sutiles con transparencia y sombras suaves.
- **Modo claro y modo oscuro** con un toggle en la barra superior. La preferencia se guarda en `localStorage` y se aplica al recargar.
- Fondo con degradado suave (gradient) que resalte el efecto glass en ambos modos.
- Paleta: un color de acento principal (índigo/violeta), **verde** para ingresos, **rojo** para gastos. Define todos los colores como **variables CSS** (`:root` y variante para `[data-theme="dark"]`) para cambiarlos fácil.
- Diseño **responsivo** (móvil, tablet, escritorio). En móvil el sidebar se colapsa.
- Usa animaciones **sutiles** (Animate.css) al abrir modales o cargar tarjetas. Nada exagerado.

## Arquitectura de datos (regla de oro)
Todo el sistema está pensado para migrar de `localStorage` a **base de datos vía API PHP** sin reescribir la interfaz. Para lograrlo:

- **Ninguna parte de la UI accede a `localStorage` directamente.** Todo pasa por una **capa de acceso a datos** en `data.js` con funciones como `getMovimientos()`, `saveMovimiento()`, `deleteMovimiento(id)`, etc.
- Cuando exista el backend, solo se cambia el **interior** de esas funciones (de `localStorage` a `fetch()` a endpoints PHP). El resto del código no debe enterarse.
- Cada registro debe tener un **`id` único** (ej. timestamp o UUID simple), como lo tendría una fila en una base de datos.
- Diseña los objetos como si fueran **tablas**: `movimientos`, `categorias`, `metas_ahorro`, `presupuestos`, `recurrentes`, `ajustes`. Documenta con un comentario los campos de cada uno (esto será el futuro esquema de BD).
- Guarda en `localStorage` bajo claves claras con prefijo: `fin_movimientos`, `fin_categorias`, etc.

## Estructura de archivos
Genera esta estructura y explícame cada archivo:
```
/finanzas-front
  index.html          (dashboard principal)
  movimientos.html    (registro y listado de ingresos/gastos)
  timeline.html       (vista unificada: todos los movimientos)
  categorias.html     (gestión de categorías)
  presupuestos.html   (presupuestos por categoría)
  ahorro.html         (alcancía / ahorros)
  recurrentes.html    (movimientos recurrentes)
  ajustes.html        (configuración)
  /css
    styles.css        (variables, glass, dark mode, estilos propios)
  /js
    app.js            (lógica común: toggle de tema, navegación, toasts, formato)
    data.js           (CAPA DE DATOS: mock + localStorage, un día será API PHP)
    dashboard.js      (tarjetas resumen y gráficas)
    movimientos.js
    timeline.js
    categorias.js
    presupuestos.js
    ahorro.js
    recurrentes.js
    ajustes.js
```
Nota: si prefieres una sola página con navegación por secciones (SPA sencilla) en vez de varios HTML, propónmelo antes de decidir. Código comentado en español, claro y ordenado, porque lo iré leyendo y aprendiendo.

## Funcionalidades de la versión 1

### 1. Dashboard (index.html)
- Tarjetas resumen (glass): **Balance total**, **Ingresos del mes**, **Gastos del mes**, **Total ahorrado**.
- Gráfica de **dona**: gastos por categoría.
- Gráfica de **barras o líneas**: ingresos vs gastos por mes.
- Lista de los últimos 5 movimientos.
- Respeta el **mes seleccionado** (ver función de selector de periodo).

### 2. Selector de mes / periodo
- Control en la parte superior para elegir el **mes y año** a visualizar, con botones "anterior / siguiente".
- Todos los resúmenes, gráficas y listados se filtran por el periodo seleccionado.
- El periodo actual se guarda en memoria (y por defecto arranca en el mes actual).

### 3. Registro de ingresos y gastos (movimientos.html)
- Formulario para agregar un movimiento: **tipo** (ingreso/gasto), **monto**, **fecha**, **categoría** (select), **descripción/nota**.
- Validaciones en el frontend: monto > 0, fecha válida, categoría obligatoria.
- Tabla/listado con filtros por tipo, categoría y rango de fechas.
- Acciones **editar** y **eliminar** por movimiento (con confirmación al eliminar).
- Toast de confirmación al guardar/editar/eliminar.

### 4. Categorías (categorias.html)
- Crear, editar y eliminar categorías.
- Campos: **nombre**, **tipo** (ingreso/gasto), **color** e **icono** (Bootstrap Icons).
- No permitir eliminar una categoría con movimientos asociados (avisar con toast/modal).

### 5. Presupuestos por categoría (presupuestos.html)
- Definir un **límite mensual** por categoría de gasto (ej. "Comida: $3,000").
- Mostrar cuánto se lleva **gastado vs límite** en el mes seleccionado, con barra de progreso (glass).
- Alerta visual (color) cuando se acerca (>80%) o supera el límite.

### 6. Ahorro / alcancía (ahorro.html)
Enfoque simple para empezar (sin obligar a poner metas):
- Funciona como una **alcancía / cuenta de ahorro**: se registran **abonos** y opcionalmente **retiros**.
- Muestra el **total ahorrado** y el **historial** de movimientos de ahorro (fecha, monto, nota).
- El **monto objetivo es opcional**: si el usuario lo define, aparece una **barra de progreso** hacia la meta; si no lo define, solo se muestra el total acumulado.
- Permitir varias "alcancías" con nombre (ej. "Emergencias", "Viaje") es deseable pero puede ser v2; si lo haces simple con una sola, está bien.

### 7. Movimientos recurrentes (recurrentes.html)
- Registrar movimientos que se repiten: **nombre**, **tipo**, **monto**, **categoría**, **frecuencia** (mensual/semanal), **día**.
- Listado de recurrentes activos con opción de **pausar/eliminar**.
- Al entrar a la app, ofrecer **generar** los movimientos recurrentes pendientes del periodo (o marcarlos como aplicados). Manténlo simple: no hace falta automatización real, basta un botón "Aplicar recurrentes de este mes".

### 8. Todos los movimientos (vista unificada)
- Una vista tipo **línea de tiempo (timeline)** que junta en una sola lista **ingresos, gastos y abonos de ahorro**, ordenados por fecha (más reciente primero).
- Cada renglón indica claramente el **origen** (ingreso / gasto / ahorro) con su color e icono.
- Filtros por tipo de movimiento y por fecha; respeta el mes seleccionado.
- Es solo **lectura/panorama**: no duplica los datos, los agrega desde la capa de datos. La edición se sigue haciendo en cada apartado.

### 9. Exportar / importar datos (en ajustes.html)
- Botón **Exportar**: descarga todos los datos (`localStorage`) como un archivo **JSON** de respaldo.
- Botón **Importar**: carga un JSON y restaura los datos (con confirmación antes de sobrescribir).
- Esto protege la información mientras no exista base de datos.

### 10. Ajustes (ajustes.html)
- **Moneda** (símbolo y formato).
- **Nombre de usuario** (se muestra en la barra superior).
- **Tema por defecto** (claro/oscuro).
- Opción para **borrar todos los datos** (con confirmación fuerte).
- Incluye aquí Exportar/Importar JSON.

## Reglas de datos (mock)
- En `data.js` incluye datos de ejemplo (varios movimientos, categorías, un presupuesto, un ahorro y un recurrente) para que la app se vea con contenido la primera vez.
- Formatea montos como moneda según ajustes (ej. `$1,250.00`) y fechas en formato legible.
- Toda operación de datos pasa por funciones de la capa de datos (nunca `localStorage` directo en la UI).

## Reglas de código y calidad
- Separa responsabilidades: nada de lógica de datos dentro del HTML.
- Nombres de variables y funciones en español, descriptivos.
- Comenta las partes clave explicando el "por qué", no solo el "qué".
- Maneja estados vacíos (ej. "Aún no hay movimientos").
- Código fácil de extender: pensado para agregar backend PHP + base de datos después.

## Cómo quiero que trabajes
1. Primero muéstrame la **estructura de carpetas** y un breve plan (y si sugieres SPA vs multipágina, dímelo).
2. Luego genera los archivos uno por uno, empezando por `data.js` (define el modelo de datos), `styles.css` e `index.html`.
3. Después de cada archivo, dame una **explicación corta** de qué hace y cómo se conecta con los demás.
4. Al final, dime cómo probarlo (colocarlo en `htdocs` y abrir `http://localhost/finanzas-front/`).
5. Si algo es ambiguo, **hazme preguntas antes de asumir**.

## Fuera de alcance (versión 1)
- No implementes backend PHP, base de datos ni autenticación todavía (pero deja el código listo para ello).
- No uses frameworks de JS ni sistemas de build.
- Múltiples cuentas (efectivo/banco/tarjeta) y automatización real de recurrentes quedan para v2.

## Roadmap (hacia dónde crece el sistema)
Esto NO se implementa en la v1, pero el frontend debe quedar preparado para ello. Sirve para que tomes decisiones de diseño con el futuro en mente.

### v2 — Backend PHP + base de datos MySQL
- Crear la base de datos MySQL con tablas equivalentes a los objetos de `data.js`: `movimientos`, `categorias`, `presupuestos`, `metas_ahorro`, `abonos_ahorro`, `recurrentes`, `ajustes`. Cada tabla con `id` (PK autoincremental o UUID) y columnas `created_at` / `updated_at`.
- Backend en PHP nativo (o Laravel cuando lo aprendas) exponiendo endpoints tipo REST: `GET/POST/PUT/DELETE` para cada recurso.
- **Reemplazar el interior de las funciones de `data.js`** para que hagan `fetch()` a esos endpoints en vez de leer/escribir `localStorage`. La UI no cambia.
- **Bitácora / audit log**: tabla `bitacora` que registra acciones (usuario, acción, recurso, id, fecha). Aquí es donde vive el "log" real de creaciones, ediciones y borrados — no en la v1.

### v3 — Autenticación y multiusuario
- Login/registro con sesiones o tokens (JWT). Cada registro se asocia a un `usuario_id`.
- Recuperación de contraseña, roles si aplica.
- Con multiusuario, la bitácora del audit log cobra todo su sentido.

### Ideas futuras (backlog)
- Múltiples cuentas/carteras (efectivo, banco, tarjeta) con transferencias entre ellas.
- Automatización real de movimientos recurrentes (job/cron en el backend).
- Reportes exportables a PDF/Excel.
- Categorías con subcategorías; etiquetas.
- Adjuntar comprobantes (imágenes) a los movimientos.
