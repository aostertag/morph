import type { LocalDay } from '@/domain/day';
import { dailyGoal } from '@/domain/evaluate';
import type { DayRecord } from '@/domain/history';
import type { Habit } from '@/domain/types';
import { formatDate, formatMinutes, formatWeekday, withUnit } from '@/lib/format';

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
