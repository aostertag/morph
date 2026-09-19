import { addDays, type LocalDay } from './day';
import type { HabitHistory } from './history';
import { type DayRange, inRange } from './range';
import type { DayLog, Habit } from './types';

/*
 * Correlaciones honestas.
 *
 * Todo lo que se afirma aquí pasa tres filtros:
 *   1. Muestra: al menos 14 días en CADA grupo (el mínimo del SPEC).
 *   2. Tamaño: la diferencia tiene que ser relevante, no solo distinta de cero.
 *   3. Azar: el intervalo de confianza de la diferencia no puede incluir el cero,
 *      con el nivel corregido por el número de comparaciones examinadas
 *      (Bonferroni). Con diez hábitos se comparan decenas de parejas y al 95 %
 *      saldrían "hallazgos" que son solo ruido.
 *
 * Un día solo entra en una comparación si estaba decidido: el hábito tocaba ese
 * día, no estaba en pausa, el hábito ya existía y el día ya ha terminado. Hoy
 * nunca cuenta, porque aún puede cambiar.
 *
 * Nada de esto demuestra causa, y el texto que lo acompaña lo dice.
 */

/** Días mínimos en cada grupo para siquiera mirar la diferencia. */
export const MIN_GROUP_DAYS = 14;
/** Diferencia mínima relevante en las escalas 1–5 de ánimo y energía. */
export const MIN_SCALE_DELTA = 0.4;
/** Diferencia mínima relevante entre tasas de cumplimiento (10 puntos). */
export const MIN_RATE_DELTA = 0.1;
/** Cuántos hallazgos se muestran como mucho. */
export const MAX_FINDINGS = 6;
export const ALPHA = 0.05;

/**
 * Cuantil de la normal estándar (aproximación racional de Acklam).
 * Error absoluto por debajo de 1,15e-9 en (0, 1).
 */
export function normalQuantile(p: number): number {
  if (p <= 0 || p >= 1) throw new RangeError(`Probabilidad fuera de (0, 1): ${p}`);
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2,
    -3.066479806614716e1, 2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1,
    -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734,
    4.374664141464968, 2.938163982698783,
  ];
  const dd = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const low = 0.02425;

  const poly = (coefficients: readonly number[], x: number): number =>
    coefficients.reduce((acc, coefficient) => acc * x + coefficient, 0);

  if (p < low) {
    const q = Math.sqrt(-2 * Math.log(p));
    return poly(c, q) / (poly(dd, q) * q + 1);
  }
  if (p > 1 - low) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -poly(c, q) / (poly(dd, q) * q + 1);
  }
  const q = p - 0.5;
  const r = q * q;
  return (poly(a, r) * q) / (poly(b, r) * r + 1);
}

/**
 * Nivel exigido al intervalo de confianza según cuántas comparaciones se miran.
 * Con una sola comparación es el 95 % de toda la vida (z = 1,96); con veinte,
 * el margen se ensancha para que el conjunto siga siendo fiable.
 */
export function bonferroniZ(comparisons: number, alpha: number = ALPHA): number {
  return normalQuantile(1 - alpha / (2 * Math.max(1, comparisons)));
}

/**
 * Días evaluables del hábito dentro del rango, con si ocurrió o no.
 * En "a evitar", ocurrir es recaer. En cantidad y tiempo, ocurrir es llegar a la
 * meta del día: un día a medias no cuenta como hecho, igual que en el resto de
 * la app.
 */
export function outcomesByDay(
  history: HabitHistory,
  range: DayRange,
  today: LocalDay,
): Map<LocalDay, boolean> {
  const avoid = history.habit.kind === 'avoid';
  const outcomes = new Map<LocalDay, boolean>();
  for (const record of history.days) {
    if (record.day < range.from) continue;
    if (record.day > range.to) break;
    if (record.day >= today) break;
    if (!record.scheduled || record.paused) continue;
    outcomes.set(record.day, avoid ? record.value > 0 : record.success);
  }
  return outcomes;
}

/** Ánimo (o energía) por día, solo de días cerrados dentro del rango. */
export function scaleByDay(
  logs: readonly DayLog[],
  field: 'mood' | 'energy',
  range: DayRange,
  today: LocalDay,
): Map<LocalDay, number> {
  const values = new Map<LocalDay, number>();
  for (const log of logs) {
    const value = log[field];
    if (value === null || log.date >= today || !inRange(log.date, range)) continue;
    values.set(log.date, value);
  }
  return values;
}

