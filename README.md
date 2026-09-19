# Hábitos

Aplicación web de seguimiento de hábitos, local-first: los datos viven en tu navegador (IndexedDB), funciona sin conexión y ofrece un recuento detallado de tu progreso.

> Estado: **Fase 2**. Ya están la pantalla Hoy y la gestión de hábitos. El detalle, las estadísticas y los ajustes llegan en las siguientes fases.

## Requisitos

- Node.js ≥ 22.12 (desarrollado con Node 24)
- npm ≥ 10

## Instalación

```bash
npm install
npm run dev        # http://localhost:5173
```

## Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Comprobación de tipos y build de producción en `dist/` |
| `npm run preview` | Sirve el build de producción |
| `npm run typecheck` | TypeScript 7 en modo estricto |
| `npm run lint` / `lint:fix` | Biome (lint y formato) |
| `npm test` / `test:watch` | Vitest |
| `npm run check` | Tipos, lint y tests |

Los tests de dominio se ejecutan en tres zonas horarias (Madrid, Santiago de Chile y Nueva York) para cubrir los cambios de horario.

## Estructura

```
src/
  app/        Composición de la app (router y layout a partir de la Fase 2)
  domain/     Lógica pura: días locales, frecuencias, evaluación, rachas, comodines, pausas
  db/         Dexie: esquema, migraciones, repositorios y errores
  lib/        Utilidades de UI (tema, formato, toasts…)
  styles/     tokens.css (todos los tokens de diseño), base.css, app.css
  test/       Fábricas y configuración de tests
```

Las decisiones de arquitectura y de diseño están documentadas en `CLAUDE.md`, y la especificación del producto en `SPEC.md`.
