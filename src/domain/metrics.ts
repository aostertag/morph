import {
  addDays,
  addMonths,
  diffDays,
  endOfMonth,
  type LocalDay,
  maxDay,
  minDay,
  startOfMonth,
  startOfWeek,
  WEEKDAYS,
  type Weekday,
  weekdayOf,
} from './day';
import type { EvaluatedUnit } from './evaluate';
import type { DayRecord, HabitHistory } from './history';
import type { WildcardUse } from './streaks';
import type { Entry, Pause, PauseReason } from './types';

/*
 * Métricas del detalle de un hábito. Todas se derivan de la historia día a día.
 *
 * Tasa de cumplimiento: cada día del rango hereda el resultado de su unidad
 * (1 si se cumplió; hechas/requeridas si se falló). Así una ventana de 7 días
 * funciona igual en hábitos diarios, semanales o mensuales. No cuentan los días
 * en pausa, los que no tocan ni los de una unidad todavía abierta y sin cumplir.
 * Los comodines protegen la racha, pero no la tasa: una unidad cubierta sigue fallada.
 */

export interface Rate {
  /** 0–1; `null` si no hay ningún día evaluable en el rango. */
  readonly ratio: number | null;
  /** Días evaluables en el rango. */
  readonly days: number;
  /** Días evaluables cuya unidad se cumplió. */
  readonly doneDays: number;
  /** Unidades distintas (días, semanas o meses) que tocan el rango. */
  readonly units: number;
  /** De esas, cumplidas. */
  readonly doneUnits: number;
}

/** Crédito del día según su unidad, o `null` si el día no se evalúa. */
function dayCredit(record: DayRecord): number | null {
  const { unit } = record;
  if (!unit || record.paused) return null;
  if (unit.status === 'done') return 1;
  if (unit.status !== 'missed') return null;
  return unit.required > 0 ? Math.min(unit.achieved / unit.required, 1) : 0;
}

export function completionRate(history: HabitHistory, from: LocalDay, to: LocalDay): Rate {
  let credit = 0;
  let days = 0;
  let doneDays = 0;
  const units = new Set<EvaluatedUnit>();
  const doneUnits = new Set<EvaluatedUnit>();
  for (const record of history.days) {
    if (record.day < from) continue;
    if (record.day > to) break;
    const c = dayCredit(record);
    if (c === null || !record.unit) continue;
    credit += c;
    days++;
    units.add(record.unit);
    if (record.unit.status === 'done') {
      doneDays++;
      doneUnits.add(record.unit);
    }
  }
  return {
    ratio: days === 0 ? null : credit / days,
    days,
    doneDays,
    units: units.size,
    doneUnits: doneUnits.size,
  };
}

export type RateWindow = 7 | 30 | 90 | 'total';
export const RATE_WINDOWS: readonly RateWindow[] = [7, 30, 90, 'total'];

/** Tasas de los últimos 7, 30 y 90 días y de toda la historia. */
export function rateWindows(history: HabitHistory): Record<RateWindow, Rate> {
  const { today } = history;
  const start = history.habit.createdOn;
  return {
    7: completionRate(history, addDays(today, -6), today),
    30: completionRate(history, addDays(today, -29), today),
    90: completionRate(history, addDays(today, -89), today),
    total: completionRate(history, start, today),
  };
}

export type Bucket = 'week' | 'month';

export interface RatePoint {
  readonly start: LocalDay;
  readonly end: LocalDay;
  readonly rate: Rate;
  /** Contiene hoy: el período sigue abierto. */
  readonly current: boolean;
}

/**
 * Tasa por semana o mes, las `count` últimas hasta la que contiene hoy.
 * Los períodos anteriores a la creación del hábito salen con `ratio: null`.
 */
export function rateSeries(
  history: HabitHistory,
  bucket: Bucket,
  count: number,
  weekStartsOn: Weekday,
): RatePoint[] {
  const { today } = history;
  const points: RatePoint[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const start =
      bucket === 'week'
        ? addDays(startOfWeek(today, weekStartsOn), -7 * i)
        : startOfMonth(addMonths(today, -i));
    const end = bucket === 'week' ? addDays(start, 6) : endOfMonth(start);
    points.push({
      start,
      end,
      rate: completionRate(history, start, minDay(end, today)),
      current: start <= today && today <= end,
    });
  }
  return points;
}

/** Semanas o meses para la evolución: los mensuales no tienen sentido por semanas. */
export function seriesBucket(history: HabitHistory): Bucket {
  return history.unit === 'month' ? 'month' : 'week';
}

