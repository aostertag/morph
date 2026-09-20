import {
  addDays,
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
import type { HabitHistory } from './history';
import { completionRate, dayCredit, type Rate } from './metrics';
import type { DayRange } from './range';
import type { Category, Habit } from './types';

/*
 * Estadísticas globales: el informe de un período sobre todos los hábitos.
 *
 * Se apoyan en la misma definición de tasa que el detalle (crédito por unidad,
 * pausas fuera, comodines que no maquillan la tasa), así que un hábito diario,
 * uno de tres veces por semana y uno mensual se pueden sumar sin trampa.
 *
 * Los hábitos "a evitar" no entran en la puntuación ni en el ranking: no son
 * tareas, igual que en el progreso del día. Tienen su propio resumen.
 */

/** Días evaluables mínimos para dar una cifra por buena. */
export const MIN_SCORE_DAYS = 7;
export const MIN_RANKING_DAYS = 7;
export const MIN_WEEKDAY_DAYS = 4;
/** El mejor y el peor día solo se nombran con al menos dos semanas de rango. */
export const MIN_WEEKDAY_RANGE = 14;
export const MOMENTUM_DAYS = 28;
export const MIN_MOMENTUM_DAYS = 7;
/** Cambio mínimo para hablar de mejora o de caída (10 puntos porcentuales). */
export const MIN_MOMENTUM_DELTA = 0.1;

export function isAvoid(history: HabitHistory): boolean {
  return history.habit.kind === 'avoid';
}

export interface PeriodScore {
  /** 0–1; `null` si no hay días evaluables. */
  readonly ratio: number | null;
  /** Días evaluables sumando todos los hábitos. */
  readonly days: number;
  /** Hábitos que aportan al menos un día. */
  readonly habits: number;
}

/**
 * Puntuación del período: crédito total entre días evaluables, sumando todos los
 * hábitos. Un hábito con más días programados pesa más, que es lo que se espera:
 * mide el período, no la media de los hábitos.
 */
export function periodScore(histories: readonly HabitHistory[], range: DayRange): PeriodScore {
  let credit = 0;
  let days = 0;
  let habits = 0;
  for (const history of histories) {
    if (isAvoid(history)) continue;
    const rate = completionRate(history, range.from, range.to);
    if (rate.days === 0) continue;
    credit += (rate.ratio ?? 0) * rate.days;
    days += rate.days;
    habits++;
  }
  return { ratio: days === 0 ? null : credit / days, days, habits };
}

export interface ScoreComparison {
  readonly current: PeriodScore;
  /** Período anterior; `null` si no tiene muestra suficiente para comparar. */
  readonly previous: PeriodScore | null;
  /** Diferencia en proporción (0,08 = 8 puntos porcentuales); `null` sin comparación. */
  readonly delta: number | null;
}

export function scoreComparison(
  histories: readonly HabitHistory[],
  range: DayRange,
  previousRange: DayRange,
): ScoreComparison {
  const current = periodScore(histories, range);
  const previous = periodScore(histories, previousRange);
  const comparable =
    previous.days >= MIN_SCORE_DAYS &&
    current.days >= MIN_SCORE_DAYS &&
    current.ratio !== null &&
    previous.ratio !== null;
  return {
    current,
    previous: comparable ? previous : null,
    delta:
      comparable && current.ratio !== null && previous.ratio !== null
        ? current.ratio - previous.ratio
        : null,
  };
}

export type ScoreBucket = 'day' | 'week' | 'month';

export interface ScorePoint {
  readonly start: LocalDay;
  readonly end: LocalDay;
  readonly score: PeriodScore;
  /** Contiene hoy: el tramo sigue abierto. */
  readonly current: boolean;
}

/** Tramo con el que se dibuja la evolución: días, semanas o meses según el rango. */
export function scoreBucket(rangeLength: number): ScoreBucket {
  if (rangeLength <= 14) return 'day';
  return rangeLength <= 120 ? 'week' : 'month';
}

/**
 * Evolución de la puntuación dentro del rango. El primer y el último tramo se
 * recortan al rango, así que los extremos pueden ser más cortos.
 */
export function scoreSeries(
  histories: readonly HabitHistory[],
  range: DayRange,
  bucket: ScoreBucket,
  weekStartsOn: Weekday,
  today: LocalDay,
): ScorePoint[] {
  const points: ScorePoint[] = [];
  let cursor = range.from;
  let guard = 0;
  while (cursor <= range.to && guard++ < 400) {
    const start =
      bucket === 'day'
        ? cursor
        : bucket === 'week'
          ? startOfWeek(cursor, weekStartsOn)
          : startOfMonth(cursor);
    const end =
      bucket === 'day' ? cursor : bucket === 'week' ? addDays(start, 6) : endOfMonth(start);
    const from = maxDay(start, range.from);
    const to = minDay(end, range.to);
    points.push({
      start: from,
      end: to,
      score: periodScore(histories, { from, to }),
      current: start <= today && today <= end,
    });
    cursor = addDays(end, 1);
  }
  return points;
}

export interface HabitRate {
  readonly habit: Habit;
  readonly rate: Rate;
}

export interface Ranking {
  /** De más a menos constante. */
  readonly ranked: readonly HabitRate[];
  /** Con menos de `MIN_RANKING_DAYS` días evaluables: no se ordenan con los demás. */
  readonly insufficient: readonly HabitRate[];
}

/**
 * Ranking de consistencia. Los hábitos con pocos días en el rango van aparte:
 * colocarlos al final del ranking los haría parecer los peores sin serlo.
 *
 * `minDays` se puede bajar para rangos cortos: sobre una semana cerrada, un
 * hábito de días concretos solo aporta dos o tres días evaluables.
 */
export function consistencyRanking(
  histories: readonly HabitHistory[],
  range: DayRange,
  minDays: number = MIN_RANKING_DAYS,
): Ranking {
  const ranked: HabitRate[] = [];
  const insufficient: HabitRate[] = [];
  for (const history of histories) {
    if (isAvoid(history)) continue;
    const rate = completionRate(history, range.from, range.to);
    if (rate.days === 0) continue;
    (rate.days >= minDays ? ranked : insufficient).push({ habit: history.habit, rate });
  }
  ranked.sort((a, b) => (b.rate.ratio ?? 0) - (a.rate.ratio ?? 0) || b.rate.days - a.rate.days);
  insufficient.sort((a, b) => b.rate.days - a.rate.days);
  return { ranked, insufficient };
}

export interface CategoryGroup {
  /** `null` = los hábitos sin categoría. */
  readonly category: Category | null;
  /** Puntuación del grupo (mismo cálculo que la general) y su comparación con el período anterior. */
  readonly comparison: ScoreComparison;
}

export interface CategoryBreakdown {
  /** De más a menos cumplimiento; solo categorías con `MIN_RANKING_DAYS` días evaluables. */
  readonly ranked: readonly CategoryGroup[];
  /**
   * Con menos días (también 0, p. ej. un hábito mensual aún en curso): se apartan en vez de
   * ordenarse como si fueran las peores, y así ninguna categoría viva desaparece sin decirlo.
   * Las que solo tienen hábitos archivados y 0 días no se listan.
   */
  readonly insufficient: readonly CategoryGroup[];
  /**
   * Los hábitos sin categoría, aparte y fuera del orden: no son una categoría, y así las
   * demás siguen cuadrando con la puntuación general. `null` si no llegan a la muestra
   * (entonces van a `insufficient`) o no hay ninguno.
   */
  readonly uncategorized: CategoryGroup | null;
}

/** Categoría real de un hábito; una `categoryId` que no existe cuenta como sin categoría. */
function categoryOf(history: HabitHistory, known: ReadonlyMap<string, Category>): Category | null {
  const id = history.habit.categoryId;
  return (id !== null && known.get(id)) || null;
}

/**
 * ¿Hay algo que decir de alguna categoría real (ordenada o apartada)? Si no, la sección
 * sobra: quien no usa categorías, o solo las tiene en hábitos "a evitar" o archivados sin
 * días en el rango, no ve una sección vacía.
 */
export function hasCategoryGroups(breakdown: CategoryBreakdown): boolean {
  return [...breakdown.ranked, ...breakdown.insufficient].some((g) => g.category !== null);
}

/**
 * Cumplimiento por categoría: la misma puntuación del período que la general, calculada
 * sobre los hábitos de cada categoría (con su comparación y sus reglas de muestra). Los
 * hábitos "a evitar" no entran, igual que en la puntuación.
 */
export function categoryBreakdown(
  histories: readonly HabitHistory[],
  categories: readonly Category[],
  range: DayRange,
  previous: DayRange,
): CategoryBreakdown {
  const known = new Map(categories.map((c) => [c.id, c]));
  const groups = new Map<Category | null, HabitHistory[]>();
  for (const history of histories) {
    if (isAvoid(history)) continue;
    const category = categoryOf(history, known);
    const list = groups.get(category);
    if (list) list.push(history);
    else groups.set(category, [history]);
  }

  const ranked: CategoryGroup[] = [];
  const insufficient: CategoryGroup[] = [];
  let uncategorized: CategoryGroup | null = null;
  for (const [category, list] of groups) {
    const comparison = scoreComparison(list, range, previous);
    // Sin días y sin ningún hábito vivo (todos archivados): no hay nada que decir de ella,
    // igual que Consistencia calla los hábitos archivados sin días en el rango.
    if (comparison.current.days === 0 && list.every((h) => h.habit.archivedOn !== null)) continue;
    const group = { category, comparison };
    if (comparison.current.days < MIN_RANKING_DAYS) insufficient.push(group);
    else if (category === null) uncategorized = group;
    else ranked.push(group);
  }

  const name = (g: CategoryGroup) => g.category?.name ?? '';
  ranked.sort(
    (a, b) =>
      (b.comparison.current.ratio ?? 0) - (a.comparison.current.ratio ?? 0) ||
      b.comparison.current.days - a.comparison.current.days ||
      name(a).localeCompare(name(b), 'es'),
  );
  // Las apartadas: primero las categorías con más días; "sin categoría" al final.
  insufficient.sort(
    (a, b) =>
      Number(a.category === null) - Number(b.category === null) ||
      b.comparison.current.days - a.comparison.current.days ||
      name(a).localeCompare(name(b), 'es'),
  );
  return { ranked, insufficient, uncategorized };
}

export interface WeekdayScore {
  readonly weekday: Weekday;
  readonly ratio: number | null;
  readonly days: number;
}

export interface WeekdayBreakdown {
  readonly scores: readonly WeekdayScore[];
  /** Solo con muestra suficiente en todos los días y al menos dos semanas de rango. */
  readonly best: Weekday | null;
  readonly worst: Weekday | null;
}

/** Cumplimiento por día de la semana, sumando todos los hábitos del rango. */
export function weekdayBreakdown(
  histories: readonly HabitHistory[],
  range: DayRange,
  rangeLength: number,
): WeekdayBreakdown {
  const credits = new Map<Weekday, number>(WEEKDAYS.map((w) => [w, 0]));
  const counts = new Map<Weekday, number>(WEEKDAYS.map((w) => [w, 0]));

  for (const history of histories) {
    if (isAvoid(history)) continue;
    for (const record of history.days) {
      if (record.day < range.from) continue;
      if (record.day > range.to) break;
      const credit = dayCredit(record);
      if (credit === null) continue;
      const weekday = weekdayOf(record.day);
      credits.set(weekday, (credits.get(weekday) ?? 0) + credit);
      counts.set(weekday, (counts.get(weekday) ?? 0) + 1);
    }
  }

  const scores: WeekdayScore[] = WEEKDAYS.map((weekday) => {
    const days = counts.get(weekday) ?? 0;
    return { weekday, days, ratio: days === 0 ? null : (credits.get(weekday) ?? 0) / days };
  });

  const measurable = scores.every((s) => s.days >= MIN_WEEKDAY_DAYS);
  const ratios = scores.map((s) => s.ratio ?? 0);
  const spread = Math.max(...ratios) - Math.min(...ratios);
  if (!measurable || rangeLength < MIN_WEEKDAY_RANGE || spread === 0) {
    return { scores, best: null, worst: null };
  }
  const sorted = [...scores].sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0));
  return { scores, best: sorted[0]?.weekday ?? null, worst: sorted.at(-1)?.weekday ?? null };
}

