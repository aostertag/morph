/*
 * Columnas compartidas por las tablas de barras de Estadísticas (Consistencia y Por categoría).
 * Con `table-fixed` y este mismo `colgroup`, las barras de las dos secciones quedan en la misma
 * posición y con el mismo ancho en cualquier pantalla, sin depender del contenido de cada fila.
 */

export const BAR_TABLE = 'w-full table-fixed text-md';

/** Nombre (el resto), barra decorativa y cifra ("58 % (19 d)"). */
export function BarTableColumns() {
  return (
    <colgroup>
      <col />
      <col className="w-20 sm:w-[35%]" />
      <col className="w-28 sm:w-32" />
    </colgroup>
  );
}

export const FIGURE_CELL = 'whitespace-nowrap text-right';
