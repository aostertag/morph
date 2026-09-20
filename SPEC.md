# SPEC: Habit Tracker

## 0. Cómo trabajar este proyecto

Vas a construir una aplicación web de seguimiento de hábitos con calidad de producto terminado. No es una demo ni un prototipo: tiene que sentirse sólida, rápida y bien pensada en cada detalle, y sobre todo debe entregar un recuento profundo del progreso con estadísticas que digan algo útil.

Reglas de trabajo:

1. Lee este documento completo antes de escribir código.
2. Crea un archivo `CLAUDE.md` en la raíz con el resumen del proyecto, stack, convenciones y decisiones tomadas. Mantenlo actualizado al cerrar cada fase, porque es tu memoria entre sesiones.
3. Antes de instalar dependencias, verifica las versiones estables actuales con `npm view <paquete> version`. Usa siempre la última versión estable, no versiones de memoria.
4. Propón la arquitectura, la estructura de carpetas y la dirección estética (sección 9) y espera mi aprobación antes de programar.
5. Trabaja por fases (sección 12). Al cerrar cada una: haz commit, actualiza `CLAUDE.md` y dime qué hiciste, qué quedó pendiente y cómo probarlo.
6. Usa las skills `emil-design-eng` y `ask-sonner` instaladas en el proyecto. Si alguna guía contradice las restricciones de diseño de este documento, mandan las restricciones.

## 1. Stack técnico

- React 19 + TypeScript en modo estricto, con Vite.
- Tailwind CSS v4 con configuración CSS-first (`@theme`). Todos los tokens de diseño (color, tipografía, espaciado, radios, sombras) definidos en un solo lugar.
- Dexie (IndexedDB) para persistencia local-first. La app funciona sin conexión y los datos sobreviven a recargas. Sistema de migraciones de esquema desde el inicio.
- Recharts para gráficos; D3 solo si algo lo requiere (por ejemplo, el heatmap).
- date-fns para fechas. Un "día" es siempre el día local del usuario; cuidado con zonas horarias y cambios de horario.
- Zustand para estado global cuando haga falta.
- Sonner para notificaciones y acciones de deshacer.
- Motion (antes Framer Motion) para las pocas animaciones que haya.
- Lucide para iconos.
- Vitest + Testing Library para tests.
- ESLint y Prettier (o Biome, justifica la elección).
- PWA instalable con manifest y service worker (vite-plugin-pwa).

## 2. Modelo de datos

Diseñado para que las estadísticas sean fáciles y eficientes de calcular:

- **Hábito**: id, nombre, descripción, color (de la paleta curada), icono Lucide opcional, categoría, tipo, meta y unidad, frecuencia, momento del día (mañana/tarde/noche/cualquiera), fecha de creación, archivado, orden.
- **Registro**: id, hábito, fecha (día local), valor, nota opcional, timestamp real del registro.
- **Registro diario**: fecha, ánimo (1–5), energía (1–5), nota del día.
- **Pausa**: rango de fechas y motivo (vacaciones, enfermedad), global o por hábito.
- **Revisión semanal**: semana, resumen calculado, reflexión escrita.
- **Categoría**: editable por el usuario.
- **Ajustes**: preferencias del usuario.

Índices en Dexie pensados para las consultas por hábito y rango de fechas.

## 3. Tipos de hábito

1. **Sí/No**: se hizo o no.
2. **Cuantitativo**: meta numérica con unidad (8 vasos, 10.000 pasos). Se cumple al alcanzar la meta, pero se guarda el valor real.
3. **Por tiempo**: minutos dedicados, con cronómetro integrado opcional que sobrevive a recargar la página.
4. **A evitar**: cosas que quiero dejar. El éxito es no registrarlo y la racha cuenta días limpios.

## 4. Frecuencias

- Diaria.
- Días específicos de la semana.
- X veces por semana, cualquier día.
- X veces al mes.

