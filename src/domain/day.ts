/**
 * Días locales.
 *
 * Un día se representa siempre como `LocalDay` ('YYYY-MM-DD'): la fecha civil del
 * usuario, sin hora ni zona. Toda la aritmética se hace sobre un número de día
 * absoluto calculado con UTC de esa fecha civil, así que los cambios de horario
 * (días de 23 o 25 horas, medianoches que no existen) no pueden desplazar un día.
 *
 * `Date` solo se usa en los bordes: para leer "qué día es ahora" en la zona local
 * y para formatear.
 */

declare const localDayBrand: unique symbol;
export type LocalDay = string & { readonly [localDayBrand]: true };

/** 0 = domingo … 6 = sábado (mismo convenio que `Date#getDay`). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const WEEKDAYS: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6];

const MS_PER_DAY = 86_400_000;
const LOCAL_DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0');
}

function fromParts(year: number, month: number, day: number): LocalDay {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}` as LocalDay;
}

function parts(day: LocalDay): [year: number, month: number, day: number] {
  const match = LOCAL_DAY_RE.exec(day);
  if (!match) throw new RangeError(`Día local no válido: ${day}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function isLocalDay(value: unknown): value is LocalDay {
  if (typeof value !== 'string') return false;
  const match = LOCAL_DAY_RE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  return day <= daysInMonthOf(year, month);
}

/** Convierte y valida; lanza si el texto no es una fecha civil real. */
export function localDay(value: string): LocalDay {
  if (!isLocalDay(value)) throw new RangeError(`Día local no válido: ${value}`);
  return value;
}

/** Día local (zona del sistema) al que pertenece un instante. */
export function toLocalDay(instant: Date | number): LocalDay {
  const date = typeof instant === 'number' ? new Date(instant) : instant;
  return fromParts(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/** Medianoche local de un día, para formatear con date-fns. No usar para aritmética. */
export function toLocalDate(day: LocalDay): Date {
  const [y, m, d] = parts(day);
  return new Date(y, m - 1, d);
}

/** Número de día absoluto (días desde 1970-01-01 en el calendario civil). */
export function dayNumber(day: LocalDay): number {
  const [y, m, d] = parts(day);
  return Math.round(Date.UTC(y, m - 1, d) / MS_PER_DAY);
}

export function fromDayNumber(n: number): LocalDay {
  const date = new Date(n * MS_PER_DAY);
  return fromParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function addDays(day: LocalDay, amount: number): LocalDay {
  return fromDayNumber(dayNumber(day) + amount);
}

/** Días de `from` a `to` (positivo si `to` es posterior). */
export function diffDays(from: LocalDay, to: LocalDay): number {
  return dayNumber(to) - dayNumber(from);
}

export function weekdayOf(day: LocalDay): Weekday {
  // 1970-01-01 fue jueves (4).
  return ((((dayNumber(day) + 4) % 7) + 7) % 7) as Weekday;
}

export function startOfWeek(day: LocalDay, weekStartsOn: Weekday): LocalDay {
  const offset = (weekdayOf(day) - weekStartsOn + 7) % 7;
  return addDays(day, -offset);
}

export function endOfWeek(day: LocalDay, weekStartsOn: Weekday): LocalDay {
  return addDays(startOfWeek(day, weekStartsOn), 6);
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonthOf(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function daysInMonth(day: LocalDay): number {
  const [y, m] = parts(day);
  return daysInMonthOf(y, m);
}

export function startOfMonth(day: LocalDay): LocalDay {
  const [y, m] = parts(day);
  return fromParts(y, m, 1);
}

export function endOfMonth(day: LocalDay): LocalDay {
  const [y, m] = parts(day);
  return fromParts(y, m, daysInMonthOf(y, m));
}

export function addMonths(day: LocalDay, amount: number): LocalDay {
  const [y, m, d] = parts(day);
  const index = y * 12 + (m - 1) + amount;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return fromParts(year, month, Math.min(d, daysInMonthOf(year, month)));
}

export function yearOf(day: LocalDay): number {
  return parts(day)[0];
}

export function minDay(a: LocalDay, b: LocalDay): LocalDay {
  return a <= b ? a : b;
}

export function maxDay(a: LocalDay, b: LocalDay): LocalDay {
  return a >= b ? a : b;
}

/** Días de `from` a `to`, ambos incluidos. Vacío si `to < from`. */
export function eachDay(from: LocalDay, to: LocalDay): LocalDay[] {
  const start = dayNumber(from);
  const end = dayNumber(to);
  const days: LocalDay[] = [];
  for (let n = start; n <= end; n++) days.push(fromDayNumber(n));
  return days;
}
