import { describe, expect, it } from 'vitest';
import { d, dayLog, days, entriesOn, habit, pause } from '@/test/factories';
import type { LocalDay } from './day';
import { buildHistory, type HabitHistory } from './history';
import { lastCompleteWeek, reviewPending, weekOf, weekSummary } from './review';
import { analyzeHabit } from './today';
import type { Entry, Habit, Pause } from './types';

function history(
  h: Habit,
  entries: readonly Entry[],
  today: string,
  pauses: readonly Pause[] = [],
): HabitHistory {
  const day = d(today);
  return buildHistory(analyzeHabit(h, entries, { today: day, weekStartsOn: 1, pauses }), day);
}

describe('lastCompleteWeek', () => {
  it('con la semana empezando en lunes devuelve la anterior entera', () => {
    // El 2026-09-19 es sábado; su semana empieza el lunes 14.
    expect(lastCompleteWeek(d('2026-09-19'), 1)).toEqual({
      from: '2026-09-07',
      to: '2026-09-13',
    });
  });

  it('con la semana empezando en domingo se desplaza un día', () => {
    expect(lastCompleteWeek(d('2026-09-19'), 0)).toEqual({
      from: '2026-09-06',
      to: '2026-09-12',
    });
  });

  it('el propio primer día de la semana ya mira a la anterior', () => {
    expect(lastCompleteWeek(d('2026-09-14'), 1)).toEqual({
      from: '2026-09-07',
      to: '2026-09-13',
    });
  });

  it('sigue durando siete días aunque haya cambio de horario', () => {
    // El cambio de horario cae el último domingo de marzo en Europa y el primer
    // fin de semana de abril en Chile; la semana civil no se entera.
    for (const today of ['2026-03-30', '2026-04-06', '2026-11-02']) {
      const week = lastCompleteWeek(d(today), 1);
      expect(weekOf(week.from)).toEqual(week);
    }
  });
});

