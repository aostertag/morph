import { isValidElement, type ReactNode, useId, useState } from 'react';
import { cx } from '@/lib/cx';

/**
 * Marco común de los gráficos: título, alternativa en tabla y nota al pie.
 * Todo gráfico tiene su tabla equivalente, que además es la lectura accesible.
 */
export function ChartFigure({
  title,
  note,
  table,
  tableLabel = 'Ver tabla',
  controls,
  children,
  className,
}: {
  title: string;
  note?: ReactNode;
  table: ReactNode;
  tableLabel?: string;
  /** Controles propios del gráfico (por ejemplo, el período). */
  controls?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const [showTable, setShowTable] = useState(false);
  const id = useId();

  return (
    <figure className={cx('mt-12', className)} aria-labelledby={id}>
      <figcaption className="mb-4 flex items-baseline justify-between gap-4 border-b border-border pb-2">
        <h2 id={id} className="label-caps">
          {title}
        </h2>
        <div className="flex items-center gap-4">
          {controls}
          <button
            type="button"
            onClick={() => setShowTable((v) => !v)}
            className="min-h-6 rounded-sm px-1 text-sm text-accent underline-offset-4 hover:underline"
          >
            {showTable ? 'Ver gráfico' : tableLabel}
          </button>
        </div>
      </figcaption>
      {showTable ? table : children}
      {note && <p className="mt-3 text-sm text-text-muted">{note}</p>}
    </figure>
  );
}

/** Tabla compacta de datos: primera columna como encabezado de fila. */
/** Clave de fila: la del elemento si la primera celda lo es, y si no su texto. */
function rowKey(cell: ReactNode): string {
  return isValidElement(cell) ? String(cell.key) : String(cell);
}

export function DataTable({
  head,
  rows,
  caption,
  flushFirst = false,
}: {
  head: readonly string[];
  rows: readonly (readonly ReactNode[])[];
  caption?: string;
  /** La primera columna pone su propio relleno vertical (para que una `ColorBar` cubra la fila). */
  flushFirst?: boolean;
}) {
  return (
    <table className="w-full text-md">
      {caption && <caption className="sr-only">{caption}</caption>}
      <thead>
        <tr className="border-b border-border text-text-muted">
          {head.map((label, index) => (
            <th
              key={label}
              scope="col"
              className={cx('py-1 font-normal', index === 0 ? 'text-left' : 'text-right')}
            >
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={rowKey(row[0])} className="border-b border-border">
            {row.map((cell, index) =>
              index === 0 ? (
                <th
                  key="head"
                  scope="row"
                  className={cx('text-left font-normal', !flushFirst && 'py-1.5')}
                >
                  {cell}
                </th>
              ) : (
                <td key={head[index]} className="py-1.5 text-right">
                  {cell}
                </td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
