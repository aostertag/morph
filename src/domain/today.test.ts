import { describe, expect, it } from 'vitest';
import { d, entriesOn, entry, habit, pause } from '@/test/factories';
import { addDays, eachDay } from './day';
import type { EvaluationContext } from './evaluate';
import { validateHabitInput } from './habit';
import { HABIT_TEMPLATES, templateToInput } from './templates';
import {
  analyzeHabit,
  buildDayView,
  dayProgress,
  groupByTimeOfDay,
  isHabitActiveOn,
  viewForDay,
} from './today';
import type { Pause } from './types';

function ctx(today: string, pauses: Pause[] = []): EvaluationContext {
  return { today: d(today), weekStartsOn: 1, pauses };
}

describe('isHabitActiveOn', () => {
  it('solo entre la creación y el archivado', () => {
    const h = habit({ createdOn: d('2026-01-05'), archivedOn: d('2026-01-10') });
    expect(isHabitActiveOn(h, d('2026-01-04'))).toBe(false);
    expect(isHabitActiveOn(h, d('2026-01-05'))).toBe(true);
    expect(isHabitActiveOn(h, d('2026-01-10'))).toBe(true);
    expect(isHabitActiveOn(h, d('2026-01-11'))).toBe(false);
  });
});

describe('buildDayView', () => {
  it('hábito diario: valor, éxito y racha a fecha de hoy', () => {
    const h = habit({ createdOn: d('2026-01-01') });
    const view = buildDayView(
      h,
      entriesOn(['2026-01-01', '2026-01-02', '2026-01-03']),
      ctx('2026-01-03'),
      d('2026-01-03'),
    );
    expect(view).toMatchObject({
      value: 1,
      success: true,
      scheduled: true,
      countsForProgress: true,
      doneForProgress: true,
      period: null,
    });
    expect(view.streak.current).toBe(3);
  });

  it('un día pasado muestra su valor pero la racha sigue siendo la de hoy', () => {
    const h = habit({ createdOn: d('2026-01-01') });
    const view = buildDayView(
      h,
      entriesOn(['2026-01-01', '2026-01-03']),
      ctx('2026-01-03'),
      d('2026-01-02'),
    );
    expect(view).toMatchObject({ value: 0, success: false, doneForProgress: false });
    expect(view.streak.current).toBe(1);
  });

  it('un día no programado no cuenta para el progreso', () => {
    const h = habit({ frequency: { type: 'weekdays', days: [1] }, createdOn: d('2026-01-05') });
    const view = buildDayView(h, [], ctx('2026-01-06'), d('2026-01-06'));
    expect(view).toMatchObject({ scheduled: false, countsForProgress: false });
  });

  it('un día en pausa no cuenta para el progreso', () => {
    const h = habit({ createdOn: d('2026-01-01') });
    const view = buildDayView(
      h,
      [],
      ctx('2026-01-02', [pause('2026-01-02', '2026-01-02')]),
      d('2026-01-02'),
    );
    expect(view).toMatchObject({ paused: true, countsForProgress: false });
  });

  it('a evitar nunca cuenta para el progreso del día', () => {
    const h = habit({ kind: 'avoid', createdOn: d('2026-01-01') });
    const view = buildDayView(h, [], ctx('2026-01-05'), d('2026-01-05'));
    expect(view).toMatchObject({ success: true, countsForProgress: false });
    expect(view.streak.current).toBe(4);
  });

  it('semanal: muestra el progreso de la semana', () => {
    const h = habit({ frequency: { type: 'perWeek', times: 3 }, createdOn: d('2026-01-05') });
    const view = buildDayView(
      h,
      entriesOn(['2026-01-05', '2026-01-06']),
      ctx('2026-01-07'),
      d('2026-01-07'),
    );
    expect(view.period).toEqual({
      start: '2026-01-05',
      end: '2026-01-11',
      achieved: 2,
      required: 3,
      met: false,
    });
    expect(view).toMatchObject({ countsForProgress: true, doneForProgress: false });
  });

  it('semanal con la meta ya cumplida: hoy no queda pendiente', () => {
    const h = habit({ frequency: { type: 'perWeek', times: 2 }, createdOn: d('2026-01-05') });
    const done = entriesOn(['2026-01-05', '2026-01-06']);
    expect(buildDayView(h, done, ctx('2026-01-07'), d('2026-01-07'))).toMatchObject({
      countsForProgress: false,
    });
    // Si además lo hace hoy, cuenta como hecho.
    const again = [...done, entry('2026-01-07')];
    expect(buildDayView(h, again, ctx('2026-01-07'), d('2026-01-07'))).toMatchObject({
      countsForProgress: true,
      doneForProgress: true,
    });
  });

  it('informa del último comodín usado en la racha actual', () => {
    const h = habit({ createdOn: d('2026-01-01') });
    const days = ['01', '02', '03', '04', '05', '06', '07', '09', '10'].map((n) => `2026-01-${n}`);
    const view = buildDayView(h, entriesOn(days), ctx('2026-01-10'), d('2026-01-10'));
    expect(view.lastWildcardInStreak).toEqual({ start: '2026-01-08', end: '2026-01-08' });
  });

  it('no informa de comodines de rachas anteriores', () => {
    const h = habit({ createdOn: d('2026-01-01') });
    const days = ['01', '02', '03', '04', '05', '06', '07', '09', '12'].map((n) => `2026-01-${n}`);
    const view = buildDayView(h, entriesOn(days), ctx('2026-01-12'), d('2026-01-12'));
    expect(view.streak.current).toBe(1);
    expect(view.lastWildcardInStreak).toBeNull();
  });
});

