import { format } from 'date-fns';
import { es } from 'date-fns/locale/es';
import {
  diffDays,
  type LocalDay,
  monthOf,
  toLocalDate,
  WEEKDAYS,
  type Weekday,
  yearOf,
} from '@/domain/day';
import type { PeriodUnit } from '@/domain/frequency';
import type { DayRange, RangePreset } from '@/domain/range';
import type { Frequency, HabitKind, Scale, TimeOfDay } from '@/domain/types';

const numberFormat = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });
const percentFormat = new Intl.NumberFormat('es-ES', {
  style: 'percent',
  maximumFractionDigits: 0,
});

export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

export function formatPercent(ratio: number): string {
  return percentFormat.format(ratio);
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "Sábado" */
export function formatWeekday(day: LocalDay): string {
  return capitalize(format(toLocalDate(day), 'EEEE', { locale: es }));
}

/** "19 de septiembre", con año si no es el año de `today`. */
export function formatDate(day: LocalDay, today: LocalDay): string {
  const pattern = yearOf(day) === yearOf(today) ? "d 'de' MMMM" : "d 'de' MMMM 'de' yyyy";
  return format(toLocalDate(day), pattern, { locale: es });
}

/** "Septiembre de 2026" */
export function formatMonthYear(day: LocalDay): string {
  return capitalize(format(toLocalDate(day), "MMMM 'de' yyyy", { locale: es }));
}

/** "19 sep" */
export function formatShortDate(day: LocalDay): string {
  return format(toLocalDate(day), 'd MMM', { locale: es }).replace('.', '');
}

/** "sep" */
export function formatMonthShort(day: LocalDay): string {
  return format(toLocalDate(day), 'MMM', { locale: es }).replace('.', '');
}

/** "Hoy", "Ayer", "Hace 3 días", o la fecha corta si queda lejos. */
export function formatRelativeDay(day: LocalDay, today: LocalDay): string {
  const diff = diffDays(day, today);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  if (diff === -1) return 'Mañana';
  if (diff > 1 && diff < 7) return `Hace ${diff} días`;
  return formatShortDate(day);
}

const WEEKDAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const;
const WEEKDAY_LETTER = ['D', 'L', 'M', 'X', 'J', 'V', 'S'] as const;
const WEEKDAY_LONG = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
] as const;

export function weekdayShort(day: Weekday): string {
  return WEEKDAY_SHORT[day];
}

export function weekdayLetter(day: Weekday): string {
  return WEEKDAY_LETTER[day];
}

export function weekdayLong(day: Weekday): string {
  return WEEKDAY_LONG[day];
}

/** Días de la semana empezando por el configurado. */
export function orderedWeekdays(weekStartsOn: Weekday): Weekday[] {
  return WEEKDAYS.map((_, i) => ((weekStartsOn + i) % 7) as Weekday);
}

function joinList(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} y ${items.at(-1)}`;
}

export function describeFrequency(frequency: Frequency, weekStartsOn: Weekday = 1): string {
  switch (frequency.type) {
    case 'daily':
      return 'Todos los días';
    case 'weekdays': {
      const days = orderedWeekdays(weekStartsOn).filter((d) => frequency.days.includes(d));
      if (days.length === 7) return 'Todos los días';
      return joinList(days.map((d) => WEEKDAY_SHORT[d]));
    }
    case 'perWeek':
      return frequency.times === 1 ? '1 vez por semana' : `${frequency.times} veces por semana`;
    case 'perMonth':
      return frequency.times === 1 ? '1 vez al mes' : `${frequency.times} veces al mes`;
  }
}

export const TIME_OF_DAY_LABEL: Readonly<Record<TimeOfDay, string>> = {
  morning: 'Mañana',
  afternoon: 'Tarde',
  evening: 'Noche',
  any: 'Cualquier momento',
};

export const HABIT_KIND_LABEL: Readonly<Record<HabitKind, string>> = {
  boolean: 'Sí / no',
  quantity: 'Cantidad',
  time: 'Tiempo',
  avoid: 'A evitar',
};

export const RANGE_LABEL: Readonly<Record<RangePreset, string>> = {
  week: 'Esta semana',
  month: 'Este mes',
  quarter: 'Este trimestre',
  year: 'Este año',
  custom: 'Personalizado',
};

/** "Del 1 al 19 de septiembre", "Del 1 de julio al 19 de septiembre". */
export function describeRange(range: DayRange, today: LocalDay): string {
  if (range.from === range.to) return capitalize(formatDate(range.from, today));
  const sameMonth =
    yearOf(range.from) === yearOf(range.to) && monthOf(range.from) === monthOf(range.to);
  const start = sameMonth
    ? format(toLocalDate(range.from), 'd', { locale: es })
    : formatDate(range.from, today);
  return `Del ${start} al ${formatDate(range.to, today)}`;
}

/** Diferencia en puntos porcentuales, con signo: "+8 puntos", "-3 puntos". */
export function formatPoints(delta: number): string {
  const points = Math.round(delta * 100);
  const sign = points > 0 ? '+' : points < 0 ? '−' : '';
  return `${sign}${formatNumber(Math.abs(points))} ${Math.abs(points) === 1 ? 'punto' : 'puntos'}`;
}

/** "4,1" para medias de ánimo y energía. */
export function formatScaleValue(value: number): string {
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

export const MOOD_LABEL: Readonly<Record<Scale, string>> = {
  1: 'Muy bajo',
  2: 'Bajo',
  3: 'Normal',
  4: 'Bueno',
  5: 'Muy bueno',
};

export const ENERGY_LABEL: Readonly<Record<Scale, string>> = {
  1: 'Muy baja',
  2: 'Baja',
  3: 'Normal',
  4: 'Alta',
  5: 'Muy alta',
};

/** "12 d", "8 sem", "3 meses". */
export function formatStreak(length: number, unit: PeriodUnit): string {
  switch (unit) {
    case 'day':
      return `${formatNumber(length)} d`;
    case 'week':
      return `${formatNumber(length)} sem`;
    case 'month':
      return length === 1 ? '1 mes' : `${formatNumber(length)} meses`;
  }
}

/** "25 min", "1 h 5 min". */
export function formatMinutes(minutes: number): string {
  const total = Math.round(minutes);
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Cronómetro: "4:05", "1:02:09". */
export function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** Número con la unidad tal como la escribió el usuario: "8 vasos". */
export function withUnit(value: number, unit: string | null): string {
  if (!unit) return formatNumber(value);
  return `${formatNumber(value)} ${unit}`;
}
