import type { Weekday } from '@/domain/day';
import type { Habit } from '@/domain/types';
import { describeFrequency, formatMinutes, TIME_OF_DAY_LABEL, withUnit } from '@/lib/format';

/**
 * Resumen de una línea: "8 vasos · Todos los días · Mañana". Con `categoryName`, la
 * categoría la abre: "Salud · 8 vasos · Todos los días · Mañana". Va delante porque en
 * móvil la línea se corta por el final y la categoría es lo que no debe perderse.
 */
export function describeHabit(
  habit: Pick<Habit, 'kind' | 'target' | 'unit' | 'frequency' | 'timeOfDay'>,
  weekStartsOn: Weekday,
  categoryName?: string | null,
): string {
  const parts: string[] = categoryName ? [categoryName] : [];
  if (habit.kind === 'quantity' && habit.target !== null)
    parts.push(withUnit(habit.target, habit.unit));
  if (habit.kind === 'time' && habit.target !== null) parts.push(formatMinutes(habit.target));
  if (habit.kind === 'avoid') parts.push('A evitar');
  parts.push(describeFrequency(habit.frequency, weekStartsOn));
  if (habit.timeOfDay !== 'any') parts.push(TIME_OF_DAY_LABEL[habit.timeOfDay]);
  return parts.join(' · ');
}
