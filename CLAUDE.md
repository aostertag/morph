# CLAUDE.md — Habit Tracker

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

### Fase 7 (pulido final): terminada

Recorrido contra las secciones 9 y 10 de `SPEC.md` y corrección de los 12 hallazgos H1–H12. El detalle,
con capturas, está en `AUDITORIA.md` (las capturas viven en `auditoria/capturas/`, ignorado por git).
El estado actual pasa `npm run check` y `npm run build` (chunk de entrada de ~305 kB).

Lo que cambió y conviene saber al tocar esas zonas:

- **Icono de hábito en su columna** (`HabitIconSlot` en `ui/HabitMarks.tsx`): entre `ColorBar` y el texto, con ancho fijo aunque no haya icono, para que nombre y segunda línea compartan margen. Vale en Hoy, Hábitos, plantillas y cabecera del detalle. La lista de Hábitos pone la `ColorBar` **antes** del asa de arrastre.
- **`TemplateRow`** (`features/habits/`): la fila de plantilla, compartida por «Nuevo hábito» y el onboarding.
- **`DataTable` admite `flushFirst`**: la primera columna pone su propio relleno vertical, para que una `ColorBar` cubra la fila. La clave de fila sale de la del elemento si la primera celda lo es.
- **`EmptyState standalone`**: en pantallas sin encabezado propio (404, hábito inexistente, hábito que empieza más adelante) el título es el `h1` y no lleva filete.
- **Barra del día (Hoy):** el segmento vacío es un contorno de `border-strong` (3,3:1 en ambos temas); antes era `sunken`, invisible en oscuro.
- **Heatmap:** el año se dibuja entero; los días anteriores a la creación son celdas `before` (contorno tenue, sin botón). Celdas de 24 px en móvil (`size-6`) y de 12 px desde `lg`. La columna de días es `sticky`.
- **Editar «Empieza el»:** `startDateRange()` en `domain/habit.ts` (hasta `retroLimitDays` atrás desde hoy, sin perder la fecha actual si es más antigua, y nunca después del primer registro). `updateHabit` lo comprueba también, dentro de la transacción. Se deshace como el resto de ediciones.
- **Gráfico «Evolución del período»:** `maxBarSize={32}`.

Pruebas intermitentes: `App.test.tsx` puede agotar el tiempo si hay un servidor de desarrollo y un navegador abiertos a la vez; pasa suelto y con la máquina libre.

**Playwright:** el MCP arrancaba con el canal `chrome`, que no está instalado en esta máquina. Se le
añadió `--browser chromium` a `.mcp.json` (commiteado; surte efecto al arrancar la sesión) y se
descargó el Chromium que pide la versión actual (`chromium-1246`). Ojo: con
`launchPersistentContext`, `CacheStorage` falla en esta máquina y el service worker no llega a
instalarse; con un contexto normal funciona.

La navegación tiene cuatro pestañas (Hoy, Estadísticas, Hábitos, Ajustes; `NAV` en `app/Layout.tsx`): a
`/revision` se llega por el aviso de Hoy y por el historial.

