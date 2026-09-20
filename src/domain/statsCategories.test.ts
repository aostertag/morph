import { describe, expect, it } from 'vitest';
import { d, days, entriesOn, habit, pause } from '@/test/factories';
import type { LocalDay } from './day';
import { buildHistory, type HabitHistory } from './history';
import type { DayRange } from './range';
import { categoryBreakdown, hasCategorizedHabits, periodScore } from './stats';
import { analyzeHabit } from './today';
import type { Category, Entry, Habit, Pause } from './types';

function history(
  h: Habit,
  entries: readonly Entry[],
  today: LocalDay,
  pauses: readonly Pause[] = [],
): HabitHistory {
  return buildHistory(analyzeHabit(h, entries, { today, weekStartsOn: 1, pauses }), today);
}

const range = (from: string, to: string): DayRange => ({ from: d(from), to: d(to) });

describe('categoryBreakdown', () => {
  const today = d('2026-01-20');
  const current = range('2026-01-09', '2026-01-16');
  const before = range('2026-01-01', '2026-01-08');
  const salud: Category = { id: 'salud', name: 'Salud', order: 0 };
  const mente: Category = { id: 'mente', name: 'Mente', order: 1 };
  const categories = [salud, mente];

  const done = (id: string, from: string, count: number) => entriesOn(days(from, count), 1, id);
  const daily = (id: string, categoryId: string | null, createdOn = '2026-01-01') =>
    habit({ id, name: id, categoryId, createdOn: d(createdOn) });

  it('ordena por cumplimiento y cada grupo sale de la misma puntuación que la general', () => {
    const a = history(daily('a', 'salud'), done('a', '2026-01-09', 8), today);
    const b = history(daily('b', 'salud'), done('b', '2026-01-09', 4), today);
    const c = history(daily('c', 'mente'), done('c', '2026-01-09', 8), today);
    const { ranked, insufficient, uncategorized } = categoryBreakdown(
      [a, b, c],
      categories,
      current,
      before,
    );
    expect(ranked.map((g) => g.category?.name)).toEqual(['Mente', 'Salud']);
    expect(ranked[1]?.comparison.current).toEqual(periodScore([a, b], current));
    expect(ranked[1]?.comparison.current).toEqual({ ratio: 12 / 16, days: 16, habits: 2 });
    expect(insufficient).toEqual([]);
    expect(uncategorized).toBeNull();
  });

  it('las categorías y los sin categoría suman exactamente la puntuación general', () => {
    const a = history(daily('a', 'salud'), done('a', '2026-01-09', 5), today);
    const c = history(daily('c', 'mente'), done('c', '2026-01-09', 2), today);
    const s = history(daily('s', null), done('s', '2026-01-09', 7), today);
    const { ranked, uncategorized } = categoryBreakdown([a, c, s], categories, current, before);
    const groups = [...ranked, ...(uncategorized ? [uncategorized] : [])];
    const credit = groups.reduce(
      (sum, g) => sum + (g.comparison.current.ratio ?? 0) * g.comparison.current.days,
      0,
    );
    const total = periodScore([a, c, s], current);
    expect(groups.reduce((sum, g) => sum + g.comparison.current.days, 0)).toBe(total.days);
    expect(credit / total.days).toBeCloseTo(total.ratio ?? 0, 10);
  });

  it('aparta las categorías con menos de una semana evaluable en vez de ordenarlas', () => {
    const histories = [
      history(daily('a', 'salud'), done('a', '2026-01-09', 8), today),
      history(daily('b', 'mente', '2026-01-13'), [], today),
    ];
    const { ranked, insufficient } = categoryBreakdown(histories, categories, current, before);
    expect(ranked.map((g) => g.category?.name)).toEqual(['Salud']);
    expect(insufficient.map((g) => g.category?.name)).toEqual(['Mente']);
    expect(insufficient[0]?.comparison.current.days).toBe(4);
  });

  it('los hábitos sin categoría van aparte y fuera del orden', () => {
    const histories = [
      history(daily('a', 'salud'), done('a', '2026-01-09', 4), today),
      history(daily('s', null), done('s', '2026-01-09', 8), today),
    ];
    const { ranked, uncategorized } = categoryBreakdown(histories, categories, current, before);
    expect(ranked.map((g) => g.category?.name)).toEqual(['Salud']);
    expect(uncategorized?.category).toBeNull();
    expect(uncategorized?.comparison.current.ratio).toBe(1);
  });

  it('sin categoría con poca muestra se aparta con las demás, al final', () => {
    const histories = [
      history(daily('s', null, '2026-01-14'), [], today),
      history(daily('n', 'mente', '2026-01-13'), [], today),
    ];
    const { uncategorized, insufficient } = categoryBreakdown(
      histories,
      categories,
      current,
      before,
    );
    expect(uncategorized).toBeNull();
    expect(insufficient.map((g) => g.category?.name ?? null)).toEqual(['Mente', null]);
  });

  it('una categoría que no existe cuenta como sin categoría', () => {
    const histories = [history(daily('x', 'borrada'), done('x', '2026-01-09', 8), today)];
    const { ranked, uncategorized } = categoryBreakdown(histories, categories, current, before);
    expect(ranked).toEqual([]);
    expect(uncategorized?.comparison.current.days).toBe(8);
  });

  it('los hábitos a evitar no cuentan: una categoría solo con ellos no aparece', () => {
    const evitar = habit({
      id: 'redes',
      kind: 'avoid',
      categoryId: 'mente',
      createdOn: d('2026-01-01'),
    });
    const histories = [
      history(evitar, [], today),
      history(daily('a', 'salud'), done('a', '2026-01-09', 8), today),
    ];
    const { ranked, insufficient } = categoryBreakdown(histories, categories, current, before);
    expect(ranked.map((g) => g.category?.name)).toEqual(['Salud']);
    expect(insufficient).toEqual([]);
  });

  it('compara con el período anterior solo si las dos muestras llegan', () => {
    const histories = [
      history(
        daily('a', 'salud'),
        [...done('a', '2026-01-01', 4), ...done('a', '2026-01-09', 8)],
        today,
      ),
      history(daily('n', 'mente', '2026-01-07'), done('n', '2026-01-09', 8), today),
    ];
    const { ranked } = categoryBreakdown(histories, categories, current, before);
    const saludGroup = ranked.find((g) => g.category?.id === 'salud');
    const menteGroup = ranked.find((g) => g.category?.id === 'mente');
    expect(saludGroup?.comparison.previous?.ratio).toBe(0.5);
    expect(saludGroup?.comparison.delta).toBeCloseTo(0.5, 10);
    // «Mente» solo tiene dos días evaluables antes: no hay comparación.
    expect(menteGroup?.comparison.previous).toBeNull();
    expect(menteGroup?.comparison.delta).toBeNull();
  });

  it('las pausas restan días evaluables y una categoría entera en pausa se aparta con 0 días', () => {
    const histories = [
      history(daily('a', 'salud'), done('a', '2026-01-09', 8), today, [
        pause('2026-01-09', '2026-01-09', 'a'),
      ]),
      history(daily('b', 'mente'), [], today, [pause('2026-01-01', '2026-01-31', 'b')]),
    ];
    const { ranked, insufficient } = categoryBreakdown(histories, categories, current, before);
    expect(ranked.map((g) => g.comparison.current.days)).toEqual([7]);
    expect(insufficient.map((g) => [g.category?.name, g.comparison.current.days])).toEqual([
      ['Mente', 0],
    ]);

    // Con dos días en pausa quedan 6: por debajo de la muestra, se aparta.
    const shorter = [
      history(daily('a', 'salud'), done('a', '2026-01-09', 8), today, [
        pause('2026-01-09', '2026-01-10', 'a'),
      ]),
    ];
    const result = categoryBreakdown(shorter, categories, current, before);
    expect(result.ranked).toEqual([]);
    expect(result.insufficient.map((g) => g.comparison.current.days)).toEqual([6]);
  });

  it('desempata por días y luego por nombre', () => {
    const histories = [
      history(daily('c', 'mente'), done('c', '2026-01-09', 8), today),
      history(daily('a', 'salud'), done('a', '2026-01-09', 8), today),
    ];
    const { ranked } = categoryBreakdown(histories, categories, current, before);
    expect(ranked.map((g) => g.category?.name)).toEqual(['Mente', 'Salud']);
  });
});

describe('hasCategorizedHabits', () => {
  const today = d('2026-01-20');
  const cats: Category[] = [{ id: 'salud', name: 'Salud', order: 0 }];

  it('es falso sin categorías, sin asignaciones o solo con hábitos a evitar', () => {
    const sin = history(habit({ id: 'a', categoryId: null }), [], today);
    const evitar = history(habit({ id: 'e', kind: 'avoid', categoryId: 'salud' }), [], today);
    expect(hasCategorizedHabits([sin], cats)).toBe(false);
    expect(hasCategorizedHabits([sin], [])).toBe(false);
    expect(hasCategorizedHabits([evitar], cats)).toBe(false);
  });

  it('es verdadero con un hábito que puntúa en una categoría existente', () => {
    const con = history(habit({ id: 'a', categoryId: 'salud' }), [], today);
    expect(hasCategorizedHabits([con], cats)).toBe(true);
    expect(hasCategorizedHabits([con], [])).toBe(false);
  });
});
