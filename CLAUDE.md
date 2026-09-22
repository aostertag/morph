# CLAUDE.md — Morph

Memoria del proyecto entre sesiones. Léelo entero antes de trabajar y actualízalo al cerrar cada fase.
La especificación completa está en `SPEC.md`; la sección 9 (diseño) prevalece sobre cualquier guía, incluidas las skills.

## Estado

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Tooling, tokens, modelo de datos Dexie, dominio (frecuencias, rachas, comodines, pausas) + tests | **Hecha** |
| 2 | Pantalla Hoy y gestión de hábitos | **Hecha** |
| 3 | Detalle de hábito, heatmap, métricas, generador de datos | **Hecha** |
| 4 | Estadísticas globales, correlaciones y registro de ánimo/energía | **Hecha** |
| 5 | Revisión semanal e hitos | **Hecha** |
| 6 | Ajustes, backup, pausas, recordatorios, PWA, onboarding, atajos, a11y | **Hecha** |
| 7 | Pulido final | **Hecha** |

### Marca: Morph

La app se llama **Morph** (título «Hoy / Morph» vía `APP_NAME` en `app/routeTitle.ts`, manifest, `apple-mobile-web-app-title`, README, SPEC).

- **Icono:** el original es `brand/morph-icon-source.png` (1024×1024, no se modifica). `node scripts/generate-icons.mjs` lo lee (PNG sin dependencias), lo reduce por promedio de área y escribe `public/pwa-192.png`, `pwa-512.png`, `pwa-maskable-512.png` (el mismo archivo que el normal), `apple-touch-icon.png` (180) y `favicon.svg` (SVG que incrusta un PNG de 64 px, **recortado alrededor de la «m» para que ocupe el 70 % del lado**: `FAVICON_FILL` en el script). Con la fuente entera (proporción de los iconos grandes) la «m» era un manchón a 16 px; al 80 % quedaba pesada y casi tocando los bordes. El 70 % se eligió mirando la pestaña real de Chrome (captura de pantalla con `CopyFromScreen`, tema claro y oscuro), no un ampliado sintético. El script falla si la marca sale del círculo seguro del 80 % (hoy queda a 31,5 % del lado del centro, límite 40 %). Si cambia el icono, vuelve a ejecutarlo y revisa los PNG.
- **Excepción consciente:** el icono es un activo de marca externo a los tokens. Hoy no lleva nada prohibido por la sección 9 del SPEC (azul plano ≈ `accent`, sin gradientes); si uno futuro los llevara, la excepción vale solo para el icono, nunca para la interfaz.
- **`theme_color` y `background_color`** del manifest siguen en `#f6f5f1` (papel): es el fondo real de la app y el de la pantalla de arranque; las variantes claro/oscuro van en las metas de `index.html`.
- **Identificadores heredados, NO renombrar:** `DB_NAME = 'habit-tracker'` (`db/schema.ts`), `BACKUP_FORMAT = 'habit-tracker-backup'` (`domain/backup.ts`) y las claves `tracker:*` de `localStorage`. Cambiarlos dejaría sin datos a las instalaciones existentes o invalidaría las copias ya exportadas. Los archivos exportados siguen llamándose `habitos-*`.
- **Repositorio de GitHub:** `aostertag/morph` (antes `habit-tracker`, renombrado el 2026-09-21; `origin` ya apunta a la URL nueva). No hay workflows ni referencias por texto al nombre viejo. El proyecto de Cloudflare Pages (`habit-tracker-c6c.pages.dev`) conserva su nombre y dominio; su dashboard sigue mostrando «habit-tracker» como nombre del repo, y el cambio de dominio queda para otra sesión.

### Fase 7 (pulido final): terminada

Recorrido contra las secciones 9 y 10 de `SPEC.md` y corrección de los 12 hallazgos H1–H12. El detalle,
con capturas, está en `AUDITORIA.md` (las capturas viven en `auditoria/capturas/`, ignorado por git).
El estado actual pasa `npm run check` y `npm run build` (chunk de entrada de ~305 kB).

Lo que cambió y conviene saber al tocar esas zonas:

- **Selector de color:** se presenta en `HABIT_COLOR_DISPLAY_ORDER` (`ui/HabitMarks.tsx`, por tono y el gris al final), **no** en el orden de `HABIT_COLORS`, que fija el color por defecto de un hábito nuevo (`palette.test.ts` comprueba que es una permutación). `flex flex-wrap` de celdas de 44 px sin `gap`: con 13 colores caben en una fila en escritorio y 7+6 en móvil de 360 y 375 px (con `gap-1` a 360 salía 6+6+1; a 320 sigue siendo 6+6+1). Si añades colores, vuelve a medirlo.
- **Icono de hábito en su columna** (`HabitIconSlot` en `ui/HabitMarks.tsx`): entre `ColorBar` y el texto, con ancho fijo aunque no haya icono, para que nombre y segunda línea compartan margen. Vale en Hoy, Hábitos, plantillas y cabecera del detalle. La lista de Hábitos pone la `ColorBar` **antes** del asa de arrastre.
- **`TemplateRow`** (`features/habits/`): la fila de plantilla, compartida por «Nuevo hábito» y el onboarding.
- **`DataTable` admite `flushFirst`**: la primera columna pone su propio relleno vertical, para que una `ColorBar` cubra la fila. La clave de fila sale de la del elemento si la primera celda lo es.
- **`EmptyState standalone`**: en pantallas sin encabezado propio (404, hábito inexistente, hábito que empieza más adelante) el título es el `h1` y no lleva filete.
- **Barra del día (Hoy):** el segmento vacío es un contorno de `border-strong` (3,3:1 en ambos temas); antes era `sunken`, invisible en oscuro.
- **Heatmap:** el año se dibuja entero; los días anteriores a la creación son celdas `before` (contorno tenue, sin botón). Celdas de 24 px en móvil (`size-6`) y de 12 px desde `lg`. La columna de días es `sticky`.
- **Editar «Empieza el»:** `startDateRange()` en `domain/habit.ts` (hasta `retroLimitDays` atrás desde hoy, sin perder la fecha actual si es más antigua, y nunca después del primer registro). `updateHabit` lo comprueba también, dentro de la transacción. Se deshace como el resto de ediciones.
- **Gráfico «Evolución del período»:** `maxBarSize={32}`.

- **Columna de campos del formulario de hábito** (`HabitForm.tsx`): es un bloque con `space-y-8`, **no** un `flex flex-col gap-8`. En Safari de iOS, el contenedor flex de esa columna quedaba ~156 px más alto que la suma de sus hijos al cargar (hueco vacío bajo «Crear hábito») y no se recalculaba hasta reactivar la página (tocar un campo, salir y volver a Safari). Al pulsar el botón el campo perdía el foco, el hueco desaparecía y el toque caía en «Empieza el». Se descartó la rejilla del formulario (pasarla a flex en móvil no cambió nada) y las unidades de viewport (solo hay `dvh`); WebKit de escritorio no lo reproduce, ni retrasando las fuentes. Alternar `display` desde JavaScript para forzar un recálculo tampoco bastó. Quitar el contenedor flex y separar con margen sí, comprobado en un iPhone real. No lo vuelvas a `flex`/`gap` en esa columna sin probarlo en un iPhone real.

### Hábitos que empiezan en el futuro (hecho)

`createdOn` puede ser posterior a hoy, hasta `FUTURE_LIMIT_DAYS` (365) días (`latestStart()`, `startDateRange()` y `hasNotStarted()` en `domain/habit.ts`).

- **No dejan rastro:** `useHabitAnalyses` los aparta (`upcoming`), así que no salen en Hoy, Estadísticas, revisión, recordatorios ni atajos; `evaluateHabit` no devuelve unidades antes de `createdOn` (sin fallos, rachas, hitos ni peso en la puntuación). Empiezan a contar solos al llegar su fecha (`useToday`). Cubierto en `domain/futureStart.test.ts`.
- **Hoy con solo hábitos futuros:** estado propio («Tus hábitos empiezan más adelante»), no «Nada programado».
- **Lista de Hábitos:** siguen en la lista activa (orden y arrastre intactos) pero con nombre atenuado, barra de color al 50 % y «Empieza el …» en negrita al principio de la línea secundaria.
- **No se archivan:** el menú no ofrece «Archivar» y `archiveHabit` lo rechaza. Un archivado anterior a `createdOn` haría que la copia de seguridad se rechazase al importar; por eso `archiveHabit` tampoco deja `archivedOn` antes de `createdOn` (hábito creado hoy y archivado sin registro).
- **Límite en el repo:** `createHabit`/`updateHabit` reciben `today` (por defecto el del reloj) y comprueban el límite futuro; al editar solo si la fecha cambia, para no invalidar un inicio ya guardado.
- **Copia de seguridad:** sin cambios; no aplica el límite de 365 días al importar (una copia antigua puede traer fechas que ya son pasado).
- **Generador:** añade «Estudiar italiano» (empieza en 5 días) **fuera de `PROFILES`**, para no consumir números aleatorios y dejar el resto de los datos idénticos.
- **Filas de «Nuevo hábito» y onboarding:** `PickerRow` (privada en `features/habits/TemplateRow.tsx`) es la única maqueta; `TemplateRow` y `BlankRow` la usan. «Empezar en blanco» va **aparte, encima** de «Plantillas» (no es una plantilla), sin barra de color (`BarGap` reserva su hueco) y con un `Plus` en la columna del icono (`HabitIconSlot` admite `children`): icono y texto coinciden en X con los de las plantillas (medido en móvil y escritorio, claro y oscuro).

