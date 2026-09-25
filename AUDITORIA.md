# Auditoría de la fase 7

Este es el informe cerrado de la fase 7; el estado actual del proyecto está en `CLAUDE.md`.

Recorrido de la app pantalla por pantalla contra las secciones 9 (diseño) y 10 (accesibilidad) de
`SPEC.md`. Se escribe **a medida que avanza el recorrido**, no al final: si la sesión se corta, la
siguiente continúa desde aquí. El resumen de la fase está en `CLAUDE.md`.

Las capturas viven en `auditoria/capturas/` (ignorada por git; solo se commitea este archivo). El
nombre de cada una es `<pantalla>-<viewport>-<tema>[-<estado>].png`, por ejemplo
`hoy-movil-oscuro-vacio.png`.

- Viewports: **móvil 390×844** y **escritorio 1440×900**.
- Orden del recorrido: Hoy · Detalle · Estadísticas · Revisión · Nuevo/Editar hábito · Hábitos ·
  Ajustes · diálogo de atajos · 404.
- Primero **todas las pantallas en tema oscuro**; el tema claro se revisa después, también en todas.

Estados de cada hallazgo: `pendiente` (esperando aprobación) · `aprobado` · `descartado` · `hecho`.

## Verificación en navegador de la fase 6 (paso 2)

Lo que hasta ahora solo estaba cubierto por tests. El usuario ya lo probó a mano en un navegador
real y funciona; aquí se vuelve a comprobar con Playwright y se anota lo que el navegador
automatizado **no** puede comprobar de verdad.

Todo se comprobó contra la **build de producción** (`npm run build` + `npm run preview`, en
`localhost:4173`), que es la única donde existe el service worker.

| Qué | Resultado | Notas |
|---|---|---|
| Manifest e instalabilidad | **bien** | `name`, `short_name`, `start_url`, `scope`, `display: standalone`, `lang: es`, descripción y tres iconos (192, 512 y 512 *maskable*), los tres servidos con `200` y `image/png`. `meta[name=theme-color]` tiene una variante por esquema (claro `#f6f5f1`, oscuro `#131312`). |
| Service worker | **bien** | Se activa, precachea 34 entradas y avisa con «La app ya funciona sin conexión.». |
| Aviso «Recargar» | **bien** | Publicando una build nueva sale «Hay una versión nueva de la app.» con «Recargar»; **no recarga sola** (la página se queda donde estaba) y al pulsar, el worker nuevo toma el control y recarga. |
| Sin conexión | **bien** | Con la red cortada funcionan la raíz, una ruta profunda escrita a mano (`/ajustes`, por `navigateFallback`) y la navegación a Estadísticas, cuyo chunk es `lazy()`. |
| Exportar copia (descarga) | **bien** | `habitos-copia-2026-09-20.json`, 183 kB, JSON válido con `format`, `version`, `exportedAt`, `settings` y `data`. |
| Importar copia válida | **bien** | El diálogo dice qué trae la copia y qué sustituye («10 hábitos, 760 registros, 2 pausas, 4 revisiones» frente a lo que hay), ofrece «Guardar una copia de lo actual antes» y al terminar deja «Deshacer». |
| Importar archivo dañado | **bien** | Cinco archivos rotos (no es JSON · formato desconocido · versión 99 · frecuencia inválida con campo desconocido · fecha `2026-02-31`). En los cinco: no se abre el diálogo, no se escribe nada y el aviso explica el problema y dice «Tus datos siguen exactamente como estaban». |
| CSV | **bien** | `habitos-registros-2026-09-20.csv`, con BOM, CRLF, 762 líneas y cabecera `fecha,habito,tipo,valor,unidad,nota`. |
| Borrar todo | **bien** | Exige escribir `BORRAR` (el botón está deshabilitado hasta entonces) y se deshace: los 14 hábitos vuelven. |
| Permiso y disparo de notificaciones | **bien, con límites** | No se pide el permiso solo: hay que pulsar «Activar notificaciones». Con permiso, un recordatorio puesto cinco minutos antes dispara **un** aviso por el service worker (título, cuerpo, `tag` e icono correctos), queda anotado en `localStorage` y **no se repite al recargar**. «Enviar un aviso de prueba» funciona. |
| Atajos de teclado | **bien** | `?` abre la ayuda y `Esc` la cierra; con el diálogo abierto las flechas no cambian de día; `←`/`→` cambian de día y lo anuncian por `aria-live`; `1`–`9` actúan según el tipo (marcar, sumar un paso, arrancar el cronómetro, registrar recaída); `N` abre el formulario; escribiendo en un campo no actúa ninguno. |
| Onboarding | **bien** | Tres pasos, «Saltar introducción» siempre visible, plantillas, «Empezar en blanco» y enlace a Ajustes para restaurar una copia. |
| Reordenar por teclado | **bien** | El asa se llama «Reordenar X», va con Espacio / flechas / Espacio y los anuncios salen en español («Beber agua está sobre la posición 2 de 9.»). El orden persiste al recargar y el menú ofrece «Subir» y «Bajar». |