export interface Momentum {
  readonly habit: Habit;
  readonly recent: Rate;
  readonly previous: Rate;
  /** Diferencia en proporción entre las dos ventanas. */
  readonly delta: number;
}

export interface MomentumLists {
  readonly improving: readonly Momentum[];
  readonly declining: readonly Momentum[];
  /** Hábitos con muestra suficiente en las dos ventanas. */
  readonly measured: number;
}

/**
 * Hábitos que mejoran o decaen: últimas cuatro semanas contra las cuatro
 * anteriores. No depende del rango elegido; siempre mira el pasado reciente.
 */
export function momentum(
  histories: readonly HabitHistory[],
  today: LocalDay,
  minDelta: number = MIN_MOMENTUM_DELTA,
): MomentumLists {
  const recentFrom = addDays(today, -(MOMENTUM_DAYS - 1));
  const previousTo = addDays(recentFrom, -1);
  const previousFrom = addDays(previousTo, -(MOMENTUM_DAYS - 1));

  const improving: Momentum[] = [];
  const declining: Momentum[] = [];
  let measured = 0;

  for (const history of histories) {
    if (isAvoid(history)) continue;
    const recent = completionRate(history, recentFrom, today);
    const previous = completionRate(history, previousFrom, previousTo);
    if (recent.days < MIN_MOMENTUM_DAYS || previous.days < MIN_MOMENTUM_DAYS) continue;
    if (recent.ratio === null || previous.ratio === null) continue;
    measured++;
    const delta = recent.ratio - previous.ratio;
    if (Math.abs(delta) < minDelta) continue;
    (delta > 0 ? improving : declining).push({ habit: history.habit, recent, previous, delta });
  }

  improving.sort((a, b) => b.delta - a.delta);
  declining.sort((a, b) => a.delta - b.delta);
  return { improving, declining, measured };
}