describe('dayProgress', () => {
  it('cuenta hechos sobre programados', () => {
    const today = d('2026-01-05');
    const a = habit({ id: 'a', createdOn: today });
    const b = habit({ id: 'b', createdOn: today });
    const c = habit({ id: 'c', createdOn: today, kind: 'avoid' });
    const entries = [entry('2026-01-05', 1, 'a')];
    const views = [a, b, c].map((h) => buildDayView(h, entries, ctx('2026-01-05'), today));
    expect(dayProgress(views)).toEqual({ done: 1, total: 2, ratio: 0.5, complete: false });
  });

  it('sin nada programado el ratio es 0 y no está completo', () => {
    expect(dayProgress([])).toEqual({ done: 0, total: 0, ratio: 0, complete: false });
  });
});

describe('groupByTimeOfDay', () => {
  it('ordena mañana, tarde, noche y cualquiera, y omite grupos vacíos', () => {
    const items = [
      { habit: habit({ id: '1', timeOfDay: 'any' }) },
      { habit: habit({ id: '2', timeOfDay: 'morning' }) },
      { habit: habit({ id: '3', timeOfDay: 'any' }) },
    ];
    const groups = groupByTimeOfDay(items);
    expect(groups.map((g) => g.timeOfDay)).toEqual(['morning', 'any']);
    expect(groups[1]?.items.map((i) => i.habit.id)).toEqual(['1', '3']);
  });
});

describe('plantillas', () => {
  it('todas son hábitos válidos', () => {
    for (const template of HABIT_TEMPLATES) {
      expect(validateHabitInput(templateToInput(template, d('2026-01-01'))), template.id).toEqual(
        {},
      );
    }
  });

  it('los identificadores son únicos', () => {
    const ids = HABIT_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('rendimiento', () => {
  it('analiza 20 hábitos con 2 años de datos y construye 7 días con holgura', () => {
    const today = d('2026-09-19');
    const start = d('2024-09-19');
    const habits = Array.from({ length: 20 }, (_, i) =>
      habit({
        id: `h${i}`,
        createdOn: start,
        frequency: i % 4 === 0 ? { type: 'perWeek', times: 3 } : { type: 'daily' },
        kind: i % 5 === 0 ? 'quantity' : 'boolean',
        target: i % 5 === 0 ? 8 : null,
      }),
    );
    const allDays = eachDay(start, today);
    const entries = habits.flatMap((h, i) =>
      allDays.filter((_, n) => (n + i) % 3 !== 0).map((day) => entry(day, 8, h.id)),
    );
    const byHabit = new Map(habits.map((h) => [h.id, entries.filter((e) => e.habitId === h.id)]));

    const t0 = performance.now();
    const analyses = habits.map((h) => analyzeHabit(h, byHabit.get(h.id) ?? [], ctx(today)));
    for (const day of eachDay(addDays(today, -6), today)) {
      dayProgress(analyses.map((a) => viewForDay(a, day)));
    }
    const elapsed = performance.now() - t0;
    expect(elapsed).toBeLessThan(250);
  });
});
