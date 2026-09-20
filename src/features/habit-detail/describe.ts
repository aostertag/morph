import type { LocalDay } from '@/domain/day';
import { dailyGoal } from '@/domain/evaluate';
import type { PeriodUnit } from '@/domain/frequency';
import type { DayRecord } from '@/domain/history';
import type { Milestone } from '@/domain/milestones';
import type { Habit, HabitKind } from '@/domain/types';
import { formatDate, formatMinutes, formatNumber, formatWeekday, withUnit } from '@/lib/format';

/** Qué pasó ese día: "6 de 8 vasos", "Hecho", "En pausa"… */
export function describeDayValue(habit: Habit, record: DayRecord | null): string {
  if (!record) return 'sin datos';
  if (record.paused) return 'en pausa';
  if (!record.scheduled) return 'no toca';
  switch (habit.kind) {
    case 'avoid':
      if (record.value <= 0) return 'limpio';
      return record.value === 1 ? '1 recaída' : `${record.value} recaídas`;
    case 'boolean':
      return record.value > 0 ? 'hecho' : 'sin hacer';
    case 'time': {
      const goal = dailyGoal(habit);
      return `${formatMinutes(record.value)} de ${formatMinutes(goal)}`;
    }
    case 'quantity':
      return `${withUnit(record.value, null)} de ${withUnit(dailyGoal(habit), habit.unit)}`;
  }
}

/** Texto completo de una celda del heatmap, para el lector de pantalla y el tooltip. */
export function describeDay(
  habit: Habit,
  record: DayRecord | null,
  day: LocalDay,
  today: LocalDay,
): string {
  const when = `${formatWeekday(day)} ${formatDate(day, today)}`;
  const state = describeDayValue(habit, record);
  const extra =
    record?.wildcard && !record.success && habit.kind !== 'avoid'
      ? ', cubierto por un comodín'
      : '';
  return `${when}: ${state}${extra}`;
}

/** "días", "semanas" o "meses" según la unidad en la que se evalúa el hábito. */
const UNIT_PLURAL: Readonly<Record<PeriodUnit, string>> = {
  day: 'días',
  week: 'semanas',
  month: 'meses',
};

/**
 * Nombre de un hito: "Primera semana completa", "30 días cumplidos",
 * "100 registros", "30 días sin recaer".
 */
export function describeMilestone(milestone: Milestone, unit: PeriodUnit, kind: HabitKind): string {
  const count = formatNumber(milestone.threshold);
  const plural = UNIT_PLURAL[unit];

  switch (milestone.kind) {
    case 'streak':
      if (kind === 'avoid') return `${count} ${plural} seguidos sin recaer`;
      // Siete días seguidos son justo eso: la primera semana entera.
      if (unit === 'day' && milestone.threshold === 7) return 'Primera semana completa';
      return `Racha de ${count} ${plural}`;
    case 'completed':
      if (kind === 'avoid') return `${count} ${plural} limpios`;
      if (milestone.threshold === 1) return 'Primer día cumplido';
      return `${count} ${plural} cumplidos`;
    case 'logged':
      return milestone.threshold === 1 ? 'Primer registro' : `${count} registros`;
  }
}
