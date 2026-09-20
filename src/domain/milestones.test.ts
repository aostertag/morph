import { describe, expect, it } from 'vitest';
import { d, days, entriesOn, habit } from '@/test/factories';
import type { LocalDay } from './day';
import { buildHistory, type HabitHistory } from './history';
import { milestones } from './milestones';
import { analyzeHabit } from './today';
import type { Entry, Habit } from './types';

function analyze(h: Habit, entries: readonly Entry[], today: string) {
  return analyzeHabit(h, entries, { today: d(today), weekStartsOn: 1, pauses: [] });
}

function build(h: Habit, entries: readonly Entry[], today: string) {
  const analysis = analyze(h, entries, today);
  return { history: buildHistory(analysis, d(today)), streak: analysis.streak };
}

/** Fecha en que se alcanzó un hito concreto, o `null`. */
function on(
  history: HabitHistory,
  streak: Parameters<typeof milestones>[1],
  kind: string,
  threshold: number,
) {
  const list = milestones(history, streak);
  const found = [...list.achieved, ...list.next].find(
    (m) => m.kind === kind && m.threshold === threshold,
  );
  return found?.achievedOn ?? null;
}

describe('hitos de un hábito diario', () => {
  const daily = habit({ createdOn: d('2026-01-01') });

  it('fecha la racha de 7 el día en que se alcanza', () => {
    const { history, streak } = build(daily, entriesOn(days('2026-01-01', 10)), '2026-01-10');
    expect(on(history, streak, 'streak', 7)).toBe('2026-01-07');
  });

  it('cuenta los días cumplidos y los días con registro por separado', () => {
    // Diez días seguidos: 10 unidades cumplidas y 10 registros.
    const { history, streak } = build(daily, entriesOn(days('2026-01-01', 10)), '2026-01-10');
    expect(on(history, streak, 'completed', 10)).toBe('2026-01-10');
    expect(on(history, streak, 'logged', 10)).toBe('2026-01-10');
  });

  it('no da por alcanzado lo que aún no se ha llegado', () => {
    const { history, streak } = build(daily, entriesOn(days('2026-01-01', 10)), '2026-01-10');
    expect(on(history, streak, 'streak', 14)).toBeNull();
    expect(on(history, streak, 'completed', 30)).toBeNull();
  });

  it('ordena los alcanzados del más reciente al más antiguo', () => {
    const { history, streak } = build(daily, entriesOn(days('2026-01-01', 40)), '2026-02-09');
    const achieved = milestones(history, streak).achieved;
    const dates = achieved.map((m) => m.achievedOn as LocalDay);
    expect(dates).toEqual([...dates].sort().reverse());
    expect(achieved.length).toBeGreaterThan(0);
  });

  it('ofrece el siguiente pendiente de cada familia con su progreso', () => {
    const { history, streak } = build(daily, entriesOn(days('2026-01-01', 10)), '2026-01-10');
    const next = milestones(history, streak).next;
    expect(next.map((m) => [m.kind, m.threshold, m.progress])).toEqual([
      ['streak', 14, 10],
      ['completed', 30, 10],
      ['logged', 50, 10],
    ]);
  });

  it('sin siguiente cuando ya se han alcanzado todos', () => {
    const { history, streak } = build(daily, entriesOn(days('2026-01-01', 1200)), '2029-04-14');
    expect(milestones(history, streak).next).toEqual([]);
  });
});

describe('un registro retroactivo recalcula sin inventar hitos', () => {
  const daily = habit({ createdOn: d('2026-01-01') });

  it('rellenar un hueco adelanta la fecha de la racha, sin duplicarla', () => {
    // Falta el día 4, y con solo tres de racha no hay comodín que lo cubra: la
    // racha se reinicia y los siete seguidos no llegan hasta el día 11.
    const roto = entriesOn([...days('2026-01-01', 3), ...days('2026-01-05', 7)]);
    const antes = build(daily, roto, '2026-01-12');
    const despues = build(daily, entriesOn(days('2026-01-01', 11)), '2026-01-12');

    expect(on(antes.history, antes.streak, 'streak', 7)).toBe('2026-01-11');
    expect(on(despues.history, despues.streak, 'streak', 7)).toBe('2026-01-07');

    const lista = milestones(despues.history, despues.streak).achieved;
    const claves = lista.map((m) => `${m.kind}:${m.threshold}`);
    expect(new Set(claves).size).toBe(claves.length);
  });
});

describe('escala de umbrales según la unidad', () => {
  it('un hábito por semana cuenta rachas en semanas', () => {
    const semanal = habit({
      createdOn: d('2026-01-05'),
      frequency: { type: 'perWeek', times: 2 },
    });
    // Dos registros en cada una de las cuatro primeras semanas.
    const entries = entriesOn([
      '2026-01-05',
      '2026-01-07',
      '2026-01-12',
      '2026-01-14',
      '2026-01-19',
      '2026-01-21',
      '2026-01-26',
      '2026-01-28',
    ]);
    const { history, streak } = build(semanal, entries, '2026-02-02');
    expect(history.unit).toBe('week');
    expect(on(history, streak, 'streak', 4)).toBe('2026-02-01');
    // El umbral diario de 7 no existe en un hábito semanal.
    expect(on(history, streak, 'streak', 7)).toBeNull();
  });

  it('un hábito mensual empieza en tres meses', () => {
    const mensual = habit({
      createdOn: d('2026-01-01'),
      frequency: { type: 'perMonth', times: 1 },
    });
    const entries = entriesOn(['2026-01-10', '2026-02-10', '2026-03-10']);
    const { history, streak } = build(mensual, entries, '2026-04-01');
    expect(history.unit).toBe('month');
    expect(on(history, streak, 'streak', 3)).toBe('2026-03-31');
  });
});

describe('hábitos a evitar', () => {
  const evitar = habit({ kind: 'avoid', createdOn: d('2026-01-01') });

  it('no tiene hitos de registros: un registro es una recaída', () => {
    const { history, streak } = build(evitar, entriesOn(days('2026-01-01', 12)), '2026-01-20');
    const kinds = new Set(
      [...milestones(history, streak).achieved, ...milestones(history, streak).next].map(
        (m) => m.kind,
      ),
    );
    expect(kinds.has('logged')).toBe(false);
  });

  it('cuenta los días limpios cerrados como unidades cumplidas', () => {
    const { history, streak } = build(evitar, [], '2026-01-20');
    expect(on(history, streak, 'completed', 10)).toBe('2026-01-10');
    expect(on(history, streak, 'streak', 7)).toBe('2026-01-07');
  });
});
