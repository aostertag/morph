import { dayNumber, type LocalDay, maxDay, minDay } from './day';
import type { Pause } from './types';

/** Pausas que afectan a un hábito: las suyas y las globales. */
export function pausesFor(habitId: string, pauses: readonly Pause[]): Pause[] {
  return pauses.filter((p) => p.habitId === null || p.habitId === habitId);
}

export function isPausedOn(day: LocalDay, pauses: readonly Pause[]): boolean {
  return pauses.some((p) => p.start <= day && day <= p.end);
}

/**
 * Días en pausa dentro de [from, to], contando una sola vez los días cubiertos
 * por varias pausas solapadas.
 */
export function pausedDaysBetween(from: LocalDay, to: LocalDay, pauses: readonly Pause[]): number {
  if (to < from) return 0;
  const ranges = pauses
    .filter((p) => p.start <= to && p.end >= from)
    .map((p) => [dayNumber(maxDay(p.start, from)), dayNumber(minDay(p.end, to))] as const)
    .sort((a, b) => a[0] - b[0]);

  let total = 0;
  let coveredUntil = Number.NEGATIVE_INFINITY;
  for (const [start, end] of ranges) {
    const effectiveStart = Math.max(start, coveredUntil + 1);
    if (end >= effectiveStart) total += end - effectiveStart + 1;
    coveredUntil = Math.max(coveredUntil, end);
  }
  return total;
}

export function validatePause(pause: Pick<Pause, 'start' | 'end'>): string | null {
  if (pause.end < pause.start) return 'La fecha de fin no puede ser anterior a la de inicio.';
  return null;
}
