import type { ReactNode } from 'react';
import type { HabitColor } from '@/domain/types';
import { cx } from '@/lib/cx';
import { HABIT_ICONS } from './icons';

export function habitColorVar(color: HabitColor): string {
  return `var(--color-habit-${color})`;
}

export const HABIT_COLOR_LABEL: Readonly<Record<HabitColor, string>> = {
  rojo: 'Rojo',
  naranja: 'Naranja',
  ocre: 'Ocre',
  oliva: 'Oliva',
  verde: 'Verde',
  turquesa: 'Turquesa',
  azul: 'Azul',
  violeta: 'Violeta',
  magenta: 'Magenta',
  grafito: 'Grafito',
  marino: 'Marino',
  ciruela: 'Ciruela',
  petroleo: 'Petróleo',
};

/** Barra vertical de 3px con el color del hábito; sin color (`null`) es un gris neutro. */
export function ColorBar({ color, className }: { color: HabitColor | null; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx('w-0.75 shrink-0 self-stretch', className)}
      style={{ backgroundColor: color ? habitColorVar(color) : 'var(--color-border-strong)' }}
    />
  );
}

export function HabitIcon({
  name,
  size = 16,
  className,
}: {
  name: string | null;
  size?: number;
  className?: string;
}) {
  const entry = name ? HABIT_ICONS[name] : undefined;
  if (!entry) return null;
  const Icon = entry.icon;
  return (
    <Icon size={size} aria-hidden="true" className={cx('shrink-0 text-text-muted', className)} />
  );
}

/** Columna del icono entre la barra de color y el texto; se reserva aunque no haya icono. */
export function HabitIconSlot({
  name = null,
  children,
}: {
  name?: string | null;
  /** Otro icono en la misma columna (p. ej. el «+» de crear uno propio). */
  children?: ReactNode;
}) {
  return (
    <span className="flex w-4 shrink-0 items-center self-center">
      {children ?? <HabitIcon name={name} />}
    </span>
  );
}
