import type { ReactNode } from 'react';

/**
 * Encabezado único de todas las pantallas. La geometría es fija: una línea de sobretítulo
 * reservada (aunque esté vacía), el título de `text-2xl` en una fila de altura táctil y las
 * acciones alineadas con esa fila. Así el título cae siempre a la misma altura y al mismo
 * margen, lleve o no sobretítulo, acciones o marca de color.
 */
export function ScreenHeader({
  title,
  eyebrow,
  actions,
  mark,
  live = false,
  children,
}: {
  title: string;
  eyebrow?: string | undefined;
  actions?: ReactNode;
  /** Marca a la izquierda que cubre todo el alto del encabezado (barra de color del hábito). */
  mark?: ReactNode;
  /** Anuncia el cambio de título y sobretítulo a los lectores de pantalla. */
  live?: boolean;
  /** Líneas de contexto bajo el título. */
  children?: ReactNode;
}) {
  return (
    <header className="mb-8 flex items-stretch gap-3">
      {mark}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div
            className="min-w-0"
            {...(live ? { 'aria-live': 'polite' as const, 'aria-atomic': true } : {})}
          >
            <p className="label-caps h-4">{eyebrow}</p>
            <h1 className="flex min-h-touch items-center text-2xl font-semibold">
              <span className="truncate">{title}</span>
            </h1>
          </div>
          {actions && (
            <div className="flex min-h-touch flex-wrap items-center gap-3 self-end">{actions}</div>
          )}
        </div>
        {children}
      </div>
    </header>
  );
}
