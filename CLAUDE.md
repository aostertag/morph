# CLAUDE.md — Habit Tracker

Memoria del proyecto entre sesiones. Léelo entero antes de trabajar y actualízalo al cerrar cada fase.
La especificación completa está en `SPEC.md`; la sección 9 (diseño) prevalece sobre cualquier guía, incluidas las skills.

## Estado

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Tooling, tokens, modelo de datos Dexie, dominio (frecuencias, rachas, comodines, pausas) + tests | **Hecha** |
| 2 | Pantalla Hoy y gestión de hábitos | **Hecha** |
| 3 | Detalle de hábito, heatmap, métricas, generador de datos | **Hecha** |
| 4 | Estadísticas globales y correlaciones | Pendiente |
| 5 | Revisión semanal, ánimo/energía, hitos | Pendiente |
| 6 | Ajustes, backup, recordatorios, PWA, onboarding, atajos, a11y | Pendiente |
| 7 | Pulido final | Pendiente |

**Siguiente: Fase 4** (estadísticas globales y correlaciones).

**Pendiente para fases posteriores:**
- Fase 5: registro de ánimo, energía y nota del día, el aviso de revisión semanal y los **hitos** del detalle. El repositorio `dayLogs` ya existe y el generador ya crea ánimo y energía correlacionados.
- Fase 6: atajos de teclado (números, ←/→, `N`, `?`) y llevar el botón de datos de ejemplo a Ajustes.

Rutas provisionales: `/estadisticas` y `/ajustes` muestran un marcador de posición hasta su fase.

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
  - `streaks.ts`: `computeStreaks()` calcula racha actual, mejor racha, comodines disponibles y usos.
  - `habit.ts`: normalización y validación del formulario de hábito.
  - `history.ts`: `buildHistory()` convierte el análisis en una línea de tiempo día a día (valor, si tocaba, pausa, éxito, unidad y comodín). De ella salen el heatmap y todas las métricas. También `heatLevel()` y `relapseLevel()`.
  - `metrics.ts`: tasas por ventana, evolución por semanas o meses, día de la semana, totales, cantidades con tendencia, estadísticas de "a evitar" e historial (notas, comodines y pausas).
  - `types.ts`: modelo de datos y `DEFAULT_SETTINGS`.
- `src/db/`:
  - `schema.ts`: `TrackerDB` y el singleton `db`.
  - `migrations.ts`: lista versionada. **Nunca se edita una versión publicada; se añade otra.**
  - `errors.ts`: `StorageError` (mensaje claro para el usuario) y `ValidationError`.
  - `repos/*`: todas las escrituras pasan por aquí. Las mutaciones devuelven el estado anterior para poder deshacer.
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
- `src/charts/ChartFigure.tsx`: marco común de los gráficos (título, controles, alternativa en tabla y nota) y `DataTable`.
- `src/lib/analysisCache.ts`: la caché de análisis que comparten Hoy y el detalle, para no recalcular al abrirlo.
- `src/dev/`: solo en desarrollo. `sampleData.ts` genera seis meses deterministas y `DevTools.tsx` solo renderiza el botón si `import.meta.env.DEV`, así que nada de esto entra en producción. Escribe con `db/repos/dataset.ts` (`replaceAllData`), que la Fase 6 reutilizará al importar un backup.
- `src/features/habits/`:
  - lista con dnd-kit (puntero y teclado, anuncios en español) y las alternativas "Subir"/"Bajar" en el menú;
  - formulario con vista previa (`HabitRow` en modo `preview`) y selector de plantillas.
  - Estas rutas se cargan con `lazy()`, para que Hoy no cargue dnd-kit ni Base UI.
- `src/ui/`:
  - primitivas: `Button`/`ButtonLink`/`IconButton`, `Field`/`Fieldset` (ARIA conectado vía render prop), `Segmented` (radios nativos), `ConfirmDialog` (Base UI AlertDialog), `ActionsMenu` (Base UI Menu), `ColorBar`/`HabitIcon`, `EmptyState`/`ScreenHeader`;
  - `ui/icons.ts` es la lista curada de iconos Lucide, importados uno a uno.
- `src/test/factories.ts`: fábricas para los tests (`habit()`, `entry()`, `entriesOn()`, `pause()`, `days()`, `d()`).

## Decisiones de dominio (acordadas con el usuario)

