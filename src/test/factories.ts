import { addDays, eachDay, type LocalDay, localDay } from '@/domain/day';
import type { Entry, Habit, Pause } from '@/domain/types';

export const d = localDay;

export function habit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'h1',
    name: 'Leer',
    description: '',
    color: 'azul',
    icon: null,
    categoryId: null,
    kind: 'boolean',
    target: null,
    unit: null,
    frequency: { type: 'daily' },
    timeOfDay: 'any',
    reminder: null,
    createdOn: d('2026-01-01'),
    archivedOn: null,
    order: 0,
    ...overrides,
  };
}

let entryCounter = 0;

export function entry(date: string, value = 1, habitId = 'h1'): Entry {
  entryCounter++;
  return {
    id: `e${entryCounter}`,
    habitId,
    date: d(date),
    value,
    note: null,
    loggedAt: 0,
  };
}

/** Un registro por cada día indicado. */
export function entriesOn(days: readonly string[], value = 1, habitId = 'h1'): Entry[] {
  return days.map((day) => entry(day, value, habitId));
}

export function pause(start: string, end: string, habitId: string | null = null): Pause {
  return {
    id: `p-${start}-${end}-${habitId ?? 'global'}`,
    habitId,
    start: d(start),
    end: d(end),
    reason: 'vacaciones',
    note: null,
  };
}

/** `count` días consecutivos empezando en `from`. */
export function days(from: string, count: number): LocalDay[] {
  const start = d(from);
  return eachDay(start, addDays(start, count - 1));
}