### Lo que este método no puede comprobar

- Que el sistema operativo **pinte** la notificación, y el comportamiento con la pestaña en
  segundo plano: sin servidor push eso depende del navegador y del sistema.
- La instalación real de la PWA: el diálogo de instalar lo decide el navegador.

### Notas del entorno (no son defectos de la app)

- El MCP de Playwright arrancaba con el canal `chrome`, que no estaba instalado en el entorno Windows. Se
  añadió `--browser chromium` a `.mcp.json` (tendrá efecto en la próxima sesión) y se descargó el
  Chromium que pide la versión actual (`chromium-1246`). El recorrido se hizo con scripts propios
  sobre `playwright-core`.
- Con `launchPersistentContext`, `CacheStorage` falla en el entorno Windows («Failed to execute 'open' on
  'CacheStorage'») y el service worker no llega a instalarse. Con un contexto normal funciona. Es
  cosa del perfil de Chromium, no de la app.

## Progreso del recorrido

| Pantalla | Móvil oscuro | Escritorio oscuro | Móvil claro | Escritorio claro |
|---|---|---|---|---|
| Hoy | hecho | hecho | hecho | hecho |
| Detalle de hábito | hecho | hecho | hecho | hecho |
| Estadísticas | hecho | hecho | hecho | hecho |
| Revisión semanal | hecho | hecho | hecho | hecho |
| Nuevo/Editar hábito | hecho | hecho | hecho | hecho |
| Hábitos | hecho | hecho | hecho | hecho |
| Ajustes | hecho | hecho | hecho | hecho |
| Diálogo de atajos | hecho | hecho | — | — |
| 404 | hecho | hecho | hecho | hecho |

Estados revisados aparte: día bloqueado por el límite retroactivo, pantallas vacías (Hoy,
Estadísticas, Hábitos, Revisión), copia dañada, confirmación de importar y de borrar todo,
recordatorios con y sin permiso, y la lista de hábitos mientras se reordena por teclado.

### Lo que salió limpio

- **Nada de lo prohibido por la sección 9**: ni un gradiente, ni blur o `backdrop-filter`, ni una
  sombra de color, ni un emoji en ninguna de las nueve pantallas, en los dos temas.
- **Foco visible**: recorriendo con Tab las nueve pantallas, todas las paradas tienen anillo.
- **Sin errores de consola** en ningún recorrido.
- **Encabezados** correctos en ocho pantallas: un solo `h1` y secciones en `h2` (con `h3` anidado
  en «Últimas 4 semanas»). La excepción es el 404 (H5).
- **Estados vacíos** con texto claro y una acción, sin ilustraciones: «Todavía no hay nada que
  medir. Crea un hábito y en unos días esta pantalla empezará a decir algo.»
- **Día bloqueado**: «Solo se puede registrar hasta 7 días atrás. Este día es de solo lectura.» y
  9 de 19 controles deshabilitados.
- **Tema claro**: la paleta de papel y tinta aguanta en las nueve pantallas; los colores de hábito
  se oscurecen y siguen legibles.
- **Selectores de color e icono**: 44×44 px exactos, con paso de 48.
- **La vista previa del formulario es `sticky`**: sigue visible al bajar hasta Color e Icono.

## Hallazgos

### H1 · Todas las filas con icono — la segunda línea no se alinea con el nombre

- **Dónde:** la regla de «filas con marca de color». Se ve en Hoy, Hábitos, las plantillas de
  `/habitos/nuevo` y la cabecera del detalle.
- **Viewport y tema:** los cuatro.
- **Problema:** el icono va dentro de la misma línea que el nombre, así que el nombre queda
  empujado a la derecha y la segunda línea arranca antes, debajo del icono. Medido en Hoy:
  «Meditar» en x=63 y «Racha 13 d» en x=39, 24 px de desfase en todas las filas. El borde
  izquierdo del bloque queda dentado. Va contra la regla única de `CLAUDE.md`: «una columna con
  todas las líneas alineadas al mismo margen izquierdo».