export interface AvoidSummary {
  readonly habit: Habit;
  /** Recaídas registradas en el rango (suma de valores). */
  readonly relapses: number;
  readonly relapseDays: number;
  /** Días sin recaer, en pausa o fuera de la vida del hábito aparte. */
  readonly cleanDays: number;
  /** Recaídas del período anterior; `null` si el hábito no existía entonces. */
  readonly previousRelapses: number | null;
}

function countRelapses(
  history: HabitHistory,
  range: DayRange,
): { relapses: number; days: number; clean: number } {
  let relapses = 0;
  let days = 0;
  let clean = 0;
  for (const record of history.days) {
    if (record.day < range.from) continue;
    if (record.day > range.to) break;
    if (record.paused || !record.scheduled) continue;
    if (record.value > 0) {
      relapses += record.value;
      days++;
    } else {
      clean++;
    }
  }
  return { relapses, days, clean };
}

export function avoidSummaries(
  histories: readonly HabitHistory[],
  range: DayRange,
  previousRange: DayRange,
): AvoidSummary[] {
  const summaries: AvoidSummary[] = [];
  for (const history of histories) {
    if (!isAvoid(history)) continue;
    const current = countRelapses(history, range);
    if (current.relapses === 0 && current.clean === 0) continue;
    const before = countRelapses(history, previousRange);
    const existed = history.habit.createdOn <= previousRange.to;
    summaries.push({
      habit: history.habit,
      relapses: current.relapses,
      relapseDays: current.days,
      cleanDays: current.clean,
      previousRelapses: existed ? before.relapses : null,
    });
  }
  return summaries.sort((a, b) => b.relapses - a.relapses);
}
