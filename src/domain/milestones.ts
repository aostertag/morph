import type { LocalDay } from './day';
import type { PeriodUnit } from './frequency';
import type { HabitHistory } from './history';
import type { StreakSummary } from './streaks';

/*
 * Hitos de un hábito. Se derivan de la historia, igual que los comodines: no se
 * guardan en ninguna parte, así que un registro retroactivo los recalcula solo y
 * ninguna fecha puede quedarse mintiendo.
 *
 * El texto de cada hito no vive aquí: el dominio no sabe español. Las etiquetas
 * salen de `features/habit-detail/describe.ts`.
 */

export type MilestoneKind = 'streak' | 'completed' | 'logged';

export interface Milestone {
  readonly kind: MilestoneKind;
  readonly threshold: number;
  /** Día en que se alcanzó; `null` si sigue pendiente. */
  readonly achievedOn: LocalDay | null;
  /** Valor actual del contador, para medir lo que falta. */
  readonly progress: number;
}

export interface Milestones {
  /** Alcanzados, del más reciente al más antiguo. */
  readonly achieved: readonly Milestone[];
  /** El siguiente pendiente de cada familia; como mucho uno por `kind`. */
  readonly next: readonly Milestone[];
  readonly unit: PeriodUnit;
}

/**
 * Umbrales de racha y de unidades cumplidas, escalados a la unidad del hábito:
 * pedirle 365 a uno mensual sería pedirle treinta años.
 */
const STREAK_THRESHOLDS: Readonly<Record<PeriodUnit, readonly number[]>> = {
  day: [7, 14, 30, 60, 100, 200, 365],
  week: [4, 8, 12, 26, 52],
  month: [3, 6, 12, 24],
};

const COMPLETED_THRESHOLDS: Readonly<Record<PeriodUnit, readonly number[]>> = {
  day: [1, 10, 30, 50, 100, 250, 500, 1000],
  week: [1, 4, 12, 26, 52, 104],
  month: [1, 3, 6, 12, 24],
};

const LOGGED_THRESHOLDS: readonly number[] = [10, 50, 100, 250, 500, 1000];

/**
 * Empareja unos umbrales con el día en que se cruzaron. `marks` lleva, en orden
 * creciente, el valor del contador y el día en que alcanzó ese valor.
 */
function match(
  kind: MilestoneKind,
  thresholds: readonly number[],
  marks: readonly { readonly value: number; readonly day: LocalDay }[],
  progress: number,
): Milestone[] {
  return thresholds.map((threshold) => ({
    kind,
    threshold,
    achievedOn: marks.find((mark) => mark.value >= threshold)?.day ?? null,
    progress,
  }));
}

/** Días en que el contador de unidades cumplidas subió, en orden. */
function completedMarks(history: HabitHistory) {
  const marks: { value: number; day: LocalDay }[] = [];
  let count = 0;
  for (const unit of history.units) {
    if (unit.status !== 'done') continue;
    count++;
    marks.push({ value: count, day: unit.end });
  }
  return { marks, total: count };
}

/** Días en que el contador de días con registro subió, en orden. */
function loggedMarks(history: HabitHistory) {
  const marks: { value: number; day: LocalDay }[] = [];
  let count = 0;
  for (const record of history.days) {
    if (record.value <= 0) continue;
    count++;
    marks.push({ value: count, day: record.day });
  }
  return { marks, total: count };
}

/**
 * Hitos alcanzados y el siguiente de cada familia.
 *
 * En los hábitos "a evitar" no hay familia de registros: un registro es una
 * recaída y no se celebra. Sus unidades cumplidas son los días limpios cerrados.
 */
export function milestones(history: HabitHistory, streak: StreakSummary): Milestones {
  const avoid = history.habit.kind === 'avoid';
  const completed = completedMarks(history);
  const streakMarks = streak.records.map((record) => ({ value: record.length, day: record.end }));

  const all = [
    ...match('streak', STREAK_THRESHOLDS[history.unit], streakMarks, streak.best),
    ...match('completed', COMPLETED_THRESHOLDS[history.unit], completed.marks, completed.total),
  ];

  if (!avoid) {
    const logged = loggedMarks(history);
    all.push(...match('logged', LOGGED_THRESHOLDS, logged.marks, logged.total));
  }

  const achieved = all
    .filter((milestone): milestone is Milestone & { achievedOn: LocalDay } => {
      return milestone.achievedOn !== null;
    })
    .sort((a, b) =>
      a.achievedOn === b.achievedOn
        ? b.threshold - a.threshold
        : a.achievedOn < b.achievedOn
          ? 1
          : -1,
    );

  // El siguiente de cada familia es el umbral más bajo que aún no se ha cruzado.
  const next: Milestone[] = [];
  for (const kind of ['streak', 'completed', 'logged'] as const) {
    const pending = all.find(
      (milestone) => milestone.kind === kind && milestone.achievedOn === null,
    );
    if (pending) next.push(pending);
  }

  return { achieved, next, unit: history.unit };
}