interface Group {
  readonly n: number;
  readonly mean: number;
  /** Varianza muestral (n − 1). */
  readonly variance: number;
}

function summarize(values: readonly number[]): Group {
  const n = values.length;
  if (n === 0) return { n: 0, mean: 0, variance: 0 };
  const mean = values.reduce((sum, value) => sum + value, 0) / n;
  if (n === 1) return { n, mean, variance: 0 };
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (n - 1);
  return { n, mean, variance };
}

/** Diferencia de medias con el error típico de Welch (no supone varianzas iguales). */
function meanDifference(withGroup: Group, withoutGroup: Group): { delta: number; error: number } {
  return {
    delta: withGroup.mean - withoutGroup.mean,
    error: Math.sqrt(withGroup.variance / withGroup.n + withoutGroup.variance / withoutGroup.n),
  };
}

/** Diferencia de proporciones con error típico sin agrupar. */
function rateDifference(
  withRate: number,
  withN: number,
  withoutRate: number,
  withoutN: number,
): { delta: number; error: number } {
  return {
    delta: withRate - withoutRate,
    error: Math.sqrt(
      (withRate * (1 - withRate)) / withN + (withoutRate * (1 - withoutRate)) / withoutN,
    ),
  };
}

export type CorrelationKind = 'mood' | 'energy' | 'habit';

export interface Correlation {
  readonly kind: CorrelationKind;
  /** Hábito que separa los dos grupos de días. */
  readonly source: Habit;
  /** Hábito comparado; solo en `kind: 'habit'`. */
  readonly target: Habit | null;
  /** 0 = el mismo día; 1 = el día siguiente. */
  readonly lag: 0 | 1;
  /** Media (ánimo, energía) o tasa (hábito) los días que el hábito ocurrió. */
  readonly withValue: number;
  readonly withoutValue: number;
  readonly withDays: number;
  readonly withoutDays: number;
  readonly delta: number;
  /** Media anchura del intervalo de confianza de la diferencia. */
  readonly margin: number;
}

export interface CorrelationReport {
  readonly findings: readonly Correlation[];
  /** Comparaciones examinadas (parejas de hábitos y de hábito con ánimo o energía). */
  readonly compared: number;
  /** De esas, las que llegaron a los 14 días por grupo. */
  readonly tested: number;
  /** De esas, las que pasaron los tres filtros (pueden ser más de las listadas). */
  readonly qualified: number;
  /** Días con ánimo o energía registrados dentro del rango. */
  readonly scaleDays: number;
  /** Nivel de confianza exigido (0,95 con una comparación; más con varias). */
  readonly confidence: number;
}

/** Comparación planteada, antes de saber si dice algo. */
interface Candidate {
  readonly kind: CorrelationKind;
  readonly source: Habit;
  readonly target: Habit | null;
  readonly lag: 0 | 1;
  readonly withValues: number[];
  readonly withoutValues: number[];
}

function splitByOutcome(
  outcomes: ReadonlyMap<LocalDay, boolean>,
  valueOn: (day: LocalDay) => number | undefined,
): { withValues: number[]; withoutValues: number[] } {
  const withValues: number[] = [];
  const withoutValues: number[] = [];
  for (const [day, happened] of outcomes) {
    const value = valueOn(day);
    if (value === undefined) continue;
    (happened ? withValues : withoutValues).push(value);
  }
  return { withValues, withoutValues };
}

export interface CorrelationInput {
  readonly histories: readonly HabitHistory[];
  readonly dayLogs: readonly DayLog[];
  readonly range: DayRange;
  readonly today: LocalDay;
}

