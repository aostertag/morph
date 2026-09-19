# CLAUDE.md — Habit Tracker

Memoria del proyecto entre sesiones. Léelo entero antes de trabajar y actualízalo al cerrar cada fase.
La especificación completa está en `SPEC.md`; la sección 9 (diseño) prevalece sobre cualquier guía, incluidas las skills.

## Estado

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Tooling, tokens, modelo de datos Dexie, dominio (frecuencias, rachas, comodines, pausas) + tests | **Hecha** |
| 2 | Pantalla Hoy y gestión de hábitos | Pendiente |
| 3 | Detalle de hábito, heatmap, métricas, generador de datos | Pendiente |
| 4 | Estadísticas globales y correlaciones | Pendiente |
| 5 | Revisión semanal, ánimo/energía, hitos | Pendiente |
| 6 | Ajustes, backup, recordatorios, PWA, onboarding, atajos, a11y | Pendiente |
| 7 | Pulido final | Pendiente |

`src/app/TokenSpecimen.tsx` es una página temporal de comprobación de tokens: se elimina en la Fase 2.

## Stack (versiones verificadas con `npm view` el 2026-09-19)

React 19.3 · TypeScript 7.0 (nativo) · Vite 8.3 + `@vitejs/plugin-react` 6 + React Compiler (vía `@rolldown/plugin-babel` + `@babel/core` 8) · Tailwind 4.3 (CSS-first) · Dexie 4.4 + dexie-react-hooks · Recharts 3.10 · date-fns 4.4 · Zustand 5 · Sonner 2 · Motion 13 · Lucide 1.47 · React Router 8 · Base UI 1.8 · dnd-kit (core 6 + sortable 10) · Zod 4 · vite-plugin-pwa 1.3 · Vitest 5 + jsdom + Testing Library + fake-indexeddb · Biome 2.5.

- **Biome, no ESLint + Prettier:** `typescript-eslint` exige `typescript <6.1`, así que no funciona con TS 7. Biome es lint + formato en una sola herramienta y no depende de la API de TS.
- **D3 no está instalado.** El heatmap se hará en SVG propio. Solo se añade D3 si algo lo requiere de verdad.
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
  - `types.ts`: modelo de datos y `DEFAULT_SETTINGS`.
- `src/db/`:
  - `schema.ts`: `TrackerDB` y el singleton `db`.
  - `migrations.ts`: lista versionada. **Nunca se edita una versión publicada; se añade otra.**
  - `errors.ts`: `StorageError` (mensaje claro para el usuario) y `ValidationError`.
  - `repos/*`: todas las escrituras pasan por aquí. Las mutaciones devuelven el estado anterior para poder deshacer.
- `src/lib/theme.ts`: resuelve el tema y guarda en `localStorage` una copia de la preferencia, que un script inline de `index.html` aplica antes del primer pintado.
- `src/test/factories.ts`: fábricas para los tests (`habit()`, `entry()`, `entriesOn()`, `pause()`, `days()`, `d()`).

## Decisiones de dominio (acordadas con el usuario)

- **Rachas en la unidad del hábito:** días (diario y días concretos), semanas (X/semana) o meses (X/mes).
- **Comodines:** se gana 1 cada 7 unidades de racha, con un máximo de 2 acumulados, en todos los tipos. Se gasta automáticamente en la primera unidad fallada. La unidad cubierta no suma, pero la racha sigue. **Se derivan de la historia, no se persisten**, así que un registro retroactivo recalcula todo con coherencia.
- **Unidad en curso (`pending`):** no suma ni rompe hasta que se cierra. En "a evitar", hoy queda `pending` si está limpio y `missed` si hubo recaída.
- **Pausas:** una unidad en pausa es neutra aunque tenga registro. Las semanas o meses con días en pausa, creados a mitad o archivados a mitad prorratean la meta: `min(días elegibles, ceil(veces × elegibles / longitud))`. Una semana entera en pausa queda `paused`.
- **Registro único por hábito y día** (índice único `&[habitId+date]`). Cuantitativo y tiempo acumulan en ese registro. Un valor 0 sin nota elimina el registro. `loggedAt` es el instante real del último cambio.
- **Hábitos "a evitar":** solo admiten frecuencia diaria o días concretos. Un registro es una recaída.
- **Retroactivo:** `settings.retroLimitDays` (7 por defecto). No se puede registrar antes de `createdOn` ni después de `archivedOn`. Para rellenar días anteriores, el formulario permitirá adelantar la fecha de inicio.
- **Archivar:** `archivedOn: LocalDay` es el último día que cuenta. *Pendiente (Fase 2):* al desarchivar, crear una pausa automática que cubra el hueco.
- **Primer día de la semana:** configurable (`weekStartsOn`, lunes por defecto).
- **Idioma:** interfaz solo en español, con formato `es-ES`.

