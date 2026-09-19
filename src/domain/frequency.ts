import {
  addDays,
  addMonths,
  daysInMonth,
  endOfMonth,
  endOfWeek,
  type LocalDay,
  startOfMonth,
  startOfWeek,
  type Weekday,
  weekdayOf,
} from './day';
import type { Frequency, HabitKind } from './types';

/** Unidad en la que se evalúa el hábito y se cuentan sus rachas. */
export type PeriodUnit = 'day' | 'week' | 'month';

export interface Period {
  readonly start: LocalDay;
  readonly end: LocalDay;
}

export function periodUnit(frequency: Frequency): PeriodUnit {
  switch (frequency.type) {
    case 'daily':
    case 'weekdays':
      return 'day';
    case 'perWeek':
      return 'week';
    case 'perMonth':
      return 'month';
  }
}

/**
 * ¿Se puede (o se debe) hacer el hábito este día?
 * En frecuencias por período cualquier día vale, así que siempre es `true`.
 */
export function isScheduledOn(frequency: Frequency, day: LocalDay): boolean {
  if (frequency.type === 'weekdays') return frequency.days.includes(weekdayOf(day));
  return true;
}

export function periodContaining(
  frequency: Frequency,
  day: LocalDay,
  weekStartsOn: Weekday,
): Period {
  switch (periodUnit(frequency)) {
    case 'day':
      return { start: day, end: day };
    case 'week':
      return { start: startOfWeek(day, weekStartsOn), end: endOfWeek(day, weekStartsOn) };
    case 'month':
      return { start: startOfMonth(day), end: endOfMonth(day) };
  }
}

export function nextPeriod(frequency: Frequency, period: Period, weekStartsOn: Weekday): Period {
  if (periodUnit(frequency) === 'month') {
    return periodContaining(frequency, addMonths(period.start, 1), weekStartsOn);
  }
  return periodContaining(frequency, addDays(period.end, 1), weekStartsOn);
}

/** Longitud nominal del período en días (7 en semanas, 28–31 en meses). */
export function periodLength(frequency: Frequency, period: Period): number {
  switch (periodUnit(frequency)) {
    case 'day':
      return 1;
    case 'week':
      return 7;
    case 'month':
      return daysInMonth(period.start);
  }
}

/** Veces que hay que cumplir en un período completo. */
export function timesPerPeriod(frequency: Frequency): number {
  return frequency.type === 'perWeek' || frequency.type === 'perMonth' ? frequency.times : 1;
}

/**
 * Meta de un período cuando solo `eligibleDays` de sus días cuentan
 * (hábito creado a mitad de período, días en pausa, archivado).
 * Se prorratea redondeando hacia arriba y nunca supera los días disponibles.
 */
export function proratedRequirement(
  times: number,
  eligibleDays: number,
  totalDays: number,
): number {
  if (eligibleDays <= 0) return 0;
  if (eligibleDays >= totalDays) return times;
  return Math.min(eligibleDays, Math.ceil((times * eligibleDays) / totalDays));
}

/** Devuelve un mensaje de error en español, o `null` si la frecuencia es válida. */
export function validateFrequency(frequency: Frequency, kind: HabitKind): string | null {
  switch (frequency.type) {
    case 'daily':
      return null;
    case 'weekdays': {
      const unique = new Set(frequency.days);
      if (unique.size === 0) return 'Elige al menos un día de la semana.';
      if (unique.size !== frequency.days.length) return 'Hay días repetidos.';
      if (frequency.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
        return 'Día de la semana no válido.';
      }
      return null;
    }
    case 'perWeek':
    case 'perMonth': {
      if (kind === 'avoid') {
        return 'Los hábitos a evitar se evalúan por día: usa frecuencia diaria o días concretos.';
      }
      const max = frequency.type === 'perWeek' ? 7 : 28;
      if (!Number.isInteger(frequency.times) || frequency.times < 1 || frequency.times > max) {
        return `Las veces deben estar entre 1 y ${max}.`;
      }
      return null;
    }
  }
}