export interface WeekdayStat {
  readonly weekday: Weekday;
  /** Días cumplidos; en "a evitar", días con recaída. */
  readonly hits: number;
  /** Días evaluables de ese día de la semana. */
  readonly total: number;
  readonly ratio: number | null;
}

/**
 * Rendimiento por día de la semana: qué parte de los lunes (martes…) se cumplió.
 * En "a evitar" cuenta los días con recaída. Hoy solo cuenta si ya está decidido.
 */
export function weekdayStats(history: HabitHistory): WeekdayStat[] {
  const avoid = history.habit.kind === 'avoid';
  const hits = new Map<Weekday, number>(WEEKDAYS.map((w) => [w, 0]));
  const totals = new Map<Weekday, number>(WEEKDAYS.map((w) => [w, 0]));
  for (const r of history.days) {
    if (!r.scheduled || r.paused) continue;
    const hit = avoid ? r.value > 0 : r.success;
    if (r.day === history.today && !hit) continue;
    const w = weekdayOf(r.day);
    totals.set(w, (totals.get(w) ?? 0) + 1);
    if (hit) hits.set(w, (hits.get(w) ?? 0) + 1);
  }
  return WEEKDAYS.map((weekday) => {
    const total = totals.get(weekday) ?? 0;
    const h = hits.get(weekday) ?? 0;
    return { weekday, hits: h, total, ratio: total === 0 ? null : h / total };
  });
}

export interface Totals {
  /** Días con la meta diaria cumplida (en "a evitar", días limpios ya cerrados). */
  readonly completedDays: number;
  /** Unidades cumplidas (días, semanas o meses). */
  readonly completedUnits: number;
  /** Días con algún registro. */
  readonly loggedDays: number;
}

export function totals(history: HabitHistory): Totals {
  const avoid = history.habit.kind === 'avoid';
  let completedDays = 0;
  let loggedDays = 0;
  for (const r of history.days) {
    if (r.value > 0) loggedDays++;
    if (avoid) {
      if (r.unit?.status === 'done') completedDays++;
    } else if (r.success) completedDays++;
  }
  return {
    completedDays,
    completedUnits: history.units.filter((u) => u.status === 'done').length,
    loggedDays,
  };
}

export interface ValueStats {
  /** Días con registro. */
  readonly loggedDays: number;
  /** Media en los días con registro; `null` si no hay ninguno. */
  readonly average: number | null;
  /** Máximo y el último día en que se alcanzó. */
  readonly max: { readonly value: number; readonly day: LocalDay } | null;
  readonly total: number;
  readonly trend: Trend | null;
}

export interface Trend {
  /** Media diaria de los últimos 30 días cerrados (sin contar hoy). */
  readonly recent: number;
  /** Media diaria de los 30 anteriores. */
  readonly previous: number;
  readonly delta: number;
}

/** Días mínimos evaluables en cada ventana para mostrar una tendencia. */
export const TREND_MIN_DAYS = 7;
const TREND_WINDOW = 30;

/** Días que cuentan para medias diarias: tocan y no están en pausa. */
function averageable(r: DayRecord): boolean {
  return r.scheduled && !r.paused;
}

function meanValue(history: HabitHistory, from: LocalDay, to: LocalDay): number | null {
  let sum = 0;
  let n = 0;
  for (const r of history.days) {
    if (r.day < from) continue;
    if (r.day > to) break;
    if (!averageable(r)) continue;
    sum += r.value;
    n++;
  }
  return n < TREND_MIN_DAYS ? null : sum / n;
}

/** Media, máximo, total y tendencia para hábitos de cantidad y tiempo. */
export function valueStats(history: HabitHistory): ValueStats {
  let loggedDays = 0;
  let total = 0;
  let max: ValueStats['max'] = null;
  for (const r of history.days) {
    if (r.value <= 0) continue;
    loggedDays++;
    total += r.value;
    if (max === null || r.value >= max.value) max = { value: r.value, day: r.day };
  }

  const yesterday = addDays(history.today, -1);
  const recent = meanValue(history, addDays(yesterday, -(TREND_WINDOW - 1)), yesterday);
  const previousEnd = addDays(yesterday, -TREND_WINDOW);
  const previous = meanValue(history, addDays(previousEnd, -(TREND_WINDOW - 1)), previousEnd);

  return {
    loggedDays,
    average: loggedDays === 0 ? null : total / loggedDays,
    max,
    total,
    trend:
      recent === null || previous === null ? null : { recent, previous, delta: recent - previous },
  };
}

