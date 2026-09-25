<div align="center">
    <img src="public/pwa-512.png"
        title="Morph" alt="Morph logo" width="120" />
    <h1>Morph</h1>
    <p>
        Un seguimiento de hábitos para el navegador, en español.
        <br>
        Sin cuentas, sin servidor: tus datos se quedan en tu dispositivo.
    </p>
    <a href="https://habit-tracker-c6c.pages.dev/">
        Abrir Morph
    </a>
</div>

## Qué es

Morph es una aplicación web para registrar hábitos y ver cómo evolucionan. Está pensada para quien quiere llevar el seguimiento de forma sencilla y sin darle sus datos a nadie. Se puede instalar como app (PWA) y funciona sin conexión.

## Qué incluye

- Hábitos de cuatro tipos: sí/no, cantidad, tiempo y «a evitar».
- Frecuencia diaria, en días concretos, X veces por semana o X veces por mes.
- Rachas con comodines, pausas y registro de días anteriores dentro de un límite configurable.
- Detalle de cada hábito con calendario de actividad, métricas e hitos.
- Estadísticas globales, comparación entre períodos y registro de ánimo y energía con correlaciones.
- Revisión semanal con reflexión escrita.
- Recordatorios (con la app abierta o activa), atajos de teclado y tema claro y oscuro.

## Datos y privacidad

Todo se guarda en el navegador (IndexedDB), en tu dispositivo. No hay cuenta ni servidor, y la app no envía nada a ningún sitio. Por eso los datos no se sincronizan entre dispositivos ni sobreviven a borrar los datos del sitio: desde Ajustes puedes exportar una copia completa en JSON, importarla o exportar los registros a CSV. La app incluye una página de privacidad (`/privacidad`) con los detalles.

## Requisitos

- Node.js ≥ 22.12
- npm

## Instalación y ejecución

```bash
npm ci
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
| `npm run typecheck` | Comprobación de tipos |
| `npm run lint` | Lint y comprobación de formato (Biome) |
| `npm run lint:fix` | Lint y formato con correcciones automáticas |
| `npm run format` | Solo formato |
| `npm test` | Tests (Vitest), una ejecución |
| `npm run test:watch` | Tests en modo vigilancia |
| `npm run check` | Tipos, lint y tests |

## Estructura

```
src/
  domain/     lógica pura: frecuencias, rachas, estadísticas, copia de seguridad
  db/         esquema de IndexedDB (Dexie), migraciones y repositorios de escritura
  features/   una carpeta por pantalla o funcionalidad
  ui/         componentes básicos compartidos
  charts/     marco común de los gráficos
  hooks/      lecturas reactivas y utilidades de React
  state/      estado local (cronómetros, diálogos)
  lib/        formato de texto, temas, notificaciones, caché de análisis
  styles/     tokens de diseño y estilos base
  dev/        datos de ejemplo, solo en desarrollo
public/       iconos y recursos estáticos de la PWA
scripts/      generación de iconos (`node scripts/generate-icons.mjs`)
brand/        icono original
```

Las dependencias van en una dirección: interfaz → datos → dominio. El dominio no importa React ni Dexie.

Stack: React, TypeScript, Vite, Tailwind, Dexie, Recharts y Vitest; Biome para lint y formato.

## Documentación

- `SPEC.md`: especificación del producto.
- `CLAUDE.md`: arquitectura, decisiones de dominio y de diseño.
- `AUDITORIA.md`: revisión final de la interfaz.

## Sobre el proyecto

Morph es un proyecto personal. Los reportes de errores son bienvenidos (abre un issue), pero por ahora no busco contribuciones de código.

Licencia [MIT](LICENSE).
