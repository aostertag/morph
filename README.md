# Hábitos

Aplicación web de seguimiento de hábitos, local-first: los datos viven en tu navegador (IndexedDB), funciona sin conexión y ofrece un recuento detallado de tu progreso.

> Estado: **Fase 6 terminada**. Están Hoy, la gestión de hábitos, el detalle con heatmap, las estadísticas con correlaciones, la revisión semanal, los ajustes (backup, pausas, recordatorios), la PWA, el onboarding y los atajos de teclado. Falta el pulido final.

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
| `node scripts/generate-icons.mjs` | Regenera los iconos de `public/` |

Los tests de dominio se ejecutan en tres zonas horarias (Madrid, Santiago de Chile y Nueva York) para cubrir los cambios de horario.

## Estructura

```
src/
  app/        Composición de la app (router, layout, título por ruta)
  domain/     Lógica pura: días, frecuencias, evaluación, rachas, comodines, pausas, estadísticas,
              correlaciones, backup y CSV, recordatorios
  db/         Dexie: esquema, migraciones, repositorios (importar y borrar en una transacción) y errores
  features/   Pantallas: hoy, hábitos, detalle, estadísticas, revisión, ajustes, onboarding, atajos
  lib/        Utilidades de UI (tema, formato, toasts, atajos, PWA…)
  styles/     tokens.css (todos los tokens de diseño), base.css, app.css
  test/       Fábricas y configuración de tests
```

## Datos y privacidad

Todo se guarda en IndexedDB, en tu dispositivo: no hay cuenta ni servidor. Desde Ajustes puedes exportar una copia completa en JSON (que la app valida entera antes de importarla, sin tocar nada si tiene algún problema), exportar los registros a CSV o borrarlo todo.

Los recordatorios usan las notificaciones del navegador y, al no haber servidor, solo salen con la app abierta o activa en segundo plano.

Las decisiones de arquitectura y de diseño están documentadas en `CLAUDE.md`, y la especificación del producto en `SPEC.md`.
