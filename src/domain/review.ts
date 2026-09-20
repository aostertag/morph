import { addDays, type LocalDay, startOfWeek, type Weekday } from './day';
import type { HabitHistory } from './history';
import { type DayRange, previousRange } from './range';
import {
  type AvoidSummary,
  avoidSummaries,
  consistencyRanking,
  type HabitRate,
  type Ranking,
  type ScoreComparison,
  scoreComparison,
} from './stats';
import type { DayLog } from './types';

/*
 * Revisión de una semana cerrada.
 *
 * El informe no se guarda: de `WeeklyReview` solo se persiste la reflexión
 * escrita, y todo lo demás se recalcula al leer, como en el resto de la app.
 *
 * Las rachas no entran aquí a propósito. Se muestran siempre a fecha de hoy, así
 * que la pantalla las toma del análisis en vez de fingir que sabe cómo estaban
 * el domingo por la noche.
 */

/**
 * Días evaluables mínimos para nombrar a un hábito en la revisión. Sobre siete
 * días, un hábito de lunes, miércoles y viernes solo aporta tres: con el mínimo
 * de las estadísticas globales no se podría nombrar a ninguno.
 */
export const MIN_REVIEW_DAYS = 3;

/** La última semana cerrada: la anterior a la que contiene hoy. */
export function lastCompleteWeek(today: LocalDay, weekStartsOn: Weekday): DayRange {
  const start = addDays(startOfWeek(today, weekStartsOn), -7);
  return { from: start, to: addDays(start, 6) };
}

/** La semana completa que empieza en `weekStart`. */
export function weekOf(weekStart: LocalDay): DayRange {
  return { from: weekStart, to: addDays(weekStart, 6) };
}

export interface WeekSummary {
  readonly week: DayRange;
  /** Cumplimiento de la semana frente a la anterior. */
  readonly score: ScoreComparison;
  readonly ranking: Ranking;
  /** El más constante; `null` si nadie cumplió nada o no hay muestra. */
  readonly best: HabitRate | null;
  /** El que más costó; `null` si no hay con quién compararlo o todos cumplieron. */
  readonly hardest: HabitRate | null;
  readonly avoid: readonly AvoidSummary[];
  /** Media de ánimo de los días registrados de la semana; `null` si no hay ninguno. */
  readonly mood: number | null;
  readonly energy: number | null;
  /** Días de la semana con ánimo o energía registrados. */
  readonly loggedDays: number;
}

function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function weekSummary(
  histories: readonly HabitHistory[],
  dayLogs: readonly DayLog[],
  week: DayRange,
): WeekSummary {
  const before = previousRange(week, 'week');
  const ranking = consistencyRanking(histories, week, MIN_REVIEW_DAYS);

  const first = ranking.ranked[0] ?? null;
  const last = ranking.ranked.at(-1) ?? null;
  // Nombrar al peor cuando todos cumplieron al 100 % sería inventarse un problema.
  const hardest =
    last !== null && ranking.ranked.length >= 2 && (last.rate.ratio ?? 0) < 1 ? last : null;

  const moods: number[] = [];
  const energies: number[] = [];
  let loggedDays = 0;
  for (const log of dayLogs) {
    if (log.date < week.from || log.date > week.to) continue;
    if (log.mood === null && log.energy === null) continue;
    loggedDays++;
    if (log.mood !== null) moods.push(log.mood);
    if (log.energy !== null) energies.push(log.energy);
  }

  return {
    week,
    score: scoreComparison(histories, week, before),
    ranking,
    best: first !== null && (first.rate.ratio ?? 0) > 0 ? first : null,
    hardest,
    avoid: avoidSummaries(histories, week, before),
    mood: mean(moods),
    energy: mean(energies),
    loggedDays,
  };
}

/**
 * ¿Toca ofrecer la revisión de esa semana?
 *
 * No se ofrece dos veces la misma, ni cuando ya hay una reflexión escrita, ni
 * cuando la semana no tenía nada que evaluar (recién llegado, o entera en pausa).
 */
export function reviewPending(
  summary: WeekSummary,
  lastOffered: LocalDay | null,
  hasReflection: boolean,
): boolean {
  if (hasReflection) return false;
  if (summary.week.from === lastOffered) return false;
  return summary.score.current.days > 0;
}
