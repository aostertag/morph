import type { Weekday } from '@/domain/day';
import type { Habit } from '@/domain/types';
import { describeFrequency, formatMinutes, TIME_OF_DAY_LABEL, withUnit } from '@/lib/format';

/** Resumen de una línea: "8 vasos · Todos los días · Mañana". */
export function describeHabit(
  habit: Pick<Habit, 'kind' | 'target' | 'unit' | 'frequency' | 'timeOfDay'>,
  weekStartsOn: Weekday,
): string {
  const parts: string[] = [];
  if (habit.kind === 'quantity' && habit.target !== null)
    parts.push(withUnit(habit.target, habit.unit));
  if (habit.kind === 'time' && habit.target !== null) parts.push(formatMinutes(habit.target));
  if (habit.kind === 'avoid') parts.push('A evitar');
  parts.push(describeFrequency(habit.frequency, weekStartsOn));
  if (habit.timeOfDay !== 'any') parts.push(TIME_OF_DAY_LABEL[habit.timeOfDay]);
  return parts.join(' · ');
}