- **Captura:** `hoy-escritorio-oscuro.png`, `habitos-escritorio-oscuro.png`
- **Propuesta:** sacar el icono a su propia columna, entre `ColorBar` y el texto, para que nombre
  y segunda línea compartan margen; o quitar el icono de la línea del nombre y alinear las dos
  líneas a la izquierda del icono.
- **Severidad:** media
- **Estado:** hecho — Icono en su propia columna (`HabitIconSlot`, ancho fijo aunque no haya icono) entre `ColorBar` y el texto, en Hoy, Hábitos, plantillas y cabecera del detalle.

### H2 · Detalle — el calendario deja medio año en blanco con sus meses etiquetados

- **Dónde:** `src/features/habit-detail/Heatmap.tsx` y `heatmapModel.ts`
- **Viewport y tema:** escritorio, los dos temas (en móvil no se nota: la rejilla se desplaza y
  arranca en el día de hoy).
- **Problema:** la rejilla siempre reserva 53 columnas. Con un hábito creado el 23 de marzo, 27 de
  esas 53 columnas no tienen ni una celda, pero las cabeceras de mes (sep, oct, nov, dic, ene,
  feb, mar) sí se dibujan encima del vacío. En escritorio casi la mitad del calendario es un hueco
  con etiquetas huérfanas.
- **Captura:** `detalle-escritorio-oscuro.png`
- **Propuesta:** o pintar esas semanas como celdas vacías (y que el año se lea como un año), o
  recortar el calendario a la vida del hábito y no dibujar los meses que no existen.
- **Severidad:** media
- **Estado:** hecho — Se mantiene el año completo; las celdas anteriores a la creación (`before` en `heatmapModel.ts`) se dibujan como un contorno tenue, sin botón, distinto de «fallado» (relleno) y de «no toca» (punto).

### H3 · Revisión — las barras de color de la tabla «Hábitos» no cubren la fila

- **Dónde:** `src/features/review/WeekReport.tsx`
- **Viewport y tema:** los cuatro.
- **Problema:** la barra mide 20 px en una fila de 33 (61 %), así que queda flotando en el centro
  en vez de marcar el alto del bloque. Afecta a las siete filas. Es el único sitio de la app donde
  pasa: en Hoy, Estadísticas, Hábitos y Ajustes las barras cubren el 100 %, y en la propia
  Revisión las de «Rachas vivas» también. Va contra «Nunca `ColorBar` con altura fija».
- **Captura:** `revision-escritorio-oscuro-completa.png`
- **Propuesta:** mover el relleno vertical del `td` al contenido, como ya se hace en la tabla de
  consistencia.
- **Severidad:** media
- **Estado:** hecho — `DataTable` admite `flushFirst`; el relleno pasa al enlace y la barra cubre 32 de 33 px (el resto es el filete). De paso, la clave de fila ya no se repetía (`[object Object]`).

### H4 · Estadísticas — con pocos tramos, «Evolución del período» dibuja bloques enormes

- **Dónde:** `src/features/stats/` (el gráfico de evolución) y `charts/`
- **Viewport y tema:** los cuatro; se nota sobre todo en escritorio.
- **Problema:** con el rango «Este mes» solo hay tres tramos (1, 7 y 14 de septiembre) y Recharts
  los estira hasta ocupar el ancho entero: cada barra mide unos 370×100 px. Deja de leerse como un
  gráfico y parece una tabla de bloques. Choca con «gráficos limpios, cuadrícula mínima, ejes
  discretos» y con la estética de instrumento de medición.
- **Captura:** `estadisticas-escritorio-oscuro-completa.png`
- **Propuesta:** poner un ancho máximo de barra (`maxBarSize`) y dejar que las barras se agrupen a
  la izquierda o se centren, como ya ocurre de hecho en «Evolución semanal» del detalle, donde hay
  muchos tramos y se ve bien.
- **Severidad:** media
- **Estado:** hecho — `maxBarSize={32}` en «Evolución del período»; con tres tramos las barras miden 32 px.

### H5 · 404 — no tiene encabezado y arrastra un filete huérfano