### Categorías (hechas: gestión en Ajustes + agrupación en Estadísticas)

**Ajustes:** `CategoriesSection` (entre Recordatorios y Pausas): listar con el número de hábitos, crear,
renombrar y borrar, todo con «Deshacer».

- `domain/categories.ts`: `categoryNameProblem()` (vacío, >40, duplicado sin distinguir mayúsculas ni
  espacios sobrantes; `ignoreId` para renombrar). Lo usan el formulario (validación viva) y el repo
  (última barrera, dentro de la transacción), como `pauseProblem`.
- `db/repos/categories.ts`: `deleteCategory` devuelve `{ category, habitIds }` y pone `categoryId: null`
  solo en esos hábitos (archivados incluidos), en una transacción. `restoreCategory(category, habitIds)`
  deshace: repone la categoría con su mismo id/orden y reasigna **solo** a los hábitos que existen y
  siguen sin categoría (no pisa una asignación hecha entretanto). También deshace un renombrado.
- `CategoryField` (formulario de hábito) usa la misma validación en vivo.
- Backup, «Borrar todo» y el generador de ejemplo ya cubrían `categories` y la integridad referencial.
- Con un formulario abierto (categoría o pausa), su lista pierde el `border-t` (el borde inferior del
  formulario hace de filete) para no mostrar dos divisorias seguidas.

**Estadísticas, «Por categoría»** (`features/stats/ByCategorySection.tsx`, en la columna izquierda
**después** de Consistencia):

- `categoryBreakdown()` y `hasCategoryGroups()` en `domain/stats.ts`. **No hay lógica de tasas
  nueva:** cada categoría es `scoreComparison()` (→ `periodScore`) sobre sus hábitos, así que hereda las
  reglas de muestra (7 días evaluables para ordenar, 7 en ambos períodos para el delta).
- **Sin categoría:** fila aparte al final, con hueco, **fuera del orden**. Excluirlos descuadraría las
  categorías respecto a la puntuación general; ordenarlos como un grupo más los haría salir «mejores» o
  «peores» siendo solo lo que sobra. Si no llegan a la muestra van a la frase de datos insuficientes.
  Una `categoryId` que ya no existe cuenta como sin categoría.
- **«A evitar»:** excluidos (no puntúan en ningún sitio); una categoría solo con ellos no aparece.
- Las categorías con menos de 7 días evaluables, **incluido 0** (p. ej. un hábito mensual aún en curso),
  se apartan en «Sin datos suficientes para ordenarlas: Relaciones (0 d)»: ninguna categoría viva se
  esfuma sin decirlo. **Excepción:** una con 0 días y todos sus hábitos archivados no se lista (igual
  que Consistencia calla los archivados sin días); con días en el rango sí cuenta. La sección solo
  aparece si `hasCategoryGroups()`: alguna categoría real, ordenada o apartada.
- Comparte columnas con Consistencia (`stats/barTable.tsx`: `table-fixed` + `colgroup`), así que las
  barras quedan en la misma posición y con el mismo ancho en móvil y escritorio; la línea «N hábitos ·
  +8 puntos que…» va en una segunda fila a todo el ancho. **Los anchos van en el `colgroup`, no en las
  celdas:** con `table-fixed` manda la primera fila (aquí la cabecera oculta, sin anchos).
- Tabla con barra decorativa `aria-hidden` y las cifras en texto (sin Recharts ni `ChartFigure`): no
  pesa en el chunk. No nombra «mejor» ni «peor» categoría. La comparación usa `previousPeriodLabel()`
  (`stats/describe.ts`, compartido con `ScoreSection`): «+15 puntos que el mes anterior».
- **La categoría en Hábitos y en el detalle** va **al principio** de la línea secundaria
  (`describeHabit(habit, weekStartsOn, categoryName)`): en móvil la línea se corta por el final y era
  la categoría lo que se perdía.

## Entorno

El proyecto se trabaja desde dos máquinas, cada una con su propia copia del repo:

- **Windows, PowerShell**, en `C:\Users\oster\Documents\tracker`.
- **Ubuntu, bash**, en `/home/agustin/Documents/morph`.

**Antes de empezar en cualquiera de las dos: `git pull`.** Son checkouts independientes; nada sincroniza el árbol de trabajo entre ellas salvo git.

