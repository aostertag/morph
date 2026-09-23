import type { ReactNode } from 'react';

/**
 * Encabezado único de todas las pantallas. La geometría es fija: una línea de sobretítulo
 * reservada (aunque esté vacía), el título de `text-2xl` en una fila de altura táctil y las
 * acciones alineadas con esa fila. Así el título cae siempre a la misma altura y al mismo
 * margen, lleve o no sobretítulo, acciones o marca de color.
 *
 * Con `actionsBelowOnMobile`, por debajo de `lg` las acciones bajan a su propia fila, fuera
 * del bloque de la marca, y desde `lg` vuelven a la altura del título. Son la misma instancia:
 * solo cambia su sitio en la rejilla. `below` va después, también fuera de la marca.
 */
export function ScreenHeader({
  title,
  eyebrow,
  actions,
  mark,
  live = false,
  wrapTitle = false,
  actionsBelowOnMobile = false,
  below,
  children,
}: {
  title: string;
  eyebrow?: string | undefined;
  actions?: ReactNode;
  /** Marca a la izquierda que cubre todo el alto del bloque (barra de color del hábito). */
  mark?: ReactNode;
  /** Anuncia el cambio de título y sobretítulo a los lectores de pantalla. */
  live?: boolean;
  /** El título se parte en varias líneas en vez de cortarse con puntos suspensivos. */
  wrapTitle?: boolean;
  actionsBelowOnMobile?: boolean;
  /** Solo con `actionsBelowOnMobile`: contenido fuera del bloque de la marca (descripción, avisos). */
  below?: ReactNode;
  /** Líneas de contexto bajo el título, dentro del bloque de la marca. */
  children?: ReactNode;
}) {
  const titleBlock = (
    <div
      className="min-w-0"
      {...(live ? { 'aria-live': 'polite' as const, 'aria-atomic': true } : {})}
    >
      <p className="label-caps h-4">{eyebrow}</p>
      <h1 className="flex min-h-touch items-center text-2xl font-semibold">
        <span className={wrapTitle ? 'min-w-0 break-words' : 'truncate'}>{title}</span>
      </h1>
    </div>
  );

  if (actionsBelowOnMobile) {
    return (
      <header className="mb-8 grid grid-cols-[minmax(0,1fr)] gap-x-4 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex items-stretch gap-3">
          {mark}
          <div className="min-w-0 flex-1">
            {titleBlock}
            {children}
          </div>
        </div>
        {actions && (
          // Desde `lg`, `mt-4` es la línea del sobretítulo: las acciones quedan a la altura del título.
          <div className="mt-4 flex min-h-touch flex-wrap items-center gap-3 lg:self-start">
            {actions}
          </div>
        )}
        {below && <div className="mt-4 lg:col-span-2">{below}</div>}
      </header>
    );
  }

  return (
    <header className="mb-8 flex items-stretch gap-3">
      {mark}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          {titleBlock}
          {actions && (
            <div className="flex min-h-touch flex-wrap items-center gap-3 self-end">{actions}</div>
          )}
        </div>
        {children}
      </div>
    </header>
  );
}
