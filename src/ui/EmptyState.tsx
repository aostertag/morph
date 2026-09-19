import type { ReactNode } from 'react';

/** Estado vacío resuelto con tipografía y un texto claro, sin ilustraciones. */
export function EmptyState({
  title,
  text,
  actions,
}: {
  title: string;
  text?: string | undefined;
  actions?: ReactNode;
}) {
  return (
    <div className="border-t border-border py-10">
      <p className="text-xl font-medium">{title}</p>
      {text && <p className="mt-2 max-w-md text-md text-text-muted">{text}</p>}
      {actions && <div className="mt-6 flex flex-wrap gap-3">{actions}</div>}
    </div>
  );
}

export function ScreenHeader({
  title,
  eyebrow,
  actions,
}: {
  title: string;
  eyebrow?: string | undefined;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="label-caps">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold">{title}</h1>
      </div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </header>
  );
}