function candidates(input: CorrelationInput): Candidate[] {
  const { histories, dayLogs, range, today } = input;
  const series = histories
    .map((history) => ({
      habit: history.habit,
      outcomes: outcomesByDay(history, range, today),
    }))
    .filter((entry) => entry.outcomes.size > 0);

  const scales = [
    { kind: 'mood' as const, values: scaleByDay(dayLogs, 'mood', range, today) },
    { kind: 'energy' as const, values: scaleByDay(dayLogs, 'energy', range, today) },
  ];

  const list: Candidate[] = [];

  for (const { habit, outcomes } of series) {
    for (const scale of scales) {
      if (scale.values.size === 0) continue;
      // Mismo día, y con un día de desfase: lo de hoy sobre el ánimo de mañana.
      for (const lag of [0, 1] as const) {
        const { withValues, withoutValues } = splitByOutcome(outcomes, (day) => {
          const target = lag === 0 ? day : addDays(day, 1);
          return inRange(target, range) ? scale.values.get(target) : undefined;
        });
        if (withValues.length === 0 && withoutValues.length === 0) continue;
        list.push({
          kind: scale.kind,
          source: habit,
          target: null,
          lag,
          withValues,
          withoutValues,
        });
      }
    }
  }

  for (let i = 0; i < series.length; i++) {
    for (let j = i + 1; j < series.length; j++) {
      const a = series[i];
      const b = series[j];
      if (!a || !b) continue;
      const forward = splitByOutcome(a.outcomes, (day) => {
        const value = b.outcomes.get(day);
        return value === undefined ? undefined : Number(value);
      });
      const backward = splitByOutcome(b.outcomes, (day) => {
        const value = a.outcomes.get(day);
        return value === undefined ? undefined : Number(value);
      });
      if (forward.withValues.length === 0 && forward.withoutValues.length === 0) continue;
      // Se mira en la dirección que reparte mejor los días: es la que más dice.
      const balance = (split: { withValues: number[]; withoutValues: number[] }) =>
        Math.min(split.withValues.length, split.withoutValues.length);
      const useForward = balance(forward) >= balance(backward);
      const split = useForward ? forward : backward;
      list.push({
        kind: 'habit',
        source: useForward ? a.habit : b.habit,
        target: useForward ? b.habit : a.habit,
        lag: 0,
        withValues: split.withValues,
        withoutValues: split.withoutValues,
      });
    }
  }

  return list;
}

function evaluate(candidate: Candidate, z: number): Correlation | null {
  const withGroup = summarize(candidate.withValues);
  const withoutGroup = summarize(candidate.withoutValues);
  const scale = candidate.kind !== 'habit';
  const { delta, error } = scale
    ? meanDifference(withGroup, withoutGroup)
    : rateDifference(withGroup.mean, withGroup.n, withoutGroup.mean, withoutGroup.n);

  const minDelta = scale ? MIN_SCALE_DELTA : MIN_RATE_DELTA;
  const margin = z * error;
  if (Math.abs(delta) < minDelta) return null;
  // El intervalo de confianza tiene que quedarse fuera del cero.
  if (Math.abs(delta) <= margin) return null;

  return {
    kind: candidate.kind,
    source: candidate.source,
    target: candidate.target,
    lag: candidate.lag,
    withValue: withGroup.mean,
    withoutValue: withoutGroup.mean,
    withDays: withGroup.n,
    withoutDays: withoutGroup.n,
    delta,
    margin,
  };
}

/** Tamaño del efecto normalizado, para ordenar escalas y tasas en la misma lista. */
function effect(correlation: Correlation): number {
  return Math.abs(correlation.delta) / (correlation.kind === 'habit' ? 1 : 4);
}

/**
 * Una pareja, una frase. Cuando la misma pareja sale con los dos desfases suele
 * ser el mismo fenómeno contado dos veces (quien recae hoy recayó ayer), así que
 * se deja el desfase con más efecto. Las dos comparaciones siguen contando para
 * la corrección: lo que se recorta es la lista, no el recuento.
 */
function strongestPerPair(findings: readonly Correlation[]): Correlation[] {
  const seen = new Set<string>();
  const kept: Correlation[] = [];
  for (const finding of findings) {
    const key = `${finding.kind}:${finding.source.id}:${finding.target?.id ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(finding);
  }
  return kept;
}

export function findCorrelations(input: CorrelationInput): CorrelationReport {
  const all = candidates(input);
  const testable = all.filter(
    (candidate) =>
      candidate.withValues.length >= MIN_GROUP_DAYS &&
      candidate.withoutValues.length >= MIN_GROUP_DAYS,
  );
  const z = bonferroniZ(testable.length);

  const evaluated = testable
    .map((candidate) => evaluate(candidate, z))
    .filter((correlation): correlation is Correlation => correlation !== null)
    .sort((a, b) => effect(b) - effect(a));
  const findings = strongestPerPair(evaluated).slice(0, MAX_FINDINGS);

  const scaleDays = new Set<LocalDay>();
  for (const log of input.dayLogs) {
    if ((log.mood !== null || log.energy !== null) && log.date < input.today) {
      if (inRange(log.date, input.range)) scaleDays.add(log.date);
    }
  }

  return {
    findings,
    compared: all.length,
    tested: testable.length,
    qualified: evaluated.length,
    scaleDays: scaleDays.size,
    confidence: 1 - ALPHA / Math.max(1, testable.length),
  };
}