- **Dónde:** la pantalla de ruta desconocida (usa `EmptyState`)
- **Viewport y tema:** los cuatro.
- **Problema:** dos cosas. (1) Es la única pantalla sin ningún encabezado: «Esta página no existe.»
  es un `<p class="text-xl font-medium">`, no un `h1`, así que al cambiar de ruta el foco entra en
  `#contenido` y no hay título que anunciar. (2) `EmptyState` trae `border-t`, y como aquí no hay
  `ScreenHeader` encima, la pantalla empieza con una línea horizontal que no separa nada.
- **Captura:** `404-escritorio-oscuro.png`
- **Propuesta:** dar a la pantalla un `h1` («Esta página no existe.») y que el filete de
  `EmptyState` solo salga cuando hay algo encima.
- **Severidad:** media (accesibilidad)
- **Estado:** hecho — `EmptyState standalone`: el título es el `h1` y no lleva filete. Se aplicó también a «hábito inexistente» y «empieza más adelante».

### H6 · Hoy, tema oscuro — los segmentos vacíos de la barra del día son invisibles

- **Dónde:** la barra segmentada de progreso de Hoy
- **Viewport y tema:** móvil y escritorio, **solo oscuro**.
- **Problema:** el segmento vacío es `rgb(12,12,11)` sobre un fondo de `rgb(19,19,18)`: **1,05:1**.
  A 0 % la barra desaparece del todo y no se ve cuántos hábitos quedan; con progreso se ven los
  llenos pero no el total. En tema claro sí se distinguen.
- **Captura:** `hoy-movil-oscuro.png` frente a `hoy-escritorio-claro.png`
- **Propuesta:** subir el segmento vacío al menos al escalón de `border` en oscuro (3:1 contra el
  fondo es lo que pide 1.4.11 para un objeto gráfico que informa).
- **Severidad:** media
- **Estado:** hecho — El segmento vacío es un contorno de `border-strong` (3,3:1 en ambos temas) y la barra pasa de 4 a 6 px.

### H7 · Detalle — las celdas del heatmap miden 12×12 px (decisión tuya)

- **Dónde:** `src/features/habit-detail/Heatmap.tsx`
- **Problema:** cada día es un `button` de 12×12 px con un paso de 15 px entre centros. WCAG 2.2 AA
  (2.5.8) pide 24×24, y la excepción por separación tampoco se cumple porque los vecinos están a
  15 px. Son 182 celdas por hábito. **Lo mitiga** que el teclado no las necesita (un solo punto de
  tabulación y flechas) y que hay tabla alternativa, que podría valer como excepción de «control
  equivalente».
- **Captura:** `detalle-escritorio-oscuro.png`
- **Propuesta:** decidir tú. Agrandar la celda rompe el heatmap anual de un vistazo; dejarlo como
  está es lo que hace cualquier calendario de este tipo y la alternativa accesible ya existe. Una
  vía intermedia: agrandar solo en móvil, donde la rejilla ya se desplaza.
- **Severidad:** a decidir
- **Estado:** hecho — Celda de 24 px en móvil (`size-6 lg:size-3`, paso de 27 px), donde la rejilla ya se desplaza anclada en hoy; compacta de 12 px en escritorio.

### H8 · Editar hábito — no se puede mover la fecha de inicio

- **Dónde:** `src/features/habits/HabitForm.tsx`
- **Problema:** el formulario de creación tiene el campo «Empieza el», pero el de edición solo
  enseña la frase «Cuenta desde el 23 de marzo.», sin control. `CLAUDE.md` dice que «para rellenar
  días anteriores, el formulario permitirá adelantar la fecha de inicio»; hoy, si te das cuenta
  tarde, no hay forma de adelantarla sin borrar el hábito y volver a crearlo.
- **Captura:** `habito-editar-escritorio-oscuro-completa.png`
- **Propuesta:** dejar editable «Empieza el» también al editar, permitiendo solo adelantarla (y
  nunca más allá del primer registro).
- **Severidad:** media (funcional)
- **Estado:** hecho — «Empieza el» es editable: hasta el límite retroactivo desde hoy (o la fecha actual si es más antigua, para poder volver atrás) y nunca después del primer registro (`startDateRange` en `domain/habit.ts`, comprobado también en `updateHabit`). Con «Deshacer» como el resto de ediciones. Si ya hay un registro el primer día, el campo lo explica y no se mueve.

### H9 · Ajustes — «días atrás» se parte en dos líneas junto al campo

