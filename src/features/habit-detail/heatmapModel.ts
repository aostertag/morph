import {
  addDays,
  eachDay,
  endOfWeek,
  type LocalDay,
  localDay,
  maxDay,
  minDay,
  startOfWeek,
  type Weekday,
  weekdayOf,
  yearOf,
} from '@/domain/day';
import {
  type DayRecord,
  type HabitHistory,
  heatLevel,
  recordOn,
  relapseLevel,
} from '@/domain/history';

/*
 * Maquetación del heatmap: una columna por semana y una fila por día de la semana.
 * Todo el cálculo vive aquí, separado del pintado, para poder probarlo.
 */

export type CellKind =
  /** Posterior a hoy o al último día del hábito, o relleno de la rejilla. */
  | 'outside'
  /** Anterior a la creación del hábito: se dibuja como un hueco tenue, sin interacción. */
  | 'before'
  /** No toca ese día según la frecuencia. */
  | 'offSchedule'
  | 'paused'
  /** Día evaluable: `level` es la intensidad (0–4). */
  | 'level'
  /** Recaída en un hábito a evitar: `level` es 1–3. */
  | 'relapse';

export interface HeatCell {
  readonly day: LocalDay;
  readonly kind: CellKind;
  readonly level: number;
  /** La unidad de este día la cubrió un comodín. */
  readonly wildcard: boolean;
  readonly today: boolean;
  readonly record: DayRecord | null;
}

export interface HeatWeek {
  readonly start: LocalDay;
  /** Siete celdas, de arriba abajo, empezando por el primer día de la semana. */
  readonly cells: readonly HeatCell[];
}

export interface MonthLabel {
  /** Columna en la que empieza el mes. */
  readonly week: number;
  readonly label: string;
}

export interface HeatmapModel {
  readonly weeks: readonly HeatWeek[];
  readonly weekdays: readonly Weekday[];
  readonly months: readonly MonthLabel[];
  /** Primer y último día por los que se puede navegar. */
  readonly first: LocalDay;
  readonly last: LocalDay;
}

export interface HeatRange {
  readonly from: LocalDay;
  readonly to: LocalDay;
}

const MONTHS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
] as const;

/** Últimas 53 semanas hasta hoy. */
export function rollingRange(today: LocalDay, weekStartsOn: Weekday): HeatRange {
  return { from: addDays(startOfWeek(today, weekStartsOn), -52 * 7), to: today };
}

/** Año natural, sin pasar de hoy. */
export function yearRange(year: number, today: LocalDay): HeatRange {
  return {
    from: localDay(`${year}-01-01`),
    to: minDay(localDay(`${year}-12-31`), today),
  };
}

/** Años con historia, del más reciente al más antiguo. */
export function availableYears(history: HabitHistory): number[] {
  const first = history.days[0];
  if (!first) return [];
  const years: number[] = [];
  for (let y = yearOf(history.today); y >= yearOf(first.day); y--) years.push(y);
  return years;
}

function cellFor(history: HabitHistory, day: LocalDay): HeatCell {
  const record = recordOn(history, day);
  const today = day === history.today;
  if (!record || day > history.today) {
    const before = day < (history.days[0]?.day ?? day) && day <= history.today;
    const kind = before ? 'before' : 'outside';
    return { day, kind, level: 0, wildcard: false, today, record: null };
  }
  const base = { day, wildcard: record.wildcard, today, record };
  if (record.paused) return { ...base, kind: 'paused', level: 0 };
  if (!record.scheduled) return { ...base, kind: 'offSchedule', level: 0 };
  if (history.habit.kind === 'avoid') {
    const level = relapseLevel(record.value);
    return { ...base, kind: level === 0 ? 'level' : 'relapse', level };
  }
  return { ...base, kind: 'level', level: heatLevel(history.habit, record.value) };
}

export function buildHeatmap(
  history: HabitHistory,
  range: HeatRange,
  weekStartsOn: Weekday,
): HeatmapModel {
  const gridStart = startOfWeek(range.from, weekStartsOn);
  const gridEnd = endOfWeek(range.to, weekStartsOn);
  const weeks: HeatWeek[] = [];
  const months: MonthLabel[] = [];
  let month = -1;

  for (let start = gridStart; start <= gridEnd; start = addDays(start, 7)) {
    const cells = eachDay(start, addDays(start, 6)).map((day) => cellFor(history, day));
    // La etiqueta del mes va en la primera columna cuyo primer día ya pertenece a él.
    const monthOf = Number(start.slice(5, 7)) - 1;
    if (monthOf !== month) {
      month = monthOf;
      months.push({ week: weeks.length, label: MONTHS[monthOf] ?? '' });
    }
    weeks.push({ start, cells });
  }

  // Se navega por los días del hábito que caen en el rango; si no hay ninguno,
  // por el rango entero hasta hoy.
  const from = maxDay(history.days[0]?.day ?? range.from, gridStart);
  const to = minDay(history.days.at(-1)?.day ?? range.to, gridEnd);
  const empty = from > to;

  return {
    weeks,
    weekdays: Array.from({ length: 7 }, (_, i) => ((weekStartsOn + i) % 7) as Weekday),
    months,
    first: empty ? gridStart : from,
    last: empty ? maxDay(gridStart, minDay(gridEnd, history.today)) : to,
  };
}

/** Día al que lleva una tecla de flecha, dentro de los límites navegables. */
export function moveWithin(model: HeatmapModel, day: LocalDay, delta: number): LocalDay {
  return minDay(maxDay(addDays(day, delta), model.first), model.last);
}

/** Día de la semana de un día, útil para situar el foco en la rejilla. */
export function rowOf(model: HeatmapModel, day: LocalDay): number {
  return model.weekdays.indexOf(weekdayOf(day));
}

export interface MonthSummary {
  readonly start: LocalDay;
  /** Días cumplidos; en "a evitar", días con recaída. */
  readonly hits: number;
  /** Días evaluables del mes. */
  readonly scheduled: number;
  /** Suma de valores del mes (para cantidad y tiempo). */
  readonly value: number;
}

/** Resumen por meses del rango: la alternativa en tabla del heatmap. */
export function monthSummaries(history: HabitHistory, range: HeatRange): MonthSummary[] {
  const avoid = history.habit.kind === 'avoid';
  const months = new Map<string, { hits: number; scheduled: number; value: number }>();
  for (const record of history.days) {
    if (record.day < range.from || record.day > range.to) continue;
    const key = record.day.slice(0, 7);
    const row = months.get(key) ?? { hits: 0, scheduled: 0, value: 0 };
    if (record.scheduled && !record.paused) row.scheduled++;
    if (avoid ? record.value > 0 : record.success) row.hits++;
    row.value += record.value;
    months.set(key, row);
  }
  return [...months].map(([key, row]) => ({ start: localDay(`${key}-01`), ...row }));
}