- **Las notas específicas de Windows solo valen en Windows.** Hoy hay una en Convenciones (los heredocs largos fallan en ese entorno; usa la herramienta Write). Si aparecen más peculiaridades de shell o de sistema operativo (comandos que no existen como `pkill`, reglas de cortafuegos, rutas con `\`…), documéntalas igual de acotadas: no asumas en Ubuntu algo que se descubrió en PowerShell, ni al revés.
- **Playwright en una máquina nueva:** `npm install` no basta. El MCP (`@playwright/mcp@latest --browser chromium`, fijado en `.mcp.json`) espera el Chromium del canal `chrome-for-testing` en la versión que pida esa build (comprobado el 2026-09-21: `chromium-1246`); `npx playwright install chromium` a secas puede traer otra build (trajo `chromium-1243`) y el MCP seguirá sin arrancar. El comando correcto es el que da el propio error: `npx @playwright/mcp install-browser chrome-for-testing`. Verificado en Ubuntu; si en Windows hace falta algo más (dependencias del sistema, permisos), anótalo ahí cuando se compruebe. En el PC con Windows (donde se hizo la fase 7, antes de usar la laptop con Ubuntu), el MCP arrancaba con el canal `chrome`, que no estaba instalado allí; de eso viene el `--browser chromium` fijado en `.mcp.json`. También allí: con `launchPersistentContext`, `CacheStorage` fallaba y el service worker no llegaba a instalarse; con un contexto normal funcionaba.
- **Node:** el mínimo es 22.12 (`engines` en `package.json`); verificado en Ubuntu con v24.21.0 el 2026-09-21.

## Stack (versiones verificadas con `npm view` el 2026-09-19)

React 19.3 · TypeScript 7.0 (nativo) · Vite 8.3 + `@vitejs/plugin-react` 6 + React Compiler (vía `@rolldown/plugin-babel` + `@babel/core` 8) · Tailwind 4.3 (CSS-first) · Dexie 4.4 + dexie-react-hooks · Recharts 3.10 · date-fns 4.4 · Zustand 5 · Sonner 2 · Motion 13 · Lucide 1.47 · React Router 8 · Base UI 1.8 · dnd-kit (core 6 + sortable 10) · Zod 4 · vite-plugin-pwa 1.3 · Vitest 5 + jsdom + Testing Library + fake-indexeddb · Biome 2.5.

- **Biome, no ESLint + Prettier:** `typescript-eslint` exige `typescript <6.1`, así que no funciona con TS 7. Biome es lint + formato en una sola herramienta y no depende de la API de TS.
- **D3 no está instalado.** El heatmap es una tabla HTML propia (mejor para el foco por teclado y para reutilizar los tokens). Solo se añade D3 si algo lo requiere de verdad.
- `noPropertyAccessFromIndexSignature` está desactivado porque choca con `useLiteralKeys` de Biome. `noUncheckedIndexedAccess` sigue activo.

## Scripts

`npm run dev` · `npm run build` (typecheck + build) · `npm run typecheck` · `npm run lint` / `lint:fix` · `npm test` · `npm run check` (typecheck + lint + tests).

## Arquitectura

UI (`features/`, `ui/`, `charts/`) → datos (`db/`) → dominio (`domain/`). **El dominio no importa React ni Dexie.**

- `src/domain/`: funciones puras. `today` siempre entra como argumento; nunca se lee `new Date()` dentro.
  - `day.ts`: `LocalDay` ('YYYY-MM-DD', tipo marcado). La aritmética usa un número de día absoluto basado en UTC de la fecha civil, a prueba de cambios de horario. `Date` solo aparece en los bordes (`toLocalDay`, `toLocalDate`).
  - `frequency.ts`: unidad de evaluación, períodos, prorrateo y validación.
  - `pauses.ts`: pausas globales (`habitId: null`) y por hábito.
  - `evaluate.ts`: `evaluateHabit()` devuelve las unidades con estado `done | missed | paused | pending`. También contiene `canLogOn()` (límite retroactivo).
  - `streaks.ts`: `computeStreaks()` calcula racha actual, mejor racha, comodines disponibles y usos. `records` guarda la **primera** vez que la racha alcanzó cada longitud (`bestRange` se queda con el empate más reciente; aquí interesa la primera), y de ahí salen las fechas de los hitos.
  - `milestones.ts`: hitos derivados de la historia, sin persistir. Tres familias (`streak`, `completed`, `logged`) con umbrales escalados a la unidad del hábito. Los "a evitar" no tienen familia `logged`: un registro es una recaída. "Primera semana completa" es el hito de racha 7 en unidad de día, no uno aparte.
  - `review.ts`: `lastCompleteWeek()`, `weekOf()`, `weekSummary()` (puntuación contra la semana anterior, ranking, más constante, el que más costó, recaídas y medias de ánimo) y `reviewPending()`. El informe **no se persiste**: de `WeeklyReview` solo se guarda la reflexión. `consistencyRanking` admite un `minDays` opcional y la revisión usa `MIN_REVIEW_DAYS = 3`, porque sobre siete días un hábito de lunes, miércoles y viernes solo aporta tres.
  - `habit.ts`: normalización y validación del formulario de hábito.
  - `range.ts`: rango de análisis (semana, mes, trimestre, año, personalizado) y el período anterior comparable.
  - `stats.ts`: puntuación del período, comparación, evolución por tramos, ranking de consistencia, día de la semana, mejora/caída de 4 semanas y resumen de "a evitar".
  - `correlation.ts`: series binarias por día, comparación de medias (Welch) y de proporciones, cuantil normal y corrección de Bonferroni.
  - `history.ts`: `buildHistory()` convierte el análisis en una línea de tiempo día a día (valor, si tocaba, pausa, éxito, unidad y comodín). De ella salen el heatmap y todas las métricas. También `heatLevel()` y `relapseLevel()`.
  - `metrics.ts`: tasas por ventana, evolución por semanas o meses, día de la semana, totales, cantidades con tendencia, estadísticas de "a evitar" e historial (notas, comodines y pausas).
  - `types.ts`: modelo de datos y `DEFAULT_SETTINGS`.
- `src/db/`:
  - `schema.ts`: `TrackerDB` y el singleton `db`.
  - `migrations.ts`: lista versionada. **Nunca se edita una versión publicada; se añade otra.**
  - `errors.ts`: `StorageError` (mensaje claro para el usuario) y `ValidationError`.
  - `repos/*`: todas las escrituras pasan por aquí (`habits`, `entries`, `dayLogs`, `pauses`, `reviews`, `categories`, `settings`, `dataset`). Las mutaciones devuelven el estado anterior para poder deshacer. `categories` se crea al vuelo desde el campo «Categoría» del formulario de hábito y se renombra y borra desde Ajustes (`features/settings/CategoriesSection`).
  - `useSettings()` devuelve `undefined` mientras carga; `getSettings()` rellena con `DEFAULT_SETTINGS`, así que un campo nuevo no rompe bases existentes.
- `src/domain/today.ts`:
  - `analyzeHabit()` evalúa todo el historial; es la parte costosa y se cachea.
  - `viewForDay()` construye el estado de un día a partir de ese análisis (valor, progreso del período, rachas, último comodín en la racha).
  - `dayProgress()` y `groupByTimeOfDay()`.
- `src/domain/templates.ts`: plantillas sugeridas, sin emojis.
- `src/lib/theme.ts`: resuelve el tema y guarda en `localStorage` una copia de la preferencia, que un script inline de `index.html` aplica antes del primer pintado.
- `src/lib/format.ts`: todo el texto formateado (fechas con date-fns/es, números `es-ES`, frecuencias, rachas, cronómetro). Importa **solo** `date-fns/locale/es`: el barrel `date-fns/locale` tarda 12 s en cargarse.
- `src/lib/toast.tsx`:
  - `notify(msg, { key, undo })` usa toasts headless de Sonner.
  - Con `key`, las acciones seguidas sobre lo mismo actualizan un único toast, y "Deshacer" vuelve al estado anterior a la primera.
  - `notifyError(err)` muestra siempre un mensaje claro.
- `src/hooks/useData.ts`:
  - lecturas reactivas (`useLiveQuery`);
  - `useEntriesByHabit(ids)` abre una suscripción `liveQuery` por hábito, así que marcar uno solo vuelve a leer ese hábito.
- `src/hooks/useToday.ts`: `useToday()` cambia a medianoche y al volver a la pestaña; `useNow()` es el tic del cronómetro.
- `src/state/timer.ts`: cronómetros en Zustand, persistidos en `localStorage` con un envoltorio seguro. Solo guardan `startedAt` y el día de inicio.
- `src/features/today/`:
  - `useHabitAnalyses` cachea en un `WeakMap` por identidad del hábito, del array de registros y de la clave de contexto;
  - `actions.ts` contiene todas las escrituras con deshacer;
  - `describe.ts` genera la línea de contexto de cada fila.
- `src/features/habit-detail/`: pantalla de detalle, cargada con `lazy()` porque arrastra Recharts.
  - `heatmapModel.ts`: maquetación pura del heatmap (semanas, meses, celdas, navegación) y resumen por meses;
  - `Heatmap.tsx`: la rejilla es una tabla con un solo punto de tabulación; las flechas mueven un día o una semana;
  - `DayPanel.tsx`: el día elegido, con su nota editable dentro del límite retroactivo;
  - `Summary.tsx`, `WeeklyChart.tsx`, `WeekdayTable.tsx`, `ValueSection.tsx`, `HistoryList.tsx`.
- `src/features/review/`: revisión semanal, cargada con `lazy()`.
  - `useReviewData.ts` reutiliza la caché compartida, como `useStats`;
  - `ReviewScreen.tsx` lee la semana de la URL (`/revision?semana=YYYY-MM-DD`; solo semanas cerradas que empiecen el día configurado) y al abrirse marca `lastReviewOffered`, así que el aviso deja de salir;
  - `ReviewPrompt.tsx` es el aviso de Hoy (no `lazy`: lo monta `TodayScreen`), `WeekReport.tsx` el informe, `ReflectionForm.tsx` la reflexión y `ReviewHistory.tsx` el historial;
  - `reviewActions.ts`: `saveReview` (con deshacer) y `dismissReview` (sin él: no se pierde nada).
  - Las **rachas** solo se enseñan en la última semana cerrada, porque van siempre a fecha de hoy.
- `src/features/habit-detail/MilestonesSection.tsx`: hitos alcanzados con su fecha y el siguiente de cada familia con su progreso. Las etiquetas salen de `describeMilestone` en `habit-detail/describe.ts`.
- `src/features/stats/`: pantalla de estadísticas globales, cargada con `lazy()` (arrastra Recharts).
  - `useStats.ts` reutiliza los análisis de la caché compartida y añade `dayLogs`;
  - `RangePicker.tsx` (select nativo + dos fechas), `ScoreSection.tsx`, `ConsistencySection.tsx`, `MomentumSection.tsx`, `WeekdaySection.tsx`, `AvoidSection.tsx`, `CorrelationsSection.tsx`;
  - `describe.ts` genera las frases de las correlaciones, siempre con su muestra y sin verbos de causa.
- `src/features/today/DayLogPanel.tsx` y `dayLogActions.ts`: ánimo y energía (escalas 1–5 con radios nativos), nota del día y deshacer. De aquí salen los datos de las correlaciones.
- `src/charts/ChartFigure.tsx`: marco común de los gráficos (título, controles, alternativa en tabla y nota) y `DataTable`.
- `src/lib/analysisCache.ts`: la caché de análisis que comparten Hoy, el detalle y las estadísticas, para no recalcular al abrirlos. `cachedHistory()` guarda además la historia día a día por identidad del análisis.
- `src/domain/backup.ts`: copia de seguridad completa, pura. `parseBackup(texto)` valida **todo** antes de devolver `ok` y por etapas: JSON, formato y versión, esquema estricto de Zod (campos desconocidos = error, fechas reales), reglas de cada hábito (`validateHabitInput`) e integridad (ids únicos, `[habitId+date]` único, referencias, rangos). Devuelve hasta 10 problemas legibles (`habits[2] («Leer») · frequency: …`) y cuántos más había. Las migraciones de formato viven en `MIGRATIONS` (hoy ninguna: versión 1). Una copia de versión futura se rechaza.
- `src/domain/csv.ts`: exportación de registros a CSV (RFC 4180, CRLF, neutraliza celdas que empiezan por `=`, `+`, `-`, `@`).
- `src/domain/reminders.ts`: `planReminders()` decide qué avisar ahora y cuándo volver a mirar (tolerancia de 30 min, sin repetir).
- `src/domain/pauses.ts` además valida: `findPauseConflict`/`pauseProblem` (rango real y no invertido; solape solo dentro del mismo ámbito).
- `src/db/repos/dataset.ts`: `readSnapshot()` (lectura coherente), `replaceAllData(data, settings?)` y `restoreSnapshot()`. **Una sola transacción `rw` sobre todas las tablas**: si algo falla, la base queda idéntica. Importar y borrar todo devuelven el estado anterior, y de ahí sale "Deshacer".
- `src/features/settings/`: `SettingsScreen` (`lazy`; arrastra Zod), `DataSection` + `dataActions.ts` (exportar, importar, borrar), `PausesSection`/`PauseForm`/`pauseActions.ts`, `RemindersSection`.
- `src/features/reminders/`: `RemindersRunner` (montado en `AppShell`, no pinta nada), `notifications.ts` (permiso, aviso por service worker o API directa, avisos ya enviados en `localStorage` por día).
- `src/features/onboarding/Onboarding.tsx`: tres pasos saltables; `TodayScreen` lo enseña solo con `!onboardingDone && !hasHabits`.
- `src/features/shortcuts/`: `GlobalShortcuts` (en el chunk de entrada; `N` y `?`) y `ShortcutsDialog` (`lazy`, arrastra Base UI). Los números y las flechas de Hoy están en `features/today/TodayShortcuts.tsx`. Lógica pura en `lib/shortcuts.ts`; `hooks/useShortcuts.ts` la conecta.
- `src/lib/storage.ts`: `requestPersistentStorage()` (desde `main.tsx`, sin esperar y sin UI, también en desarrollo; solo allí registra el resultado en consola). `DataSection` abre con un aviso de que los datos viven solo en este navegador.
- `src/lib/pwa.ts` registra el service worker (solo en producción, aviso "Recargar" en vez de recarga automática); `src/lib/download.ts` descarga archivos; `src/app/routeTitle.ts` da el título por ruta.
- `scripts/generate-icons.mjs` genera los iconos de `public/` (cuadrado plano de tinta azul con una marca blanca, sin dependencias). `public/sw-extra.js` se carga dentro del service worker y enfoca la app al pulsar un recordatorio.
- `src/dev/`: solo en desarrollo. `sampleData.ts` genera seis meses deterministas —incluidas cuatro reflexiones semanales, que empiezan el día que diga `weekStartsOn` y dejan la última semana cerrada sin escribir para que el aviso de Hoy tenga algo que ofrecer—; `DevTools.tsx` solo renderiza el botón (`SampleDataButton.tsx`) si `import.meta.env.DEV`, así que nada de esto entra en producción. Escribe con `db/repos/dataset.ts` (`replaceAllData`), que también usa la importación de backups.
- `src/features/habits/`:
  - lista con dnd-kit (puntero y teclado, anuncios en español) y las alternativas "Subir"/"Bajar" en el menú;
  - formulario con vista previa (`HabitRow` en modo `preview`) y selector de plantillas.
  - Estas rutas se cargan con `lazy()`, para que Hoy no cargue dnd-kit ni Base UI.
- `src/ui/`:
  - primitivas: `Button`/`ButtonLink`/`IconButton`, `Field`/`Fieldset` (ARIA conectado vía render prop), `Segmented` (radios nativos), `ConfirmDialog` (Base UI AlertDialog), `ActionsMenu` (Base UI Menu), `ColorBar`/`HabitIcon`, `EmptyState`; `ScreenHeader` (encabezado único de todas las pantallas: sobretítulo reservado de 16 px, título `text-2xl` en fila de `min-h-touch`, acciones alineadas con esa fila, `mark` opcional para la barra del hábito; Hoy lo usa con el día de la semana como sobretítulo, sin excepción; `html` lleva `scrollbar-gutter: stable` para que el margen izquierdo no dependa de si hay barra de desplazamiento);
  - `ui/icons.ts` es la lista curada de iconos Lucide, importados uno a uno.
- `src/test/factories.ts`: fábricas para los tests (`habit()`, `entry()`, `entriesOn()`, `dayLog()`, `pause()`, `days()`, `d()`).

La navegación tiene cuatro pestañas (Hoy, Estadísticas, Hábitos, Ajustes; `NAV` en `app/Layout.tsx`): a
`/revision` se llega por el aviso de Hoy y por el historial.

**Peso del paquete (comprobado en la build del cierre de la fase 6):** el chunk de entrada (Hoy, con `ReviewPrompt`, `Onboarding`, `RemindersRunner` y `GlobalShortcuts` dentro, ~305 kB) solo importa de forma estática el runtime, `Button` y `HabitMarks`. Recharts vive en los chunks de `HabitDetailScreen` y `BarChart`, el informe de la revisión en `ReviewScreen`, Zod y el backup en `SettingsScreen` y Base UI del diálogo de atajos en `ShortcutsDialog`, todos `lazy()`. Si Hoy empieza a arrastrar alguno de ellos, es que algo se importó fuera de un `lazy()`.

## Mapa del proyecto

Mira aquí primero; el detalle de cada módulo está en «Arquitectura». Alias `@/` = `src/`.

```
SPEC.md            especificación (sección 9 = diseño, prevalece)      AUDITORIA.md  informe de la fase 7
vite.config.ts     Vite + React Compiler + Tailwind + PWA (precache, manifest)
vitest.config.ts   proyectos de test: domain ×3 zonas horarias, db, lib, ui
biome.json         lint + formato · tsconfig.json  TS estricto
index.html         script inline que aplica el tema antes del primer pintado
public/            iconos PWA y sw-extra.js (los genera scripts/generate-icons.mjs)
src/
  main.tsx         arranque · pwa.ts registra el service worker
  app/             App.tsx (rutas y lazy) · Layout.tsx (pestañas, foco) · routeTitle.ts · ErrorBoundary · NotFound.tsx
  domain/          lógica pura (sin React ni Dexie), tests al lado
  db/              schema.ts, migrations.ts, errors.ts, repos/* (única vía de escritura)
  hooks/           useData (lecturas reactivas), useToday, useShortcuts
  state/           Zustand: timer.ts (cronómetros), shortcutsDialog.ts
  lib/             format.ts (todo el texto), toast.tsx, theme.ts, analysisCache.ts, shortcuts.ts, download.ts
  features/        una carpeta por pantalla o funcionalidad (abajo)
  ui/              primitivas: Button, Field, Segmented, ConfirmDialog, ActionsMenu, EmptyState, HabitMarks, icons.ts
  charts/          ChartFigure.tsx (gráfico + tabla alternativa)
  styles/          tokens.css (todos los valores de diseño), base.css, app.css
  test/            factories.ts, render.tsx, setup.ts
  dev/             datos de ejemplo, solo en desarrollo
```

| Archivo | Qué contiene | Tócalo cuando… |
|---|---|---|
| `domain/types.ts` | `Habit`, `Entry`, `Pause`, `Settings`, `DEFAULT_SETTINGS`, `HabitKind`, `Frequency` | cambia el modelo de datos |
| `domain/evaluate.ts` | estado de cada unidad (`done/missed/paused/pending`), `canLogOn` | cambian las reglas de cumplimiento o el límite retroactivo |
| `domain/frequency.ts` | unidades, períodos, prorrateo | nuevo tipo de frecuencia |
| `domain/streaks.ts`, `milestones.ts` | rachas, comodines, hitos | cambian las reglas de racha o los umbrales |
| `domain/history.ts`, `metrics.ts` | línea de tiempo día a día y todas las métricas del detalle | métrica nueva de un hábito |
| `domain/stats.ts`, `range.ts`, `correlation.ts` | estadísticas globales, rangos, correlaciones | métrica nueva global o de un rango |
| `domain/today.ts` | `analyzeHabit`, `viewForDay`, `dayProgress` | cambia lo que muestra una fila de Hoy |
| `domain/habit.ts`, `templates.ts` | validación del formulario, plantillas | nuevo campo de hábito o plantilla |
| `domain/backup.ts` | esquema Zod estricto y migraciones de formato de la copia | cambia cualquier campo persistido |
| `db/migrations.ts` | versiones del esquema Dexie (nunca se edita una publicada) | cambia un índice o hay que transformar datos |
| `db/repos/dataset.ts` | lectura/reemplazo atómico de todo | tabla nueva (entra en backup, borrar todo, generador) |
| `features/today/actions.ts` | escrituras de Hoy con deshacer | nueva forma de registrar |
| `features/today/controls.tsx`, `HabitRow.tsx`, `describe.ts` | control de cada tipo, fila y línea de contexto | cambia cómo se registra o se ve un hábito en Hoy |
| `features/habits/HabitForm.tsx`, `fields.tsx` | formulario y sus campos | campo nuevo de hábito |
| `features/habit-detail/` | heatmap, resumen, gráficos, hitos, historial | sección nueva del detalle |
| `features/stats/` | secciones de Estadísticas y `useStats` | sección nueva de Estadísticas |
| `features/settings/SettingsScreen.tsx` | ajustes; `Data/Pauses/RemindersSection` | ajuste nuevo |
| `lib/format.ts` | fechas, números, frecuencias, rachas | cualquier texto formateado (no formatees en los componentes) |
| `lib/analysisCache.ts` | caché compartida de análisis | cambia qué se calcula por hábito |
| `lib/shortcuts.ts`, `features/shortcuts/`, `today/TodayShortcuts.tsx` | atajos | atajo nuevo (y su fila en el diálogo de ayuda) |
| `styles/tokens.css` | colores, tipografía, radios, movimiento | cambia el diseño; nunca valores sueltos |
| `test/factories.ts` | `habit()`, `entry()`, `pause()`, `d()`… | campo nuevo en un modelo (que las fábricas lo rellenen) |
| `dev/sampleData.ts` | seis meses de datos de ejemplo | conviene que cubra lo nuevo |

## Cómo hacer cambios frecuentes

Tras cualquiera: `npm run check`. Si tocas una pantalla, mírala también con `npm run dev`.

- **Nuevo tipo de hábito** (`HabitKind`): añádelo en `domain/types.ts` y en el `z.enum` de `kind` de `domain/backup.ts`; TS marcará los `switch` incompletos (`evaluate`, `history`, `metrics`, `csv`, `stats`, `milestones`). Además: reglas en `domain/habit.ts`, control en `today/controls.tsx` + `HabitRow.tsx` + `describe.ts` + `TodayShortcuts.tsx`, campos en `habits/fields.tsx`, heatmap (`heatmapModel.ts`) y detalle. Decide su `target`/`unit`, si cuenta en el progreso del día y si admite recordatorio. Tests en `domain` y uno de UI.
- **Métrica nueva:** función pura en `domain/metrics.ts` (por hábito, sobre `buildHistory`) o `domain/stats.ts` (global), con `today` como argumento y test en las tres zonas horarias. Muestra mínima explícita si es una tasa. Se lee en `useHabitDetail`/`useStats`, se pinta en una sección con su tabla alternativa (`ChartFigure`) y sus frases van en el `describe.ts` de la carpeta. No la persistas: se deriva.
- **Pantalla nueva:** `features/<nombre>/<Nombre>Screen.tsx` con `ScreenHeader`, cargada con `lazy()` y ruta en `app/App.tsx`; título en `app/routeTitle.ts` (y pestaña en `NAV` de `Layout.tsx` si va en la barra). Si arrastra Recharts, Zod o Base UI, **nunca** la importes de forma estática desde Hoy (vigila el chunk de entrada). Test de UI con `renderRoute()`.
- **Migración de base de datos:** añade una entrada con la versión siguiente a `MIGRATIONS` en `db/migrations.ts` (`stores` solo cambia lo que cambia; `upgrade` para transformar datos) y un caso en `migrations.test.ts`. Si el campo se persiste, actualiza también `domain/backup.ts` (esquema y, si el formato de la copia cambia de forma incompatible, `BACKUP_VERSION` + un paso en su `MIGRATIONS`), `dataset.ts` si es una tabla nueva, y `dev/sampleData.ts`. Recuerda: IndexedDB no indexa `null` ni booleanos.
- **Campo nuevo en ajustes:** `Settings` y `DEFAULT_SETTINGS` en `domain/types.ts`; `settingsSchema` en `domain/backup.ts` (es `strictObject`: sin un valor por defecto, las copias antiguas dejarían de importarse, así que dale `.default(...)` o súbela de versión); validación en `updateSettings` (`db/repos/settings.ts`) si tiene rango; control en `SettingsScreen.tsx` que llama a `save({...})`. No hace falta migración de Dexie: `settings` no indexa campos y `getSettings` rellena con los valores por defecto.

## Decisiones de dominio (acordadas con el usuario)

- **Rachas en la unidad del hábito:** días (diario y días concretos), semanas (X/semana) o meses (X/mes).
- **Comodines:** se gana 1 cada 7 unidades de racha, con un máximo de 2 acumulados, en todos los tipos. Se gasta automáticamente en la primera unidad fallada. La unidad cubierta no suma, pero la racha sigue. **Se derivan de la historia, no se persisten**, así que un registro retroactivo recalcula todo con coherencia.
- **Unidad en curso (`pending`):** no suma ni rompe hasta que se cierra. En "a evitar", hoy queda `pending` si está limpio y `missed` si hubo recaída.
- **Pausas:** una unidad en pausa es neutra aunque tenga registro. Las semanas o meses con días en pausa, creados a mitad o archivados a mitad prorratean la meta: `min(días elegibles, ceil(veces × elegibles / longitud))`. Una semana entera en pausa queda `paused`.
- **Registro único por hábito y día** (índice único `&[habitId+date]`). Cuantitativo y tiempo acumulan en ese registro. Un valor 0 sin nota elimina el registro. `loggedAt` es el instante real del último cambio.
- **Hábitos "a evitar":** solo admiten frecuencia diaria o días concretos. Un registro es una recaída.
- **Retroactivo:** `settings.retroLimitDays` (7 por defecto). No se puede registrar antes de `createdOn` ni después de `archivedOn`. Para rellenar días anteriores se puede adelantar la fecha de inicio, al crear y al editar (al editar, nunca después del primer registro).
- **Archivar:** `archivedOn: LocalDay` es el último día que cuenta. Es hoy si hoy ya tiene registro; si no, ayer (`archiveDayFor`). Al restaurar se crea una pausa del hábito (nota "Archivado") que cubre el hueco, para que esos días no cuenten como fallados (`unarchiveGap`). Deshacer la restauración borra esa pausa.
- **Progreso del día (Hoy):**
  - Cuentan los hábitos programados y no pausados.
  - **Los hábitos "a evitar" no cuentan:** no son tareas.
  - Un hábito por semana o mes con la meta ya cumplida otros días no cuenta ese día, salvo que también se haga ese día.
  - Los hábitos de días concretos solo aparecen los días que tocan.
- **Rachas mostradas:** siempre a fecha de hoy, aunque se esté viendo un día pasado. Por eso la revisión semanal solo las enseña en la última semana cerrada.
- **Hitos:** derivados de la historia, nunca guardados, igual que los comodines: un registro retroactivo los recoloca solo y ninguna fecha puede quedarse mintiendo.
- **Revisión semanal:** se ofrece una vez por semana cerrada (`settings.lastReviewOffered`). No se ofrece si ya hay reflexión escrita ni si la semana no tenía días evaluables. La reflexión se puede escribir y corregir siempre: es una nota sobre algo que ya pasó, así que el límite retroactivo no la afecta. Vaciarla borra la revisión.
- **Cronómetro:** solo se ofrece para hoy. Al detenerlo se suman los minutos redondeados al día en que empezó. Si no llega a un minuto no se suma nada. Deshacer resta los minutos y reanuda el cronómetro.
- **Cantidades:** el paso de +/- sale de `quantityStep` (1 para metas ≤20; si no, un valor redondo cercano a meta/10: 8.000 pasos avanza de 1.000 en 1.000). Tocar el valor permite escribirlo.
- **Día seleccionado:** va en la URL (`/?dia=YYYY-MM-DD`, con `replace`). Las fechas futuras se ignoran. Más allá del límite retroactivo el día es de solo lectura, con un aviso.
- **Al crear un hábito** se vuelve a Hoy si se llegó desde allí (`?volver=hoy`) y, si no, a la lista. Crear, editar, archivar, restaurar y eliminar se pueden deshacer. Eliminar además pide confirmación e indica cuántos registros se borrarán.
- **Tasa de cumplimiento:** cada día del rango hereda el resultado de su unidad (1 si se cumplió; hechas/requeridas si se falló), así que una ventana de 7, 30 o 90 días funciona igual en hábitos diarios, semanales y mensuales. No cuentan las pausas, los días que no tocan ni la unidad en curso sin cumplir. **Los comodines protegen la racha, no la tasa.**
- **Heatmap:** la escala `heat-0…4` para todos los hábitos, con el color del hábito solo como marca de identidad. En cantidad y tiempo la intensidad va relativa a la meta (menos de 1/3, de 2/3, de la meta, meta), así que el paso 4 siempre significa "cumplido". Los hábitos **a evitar** pintan las recaídas con una escala propia (`relapse-1…3`, ladrillo apagado), nunca con el azul de "cumplido", y la leyenda lo dice. Nada se distingue solo por color: punto pequeño si no toca, trazo si hay pausa y punto de tinta si un comodín cubrió el día.
- **Primer día de la semana:** configurable (`weekStartsOn`, lunes por defecto).
- **Idioma:** interfaz solo en español, con formato `es-ES`.
- **Rango de estadísticas:** períodos naturales en curso, recortados a hoy. El período anterior se recorta al mismo número de días transcurridos (comparar 12 días contra 31 sería mentir), sin salirse nunca de ese período.
- **Puntuación del período:** crédito total entre días evaluables sumando todos los hábitos, así que un hábito con más días programados pesa más. **Los "a evitar" no puntúan** (no son tareas) y tienen su propio bloque de recaídas.
- **Muestra mínima:** 7 días evaluables para dar una tasa o comparar períodos; 4 días de cada día de la semana y 2 semanas de rango para nombrar el mejor y el peor; 7 días en cada ventana y 10 puntos de cambio para hablar de mejora o caída. Lo que no llega se aparta y se dice, en vez de ordenarse como si fuera lo peor.
- **Correlaciones (tres filtros):** 14 días en cada grupo, diferencia mínima relevante (0,4 puntos de ánimo o energía; 10 puntos porcentuales entre hábitos) e intervalo de confianza que excluya el cero, con el nivel **corregido por Bonferroni** según cuántas comparaciones se examinan. Solo entran días decididos (tocaba, sin pausa, hábito vivo y día terminado); hoy nunca cuenta.
- **Desfase de un día:** cada hábito se compara con el ánimo y la energía del mismo día y con los del día siguiente. Las dos comparaciones cuentan para la corrección; en la lista se enseña la más marcada de cada pareja, porque las dos suelen ser la misma historia. El texto dice siempre de cuál se trata ("Los días después de cumplir…").
- **Lenguaje de las correlaciones:** cada frase lleva su muestra y ninguna usa verbos de causa. Al pie van el recuento de lo examinado y la advertencia fija de que es correlación, no causa.

- **Backup (validar antes de tocar, no perder nada):** importar valida el archivo entero en memoria; con un solo problema no se escribe nada y se lista lo que falla ("tus datos siguen como estaban"). Con el archivo válido se pide confirmación diciendo qué entra y qué se sustituye, con un botón para exportar antes lo actual. Se escribe en **una transacción**, se avisa con "Deshacer" y los cronómetros en marcha se descartan. Los ajustes viajan en la copia. Borrar todo pide escribir `BORRAR` y también se puede deshacer.
- **Almacenamiento persistente:** se pide `navigator.storage.persist()` al arrancar, sin bloquear ni preguntar; el navegador decide. No se detecta si se concedió ni si la app está instalada: el aviso de Ajustes vale igual en ambos casos.
- **Pausas (Ajustes):** globales o de un hábito, con fechas reales, rango no invertido y **sin solape dentro del mismo ámbito** (global con global, o mismo hábito); una global y una de un hábito pueden coincidir (el efecto es la unión) y las consecutivas valen. Crear, editar y borrar se deshacen. Las pausas que crea `unarchiveHabit` no pasan por esta validación. Se reflejan en Hoy, heatmap, rachas y estadísticas (`db/pausesEffect.test.ts` lo comprueba de punta a punta).
- **Recordatorios:** la hora se fija en el formulario del hábito (no en "a evitar"). Solo avisa si ese día el hábito toca, no está en pausa ni hecho; un aviso que llega más de 30 min tarde se descarta; no se repite tras recargar. El permiso se pide desde Ajustes con un botón (nunca solo). Sin servidor push, solo con la app abierta o activa.
- **Onboarding:** solo si no hay hábitos y no se completó ni saltó. "Borrar todo" lo vuelve a activar (los ajustes se borran).
- **Atajos:** `1`–`9` sobre el hábito con ese número en el orden visible (booleano marca, cantidad suma un paso, tiempo inicia o detiene el cronómetro de hoy, "a evitar" registra o quita una recaída); `←`/`→` cambian de día; `N` nuevo hábito; `?` ayuda. No actúan al escribir en un campo, con un diálogo o menú abierto, con Ctrl/Alt/Meta ni sobre días bloqueados. Las flechas respetan radios, rangos y la rejilla del heatmap.
- **Accesibilidad de rutas:** al cambiar de pantalla se pone el título de la pestaña y el foco pasa a `#contenido`; al cambiar de día se anuncia la fecha (`aria-live`).
- **PWA:** `generateSW` con `registerType: 'prompt'`; el precache excluye los subconjuntos cirílico, griego y vietnamita de la fuente; se sirve `index.html` como respaldo de navegación sin conexión.

## Diseño (resumen; los valores están en `src/styles/tokens.css`)

- **Tokens:** todos en `src/styles/tokens.css` (`@theme static`). Se borran las escalas por defecto de Tailwind (`--color-*: initial`, etc.). El tema oscuro redefine las variables bajo `:root[data-theme='dark']`. Nunca uses colores o tamaños sueltos.
- **Paleta:** neutros cálidos de papel y tinta, acento tinta azul (`#2B50C8` en claro y `#8CA3FF` en oscuro), 13 colores de hábito (`--color-habit-<clave>`, claves en `HABIT_COLORS`; **nunca renombres ni reordenes las existentes**: los hábitos y las copias guardan la clave, solo se añaden al final), una escala de heatmap `heat-0…4` y una escala de recaídas `relapse-1…3`. Texto sobre un color: `on-accent` y `on-habit`. Velo de diálogos: `scrim`.
- **Contrastes medidos:**
  - texto 15,9/15,5; muted 6,4/7,3; faint 4,9/5,5; border-strong 3,3/3,3; accent 6,2/7,8;
  - hábitos ≥4,5 en claro y ≥7 en oscuro (contra `on-habit`); marino 12,8/7,09, ciruela 11,0/7,06, petróleo 8,9/8,87;
  - los tres profundos (`marino`, `ciruela`, `petroleo`) aportan profundidad solo en claro (L≈33–40 frente a ≈53 de los demás): en oscuro el mínimo de 7 obliga a L≥~71, así que se separan por tono y saturación (ΔE OKLab ≥5,4 al vecino más cercano). Se descartaron `carmesi` (5,3 del magenta en oscuro), `bosque` y `marron` (casi iguales a verde y naranja en oscuro);
  - los pasos bajos del heatmap están por debajo de 3:1, compensados con marcas, tabla alternativa y tooltips;
  - los tres pasos de recaída superan 3:1 sobre la celda vacía y sobre el fondo en ambos temas.
- **Tamaño de la raíz por ancho:** desde 1600 px CSS, `html` pasa de 16 a 17 px (`--root-font-size-wide`, 106,25 %, en `tokens.css`; la media query está en `base.css`). Como escala, espaciado, contenedores y objetivos táctiles están en `rem`, suben juntos; los breakpoints de Tailwind (`lg` = 64rem) **no** se mueven, porque las media queries en `rem` se resuelven contra los 16 px del navegador. Por debajo de 1600 px no cambia nada. Nació de comparar el 100 % con el 110 % de zoom de Chrome en un monitor de 24″ a 1080p: el texto de 12–13 px se quedaba pequeño. Lo que sigue en píxeles a propósito: bordes (1 px), focos (2 px), radios, sombras, la barra de color (`w-0.75`, en rem, sí escala) y los iconos Lucide (`size={16|18|20}`, dentro de cajas de `size-touch` que sí escalan). Las etiquetas de Recharts llevan `fontSize: 12` en píxeles y se igualan con una regla en `base.css` (`.recharts-cartesian-axis-tick-value`, `.recharts-label` → `--text-xs`); las alturas de los gráficos (160–200 px) y los anchos del eje Y (44/48 px) siguen fijos. No hay segundo escalón para 2560 px: no se ha podido probar. Si el zoom de Chrome está al 110 % el efecto se suma (el viewport sigue por encima de 1600).
- **Tipografía:** IBM Plex Sans Variable autoalojada (`@fontsource-variable/ibm-plex-sans/wght.css`). Sus cifras son tabulares por diseño: las 10 miden 600 unidades, verificado con fontTools. El subconjunto no trae `tnum`, `zero` ni versalitas reales. La escala va de `text-xs` (12) a `text-4xl` (56). Las etiquetas de sección usan la utilidad `label-caps`.
- **Espaciado:** rejilla de 4px (`--spacing: 0.25rem`), `px-gutter` (16) / `px-gutter-desktop` (32) y `min-h-touch` / `size-touch` (44px).
- **Radios:** `sm` 3, `md` 6 y `lg` 10.
- **Sombras:** solo `shadow-overlay`, para capas superpuestas.
- **Movimiento:** `--duration-fast|base|slow` (150/180/200 ms) y `--ease-out`. Se animan solo `transform`, `opacity` y color. La utilidad `pressable` da `scale(0.97)` al pulsar. Nada se anima al actuar por teclado. `prefers-reduced-motion` está cubierto en `base.css`.
- **Gráficos:** Recharts, siempre en tinta sobre cuadrícula mínima, con los colores tomados de los tokens. Cada gráfico tiene su tabla equivalente (`ChartFigure`), que es a la vez la alternativa accesible.
- **Filas con marca de color (regla única en toda la app):** la fila es un flex con `items-stretch`; `ColorBar` va como primer hijo **sin altura propia**, así que cubre todo el alto del bloque, incluido su relleno vertical; a su lado, una columna con todas las líneas alineadas al mismo margen izquierdo y las cifras a la derecha, `whitespace-nowrap`. Vale igual en `li` (Hoy, hábitos, plantillas, "A evitar", tendencia, rachas del informe) y en celdas de tabla (consistencia, rachas del panel lateral), donde el relleno se mueve del `td`/`th` al contenido para que la barra lo abarque. Nunca `ColorBar` con altura fija.
- **Encabezado del detalle de hábito (decisión consciente, no lo «corrijas»):** la `ColorBar` va pegada al margen y el texto del título queda desplazado a su derecha (unos 47 px en escritorio y móvil respecto al resto de pantallas). El encabezado en sí (`header`) sí coincide en x e y con todas las demás; solo el texto del `h1` empieza más adentro. Se decidió así para no romper la regla de filas con marca de color. No saques la barra fuera del margen ni alinees el título con el de otras pantallas.
- **Barras de progreso:** se llenan siempre de izquierda a derecha. La barra segmentada de Hoy ordena los segmentos poniendo delante los hábitos hechos.
- **Prohibido:** gradientes, emojis, blur o glassmorphism, sombras de color, ilustraciones, tarjetas idénticas por todas partes y tono motivacional empalagoso.

## Convenciones

- TypeScript estricto (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`), sin `any` y sin aserciones `!`.
- Los modelos usan `| null` en vez de propiedades opcionales. IndexedDB no indexa `null` ni booleanos, así que no se crean índices sobre ellos.
- Tests colocados junto al módulo (`*.test.ts`), organizados en proyectos de Vitest:
  - `domain` se ejecuta tres veces, con `TZ=Europe/Madrid`, `America/Santiago` y `America/New_York`;
  - `db` usa fake-indexeddb;
  - `lib` ejecuta los tests puros de `lib/`, `state/`, `hooks/` y `features/` (`*.test.ts`) en Node;
  - `lib` incluye también `src/dev/` (el generador de datos);
  - `ui` usa jsdom (`*.test.tsx`) con fake-indexeddb. `src/test/setup.ts` limpia la base entre tests y añade polyfills de `matchMedia`, de la captura de puntero y de `ResizeObserver` (lo necesita Recharts); `src/test/render.tsx` ofrece `renderRoute()` (router en memoria y Toaster montado).
- En los tests de UI se busca por rol y nombre accesible, lo que de paso comprueba la accesibilidad. `setup.ts` descarta los toasts entre tests: el store de Sonner es global y sobrevive al desmontaje.
- `src/dev/sampleData.test.ts` comprueba que las correlaciones del generador llegan enteras hasta `findCorrelations` (ejercicio → ánimo y dormir pronto → energía del día siguiente). Si alguien toca un umbral y la pantalla se queda muda, ese test lo dice.
- Controles nativos antes que roles ARIA: casillas reales (`input type=checkbox` visualmente oculto), radios para los segmentados, `fieldset`/`legend` para grupos. Biome (`useSemanticElements`) lo exige.
- Colores de hábito en estilos en línea con `habitColorVar(color)`; para todo lo demás, utilidades de los tokens.
- Comentarios y mensajes de usuario en español; código (identificadores) en inglés.
- Estilo Biome: 2 espacios, comillas simples y línea de 100 caracteres. Ejecuta `npm run lint:fix` antes de hacer commit.
- Ejecuta `npm run check` solo, sin pipes (`| tail`, `| Select-Object`…), y mira su código de salida. Si no es 0, no hagas commit ni push, aunque el fallo parezca ajeno al cambio o ya esté anotado: investígalo o detente y explícalo en el informe.
- `src/test/setup.ts` también define `Document.prototype.focus`: `user-event` pasa `document` como `relatedTarget` si el elemento con foco se desmonta antes de pulsar otro botón, y Sonner intenta devolverle el foco al desmontarse.
- Esperas en los tests de UI: antes de una acción que depende de lo pintado, espera a la **vista**, no a
  la base (la base se actualiza antes de que `liveQuery` repinte). Todo test que compruebe que algo **no**
  pasó necesita un control positivo que demuestre que el mecanismo estaba vivo y los datos cargados, nunca
  una espera fija. Los tests que navegan con `<App />` precargan las pantallas `lazy()` con
  `preloadLazyScreens()` (`src/test/render.tsx`). Detalle en «Pendiente».
- Los tests de `db/` que necesitan el resto del dominio (p. ej. `pausesEffect.test.ts`) corren en Node con `fake-indexeddb`; los de UI que comprueban atajos montan `<App />` entera.
- Para escribir archivos con contenido complejo usa la herramienta Write, no heredocs en bash: en este entorno Windows los heredocs largos fallan.

## Pendiente (para su propia sesión)

### Los tests de UI ya no dependen del calendario (hecho, 2026-09-22)

`src/test/setup.ts` fija `Date` (`vi.useFakeTimers({ toFake: ['Date'] })`, no el resto de temporizadores) a
un miércoles a mitad de mes (`new Date(2026, 2, 18, 12, 0, 0)`, construido en hora local a mediodía, nunca
con un string: `new Date('YYYY-MM-DD')` se interpreta en UTC y en `America/Santiago`/`America/New_York` cae
en el día anterior). Se fija en el **nivel superior** del archivo, no en un `beforeEach`: varios tests hacen
`const today = todayLocal()` al cargarse el módulo, antes de que corra ningún `beforeEach`. Se puede
sobrescribir con `TEST_TODAY=YYYY-MM-DD` (mismo criterio de hora local a mediodía) para simular otra fecha.

- **Aislamiento entre archivos, comprobado:** `isolate: true` es el valor por defecto de Vitest (no hay
  override en `vitest.config.ts`) y se verificó también en vivo, con dos archivos de sonda forzados al mismo
  worker (`--maxWorkers=1 --sequence.shuffle=false`): uno deja `vi.setSystemTime` en 2099 sin restaurarlo, y
  el siguiente sigue viendo el reloj real. Por eso el `vi.useRealTimers()` del `afterEach` de
  `RemindersRunner.test.tsx` (que ya fijaba su propia fecha explícita por test, sin tocar) no puede filtrarse
  a otros archivos.
- **`toFake: ['Date']` no rompió nada:** ningún test de los afectados usa `Date.now()` para orden de
  `loggedAt`, duraciones o cronómetro (`useNow`) — se comprobó con grep antes de tocar nada y con la suite
  completa después (1341/1341).
- **`StatsScreen.test.tsx` › «no señala el mejor día de la semana sin muestra en todos»** (el que fallaba
  todos los lunes): pasó de `rango=semana` a un personalizado de 9 días terminado ayer, que no depende de
  qué día de la semana sea "hoy" (con `rango=semana`, si hoy es el primer día de la semana configurada no
  hay ningún día evaluable todavía, y el mensaje correcto pasa a ser otro). Se añadió un test aparte, con su
  propio `vi.setSystemTime` a un lunes real, que cubre justamente ese caso («Sin días evaluables en este
  período.»).
- **Segundo bug de calendario, encontrado al simular las cinco fechas límite (no estaba documentado
  antes):** `StatsScreen.test.tsx` y `ByCategorySection.test.tsx` usaban `rango=trimestre` (o `rango=mes`)
  como rango por defecto en 7 tests. Esos presets son períodos naturales en curso, así que su longitud varía
  con el día: el 1 de enero el trimestre en curso tiene 1 día (colapsa la muestra de correlaciones y
  consistencia), y el 30 de abril tiene 29 días evaluables, un número impar que rompe una aserción de
  «exactamente 50 %» sobre un patrón alterno. Arreglo: los 7 tests pasan a `rango=personalizado` con la
  longitud exacta del historial que cada uno crea (ya no depende de en qué punto del trimestre/mes caiga
  "hoy"). El comportamiento de los presets (`week`/`month`/`quarter`/`year`/`custom`) sigue cubierto aparte,
  de forma pura y sin depender del reloj real, en `domain/range.test.ts` (`resolveRange` y `previousRange`
  para los cinco, con casos límite: 29 de febrero, marzo→febrero más corto, trimestres de distinta duración).
- **Las cinco fechas límite, con el arreglo completo, dan 119/119** en el proyecto `ui` (13 archivos): un
  lunes, un domingo, el 30 de abril, el 1 de enero y un 29 de febrero (`TEST_TODAY=2026-06-15` /
  `2026-06-21` / `2026-04-30` / `2026-01-01` / `2028-02-29`). Un `FAIL` suelto en `SettingsScreen.test.tsx`
  durante una de las tandas no se repitió en dos reintentos con la misma fecha (ni en solitario ni dentro de
  la suite completa): era la carrera de `RetroLimit` (ver abajo), no algo ligado al calendario.

### Tests de UI intermitentes: causa encontrada y cerrados (hecho, 2026-09-22)

**Reproducción (Ubuntu, 8 núcleos, sin tocar nada), suite completa:**
- 10 en reposo: 9/10. Falló `SettingsScreen` › «el límite retroactivo se guarda…» (`expected 14 to be 30`).
- 10 con `npm run dev` y Chrome abierto en `localhost:5173`: 9/10. Falló `shortcuts` › «los números marcan
  los hábitos…» (`expected {…(6)} to be undefined`, el de la nota anterior).
- 10 con eso y 12 bucles de CPU ocupados (saturación artificial): 0/10, con 14 tests distintos agotando
  `findBy` (1 s) o el límite por test (5 s). Ver «Saturación» abajo.

**Causas (las dos primeras, demostradas de forma determinista con sondas temporales):**
- **Esperar a la base en vez de a la vista.** `toggleDone` y `toggleRelapse` deciden con lo pintado (ver
  el bug pendiente de abajo). El test esperaba a que la base tuviera el registro y volvía a pulsar `1`; el
  repintado llega después (`liveQuery` → render) y, con la suite en paralelo, la tecla podía caer en ese
  hueco y volver a marcar. Arreglo: esperar a la casilla (`toBeChecked()`) antes de la siguiente pulsación.
- **El eco del propio guardado pisaba el campo (`RetroLimit`, bug de la app, corregido).** El campo se
  sincroniza con el ajuste guardado para reflejar cambios de fuera (importar, borrar todo). El test
  guardaba 14 y escribía «30»; el eco del 14 llegaba a mitad y dejaba «14», y el Enter no guardaba nada.
  Ahora `RetroLimit` recuerda lo que acaba de mandar (`pending`) y su eco no toca el texto. Test de
  regresión: «el eco de un guardado no pisa lo que se sigue escribiendo».
- **Esperas que cruzan un `lazy()`** (`App.test`). La primera visita a una pantalla `lazy()` compila el
  módulo en frío en Vitest: medido 60–190 ms en reposo y hasta 1.241 ms saturado, frente a 15–135 ms en
  la segunda visita. `findBy` espera 1 s. Arreglo: `preloadLazyScreens()` (`src/test/render.tsx`) en un
  `beforeAll` de `App.test` y `shortcuts.test`. Si añades una pantalla `lazy()`, añádela ahí.

**Tests que pasaban en falso (comprobaban que algo no ocurrió sin esperar a nada), ya con control positivo:**
- `shortcuts`: «sin hábito o con Ctrl», «escribiendo en un campo», «con el diálogo abierto» (pulsan luego
  `2` sobre un segundo hábito y esperan su registro: las escrituras van en cola), «día cerrado» (avanza
  al primer día abierto y la misma tecla sí registra) y «foco en un radio» (fuera del radio la flecha sí
  cambia de día).
- `TodayScreen` › «no lo ofrece si ya tiene reflexión»: las revisiones llegan por su propia consulta, así
  que no ver el aviso no probaba nada. Ahora se ve el aviso y desaparece al escribir la reflexión.
- `RemindersRunner`, los cuatro «no avisa…»: esperaban 150 ms fijos. Ahora un hábito de control que sí
  debe avisar; en el de «sin permiso», un testigo de datos cargados y luego se concede el permiso.
- Se comprobó que muerden: cada una de 8 regresiones introducidas a propósito en producción (quitar
  Ctrl, el límite retroactivo de los atajos, el bloqueo por diálogo o por campo, la reflexión, el permiso,
  «ya hecho» y el arreglo de `RetroLimit`) hace fallar su test.
- Además, lecturas de la base sin esperar tras un clic, envueltas en `waitFor`: `TodayScreen` (energía,
  que además pulsaba «Quitar» antes de que se habilitara; nota del día) y `HabitDetailScreen` (Deshacer).

**Verificación:** 30/30 de la suite completa (1342/1342) con `npm run dev` y Chrome abierto, y
10/10 con 4 bucles de CPU ocupados además. `npm run check` con código 0.

**Saturación (no se arregla, a propósito):** con 12 bucles ocupados sobre 8 núcleos fallan `findBy` de 1 s
y límites de 5 s en muchos tests (`HabitForm` tarda hasta 2,2 s en reposo; `repos.test` › «si algo
falla…», 1,2 s) y el presupuesto de `today.test` › rendimiento (<250 ms), que mide tiempo de reloj. Subir
esos límites sin más razón que la saturación artificial esconderría regresiones reales. Si se ven con
carga normal, anotar aquí test, condición y mensaje.

### Bug: marcar dos veces muy rápido marca en vez de desmarcar (pendiente, para su propia sesión)

**Causa:** `toggleDone` y `toggleRelapse` (`features/today/actions.ts`) deciden con `view.value > 0`, es
decir, con lo que había pintado al pulsar, y escriben un valor absoluto (`setEntryValue(…, 0 | 1)`). Si
llega una segunda pulsación antes de que `liveQuery` repinte, las dos leen «sin marcar» y las dos escriben
1. Afecta a la casilla, al botón de recaída y a los atajos numéricos. No afecta a `adjustValue`/`stopTimer`
(suman dentro de la transacción), `setValue` (absoluto), el cronómetro (lee el store al momento) ni a
ánimo, energía y nota. Arreglo probable: decidir dentro de la transacción según el registro real (un
«conmutar» en el repo, como `adjustEntryValue`).

**Reproducido con Playwright en el build de producción (Chrome 154, 2026-09-22):**
- `1` dos veces a 4–6 ms: 5/5 mal (la base queda `value: 1`); a ≥12 ms: 0/35.
- Doble clic en la casilla (dos `change` a 1,6–5 ms): 5/5 mal, con un único toast «Leer: hecho», sin
  señal de la segunda acción.
- Tecla mantenida: correcto; `parseShortcut` descarta `event.repeat`.
- De la tecla a la casilla pintada: ~20–25 ms; con la CPU ralentizada 6× (gama baja) ~30–35 ms, y a esa
  velocidad dos teclas a 10 ms fallan 4/4 y a ≥25 ms, 0/16.
- Por debajo del ritmo humano (≥~50 ms entre pulsaciones) en este equipo; en un móvil con IndexedDB lento
  la ventana puede ser mayor, sin medir.

## Limitaciones conocidas

- Los recordatorios del navegador solo se disparan con la app abierta o activa, porque no hay servidor push. Se dice en Ajustes.
- Los subconjuntos cirílico, griego y vietnamita de la fuente no se precachean: sin conexión, un texto en esos alfabetos usaría la fuente del sistema.
- Las pausas creadas por `unarchiveHabit` pueden solaparse con una pausa del mismo hábito creada a mano; el análisis las une, pero al editar una de las dos el formulario avisa del solape.
