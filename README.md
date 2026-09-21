<div align="center">
    <img src="public/pwa-512.png"
        title="Morph" alt="Morph logo" width="120" />
    <h1>Morph</h1>
    <p>
        El habit tracker diseñado para las personas, hecho con cariño.
        <br>
        Ultraligero, rápido y sin registro obligatorio.
    </p>
    <a href="https://habit-tracker-c6c.pages.dev/">
        Morph
    </a>
</div>

# Morph

Aplicación web para seguir hábitos: registro diario, rachas, heatmap, estadísticas, revisión semanal y ajustes. Interfaz en español, instalable como PWA y con funcionamiento sin conexión.

## Datos y privacidad

Todo se guarda en el navegador (IndexedDB), en tu dispositivo. No hay cuenta ni servidor, y nada se envía a ningún sitio. Por eso los datos no se sincronizan entre dispositivos ni sobreviven a borrar los datos del sitio: desde Ajustes puedes exportar una copia completa en JSON, importarla o exportar los registros a CSV.

## Requisitos

- Node.js ≥ 22.12
- npm ≥ 10

## Instalación y ejecución

```bash
npm install
npm run dev        # http://localhost:5173
```

Para generar y probar la versión de producción:

```bash
npm run build      # genera dist/
npm run preview    # sirve dist/ en local
```

## Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Comprobación de tipos y build de producción en `dist/` |
| `npm run preview` | Sirve el build de producción |
| `npm run check` | Tipos, lint y tests |
| `npm run lint:fix` | Biome (lint y formato) |
| `npm test` | Vitest |

## Documentación

- `SPEC.md`: especificación del producto.
- `CLAUDE.md`: arquitectura, decisiones de dominio y de diseño.
- `AUDITORIA.md`: revisión final de la interfaz.
