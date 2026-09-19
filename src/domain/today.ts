import type { LocalDay } from './day';
import {
  type EvaluationContext,
  evaluateHabit,
  type HabitEvaluation,
  isDaySuccess,
  valuesByDay,
} from './evaluate';
import { isScheduledOn, type PeriodUnit } from './frequency';
import { isPausedOn, pausesFor } from './pauses';
import { computeStreaks, type StreakSummary, type WildcardUse } from './streaks';
import type { Entry, Habit, Pause, TimeOfDay } from './types';

export interface PeriodProgress {
  readonly start: LocalDay;
  readonly end: LocalDay;
  readonly achieved: number;
  readonly required: number;
  readonly met: boolean;
}

/** Todo lo que la pantalla Hoy necesita saber de un hábito en un día concreto. */
export interface HabitDayView {
  readonly habit: Habit;
  readonly day: LocalDay;
  /** Valor registrado ese día (0 si no hay registro). */
  readonly value: number;
  /** El día cumple la meta diaria. En "a evitar": día limpio. */
  readonly success: boolean;
  /** El hábito toca ese día según su frecuencia. */
  readonly scheduled: boolean;
  readonly paused: boolean;
  readonly unit: PeriodUnit;
  /** Progreso del período (semana o mes) que contiene el día; `null` en hábitos por día. */
  readonly period: PeriodProgress | null;
  /** Cuenta en el progreso del día. */
  readonly countsForProgress: boolean;
  /** Cuenta como hecho en el progreso del día. */
  readonly doneForProgress: boolean;
  /** Rachas a fecha de hoy (no del día mostrado). */
  readonly streak: StreakSummary;
  /** Último comodín gastado dentro de la racha actual. */
  readonly lastWildcardInStreak: WildcardUse | null;
}

/** ¿Existe el hábito ese día? (creado y no archivado antes). */
export function isHabitActiveOn(
  habit: Pick<Habit, 'createdOn' | 'archivedOn'>,
  day: LocalDay,
): boolean {
  return habit.createdOn <= day && (habit.archivedOn === null || day <= habit.archivedOn);
}

/**
 * Historial evaluado de un hábito: lo costoso, calculado una vez y reutilizable
 * para construir la vista de cualquier día.
 */
export interface HabitAnalysis {
  readonly habit: Habit;
  readonly values: ReadonlyMap<LocalDay, number>;
  readonly evaluation: HabitEvaluation;
  readonly streak: StreakSummary;
  readonly pauses: readonly Pause[];
}

export function analyzeHabit(
  habit: Habit,
  entries: readonly Entry[],
  ctx: EvaluationContext,
): HabitAnalysis {
  const own = entries.filter((e) => e.habitId === habit.id);
  const evaluation = evaluateHabit(habit, own, ctx);
  return {
    habit,
    values: valuesByDay(own),
    evaluation,
    streak: computeStreaks(evaluation.unit, evaluation.units),
    pauses: pausesFor(habit.id, ctx.pauses),
  };
}

/** Atajo para tests y usos puntuales: analiza y construye la vista de un día. */
export function buildDayView(
  habit: Habit,
  entries: readonly Entry[],
  ctx: EvaluationContext,
  day: LocalDay,
): HabitDayView {
  return viewForDay(analyzeHabit(habit, entries, ctx), day);
}

export function viewForDay(analysis: HabitAnalysis, day: LocalDay): HabitDayView {
  const { habit, evaluation, streak } = analysis;
  const value = analysis.values.get(day) ?? 0;
  const success = isDaySuccess(habit, value);
  const scheduled = isHabitActiveOn(habit, day) && isScheduledOn(habit.frequency, day);
  const paused = isPausedOn(day, analysis.pauses);

  let period: PeriodProgress | null = null;
  if (evaluation.unit !== 'day') {
    const unit = evaluation.units.find((u) => u.start <= day && day <= u.end);
    if (unit) {
      period = {
        start: unit.start,
        end: unit.end,
        achieved: unit.achieved,
        required: unit.required,
        met: unit.status === 'done',
      };
    }
  }

  let countsForProgress = scheduled && !paused && habit.kind !== 'avoid';
  const doneForProgress = countsForProgress && success;
  // En hábitos por período, si la meta ya se cumplió otros días, hoy no queda nada pendiente.
  if (countsForProgress && !success && period?.met) countsForProgress = false;

  const lastUse = streak.wildcardUses.at(-1) ?? null;
  const lastWildcardInStreak =
    lastUse && streak.currentRange && lastUse.start >= streak.currentRange.start ? lastUse : null;

  return {
    habit,
    day,
    value,
    success,
    scheduled,
    paused,
    unit: evaluation.unit,
    period,
    countsForProgress,
    doneForProgress,
    streak,
    lastWildcardInStreak,
  };
}

export interface DayProgress {
  readonly done: number;
  readonly total: number;
  /** 0–1; 0 si no hay nada programado. */
  readonly ratio: number;
  readonly complete: boolean;
}

export function dayProgress(views: readonly HabitDayView[]): DayProgress {
  const counted = views.filter((v) => v.countsForProgress);
  const done = counted.filter((v) => v.doneForProgress).length;
  const total = counted.length;
  return {
    done,
    total,
    ratio: total === 0 ? 0 : done / total,
    complete: total > 0 && done === total,
  };
}

export const TIME_OF_DAY_ORDER: readonly TimeOfDay[] = ['morning', 'afternoon', 'evening', 'any'];

export interface TimeOfDayGroup<T> {
  readonly timeOfDay: TimeOfDay;
  readonly items: readonly T[];
}

/** Agrupa por momento del día conservando el orden de entrada; omite grupos vacíos. */
export function groupByTimeOfDay<T extends { readonly habit: Pick<Habit, 'timeOfDay'> }>(
  items: readonly T[],
): TimeOfDayGroup<T>[] {
  return TIME_OF_DAY_ORDER.map((timeOfDay) => ({
    timeOfDay,
    items: items.filter((item) => item.habit.timeOfDay === timeOfDay),
  })).filter((group) => group.items.length > 0);
}
