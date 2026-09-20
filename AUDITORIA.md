# Auditoría de la fase 7

Recorrido de la app pantalla por pantalla contra las secciones 9 (diseño) y 10 (accesibilidad) de
`SPEC.md`. Se escribe **a medida que avanza el recorrido**, no al final: si la sesión se corta, la
siguiente continúa desde aquí. El plan completo de la fase está en `CLAUDE.md`.

Las capturas viven en `auditoria/capturas/` (ignorada por git; solo se commitea este archivo). El
nombre de cada una es `<pantalla>-<viewport>-<tema>[-<estado>].png`, por ejemplo
`hoy-movil-oscuro-vacio.png`.

- Viewports: **móvil 390×844** y **escritorio 1440×900**.
- Orden del recorrido: Hoy · Detalle · Estadísticas · Revisión · Nuevo/Editar hábito · Hábitos ·
  Ajustes · diálogo de atajos · 404.
- Primero **todas las pantallas en tema oscuro**; el tema claro se revisa después, también en todas.

Estados de cada hallazgo: `pendiente` (esperando aprobación) · `aprobado` · `descartado` · `hecho`.

## Progreso del recorrido

| Pantalla | Móvil oscuro | Escritorio oscuro | Móvil claro | Escritorio claro |
|---|---|---|---|---|
| Hoy | — | — | — | — |
| Detalle de hábito | — | — | — | — |
| Estadísticas | — | — | — | — |
| Revisión semanal | — | — | — | — |
| Nuevo/Editar hábito | — | — | — | — |
| Hábitos | — | — | — | — |
| Ajustes | — | — | — | — |
| Diálogo de atajos | — | — | — | — |
| 404 | — | — | — | — |

## Verificación en navegador de la fase 6 (paso 2)

Lo que hasta ahora solo estaba cubierto por tests. El usuario ya lo probó a mano en un navegador
real y funciona; aquí se vuelve a comprobar con Playwright y se anota lo que el navegador
automatizado **no** puede comprobar de verdad.

| Qué | Resultado | Notas |
|---|---|---|
| Manifest e instalabilidad | pendiente | |
| Service worker y aviso "Recargar" | pendiente | requiere `npm run build` + `npm run preview` |
| Sin conexión | pendiente | |
| Exportar copia (descarga) | pendiente | |
| Importar copia válida | pendiente | |
| Importar archivo dañado | pendiente | |
| Exportar CSV | pendiente | |
| Permiso y aviso de notificaciones | pendiente | sin servidor push; la pestaña en segundo plano no se puede comprobar así |
| Atajos de teclado | pendiente | |
| Onboarding | pendiente | |
| Reordenar por teclado | pendiente | |

## Hallazgos

Ninguno todavía: el recorrido empieza en el paso 2.

<!--
Formato de cada hallazgo:

### H1 · <Pantalla> — <resumen en una línea>

- **Dónde:** ruta y componente (`src/...`)
- **Viewport y tema:** móvil oscuro / escritorio claro / …
- **Problema:** qué se ve mal y contra qué regla de la sección 9 o 10 va.
- **Captura:** `auditoria/capturas/....png`
- **Propuesta:** el arreglo concreto.
- **Severidad:** alta / media / baja
- **Estado:** pendiente
-->

## Ya corregido antes del recorrido (paso 1)

| # | Pantalla | Problema | Corrección | Estado |
|---|---|---|---|---|
| 1 | Ajustes | El límite retroactivo se guardaba en cada tecla: escribir `14` guardaba `1` y luego `14`. | Se guarda al salir del campo o con Enter; fuera de rango se avisa y se recupera el valor anterior (`SettingsScreen.tsx`). | hecho |
| 2 | Nuevo/Editar hábito | En el selector de icono, la opción "Ninguno" era texto dentro de una caja de 44 px: no cabía, tocaba los bordes y se cortaba. | Pasa a ser un icono (`CircleSlash`) del mismo tamaño que los demás, con "Ninguno" como nombre accesible y como tooltip; se añadió tooltip a todas las opciones y el estado elegido es idéntico en todas (`features/habits/fields.tsx`). | hecho |