Rachas y porcentajes respetan la frecuencia: en un hábito de "3 veces por semana", no hacerlo un martes no rompe nada.

## 5. Rachas

- Racha actual y mejor racha histórica por hábito.
- **Comodines**: se gana uno cada 7 días de racha (máximo 2 acumulados) y se usa automáticamente para cubrir un día fallado. Esto evita el efecto "rompí la racha, ya da igual". Debe quedar registrado y visible cuándo se usó uno.
- Días en pausa no cuentan ni a favor ni en contra.
- Registro retroactivo de días pasados, con límite configurable (por defecto 7 días).

## 6. Pantallas

### Hoy (principal)
- Hábitos que tocan hoy, agrupados por momento del día.
- Marcar con un toque; cuantitativos con +/- y entrada directa; por tiempo con cronómetro.
- Progreso del día y confirmación sobria al completar todo.
- Toast con "deshacer" para toda acción.
- Registro rápido de ánimo, energía y nota del día.
- Navegación a días anteriores.

### Detalle de hábito
- Heatmap anual tipo calendario, con intensidad proporcional al valor en cuantitativos.
- Racha actual, mejor racha, total completado, tasa de cumplimiento (7, 30, 90 días y total).
- Evolución semanal de la tasa de cumplimiento.
- Rendimiento por día de la semana.
- Cuantitativos: promedio, máximo, total acumulado y tendencia.
- Historial de notas y comodines usados.
- Hitos alcanzados (primera semana completa, 30 días, 100 registros, etc.).

### Estadísticas globales
La parte más importante. Debe leerse como un informe sobre mí:
- Puntuación del período con comparación contra el anterior.
- Ranking de hábitos por consistencia.
- Mejor y peor día de la semana.
- Hábitos mejorando y decayendo en las últimas 4 semanas.
- **Correlaciones** entre hábitos y con el ánimo/energía, explicadas en lenguaje natural ("Los días que haces ejercicio, tu ánimo promedio es 4,1 frente a 3,2"). Solo mostrar las que tengan datos suficientes (mínimo 14 días en cada grupo), indicar el tamaño de la muestra y aclarar que es correlación, no causa.
- Selector de rango: semana, mes, trimestre, año y personalizado.

### Revisión semanal
- Al abrir la app por primera vez en la semana, ofrecer el resumen de la anterior: cumplimiento, rachas, hábito más constante, el que más costó y un espacio para una reflexión breve.
- Historial de revisiones.

### Gestión de hábitos
- Crear y editar con formulario claro y vista previa.
- Plantillas sugeridas (agua, lectura, ejercicio, meditación, dormir temprano, etc.).
- Reordenar con arrastrar y soltar (también accesible por teclado).
- Archivar conservando historial; eliminar con confirmación.

### Ajustes
- Tema claro, oscuro o sistema.
- Primer día de la semana.
- Recordatorios por hábito con notificaciones del navegador.
- Exportar e importar backup completo en JSON (con validación del archivo antes de importar) y exportar registros a CSV.
- Borrar todos los datos con confirmación fuerte.

## 7. Onboarding y datos de ejemplo

- Onboarding breve la primera vez: 2 o 3 pasos, saltable.
- En modo desarrollo, un botón que genere 6 meses de datos realistas (rachas, baches, variaciones de ánimo y correlaciones plausibles) para probar las estadísticas.

## 8. Arquitectura y calidad de código

- Toda la lógica de dominio (frecuencias, rachas, comodines, pausas, estadísticas, correlaciones) en funciones puras, separadas de la UI y de la base de datos.
- Tests de esa lógica con casos borde: cambio de horario, años bisiestos, hábitos creados a mitad de semana, días en pausa, registros retroactivos, comodines encadenados.
- Componentes pequeños y tipados; nada de `any`.
- Manejo de errores de IndexedDB con mensajes claros al usuario.
- Rendimiento: la pantalla Hoy debe sentirse instantánea incluso con 2 años de datos. Memoizar o precalcular donde haga falta.
- README con instrucciones de instalación, scripts y estructura.

