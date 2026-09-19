import { diffDays, type LocalDay } from '@/domain/day';
import type { HabitDayView } from '@/domain/today';
import {
  formatDate,
  formatRelativeDay,
  formatShortDate,
  formatStreak,
  withUnit,
} from '@/lib/format';

function wildcardText(view: HabitDayView, today: LocalDay): string | null {
  const use = view.lastWildcardInStreak;
  if (!use) return null;
  if (view.unit === 'day') {
    const diff = diffDays(use.start, today);
    const when =
      diff < 7
        ? formatRelativeDay(use.start, today).toLowerCase()
        : `el ${formatShortDate(use.start)}`;
    return `comodín usado ${when}`;
  }
  if (view.unit === 'week') return `comodín usado la semana del ${formatShortDate(use.start)}`;
  return `comodín usado en ${formatDate(use.start, today).replace(/^1 de /, '')}`;
}

/**
 * Línea de contexto bajo el nombre del hábito en la pantalla Hoy:
 * "Racha 12 d · comodín usado ayer", "2 de 3 esta semana · Racha 4 sem"…
 */
export function describeRowContext(view: HabitDayView, today: LocalDay): string {
  if (view.paused) return 'En pausa';
  const parts: string[] = [];
  const { streak, habit } = view;

  if (view.period) {
    const current = view.period.end >= today;
    const span =
      view.unit === 'week'
        ? current
          ? 'esta semana'
          : 'esa semana'
        : current
          ? 'este mes'
          : 'ese mes';
    parts.push(`${view.period.achieved} de ${view.period.required} ${span}`);
  }

  if (habit.kind === 'avoid') {
    parts.push(
      streak.current > 0 ? `${formatStreak(streak.current, 'day')} sin recaer` : 'Sin racha limpia',
    );
  } else if (streak.current > 0) {
    parts.push(`Racha ${formatStreak(streak.current, view.unit)}`);
  } else if (!view.period) {
    parts.push(
      streak.best > 0 ? `Mejor racha ${formatStreak(streak.best, view.unit)}` : 'Sin racha',
    );
  }

  const wildcard = wildcardText(view, today);
  if (wildcard) parts.push(wildcard);

  if (habit.kind === 'quantity' && habit.target !== null && view.value > habit.target) {
    parts.push(`${withUnit(view.value, habit.unit)} registrados`);
  }

  const text = parts.join(' · ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