export interface ValuePoint {
  readonly day: LocalDay;
  /** `null` en días que no tocan o en pausa. */
  readonly value: number | null;
  /** Media de los 7 últimos días evaluables; `null` hasta tener 7. */
  readonly average: number | null;
}

/** Valores diarios de los últimos `count` días con su media móvil de 7 días evaluables. */
export function valueSeries(history: HabitHistory, count: number): ValuePoint[] {
  const from = addDays(history.today, -(count - 1));
  const window: number[] = [];
  const points: ValuePoint[] = [];
  for (const r of history.days) {
    const counts = averageable(r);
    if (counts) {
      window.push(r.value);
      if (window.length > 7) window.shift();
    }
    if (r.day < from) continue;
    points.push({
      day: r.day,
      value: counts ? r.value : null,
      average: window.length === 7 ? window.reduce((a, b) => a + b, 0) / 7 : null,
    });
  }
  return points;
}

export interface AvoidStats {
  /** Días limpios ya cerrados (hoy no cuenta hasta terminar). */
  readonly cleanDays: number;
  /** Recaídas registradas en total (la suma de valores). */
  readonly relapses: number;
  readonly relapseDays: number;
  /** Recaídas en los últimos 30 días, hoy incluido. */
  readonly relapsesLast30: number;
  readonly lastRelapse: LocalDay | null;
  /** Días desde la última recaída (0 si fue hoy). */
  readonly daysSinceLastRelapse: number | null;
  /** Media de días entre recaídas consecutivas; `null` con menos de dos. */
  readonly averageGap: number | null;
}

export function avoidStats(history: HabitHistory): AvoidStats {
  const from30 = addDays(history.today, -29);
  let cleanDays = 0;
  let relapses = 0;
  let relapsesLast30 = 0;
  const relapseDays: LocalDay[] = [];
  for (const r of history.days) {
    if (r.unit?.status === 'done') cleanDays++;
    if (r.value <= 0) continue;
    relapses += r.value;
    relapseDays.push(r.day);
    if (r.day >= from30) relapsesLast30 += r.value;
  }
  const last = relapseDays.at(-1) ?? null;
  const first = relapseDays[0];
  return {
    cleanDays,
    relapses,
    relapseDays: relapseDays.length,
    relapsesLast30,
    lastRelapse: last,
    daysSinceLastRelapse: last === null ? null : diffDays(last, history.today),
    averageGap:
      relapseDays.length < 2 || first === undefined || last === null
        ? null
        : diffDays(first, last) / (relapseDays.length - 1),
  };
}

export type HistoryItem =
  | {
      readonly type: 'note';
      readonly day: LocalDay;
      readonly value: number;
      readonly note: string;
    }
  | { readonly type: 'wildcard'; readonly day: LocalDay; readonly end: LocalDay }
  | {
      readonly type: 'pause';
      readonly day: LocalDay;
      readonly end: LocalDay;
      readonly reason: PauseReason;
      readonly note: string | null;
      /** Pausa de todos los hábitos. */
      readonly global: boolean;
    };

/**
 * Notas, comodines usados y pausas del hábito, del más reciente al más antiguo.
 * Solo entra lo que cae dentro de la vida del hábito.
 */
export function historyFeed(
  history: HabitHistory,
  entries: readonly Entry[],
  wildcardUses: readonly WildcardUse[],
  pauses: readonly Pause[],
): HistoryItem[] {
  const first = history.days[0]?.day;
  const last = history.days.at(-1)?.day;
  if (first === undefined || last === undefined) return [];

  const items: HistoryItem[] = [];
  for (const e of entries) {
    const note = e.note?.trim();
    if (e.habitId === history.habit.id && note && e.date >= first && e.date <= last) {
      items.push({ type: 'note', day: e.date, value: e.value, note });
    }
  }
  for (const w of wildcardUses) items.push({ type: 'wildcard', day: w.start, end: w.end });
  for (const p of pauses) {
    const applies = p.habitId === null || p.habitId === history.habit.id;
    if (!applies || p.end < first || p.start > last) continue;
    items.push({
      type: 'pause',
      day: maxDay(p.start, first),
      end: minDay(p.end, last),
      reason: p.reason,
      note: p.note,
      global: p.habitId === null,
    });
  }
  // Más reciente primero; a igual fecha, notas antes que comodines y pausas.
  const order = { note: 0, wildcard: 1, pause: 2 } as const;
  return items.sort((a, b) =>
    a.day === b.day ? order[a.type] - order[b.type] : a.day < b.day ? 1 : -1,
  );
}