- **Dónde:** `src/features/settings/SettingsScreen.tsx`, «Registrar días anteriores»
- **Viewport y tema:** los cuatro.
- **Problema:** el campo numérico se lleva casi todo el ancho y el sufijo queda en una columna
  estrecha, así que «días atrás» se rompe en «días / atrás» aunque sobre sitio de sobra a la
  derecha.
- **Captura:** `ajustes-escritorio-oscuro-completa.png`
- **Propuesta:** estrechar el campo (es un número de dos cifras) y darle al sufijo
  `whitespace-nowrap`.
- **Severidad:** baja
- **Estado:** hecho — Campo en un contenedor de 80 px (`inputClasses` traía `w-full`, que pisaba a `w-24`) y sufijo con `whitespace-nowrap`.

### H10 · Onboarding — sus plantillas no se parecen a las del formulario

- **Dónde:** `src/features/onboarding/Onboarding.tsx` (paso 3) frente a `/habitos/nuevo`
- **Problema:** en el onboarding las plantillas son filas de texto pelado; en el formulario las
  mismas plantillas llevan icono, barra de color y chevron. Es el primer sitio donde se ve un
  hábito y no se parece a como se verán después.
- **Captura:** `onboarding-escritorio-oscuro-paso3.png` frente a
  `habito-nuevo-escritorio-oscuro-completa.png`
- **Propuesta:** reutilizar la misma fila en los dos sitios.
- **Severidad:** baja
- **Estado:** hecho — Fila compartida `TemplateRow` en el selector y en el onboarding.

### H11 · Hábitos — el asa de arrastre deja la barra de color fuera del borde de la fila

- **Dónde:** `src/features/habits/SortableHabitList.tsx`
- **Problema:** en Hoy la barra de color es el primer elemento de la fila y marca su borde
  izquierdo; aquí el asa va delante, así que la barra queda metida hacia dentro y el borde
  izquierdo de la lista cambia de una pantalla a otra.
- **Captura:** `habitos-escritorio-oscuro.png`
- **Propuesta:** poner la barra delante del asa, o aceptar la diferencia y anotarla en la regla de
  `CLAUDE.md`.
- **Severidad:** baja
- **Estado:** hecho — `ColorBar` delante del asa en `SortableHabitList`.

### H12 · Detalle en móvil — las etiquetas de día de la semana se van con el scroll

- **Dónde:** `src/features/habit-detail/Heatmap.tsx`
- **Viewport y tema:** solo móvil.
- **Problema:** la rejilla arranca desplazada al final (bien: enseña los días recientes), pero la
  columna de «M / J / S» se queda fuera de pantalla, así que de entrada no se sabe qué fila es qué
  día hasta desplazar a la izquierda.
- **Captura:** `detalle-movil-oscuro.png`
- **Propuesta:** dejar la columna de días `sticky` a la izquierda del área que se desplaza.
- **Severidad:** baja
- **Estado:** hecho — Columna de días `sticky` a la izquierda, con el margen incluido para que no asomen celdas por debajo.

### Cosas que miré y decidí no anotar

- Los enlaces de 20 px de alto de Estadísticas y Revisión: quedan por debajo de 24 px, pero sus
  filas están a 33–73 px unas de otras, así que cumplen 2.5.8 por la excepción de separación.
- El icono *maskable* es el mismo archivo que el normal: la marca cabe dentro del círculo seguro
  del 80 %, así que es correcto.
- La rejilla del heatmap en móvil llega a los bordes de la pantalla: es un `-mx-gutter` con
  `px-gutter` dentro, el patrón correcto para algo que se desplaza en horizontal.
- El manifiesto declara `theme_color` claro; las dos variantes van en `meta[name=theme-color]`.

## Ya corregido antes del recorrido (paso 1)

| # | Pantalla | Problema | Corrección | Estado |
|---|---|---|---|---|
| 1 | Ajustes | El límite retroactivo se guardaba en cada tecla: escribir `14` guardaba `1` y luego `14`. | Se guarda al salir del campo o con Enter; fuera de rango se avisa y se recupera el valor anterior (`SettingsScreen.tsx`). | hecho |
| 2 | Nuevo/Editar hábito | En el selector de icono, la opción "Ninguno" era texto dentro de una caja de 44 px: no cabía, tocaba los bordes y se cortaba. | Pasa a ser un icono (`CircleSlash`) del mismo tamaño que los demás, con "Ninguno" como nombre accesible y como tooltip; se añadió tooltip a todas las opciones y el estado elegido es idéntico en todas (`features/habits/fields.tsx`). | hecho |