- **Rachas en la unidad del hábito:** días (diario y días concretos), semanas (X/semana) o meses (X/mes).
- **Comodines:** se gana 1 cada 7 unidades de racha, con un máximo de 2 acumulados, en todos los tipos. Se gasta automáticamente en la primera unidad fallada. La unidad cubierta no suma, pero la racha sigue. **Se derivan de la historia, no se persisten**, así que un registro retroactivo recalcula todo con coherencia.
- **Unidad en curso (`pending`):** no suma ni rompe hasta que se cierra. En "a evitar", hoy queda `pending` si está limpio y `missed` si hubo recaída.
- **Pausas:** una unidad en pausa es neutra aunque tenga registro. Las semanas o meses con días en pausa, creados a mitad o archivados a mitad prorratean la meta: `min(días elegibles, ceil(veces × elegibles / longitud))`. Una semana entera en pausa queda `paused`.
- **Registro único por hábito y día** (índice único `&[habitId+date]`). Cuantitativo y tiempo acumulan en ese registro. Un valor 0 sin nota elimina el registro. `loggedAt` es el instante real del último cambio.
- **Hábitos "a evitar":** solo admiten frecuencia diaria o días concretos. Un registro es una recaída.
- **Retroactivo:** `settings.retroLimitDays` (7 por defecto). No se puede registrar antes de `createdOn` ni después de `archivedOn`. Para rellenar días anteriores, el formulario permitirá adelantar la fecha de inicio.
- **Archivar:** `archivedOn: LocalDay` es el último día que cuenta. Es hoy si hoy ya tiene registro; si no, ayer (`archiveDayFor`). Al restaurar se crea una pausa del hábito (nota "Archivado") que cubre el hueco, para que esos días no cuenten como fallados (`unarchiveGap`). Deshacer la restauración borra esa pausa.
- **Progreso del día (Hoy):**
  - Cuentan los hábitos programados y no pausados.
  - **Los hábitos "a evitar" no cuentan:** no son tareas.
  - Un hábito por semana o mes con la meta ya cumplida otros días no cuenta ese día, salvo que también se haga ese día.
  - Los hábitos de días concretos solo aparecen los días que tocan.
- **Rachas mostradas:** siempre a fecha de hoy, aunque se esté viendo un día pasado.
- **Cronómetro:** solo se ofrece para hoy. Al detenerlo se suman los minutos redondeados al día en que empezó. Si no llega a un minuto no se suma nada. Deshacer resta los minutos y reanuda el cronómetro.
- **Cantidades:** el paso de +/- sale de `quantityStep` (1 para metas ≤20; si no, un valor redondo cercano a meta/10: 8.000 pasos avanza de 1.000 en 1.000). Tocar el valor permite escribirlo.
- **Día seleccionado:** va en la URL (`/?dia=YYYY-MM-DD`, con `replace`). Las fechas futuras se ignoran. Más allá del límite retroactivo el día es de solo lectura, con un aviso.
- **Al crear un hábito** se vuelve a Hoy si se llegó desde allí (`?volver=hoy`) y, si no, a la lista. Crear, editar, archivar, restaurar y eliminar se pueden deshacer. Eliminar además pide confirmación e indica cuántos registros se borrarán.
- **Tasa de cumplimiento:** cada día del rango hereda el resultado de su unidad (1 si se cumplió; hechas/requeridas si se falló), así que una ventana de 7, 30 o 90 días funciona igual en hábitos diarios, semanales y mensuales. No cuentan las pausas, los días que no tocan ni la unidad en curso sin cumplir. **Los comodines protegen la racha, no la tasa.**
- **Heatmap:** la escala `heat-0…4` para todos los hábitos, con el color del hábito solo como marca de identidad. En cantidad y tiempo la intensidad va relativa a la meta (menos de 1/3, de 2/3, de la meta, meta), así que el paso 4 siempre significa "cumplido". Los hábitos **a evitar** pintan las recaídas con una escala propia (`relapse-1…3`, ladrillo apagado), nunca con el azul de "cumplido", y la leyenda lo dice. Nada se distingue solo por color: punto pequeño si no toca, trazo si hay pausa y punto de tinta si un comodín cubrió el día.
- **Primer día de la semana:** configurable (`weekStartsOn`, lunes por defecto).
- **Idioma:** interfaz solo en español, con formato `es-ES`.

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
- En los tests de UI se busca por rol y nombre accesible, lo que de paso comprueba la accesibilidad.
- Controles nativos antes que roles ARIA: casillas reales (`input type=checkbox` visualmente oculto), radios para los segmentados, `fieldset`/`legend` para grupos. Biome (`useSemanticElements`) lo exige.
- Colores de hábito en estilos en línea con `habitColorVar(color)`; para todo lo demás, utilidades de los tokens.
- Comentarios y mensajes de usuario en español; código (identificadores) en inglés.
- Estilo Biome: 2 espacios, comillas simples y línea de 100 caracteres. Ejecuta `npm run lint:fix` antes de hacer commit.
- Para escribir archivos con contenido complejo usa la herramienta Write, no heredocs en bash: en este entorno Windows los heredocs largos fallan.

## Limitaciones conocidas

- Los recordatorios del navegador solo se disparan con la app abierta o activa, porque no hay servidor push (Fase 6).
- El paquete de fuentes incluye subconjuntos cirílico, griego y vietnamita. Solo se descargan si se usan (`unicode-range`), pero hay que excluirlos del precache de la PWA en la Fase 6.
