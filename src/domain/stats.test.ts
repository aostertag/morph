import { describe, expect, it } from 'vitest';
import { d, days, entriesOn, habit, pause } from '@/test/factories';
import type { LocalDay } from './day';
import { buildHistory, type HabitHistory } from './history';
import type { DayRange } from './range';
import {
  avoidSummaries,
  consistencyRanking,
  momentum,
  periodScore,
  scoreBucket,
  scoreComparison,
  scoreSeries,
  weekdayBreakdown,
} from './stats';
import { analyzeHabit } from './today';
import type { Entry, Habit, Pause } from './types';

function history(
  h: Habit,
  entries: readonly Entry[],
  today: LocalDay,
  pauses: readonly Pause[] = [],
): HabitHistory {
  return buildHistory(analyzeHabit(h, entries, { today, weekStartsOn: 1, pauses }), today);
}

const range = (from: string, to: string): DayRange => ({ from: d(from), to: d(to) });

describe('periodScore', () => {
  const today = d('2026-01-20');

  it('pesa cada hábito por sus días evaluables', () => {
    const leer = habit({ id: 'leer', createdOn: d('2026-01-01') });
    const correr = habit({ id: 'correr', createdOn: d('2026-01-01') });
    const histories = [
      history(
        leer,
        entriesOn(['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04'], 1, 'leer'),
        today,
      ),
      history(correr, entriesOn(['2026-01-01', '2026-01-02'], 1, 'correr'), today),
    ];
    const score = periodScore(histories, range('2026-01-01', '2026-01-04'));
    expect(score).toEqual({ ratio: 6 / 8, days: 8, habits: 2 });
  });

  it('no cuenta los hábitos a evitar', () => {
    const evitar = habit({ id: 'redes', kind: 'avoid', createdOn: d('2026-01-01') });
    const score = periodScore([history(evitar, [], today)], range('2026-01-01', '2026-01-04'));
    expect(score).toEqual({ ratio: null, days: 0, habits: 0 });
  });

  it('las pausas no cuentan ni a favor ni en contra', () => {
    const h = habit({ id: 'leer', createdOn: d('2026-01-01') });
    const pausa = pause('2026-01-03', '2026-01-04', 'leer');
    const score = periodScore(
      [history(h, entriesOn(['2026-01-01', '2026-01-02'], 1, 'leer'), today, [pausa])],
      range('2026-01-01', '2026-01-04'),
    );
    expect(score).toEqual({ ratio: 1, days: 2, habits: 1 });
  });
});

describe('scoreComparison', () => {
  const today = d('2026-01-20');
  const h = habit({ id: 'leer', createdOn: d('2026-01-01') });

  it('compara con el período anterior en puntos de proporción', () => {
    const entries = [
      ...entriesOn(['2026-01-09', '2026-01-10', '2026-01-11', '2026-01-12'], 1, 'leer'),
      ...entriesOn(['2026-01-01', '2026-01-02'], 1, 'leer'),
    ];
    const comparison = scoreComparison(
      [history(h, entries, today)],
      range('2026-01-09', '2026-01-16'),
      range('2026-01-01', '2026-01-08'),
    );
    expect(comparison.current.ratio).toBe(0.5);
    expect(comparison.previous?.ratio).toBe(0.25);
    expect(comparison.delta).toBeCloseTo(0.25, 10);
  });

  it('no compara si el período anterior tiene menos de una semana evaluable', () => {
    const reciente = habit({ id: 'nuevo', createdOn: d('2026-01-09') });
    const comparison = scoreComparison(
      [history(reciente, [], today)],
      range('2026-01-09', '2026-01-16'),
      range('2026-01-01', '2026-01-08'),
    );
    expect(comparison.previous).toBeNull();
    expect(comparison.delta).toBeNull();
  });
});

describe('scoreSeries', () => {
  const today = d('2026-01-20');
  const h = habit({ id: 'leer', createdOn: d('2026-01-01') });

  it('elige el tramo según la longitud del rango', () => {
    expect(scoreBucket(7)).toBe('day');
    expect(scoreBucket(31)).toBe('week');
    expect(scoreBucket(365)).toBe('month');
  });

  it('recorta el primer y el último tramo al rango', () => {
    const points = scoreSeries(
      [history(h, entriesOn(days('2026-01-05', 10), 1, 'leer'), today)],
      range('2026-01-06', '2026-01-19'),
      'week',
      1,
      today,
    );
    expect(points.map((p) => [p.start, p.end])).toEqual([
      ['2026-01-06', '2026-01-11'],
      ['2026-01-12', '2026-01-18'],
      ['2026-01-19', '2026-01-19'],
    ]);
    expect(points[0]?.score.ratio).toBe(1);
    expect(points[2]?.score.ratio).toBe(0);
  });

  it('marca el tramo que contiene hoy', () => {
    const points = scoreSeries(
      [history(h, [], today)],
      range('2026-01-01', '2026-01-20'),
      'week',
      1,
      today,
    );
    expect(points.at(-1)?.current).toBe(true);
    expect(points.slice(0, -1).every((p) => !p.current)).toBe(true);
  });
});

