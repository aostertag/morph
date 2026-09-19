import { addDays, eachDay, type LocalDay, maxDay, minDay, type Weekday } from './day';
import {
  isScheduledOn,
  nextPeriod,
  type PeriodUnit,
  periodContaining,
  periodLength,
  periodUnit,
  proratedRequirement,
  timesPerPeriod,
} from './frequency';
import { isPausedOn, pausesFor } from './pauses';
import type { Entry, Habit, Pause } from './types';

/**
 * Estado de una unidad de evaluación (un día, una semana o un mes según la frecuencia).
 * - `done`: cumplida.
 * - `missed`: cerrada sin cumplir.
 * - `paused`: neutra; no suma ni rompe.
 * - `pending`: todavía abierta (contiene hoy) y sin cumplir; no rompe nada.
 */
export type UnitStatus = 'done' | 'missed' | 'paused' | 'pending';

export interface EvaluatedUnit {
  readonly start: LocalDay;
  readonly end: LocalDay;
  readonly status: UnitStatus;
  /** Días cumplidos necesarios en la unidad (1 en unidades de un día). */
  readonly required: number;
  /** Días cumplidos hasta hoy dentro de la unidad. En "a evitar": días limpios. */
  readonly achieved: number;
}

export interface EvaluationContext {
  readonly today: LocalDay;
  readonly weekStartsOn: Weekday;
  /** Todas las pausas; se filtran las que aplican al hábito. */
  readonly pauses: readonly Pause[];
}

export interface HabitEvaluation {
  readonly unit: PeriodUnit;
  readonly units: readonly EvaluatedUnit[];
}

/** Valor diario que cuenta como cumplido. */
export function dailyGoal(habit: Pick<Habit, 'kind' | 'target'>): number {
  if (habit.kind === 'quantity' || habit.kind === 'time') return Math.max(habit.target ?? 1, 0);
  return 1;
}

/**
 * ¿Cumple el día este valor? En "a evitar" el éxito es no haber registrado nada.
 * Se guarda el valor real; aquí solo se compara con la meta.
 */
export function isDaySuccess(habit: Pick<Habit, 'kind' | 'target'>, value: number): boolean {
  if (habit.kind === 'avoid') return value <= 0;
  const goal = dailyGoal(habit);
  return goal === 0 ? value > 0 : value >= goal;
}

/** Suma los valores por día (normalmente hay un registro por hábito y día). */
export function valuesByDay(entries: readonly Entry[]): Map<LocalDay, number> {
  const map = new Map<LocalDay, number>();
  for (const e of entries) map.set(e.date, (map.get(e.date) ?? 0) + e.value);
  return map;
}

/** Último día en que el hábito cuenta a efectos de evaluación. */
export function evaluationEnd(habit: Pick<Habit, 'archivedOn'>, today: LocalDay): LocalDay {
  return habit.archivedOn === null ? today : minDay(habit.archivedOn, today);
}

/**
 * Recorre la historia del hábito desde su creación hasta hoy (o su archivado)
 * y devuelve las unidades evaluadas en orden cronológico.
 */
export function evaluateHabit(
  habit: Habit,
  entries: readonly Entry[],
  ctx: EvaluationContext,
): HabitEvaluation {
  const unit = periodUnit(habit.frequency);
  const pauses = pausesFor(habit.id, ctx.pauses);
  const values = valuesByDay(entries.filter((e) => e.habitId === habit.id));
  const end = evaluationEnd(habit, ctx.today);
  if (habit.createdOn > end) return { unit, units: [] };

  const units =
    unit === 'day'
      ? evaluateDays(habit, values, pauses, end, ctx.today)
      : evaluatePeriods(habit, values, pauses, end, ctx);
  return { unit, units };
}

function evaluateDays(
  habit: Habit,
  values: ReadonlyMap<LocalDay, number>,
  pauses: readonly Pause[],
  end: LocalDay,
  today: LocalDay,
): EvaluatedUnit[] {
  const units: EvaluatedUnit[] = [];
  for (const day of eachDay(habit.createdOn, end)) {
    if (!isScheduledOn(habit.frequency, day)) continue;
    const success = isDaySuccess(habit, values.get(day) ?? 0);
    let status: UnitStatus;
    if (isPausedOn(day, pauses)) status = 'paused';
    else if (day === today) {
      // Hoy sigue abierto. En "a evitar" una recaída ya lo cierra como fallado;
      // un día limpio no se da por cumplido hasta que termine.
      if (habit.kind === 'avoid') status = success ? 'pending' : 'missed';
      else status = success ? 'done' : 'pending';
    } else status = success ? 'done' : 'missed';
    units.push({ start: day, end: day, status, required: 1, achieved: success ? 1 : 0 });
  }
  return units;
}

function evaluatePeriods(
  habit: Habit,
  values: ReadonlyMap<LocalDay, number>,
  pauses: readonly Pause[],
  end: LocalDay,
  ctx: EvaluationContext,
): EvaluatedUnit[] {
  const { frequency } = habit;
  const times = timesPerPeriod(frequency);
  const units: EvaluatedUnit[] = [];

  let period = periodContaining(frequency, habit.createdOn, ctx.weekStartsOn);
  while (period.start <= end) {
    const firstDay = maxDay(period.start, habit.createdOn);
    // El período se cierra en su último día o, si se archivó antes, el día del archivado.
    const closesOn = habit.archivedOn === null ? period.end : minDay(period.end, habit.archivedOn);

    let eligible = 0;
    for (const day of eachDay(firstDay, closesOn)) {
      if (!isPausedOn(day, pauses)) eligible++;
    }

    let achieved = 0;
    for (const day of eachDay(firstDay, minDay(closesOn, ctx.today))) {
      if (!isPausedOn(day, pauses) && isDaySuccess(habit, values.get(day) ?? 0)) achieved++;
    }

    const required = proratedRequirement(times, eligible, periodLength(frequency, period));
    let status: UnitStatus;
    if (required === 0) status = 'paused';
    else if (achieved >= required) status = 'done';
    else if (closesOn >= ctx.today) status = 'pending';
    else status = 'missed';

    units.push({ start: period.start, end: period.end, status, required, achieved });
    period = nextPeriod(frequency, period, ctx.weekStartsOn);
  }
  return units;
}

export type LogPermission = 'ok' | 'future' | 'beforeStart' | 'archived' | 'tooOld';

/**
 * ¿Se puede registrar este día? Hoy siempre; hacia atrás, hasta `retroLimitDays`
 * días y nunca antes de la creación del hábito ni después de su archivado.
 */
export function canLogOn(
  habit: Pick<Habit, 'createdOn' | 'archivedOn'>,
  day: LocalDay,
  today: LocalDay,
  retroLimitDays: number,
): LogPermission {
  if (day > today) return 'future';
  if (day < habit.createdOn) return 'beforeStart';
  if (habit.archivedOn !== null && day > habit.archivedOn) return 'archived';
  if (day < addDays(today, -Math.max(0, retroLimitDays))) return 'tooOld';
  return 'ok';
}