**Peso del paquete (comprobado en la build del cierre de la fase 6):** el chunk de entrada (Hoy, con `ReviewPrompt`, `Onboarding`, `RemindersRunner` y `GlobalShortcuts` dentro, ~305 kB) solo importa de forma estática el runtime, `Button` y `HabitMarks`. Recharts vive en los chunks de `HabitDetailScreen` y `BarChart`, el informe de la revisión en `ReviewScreen`, Zod y el backup en `SettingsScreen` y Base UI del diálogo de atajos en `ShortcutsDialog`, todos `lazy()`. Si Hoy empieza a arrastrar alguno de ellos, es que algo se importó fuera de un `lazy()`.

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
  - `repos/*`: todas las escrituras pasan por aquí (`habits`, `entries`, `dayLogs`, `pauses`, `reviews`, `categories`, `settings`, `dataset`). Las mutaciones devuelven el estado anterior para poder deshacer. `categories` solo se usa desde el campo «Categoría» del formulario de hábito (crear al vuelo); no hay pantalla para renombrar ni borrar.
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
- `src/lib/pwa.ts` registra el service worker (solo en producción, aviso "Recargar" en vez de recarga automática); `src/lib/download.ts` descarga archivos; `src/app/routeTitle.ts` da el título por ruta.
- `scripts/generate-icons.mjs` genera los iconos de `public/` (cuadrado plano de tinta azul con una marca blanca, sin dependencias). `public/sw-extra.js` se carga dentro del service worker y enfoca la app al pulsar un recordatorio.
- `src/dev/`: solo en desarrollo. `sampleData.ts` genera seis meses deterministas —incluidas cuatro reflexiones semanales, que empiezan el día que diga `weekStartsOn` y dejan la última semana cerrada sin escribir para que el aviso de Hoy tenga algo que ofrecer—; `DevTools.tsx` solo renderiza el botón (`SampleDataButton.tsx`) si `import.meta.env.DEV`, así que nada de esto entra en producción. Escribe con `db/repos/dataset.ts` (`replaceAllData`), que también usa la importación de backups.
- `src/features/habits/`:
  - lista con dnd-kit (puntero y teclado, anuncios en español) y las alternativas "Subir"/"Bajar" en el menú;
  - formulario con vista previa (`HabitRow` en modo `preview`) y selector de plantillas.
  - Estas rutas se cargan con `lazy()`, para que Hoy no cargue dnd-kit ni Base UI.
- `src/ui/`:
  - primitivas: `Button`/`ButtonLink`/`IconButton`, `Field`/`Fieldset` (ARIA conectado vía render prop), `Segmented` (radios nativos), `ConfirmDialog` (Base UI AlertDialog), `ActionsMenu` (Base UI Menu), `ColorBar`/`HabitIcon`, `EmptyState`/`ScreenHeader`;
  - `ui/icons.ts` es la lista curada de iconos Lucide, importados uno a uno.
- `src/test/factories.ts`: fábricas para los tests (`habit()`, `entry()`, `entriesOn()`, `dayLog()`, `pause()`, `days()`, `d()`).

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
  app/             App.tsx (rutas y lazy) · Layout.tsx (pestañas, foco) · routeTitle.ts · ErrorBoundary · Placeholder.tsx (solo se usa `NotFound`)
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
- **Pausas (Ajustes):** globales o de un hábito, con fechas reales, rango no invertido y **sin solape dentro del mismo ámbito** (global con global, o mismo hábito); una global y una de un hábito pueden coincidir (el efecto es la unión) y las consecutivas valen. Crear, editar y borrar se deshacen. Las pausas que crea `unarchiveHabit` no pasan por esta validación. Se reflejan en Hoy, heatmap, rachas y estadísticas (`db/pausesEffect.test.ts` lo comprueba de punta a punta).
- **Recordatorios:** la hora se fija en el formulario del hábito (no en "a evitar"). Solo avisa si ese día el hábito toca, no está en pausa ni hecho; un aviso que llega más de 30 min tarde se descarta; no se repite tras recargar. El permiso se pide desde Ajustes con un botón (nunca solo). Sin servidor push, solo con la app abierta o activa.
- **Onboarding:** solo si no hay hábitos y no se completó ni saltó. "Borrar todo" lo vuelve a activar (los ajustes se borran).
- **Atajos:** `1`–`9` sobre el hábito con ese número en el orden visible (booleano marca, cantidad suma un paso, tiempo inicia o detiene el cronómetro de hoy, "a evitar" registra o quita una recaída); `←`/`→` cambian de día; `N` nuevo hábito; `?` ayuda. No actúan al escribir en un campo, con un diálogo o menú abierto, con Ctrl/Alt/Meta ni sobre días bloqueados. Las flechas respetan radios, rangos y la rejilla del heatmap.
- **Accesibilidad de rutas:** al cambiar de pantalla se pone el título de la pestaña y el foco pasa a `#contenido`; al cambiar de día se anuncia la fecha (`aria-live`).
- **PWA:** `generateSW` con `registerType: 'prompt'`; el precache excluye los subconjuntos cirílico, griego y vietnamita de la fuente; se sirve `index.html` como respaldo de navegación sin conexión.

## Diseño (resumen; los valores están en `src/styles/tokens.css`)

