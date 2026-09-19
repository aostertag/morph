import { diffDays, eachDay, type LocalDay } from './day';
import { dailyGoal, type EvaluatedUnit, evaluationEnd, isDaySuccess } from './evaluate';
import { isScheduledOn, type PeriodUnit } from './frequency';
import { isPausedOn } from './pauses';
import type { HabitAnalysis } from './today';
import type { Habit } from './types';

/** Un día de la historia de un hábito, con todo lo necesario para métricas y heatmap. */
export interface DayRecord {
  readonly day: LocalDay;
  /** Valor registrado (0 si no hay registro). En "a evitar": recaídas. */
  readonly value: number;
  /** Toca según la frecuencia (siempre en hábitos por semana o mes). */
  readonly scheduled: boolean;
  readonly paused: boolean;
  /** Cumple la meta diaria. En "a evitar": día limpio. */
  readonly success: boolean;
  /** Unidad de evaluación a la que pertenece; `null` si no toca ese día. */
  readonly unit: EvaluatedUnit | null;
  /** Su unidad fue fallada y la cubrió un comodín. */
  readonly wildcard: boolean;
}

/**
 * Historia completa día a día, desde la creación hasta hoy (o el archivado).
 * Se calcula una vez a partir del análisis y de ella salen el heatmap y las métricas.
 */
export interface HabitHistory {
  readonly habit: Habit;
  readonly unit: PeriodUnit;
  readonly today: LocalDay;
  /** Días en orden cronológico; vacío si el hábito aún no ha empezado. */
  readonly days: readonly DayRecord[];
  readonly units: readonly EvaluatedUnit[];
}

export function buildHistory(analysis: HabitAnalysis, today: LocalDay): HabitHistory {
  const { habit, evaluation, values, pauses, streak } = analysis;
  const end = evaluationEnd(habit, today);
  const covered = new Set(streak.wildcardUses.map((w) => w.start));
  const days: DayRecord[] = [];

  // Las unidades están en orden y son contiguas: se recorren con un puntero.
  let index = 0;
  for (const day of eachDay(habit.createdOn, end)) {
    const scheduled = isScheduledOn(habit.frequency, day);
    let unit: EvaluatedUnit | null = null;
    if (scheduled) {
      let candidate = evaluation.units[index];
      while (candidate && candidate.end < day) candidate = evaluation.units[++index];
      if (candidate && candidate.start <= day) unit = candidate;
    }
    const value = values.get(day) ?? 0;
    days.push({
      day,
      value,
      scheduled,
      paused: isPausedOn(day, pauses),
      success: isDaySuccess(habit, value),
      unit,
      wildcard: unit !== null && covered.has(unit.start),
    });
  }

  return { habit, unit: evaluation.unit, today, days, units: evaluation.units };
}

/** Día concreto de la historia, o `undefined` si queda fuera. */
export function recordOn(history: HabitHistory, day: LocalDay): DayRecord | undefined {
  const first = history.days[0];
  if (!first || day < first.day) return undefined;
  // Los días son consecutivos: el índice es la distancia al primero.
  const record = history.days[diffDays(first.day, day)];
  return record?.day === day ? record : undefined;
}

/** Nivel del heatmap (0–4). 4 significa siempre "meta del día cumplida". */
export type HeatLevel = 0 | 1 | 2 | 3 | 4;

/**
 * Intensidad de un día en hábitos que se cumplen haciendo algo. En cantidad y
 * tiempo es proporcional a la meta: menos de 1/3, menos de 2/3, menos de la meta, meta.
 */
export function heatLevel(habit: Pick<Habit, 'kind' | 'target'>, value: number): HeatLevel {
  if (value <= 0) return 0;
  const goal = dailyGoal(habit);
  if (habit.kind === 'boolean' || goal === 0) return 4;
  const ratio = value / goal;
  if (ratio >= 1) return 4;
  if (ratio >= 2 / 3) return 3;
  if (ratio >= 1 / 3) return 2;
  return 1;
}

/** Nivel de recaídas en "a evitar" (0–3): ninguna, 1, 2, 3 o más. */
export type RelapseLevel = 0 | 1 | 2 | 3;

export function relapseLevel(value: number): RelapseLevel {
  if (value <= 0) return 0;
  if (value >= 3) return 3;
  return value >= 2 ? 2 : 1;
}