describe('consistencyRanking', () => {
  const today = d('2026-01-20');

  it('ordena por tasa y aparta los hábitos con pocos días', () => {
    const constante = habit({ id: 'a', name: 'Constante', createdOn: d('2026-01-01') });
    const flojo = habit({ id: 'b', name: 'Flojo', createdOn: d('2026-01-01') });
    const nuevo = habit({ id: 'c', name: 'Nuevo', createdOn: d('2026-01-18') });
    const histories = [
      history(
        constante,
        entriesOn(
          [
            '2026-01-01',
            '2026-01-02',
            '2026-01-03',
            '2026-01-04',
            '2026-01-05',
            '2026-01-06',
            '2026-01-07',
          ],
          1,
          'a',
        ),
        today,
      ),
      history(flojo, entriesOn(['2026-01-01'], 1, 'b'), today),
      history(nuevo, entriesOn(['2026-01-18'], 1, 'c'), today),
    ];
    const { ranked, insufficient } = consistencyRanking(
      histories,
      range('2026-01-01', '2026-01-19'),
    );
    expect(ranked.map((r) => r.habit.name)).toEqual(['Constante', 'Flojo']);
    expect(insufficient.map((r) => r.habit.name)).toEqual(['Nuevo']);
  });
});

describe('weekdayBreakdown', () => {
  // Cuatro semanas completas: todos los domingos hechos, ningún lunes.
  const today = d('2026-02-01');
  const h = habit({ id: 'leer', createdOn: d('2026-01-04') });
  const entries = entriesOn(
    [
      '2026-01-04',
      '2026-01-11',
      '2026-01-18',
      '2026-01-25', // domingos
      '2026-01-06',
      '2026-01-13', // martes
      '2026-01-07',
      '2026-01-14', // miércoles
      '2026-01-08',
      '2026-01-15', // jueves
      '2026-01-09',
      '2026-01-16', // viernes
      '2026-01-10',
      '2026-01-17', // sábados
    ],
    1,
    'leer',
  );

  it('nombra el mejor y el peor día cuando hay muestra', () => {
    const breakdown = weekdayBreakdown(
      [history(h, entries, today)],
      range('2026-01-04', '2026-01-31'),
      28,
    );
    expect(breakdown.best).toBe(0);
    expect(breakdown.worst).toBe(1);
    expect(breakdown.scores[0]).toEqual({ weekday: 0, days: 4, ratio: 1 });
    expect(breakdown.scores[1]).toEqual({ weekday: 1, days: 4, ratio: 0 });
  });

  it('con menos de dos semanas no se pronuncia', () => {
    const breakdown = weekdayBreakdown(
      [history(h, entries, today)],
      range('2026-01-04', '2026-01-10'),
      7,
    );
    expect(breakdown.best).toBeNull();
    expect(breakdown.worst).toBeNull();
    expect(breakdown.scores.every((s) => s.days <= 1)).toBe(true);
  });
});

describe('momentum', () => {
  const today = d('2026-03-01');
  const h = habit({ id: 'leer', createdOn: d('2026-01-01') });

  it('detecta un hábito que mejora', () => {
    const entries = entriesOn(days('2026-02-02', 27), 1, 'leer');
    const { improving, declining, measured } = momentum([history(h, entries, today)], today);
    expect(measured).toBe(1);
    expect(declining).toHaveLength(0);
    expect(improving[0]?.habit.id).toBe('leer');
    expect(improving[0]?.delta).toBeGreaterThan(0.9);
  });

  it('detecta un hábito que decae', () => {
    const entries = entriesOn(days('2026-01-05', 28), 1, 'leer');
    const { improving, declining } = momentum([history(h, entries, today)], today);
    expect(improving).toHaveLength(0);
    expect(declining[0]?.delta).toBeLessThan(-0.9);
  });

  it('ignora los cambios pequeños y los hábitos sin muestra en las dos ventanas', () => {
    const entries = entriesOn(days('2026-01-05', 55), 1, 'leer');
    const estable = momentum([history(h, entries, today)], today);
    expect(estable.improving).toHaveLength(0);
    expect(estable.declining).toHaveLength(0);
    expect(estable.measured).toBe(1);

    const nuevo = habit({ id: 'nuevo', createdOn: d('2026-02-25') });
    expect(momentum([history(nuevo, [], today)], today).measured).toBe(0);
  });
});

describe('avoidSummaries', () => {
  const today = d('2026-01-20');
  const h = habit({ id: 'redes', name: 'Redes', kind: 'avoid', createdOn: d('2026-01-01') });

  it('cuenta recaídas y las compara con el período anterior', () => {
    const entries = [
      ...entriesOn(['2026-01-10', '2026-01-12'], 1, 'redes'),
      ...entriesOn(['2026-01-02', '2026-01-03', '2026-01-04'], 1, 'redes'),
    ];
    const [summary] = avoidSummaries(
      [history(h, entries, today)],
      range('2026-01-09', '2026-01-16'),
      range('2026-01-01', '2026-01-08'),
    );
    expect(summary).toMatchObject({
      relapses: 2,
      relapseDays: 2,
      cleanDays: 6,
      previousRelapses: 3,
    });
  });

  it('no compara si el hábito no existía en el período anterior', () => {
    const nuevo = habit({ id: 'redes', kind: 'avoid', createdOn: d('2026-01-09') });
    const [summary] = avoidSummaries(
      [history(nuevo, [], today)],
      range('2026-01-09', '2026-01-16'),
      range('2026-01-01', '2026-01-08'),
    );
    expect(summary?.previousRelapses).toBeNull();
  });
});
