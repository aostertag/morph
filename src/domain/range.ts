import {
  addDays,
  addMonths,
  diffDays,
  endOfMonth,
  type LocalDay,
  minDay,
  monthOf,
  startOfMonth,
  startOfWeek,
  type Weekday,
} from './day';

/*
 * Rango de análisis de las estadísticas globales.
 *
 * Los períodos son naturales y están en curso: la semana empieza el día
 * configurado, el mes el día 1, el trimestre en enero, abril, julio u octubre, y
 * el año el 1 de enero. Todos terminan hoy.
 *
 * El período anterior se recorta al mismo número de días transcurridos: si vamos
 * por el día 12 del mes, el anterior se mide también sobre sus 12 primeros días.
 * Comparar 12 días contra 31 daría una caída que no ha ocurrido.
 */

export interface DayRange {
  readonly from: LocalDay;
  readonly to: LocalDay;
}

export type RangePreset = 'week' | 'month' | 'quarter' | 'year' | 'custom';

export const RANGE_PRESETS: readonly RangePreset[] = ['week', 'month', 'quarter', 'year', 'custom'];

export function isRangePreset(value: unknown): value is RangePreset {
  return typeof value === 'string' && RANGE_PRESETS.includes(value as RangePreset);
}

export function startOfQuarter(day: LocalDay): LocalDay {
  return startOfMonth(addMonths(day, -((monthOf(day) - 1) % 3)));
}

export function startOfYear(day: LocalDay): LocalDay {
  return startOfMonth(addMonths(day, -(monthOf(day) - 1)));
}

/** Primer día del período natural en curso. */
function periodStart(
  preset: Exclude<RangePreset, 'custom'>,
  today: LocalDay,
  weekStartsOn: Weekday,
) {
  switch (preset) {
    case 'week':
      return startOfWeek(today, weekStartsOn);
    case 'month':
      return startOfMonth(today);
    case 'quarter':
      return startOfQuarter(today);
    case 'year':
      return startOfYear(today);
  }
}

/** Último día del período natural que empieza en `start`. */
function periodEnd(preset: Exclude<RangePreset, 'custom'>, start: LocalDay): LocalDay {
  switch (preset) {
    case 'week':
      return addDays(start, 6);
    case 'month':
      return endOfMonth(start);
    case 'quarter':
      return endOfMonth(addMonths(start, 2));
    case 'year':
      return endOfMonth(addMonths(start, 11));
  }
}

function shiftBack(preset: Exclude<RangePreset, 'custom'>, start: LocalDay): LocalDay {
  switch (preset) {
    case 'week':
      return addDays(start, -7);
    case 'month':
      return addMonths(start, -1);
    case 'quarter':
      return addMonths(start, -3);
    case 'year':
      return addMonths(start, -12);
  }
}

export function rangeDays(range: DayRange): number {
  return diffDays(range.from, range.to) + 1;
}

/** Ordena las fechas y las recorta a hoy; el futuro no se analiza. */
export function clampRange(from: LocalDay, to: LocalDay, today: LocalDay): DayRange {
  const [a, b] = from <= to ? [from, to] : [to, from];
  return { from: minDay(a, today), to: minDay(b, today) };
}

export function resolveRange(
  preset: RangePreset,
  today: LocalDay,
  weekStartsOn: Weekday,
  custom?: DayRange | null,
): DayRange {
  if (preset === 'custom') {
    return custom ? clampRange(custom.from, custom.to, today) : { from: today, to: today };
  }
  return { from: periodStart(preset, today, weekStartsOn), to: today };
}

/**
 * El mismo período inmediatamente anterior, con tantos días como lleva el actual.
 * Nunca se sale del período anterior: en meses de distinta longitud se recorta.
 */
export function previousRange(range: DayRange, preset: RangePreset): DayRange {
  const length = rangeDays(range);
  if (preset === 'custom') {
    const to = addDays(range.from, -1);
    return { from: addDays(to, -(length - 1)), to };
  }
  const from = shiftBack(preset, range.from);
  return { from, to: minDay(addDays(from, length - 1), periodEnd(preset, from)) };
}

export function inRange(day: LocalDay, range: DayRange): boolean {
  return day >= range.from && day <= range.to;
}