## Diseño (resumen; los valores están en `src/styles/tokens.css`)

- **Tokens:** todos en `src/styles/tokens.css` (`@theme static`). Se borran las escalas por defecto de Tailwind (`--color-*: initial`, etc.). El tema oscuro redefine las variables bajo `:root[data-theme='dark']`. Nunca uses colores o tamaños sueltos.
- **Paleta:** neutros cálidos de papel y tinta, acento tinta azul (`#2B50C8` en claro y `#8CA3FF` en oscuro), 10 colores de hábito (`--color-habit-<clave>`, claves en `HABIT_COLORS`) y una escala de heatmap `heat-0…4`. Texto sobre un color: `on-accent` y `on-habit`.
- **Contrastes medidos:**
  - texto 15,9/15,5; muted 6,4/7,3; faint 4,9/5,5; border-strong 3,3/3,3; accent 6,2/7,8;
  - hábitos ≥4,5 en claro y ≥7 en oscuro;
  - los pasos bajos del heatmap están por debajo de 3:1, compensados con una tabla alternativa y tooltips.
- **Tipografía:** IBM Plex Sans Variable autoalojada (`@fontsource-variable/ibm-plex-sans/wght.css`). Sus cifras son tabulares por diseño: las 10 miden 600 unidades, verificado con fontTools. El subconjunto no trae `tnum`, `zero` ni versalitas reales. La escala va de `text-xs` (12) a `text-4xl` (56). Las etiquetas de sección usan la utilidad `label-caps`.
- **Espaciado:** rejilla de 4px (`--spacing: 0.25rem`), `px-gutter` (16) / `px-gutter-desktop` (32) y `min-h-touch` / `size-touch` (44px).
- **Radios:** `sm` 3, `md` 6 y `lg` 10.
- **Sombras:** solo `shadow-overlay`, para capas superpuestas.
- **Movimiento:** `--duration-fast|base|slow` (150/180/200 ms) y `--ease-out`. Se animan solo `transform`, `opacity` y color. La utilidad `pressable` da `scale(0.97)` al pulsar. Nada se anima al actuar por teclado. `prefers-reduced-motion` está cubierto en `base.css`.
- **Prohibido:** gradientes, emojis, blur o glassmorphism, sombras de color, ilustraciones, tarjetas idénticas por todas partes y tono motivacional empalagoso.

## Convenciones

- TypeScript estricto (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`), sin `any` y sin aserciones `!`.
- Los modelos usan `| null` en vez de propiedades opcionales. IndexedDB no indexa `null` ni booleanos, así que no se crean índices sobre ellos.
- Tests colocados junto al módulo (`*.test.ts`), organizados en proyectos de Vitest:
  - `domain` se ejecuta tres veces, con `TZ=Europe/Madrid`, `America/Santiago` y `America/New_York`;
  - `db` usa fake-indexeddb;
  - `ui` usa jsdom (`*.test.tsx`).
- Comentarios y mensajes de usuario en español; código (identificadores) en inglés.
- Estilo Biome: 2 espacios, comillas simples y línea de 100 caracteres. Ejecuta `npm run lint:fix` antes de hacer commit.
- Para escribir archivos con contenido complejo usa la herramienta Write, no heredocs en bash: en este entorno Windows los heredocs largos fallan.

## Limitaciones conocidas

- Los recordatorios del navegador solo se disparan con la app abierta o activa, porque no hay servidor push (Fase 6).
- El paquete de fuentes incluye subconjuntos cirílico, griego y vietnamita. Solo se descargan si se usan (`unicode-range`), pero hay que excluirlos del precache de la PWA en la Fase 6.