describe('weekSummary', () => {
  const week = weekOf(d('2026-09-07'));
  const today = '2026-09-19';

  it('puntúa la semana y la compara con la anterior', () => {
    const h = habit({ createdOn: d('2026-08-01') });
    // Toda la semana anterior cumplida y solo cuatro días de la revisada.
    const entries = entriesOn([...days('2026-08-31', 7), ...days('2026-09-07', 4)]);
    const summary = weekSummary([history(h, entries, today)], [], week);

    expect(summary.score.current).toMatchObject({ ratio: 4 / 7, days: 7 });
    expect(summary.score.previous).toMatchObject({ ratio: 1, days: 7 });
    expect(summary.score.delta).toBeCloseTo(4 / 7 - 1);
  });

  it('nombra al más constante y al que más costó', () => {
    const leer = habit({ id: 'h1', name: 'Leer', createdOn: d('2026-08-01') });
    const correr = habit({ id: 'h2', name: 'Correr', createdOn: d('2026-08-01') });
    const summary = weekSummary(
      [
        history(leer, entriesOn(days('2026-09-07', 7), 1, 'h1'), today),
        history(correr, entriesOn(days('2026-09-07', 2), 1, 'h2'), today),
      ],
      [],
      week,
    );

    expect(summary.best?.habit.name).toBe('Leer');
    expect(summary.hardest?.habit.name).toBe('Correr');
  });

  it('no nombra al peor si solo hay un hábito', () => {
    const h = habit({ createdOn: d('2026-08-01') });
    const summary = weekSummary([history(h, entriesOn(days('2026-09-07', 3)), today)], [], week);
    expect(summary.best?.habit.id).toBe('h1');
    expect(summary.hardest).toBeNull();
  });

  it('no nombra al peor si todos cumplieron la semana entera', () => {
    const leer = habit({ id: 'h1', name: 'Leer', createdOn: d('2026-08-01') });
    const correr = habit({ id: 'h2', name: 'Correr', createdOn: d('2026-08-01') });
    const summary = weekSummary(
      [
        history(leer, entriesOn(days('2026-09-07', 7), 1, 'h1'), today),
        history(correr, entriesOn(days('2026-09-07', 7), 1, 'h2'), today),
      ],
      [],
      week,
    );
    expect(summary.hardest).toBeNull();
  });

  it('no nombra a nadie si no se cumplió nada', () => {
    const h = habit({ createdOn: d('2026-08-01') });
    const summary = weekSummary([history(h, [], today)], [], week);
    expect(summary.best).toBeNull();
    expect(summary.hardest).toBeNull();
  });

  it('una semana entera en pausa no deja días evaluables', () => {
    const h = habit({ createdOn: d('2026-08-01') });
    const pausa = [pause('2026-09-07', '2026-09-13')];
    const summary = weekSummary([history(h, [], today, pausa)], [], week);
    expect(summary.score.current.days).toBe(0);
    expect(summary.score.current.ratio).toBeNull();
  });

  it('un hábito de días concretos entra aunque solo toque tres días', () => {
    const h = habit({
      createdOn: d('2026-08-01'),
      frequency: { type: 'weekdays', days: [1, 3, 5] },
    });
    // Lunes 7, miércoles 9 y viernes 11: cumple dos de los tres.
    const summary = weekSummary(
      [history(h, entriesOn(['2026-09-07', '2026-09-09']), today)],
      [],
      week,
    );
    expect(summary.ranking.ranked).toHaveLength(1);
    expect(summary.ranking.insufficient).toEqual([]);
    expect(summary.best?.rate.days).toBe(3);
  });

  it('un hábito creado a mitad de semana solo aporta sus días', () => {
    const h = habit({ createdOn: d('2026-09-10') });
    const summary = weekSummary([history(h, entriesOn(days('2026-09-10', 4)), today)], [], week);
    expect(summary.score.current.days).toBe(4);
    expect(summary.score.current.ratio).toBe(1);
  });

  it('los hábitos a evitar van a su propio bloque, no a la puntuación', () => {
    const evitar = habit({ id: 'h9', kind: 'avoid', createdOn: d('2026-08-01') });
    const summary = weekSummary(
      [history(evitar, entriesOn(['2026-09-08', '2026-09-11'], 1, 'h9'), today)],
      [],
      week,
    );
    expect(summary.score.current.habits).toBe(0);
    expect(summary.ranking.ranked).toEqual([]);
    expect(summary.avoid).toHaveLength(1);
    expect(summary.avoid[0]).toMatchObject({ relapses: 2, relapseDays: 2, cleanDays: 5 });
  });

  it('promedia el ánimo y la energía solo de esa semana', () => {
    const h = habit({ createdOn: d('2026-08-01') });
    const logs = [
      dayLog('2026-09-06', 1, 1),
      dayLog('2026-09-08', 4, 2),
      dayLog('2026-09-10', 2, 4),
      dayLog('2026-09-15', 5, 5),
    ];
    const summary = weekSummary([history(h, [], today)], logs, week);
    expect(summary.mood).toBe(3);
    expect(summary.energy).toBe(3);
    expect(summary.loggedDays).toBe(2);
  });

  it('sin registros de ánimo no inventa una media', () => {
    const h = habit({ createdOn: d('2026-08-01') });
    const summary = weekSummary([history(h, [], today)], [dayLog('2026-09-08')], week);
    expect(summary.mood).toBeNull();
    expect(summary.energy).toBeNull();
    expect(summary.loggedDays).toBe(0);
  });
});

describe('reviewPending', () => {
  const week = weekOf(d('2026-09-07'));
  const today = '2026-09-19';
  const withDays = () =>
    weekSummary(
      [history(habit({ createdOn: d('2026-08-01') }), entriesOn(days('2026-09-07', 3)), today)],
      [],
      week,
    );

  it('se ofrece cuando la semana tiene días y no se ha ofrecido', () => {
    expect(reviewPending(withDays(), null, false)).toBe(true);
  });

  it('no se repite si ya se ofreció esa semana', () => {
    expect(reviewPending(withDays(), week.from as LocalDay, false)).toBe(false);
  });

  it('se vuelve a ofrecer cuando la última ofrecida es otra semana', () => {
    expect(reviewPending(withDays(), d('2026-08-31'), false)).toBe(true);
  });

  it('no se ofrece si ya hay una reflexión escrita', () => {
    expect(reviewPending(withDays(), null, true)).toBe(false);
  });

  it('no se ofrece si no había nada que evaluar', () => {
    const vacia = weekSummary(
      [history(habit({ createdOn: d('2026-09-20') }), [], today)],
      [],
      week,
    );
    expect(reviewPending(vacia, null, false)).toBe(false);
  });
});