- **Tokens:** todos en `src/styles/tokens.css` (`@theme static`). Se borran las escalas por defecto de Tailwind (`--color-*: initial`, etc.). El tema oscuro redefine las variables bajo `:root[data-theme='dark']`. Nunca uses colores o tamaños sueltos.
- **Paleta:** neutros cálidos de papel y tinta, acento tinta azul (`#2B50C8` en claro y `#8CA3FF` en oscuro), 10 colores de hábito (`--color-habit-<clave>`, claves en `HABIT_COLORS`), una escala de heatmap `heat-0…4` y una escala de recaídas `relapse-1…3`. Texto sobre un color: `on-accent` y `on-habit`. Velo de diálogos: `scrim`.
- **Contrastes medidos:**
  - texto 15,9/15,5; muted 6,4/7,3; faint 4,9/5,5; border-strong 3,3/3,3; accent 6,2/7,8;
  - hábitos ≥4,5 en claro y ≥7 en oscuro;
  - los pasos bajos del heatmap están por debajo de 3:1, compensados con marcas, tabla alternativa y tooltips;
  - los tres pasos de recaída superan 3:1 sobre la celda vacía y sobre el fondo en ambos temas.
- **Tipografía:** IBM Plex Sans Variable autoalojada (`@fontsource-variable/ibm-plex-sans/wght.css`). Sus cifras son tabulares por diseño: las 10 miden 600 unidades, verificado con fontTools. El subconjunto no trae `tnum`, `zero` ni versalitas reales. La escala va de `text-xs` (12) a `text-4xl` (56). Las etiquetas de sección usan la utilidad `label-caps`.
- **Espaciado:** rejilla de 4px (`--spacing: 0.25rem`), `px-gutter` (16) / `px-gutter-desktop` (32) y `min-h-touch` / `size-touch` (44px).
- **Radios:** `sm` 3, `md` 6 y `lg` 10.
- **Sombras:** solo `shadow-overlay`, para capas superpuestas.
- **Movimiento:** `--duration-fast|base|slow` (150/180/200 ms) y `--ease-out`. Se animan solo `transform`, `opacity` y color. La utilidad `pressable` da `scale(0.97)` al pulsar. Nada se anima al actuar por teclado. `prefers-reduced-motion` está cubierto en `base.css`.
- **Gráficos:** Recharts, siempre en tinta sobre cuadrícula mínima, con los colores tomados de los tokens. Cada gráfico tiene su tabla equivalente (`ChartFigure`), que es a la vez la alternativa accesible.
- **Filas con marca de color (regla única en toda la app):** la fila es un flex con `items-stretch`; `ColorBar` va como primer hijo **sin altura propia**, así que cubre todo el alto del bloque, incluido su relleno vertical; a su lado, una columna con todas las líneas alineadas al mismo margen izquierdo y las cifras a la derecha, `whitespace-nowrap`. Vale igual en `li` (Hoy, hábitos, plantillas, "A evitar", tendencia, rachas del informe) y en celdas de tabla (consistencia, rachas del panel lateral), donde el relleno se mueve del `td`/`th` al contenido para que la barra lo abarque. Nunca `ColorBar` con altura fija.
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
- `src/test/setup.ts` también define `Document.prototype.focus`: `user-event` pasa `document` como `relatedTarget` si el elemento con foco se desmonta antes de pulsar otro botón, y Sonner intenta devolverle el foco al desmontarse.
- Los tests de `db/` que necesitan el resto del dominio (p. ej. `pausesEffect.test.ts`) corren en Node con `fake-indexeddb`; los de UI que comprueban atajos montan `<App />` entera.
- Para escribir archivos con contenido complejo usa la herramienta Write, no heredocs en bash: en este entorno Windows los heredocs largos fallan.

## Limitaciones conocidas

- Los recordatorios del navegador solo se disparan con la app abierta o activa, porque no hay servidor push. Se dice en Ajustes.
- Los subconjuntos cirílico, griego y vietnamita de la fuente no se precachean: sin conexión, un texto en esos alfabetos usaría la fuente del sistema.
- Las pausas creadas por `unarchiveHabit` pueden solaparse con una pausa del mismo hábito creada a mano; el análisis las une, pero al editar una de las dos el formulario avisa del solape.