## 9. Dirección de diseño (obligatoria, prevalece sobre cualquier otra guía)

Restricciones que no se negocian:
- Cero gradientes, en ningún elemento. Solo colores planos.
- Cero emojis en interfaz, textos, notificaciones, plantillas y datos de ejemplo.
- Nada de glassmorphism, blur de fondo, brillos ni sombras de colores.
- Nada de ilustraciones decorativas genéricas. Los estados vacíos se resuelven con buena tipografía y un texto claro.
- No convertir todo en tarjetas idénticas con la misma sombra y radio. La jerarquía se construye con tipografía, espaciado y alineación; los contenedores solo cuando agrupan algo de verdad.
- Nada de mensajes motivacionales empalagosos. Tono sobrio, directo y respetuoso.
- Animaciones mínimas y funcionales (confirmar una acción, transición entre vistas), entre 150 y 200 ms, nunca decorativas. Respetar `prefers-reduced-motion`.

Lo que sí:
- Estética de herramienta bien diseñada, como un instrumento de medición o un cuaderno de registro: precisa, calmada, con alta densidad de información bien ordenada.
- Paleta reducida: un neutro principal, un acento y una escala de intensidad para el heatmap. Cada hábito toma su color de una paleta curada de 8 a 10 tonos que funcionen juntos en modo claro y oscuro.
- Tipografía con carácter: una familia para texto y cifras con números tabulares para que las estadísticas se alineen. Los números grandes (rachas, porcentajes) son protagonistas.
- Gráficos limpios: cuadrícula mínima, ejes discretos, etiquetas directas sobre los datos en lugar de leyendas cuando sea posible.
- Mobile-first, pero aprovechando el espacio en escritorio (por ejemplo, panel lateral de estadísticas).
- Tamaño de letra según pantalla: la escala tipográfica parte de 16 px. En pantallas de 1600 px CSS o más (monitor de escritorio a 1080p) la raíz sube a 17 px y con ella toda la escala, el espaciado y los contenedores, definidos en rem en `tokens.css`. Por debajo de 1600 px no cambia nada. El texto pequeño (12 y 13 px) es el que más se resiente a densidad de píxeles baja, y por eso se escala en bloque en vez de tocar componentes.

Antes de programar la UI, preséntame la dirección estética: paleta con valores hex para ambos temas, tipografías, escala de espaciado y la pantalla Hoy descrita en texto. Espera mi aprobación.

## 10. Accesibilidad

- Cumplir WCAG 2.2 nivel AA: contraste, foco visible, tamaños táctiles mínimos.
- Navegación completa por teclado y etiquetas ARIA correctas.
- El heatmap y los gráficos deben tener una alternativa textual o tabla accesible.

## 11. Atajos de teclado (escritorio)

- Números para marcar hábitos de la pantalla Hoy.
- Flechas izquierda/derecha para cambiar de día.
- `N` para nuevo hábito, `?` para ver todos los atajos.

## 12. Fases

1. Estructura, tooling, tokens de diseño, modelo de datos con Dexie y lógica de frecuencias, rachas, comodines y pausas con tests.
2. Pantalla Hoy y gestión de hábitos (crear, editar, archivar, reordenar, plantillas).
3. Detalle de hábito con heatmap, métricas y gráficos. Generador de datos de ejemplo.
4. Estadísticas globales y correlaciones.
5. Revisión semanal, registro de ánimo y energía, hitos.
6. Ajustes, exportar/importar, recordatorios, PWA, onboarding, atajos y accesibilidad.
7. Pulido final: recorre la app completa como un usuario exigente, revisa cada pantalla contra la sección 9 y la 10, corrige todo lo que se sienta tosco o inconsistente y entrégame una lista de lo que cambiaste.