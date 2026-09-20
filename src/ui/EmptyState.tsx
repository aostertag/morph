import type { ReactNode } from 'react';
import { ScreenHeader } from './ScreenHeader';

/** Estado vacío resuelto con tipografía y un texto claro, sin ilustraciones. */
export function EmptyState({
  title,
  text,
  actions,
  standalone = false,
}: {
  title: string;
  text?: string | undefined;
  actions?: ReactNode;
  /** Pantalla entera sin encabezado propio: el título pasa a ser el `h1`, con el encabezado común. */
  standalone?: boolean;
}) {
  if (standalone) {
    return (
      <>
        <ScreenHeader title={title} />
        {text && <p className="max-w-md text-md text-text-muted">{text}</p>}
        {actions && <div className="mt-6 flex flex-wrap gap-3">{actions}</div>}
      </>
    );
  }
  return (
    <div className="border-t border-border py-10">
      <p className="text-xl font-medium">{title}</p>
      {text && <p className="mt-2 max-w-md text-md text-text-muted">{text}</p>}
      {actions && <div className="mt-6 flex flex-wrap gap-3">{actions}</div>}
    </div>
  );
}
