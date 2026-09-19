import { describe, expect, it } from 'vitest';
import { d, days, entriesOn, entry, habit, pause } from '@/test/factories';
import { buildHistory } from './history';
import {
  avoidStats,
  completionRate,
  historyFeed,
  rateSeries,
  rateWindows,
  seriesBucket,
  totals,
  valueSeries,
  valueStats,
  weekdayStats,
} from './metrics';
import { analyzeHabit } from './today';
import type { Entry, Habit, Pause } from './types';

function setup(h: Habit, entries: Entry[], today: string, pauses: Pause[] = []) {
  const ctx = { today: d(today), weekStartsOn: 1 as const, pauses };
  const analysis = analyzeHabit(h, entries, ctx);
  return { analysis, history: buildHistory(analysis, d(today)) };
}

function hist(h: Habit, entries: Entry[], today: string, pauses: Pause[] = []) {
  return setup(h, entries, today, pauses).history;
}

describe('completionRate', () => {
  it('diario: cumplidos entre evaluables; hoy sin hacer no cuenta', () => {
    const h = habit({ createdOn: d('2026-03-01') });
    const history = hist(h, entriesOn(['2026-03-01', '2026-03-02', '2026-03-04']), '2026-03-05');
    expect(completionRate(history, d('2026-03-01'), d('2026-03-05'))).toEqual({
      ratio: 3 / 4,
      days: 4,
      doneDays: 3,
      units: 4,
      doneUnits: 3,
    });
  });

  it('hoy cuenta si ya está hecho', () => {
    const h = habit({ createdOn: d('2026-03-01') });
    const history = hist(h, entriesOn(['2026-03-02']), '2026-03-02');
    expect(completionRate(history, d('2026-03-01'), d('2026-03-02')).ratio).toBe(1 / 2);
  });

  it('sin días evaluables: ratio null', () => {
    const h = habit({ createdOn: d('2026-03-05') });
    expect(completionRate(hist(h, [], '2026-03-05'), d('2026-03-01'), d('2026-03-05'))).toEqual({
      ratio: null,
      days: 0,
      doneDays: 0,
      units: 0,
      doneUnits: 0,
    });
  });

  it('las pausas no cuentan', () => {
    const h = habit({ createdOn: d('2026-03-01') });
    const history = hist(h, entriesOn(['2026-03-01']), '2026-03-05', [
      pause('2026-03-02', '2026-03-04'),
    ]);
    expect(completionRate(history, d('2026-03-01'), d('2026-03-05'))).toMatchObject({
      ratio: 1,
      days: 1,
    });
  });

  it('los comodines no maquillan la tasa', () => {
    const h = habit({ createdOn: d('2026-03-01') });
    const history = hist(h, entriesOn([...days('2026-03-01', 7), '2026-03-09']), '2026-03-10');
    // El 8 lo cubre un comodín para la racha, pero sigue fallado.
    expect(completionRate(history, d('2026-03-01'), d('2026-03-09')).ratio).toBe(8 / 9);
  });

  it('días concretos: solo cuentan los días que tocan', () => {
    // Lunes y miércoles; 2026-03-02 es lunes.
    const h = habit({ createdOn: d('2026-03-02'), frequency: { type: 'weekdays', days: [1, 3] } });
    const history = hist(h, entriesOn(['2026-03-02']), '2026-03-08');
    expect(completionRate(history, d('2026-03-02'), d('2026-03-08'))).toMatchObject({
      ratio: 1 / 2,
      days: 2,
    });
  });

  it('por semana: cada día hereda el resultado de su semana', () => {
    // 3 veces por semana. Semana del 2: cumplida. Semana del 9: 1 de 3.
    const h = habit({ createdOn: d('2026-03-02'), frequency: { type: 'perWeek', times: 3 } });
    const history = hist(
      h,
      entriesOn(['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-10']),
      '2026-03-16',
    );
    const both = completionRate(history, d('2026-03-02'), d('2026-03-15'));
    expect(both.ratio).toBeCloseTo((7 * 1 + 7 * (1 / 3)) / 14);
    expect(both).toMatchObject({ days: 14, units: 2, doneUnits: 1, doneDays: 7 });
    // Una ventana que solo toca 3 días de la primera semana y 4 de la segunda.
    const cut = completionRate(history, d('2026-03-06'), d('2026-03-12'));
    expect(cut.ratio).toBeCloseTo((3 * 1 + 4 * (1 / 3)) / 7);
  });

  it('por semana: la semana en curso sin cumplir no cuenta; cumplida sí', () => {
    const h = habit({ createdOn: d('2026-03-02'), frequency: { type: 'perWeek', times: 2 } });
    const open = hist(h, entriesOn(['2026-03-02']), '2026-03-04');
    expect(completionRate(open, d('2026-03-02'), d('2026-03-04')).ratio).toBeNull();
    const done = hist(h, entriesOn(['2026-03-02', '2026-03-03']), '2026-03-04');
    expect(completionRate(done, d('2026-03-02'), d('2026-03-04'))).toMatchObject({
      ratio: 1,
      days: 3,
    });
  });

  it('por semana: una semana entera en pausa no cuenta', () => {
    const h = habit({ createdOn: d('2026-03-02'), frequency: { type: 'perWeek', times: 2 } });
    const history = hist(h, entriesOn(['2026-03-10', '2026-03-11']), '2026-03-16', [
      pause('2026-03-02', '2026-03-08'),
    ]);
    expect(completionRate(history, d('2026-03-02'), d('2026-03-15'))).toMatchObject({
      ratio: 1,
      days: 7,
      units: 1,
    });
  });

  it('por semana: creado a mitad de semana prorratea la meta', () => {
    // Creado el jueves: quedan 4 de 7 días, meta ceil(3 × 4 / 7) = 2.
    const h = habit({ createdOn: d('2026-03-05'), frequency: { type: 'perWeek', times: 3 } });
    const history = hist(h, entriesOn(['2026-03-05', '2026-03-06']), '2026-03-09');
    expect(completionRate(history, d('2026-03-05'), d('2026-03-08'))).toMatchObject({
      ratio: 1,
      days: 4,
      doneUnits: 1,
    });
  });

  it('a evitar: días limpios; una recaída hoy cuenta como fallo', () => {
    const h = habit({ kind: 'avoid', createdOn: d('2026-03-01') });
    const history = hist(h, [entry('2026-03-02'), entry('2026-03-04')], '2026-03-04');
    expect(completionRate(history, d('2026-03-01'), d('2026-03-04'))).toMatchObject({
      ratio: 2 / 4,
      days: 4,
    });
  });
});

describe('rateWindows', () => {
  it('7, 30, 90 días y total', () => {
    const h = habit({ createdOn: d('2026-01-01') });
    const history = hist(h, entriesOn(days('2026-03-24', 7)), '2026-03-31');
    const rates = rateWindows(history);
    expect(rates[7]).toMatchObject({ days: 6, doneDays: 6, ratio: 1 });
    expect(rates[30]).toMatchObject({ days: 29, doneDays: 7 });
    expect(rates[90]).toMatchObject({ days: 89, doneDays: 7 });
    expect(rates.total).toMatchObject({ days: 89, doneDays: 7 });
  });
});

describe('rateSeries', () => {
  it('semanas hasta la actual; antes de crear el hábito, null', () => {
    const h = habit({ createdOn: d('2026-03-09') });
    const history = hist(h, entriesOn(days('2026-03-09', 7)), '2026-03-18');
    const series = rateSeries(history, 'week', 3, 1);
    expect(series.map((p) => [p.start, p.end, p.rate.ratio, p.current])).toEqual([
      ['2026-03-02', '2026-03-08', null, false],
      ['2026-03-09', '2026-03-15', 1, false],
      ['2026-03-16', '2026-03-22', 0, true],
    ]);
  });

  it('respeta el primer día de la semana', () => {
    const h = habit({ createdOn: d('2026-03-01') });
    const series = rateSeries(hist(h, [], '2026-03-18'), 'week', 1, 0);
    expect(series[0]).toMatchObject({ start: '2026-03-15', end: '2026-03-21' });
  });

  it('meses, para hábitos mensuales', () => {
    const h = habit({ createdOn: d('2026-01-01'), frequency: { type: 'perMonth', times: 2 } });
    const history = hist(h, entriesOn(['2026-01-05', '2026-01-06', '2026-02-10']), '2026-03-10');
    expect(seriesBucket(history)).toBe('month');
    const series = rateSeries(history, 'month', 3, 1);
    expect(series.map((p) => [p.start, p.end, p.rate.ratio])).toEqual([
      ['2026-01-01', '2026-01-31', 1],
      ['2026-02-01', '2026-02-28', 0.5],
      ['2026-03-01', '2026-03-31', null],
    ]);
  });
});

describe('weekdayStats', () => {
  it('parte de cada día de la semana que se cumplió', () => {
    // Desde el lunes 2 de marzo, dos semanas; solo los lunes.
    const h = habit({ createdOn: d('2026-03-02') });
    const history = hist(h, entriesOn(['2026-03-02', '2026-03-09']), '2026-03-15');
    const stats = weekdayStats(history);
    expect(stats.find((s) => s.weekday === 1)).toMatchObject({ hits: 2, total: 2, ratio: 1 });
    expect(stats.find((s) => s.weekday === 2)).toMatchObject({ hits: 0, total: 2, ratio: 0 });
    // Hoy (domingo 15) sin hacer no cuenta.
    expect(stats.find((s) => s.weekday === 0)).toMatchObject({ total: 1 });
  });

  it('a evitar: cuenta los días con recaída', () => {
    const h = habit({ kind: 'avoid', createdOn: d('2026-03-02') });
    const history = hist(h, [entry('2026-03-03'), entry('2026-03-10', 2)], '2026-03-15');
    expect(weekdayStats(history).find((s) => s.weekday === 2)).toMatchObject({
      hits: 2,
      total: 2,
    });
  });

  it('ignora pausas y días que no tocan', () => {
    const h = habit({ createdOn: d('2026-03-02'), frequency: { type: 'weekdays', days: [1] } });
    const history = hist(h, [], '2026-03-15', [pause('2026-03-09', '2026-03-09')]);
    const stats = weekdayStats(history);
    expect(stats.find((s) => s.weekday === 1)).toMatchObject({ total: 1 });
    expect(stats.find((s) => s.weekday === 2)).toMatchObject({ total: 0, ratio: null });
  });
});

describe('totals', () => {
  it('días cumplidos, unidades cumplidas y días con registro', () => {
    const h = habit({
      kind: 'quantity',
      target: 8,
      createdOn: d('2026-03-02'),
      frequency: { type: 'perWeek', times: 2 },
    });
    const history = hist(
      h,
      [entry('2026-03-02', 8), entry('2026-03-03', 9), entry('2026-03-04', 3)],
      '2026-03-10',
    );
    expect(totals(history)).toEqual({ completedDays: 2, completedUnits: 1, loggedDays: 3 });
  });

  it('a evitar: días limpios cerrados', () => {
    const h = habit({ kind: 'avoid', createdOn: d('2026-03-01') });
    const history = hist(h, [entry('2026-03-02')], '2026-03-04');
    expect(totals(history).completedDays).toBe(2);
  });
});

describe('valueStats', () => {
  const h = habit({ kind: 'quantity', target: 8, unit: 'vasos', createdOn: d('2026-01-01') });

  it('media en días con registro, máximo (el último) y total', () => {
    const history = hist(
      h,
      [entry('2026-03-01', 4), entry('2026-03-02', 10), entry('2026-03-04', 10)],
      '2026-03-05',
    );
    expect(valueStats(history)).toMatchObject({
      loggedDays: 3,
      average: 8,
      max: { value: 10, day: '2026-03-04' },
      total: 24,
    });
  });

  it('sin registros', () => {
    expect(valueStats(hist(h, [], '2026-03-05'))).toMatchObject({
      loggedDays: 0,
      average: null,
      max: null,
      total: 0,
    });
  });

  it('tendencia: 30 días cerrados frente a los 30 anteriores, sin contar hoy', () => {
    // Del 31 de enero al 1 de marzo: 4 al día; del 2 al 31 de marzo: 6. Hoy: 100.
    const before = days('2026-01-31', 30).map((x) => entry(x, 4));
    const after = days('2026-03-02', 30).map((x) => entry(x, 6));
    const history = hist(h, [...before, ...after, entry('2026-04-01', 100)], '2026-04-01');
    expect(valueStats(history).trend).toEqual({ recent: 6, previous: 4, delta: 2 });
  });

  it('sin tendencia si falta historia', () => {
    const young = habit({ kind: 'quantity', target: 8, createdOn: d('2026-03-20') });
    expect(valueStats(hist(young, [], '2026-04-01')).trend).toBeNull();
  });
});

describe('valueSeries', () => {
  it('valor diario y media móvil de 7 días evaluables', () => {
    const h = habit({ kind: 'time', target: 10, createdOn: d('2026-03-01') });
    const history = hist(
      h,
      days('2026-03-01', 8).map((x, i) => entry(x, i + 1)),
      '2026-03-08',
      [pause('2026-03-03', '2026-03-03', 'h1')],
    );
    const series = valueSeries(history, 3);
    expect(series.map((p) => p.day)).toEqual(['2026-03-06', '2026-03-07', '2026-03-08']);
    // El día en pausa no cuenta: la primera media de 7 llega el día 8.
    expect(series.map((p) => p.average)).toEqual([null, null, (1 + 2 + 4 + 5 + 6 + 7 + 8) / 7]);
    expect(valueSeries(history, 8)[2]?.value).toBeNull();
  });
});

describe('avoidStats', () => {
  it('recaídas, última, días desde entonces y separación media', () => {
    const h = habit({ kind: 'avoid', createdOn: d('2026-01-01') });
    const history = hist(
      h,
      [entry('2026-01-10', 2), entry('2026-02-09'), entry('2026-03-01')],
      '2026-03-05',
    );
    expect(avoidStats(history)).toEqual({
      cleanDays: 60,
      relapses: 4,
      relapseDays: 3,
      relapsesLast30: 2,
      lastRelapse: '2026-03-01',
      daysSinceLastRelapse: 4,
      averageGap: 25,
    });
  });

  it('sin recaídas', () => {
    const h = habit({ kind: 'avoid', createdOn: d('2026-03-01') });
    expect(avoidStats(hist(h, [], '2026-03-05'))).toMatchObject({
      relapses: 0,
      lastRelapse: null,
      daysSinceLastRelapse: null,
      averageGap: null,
    });
  });
});

describe('historyFeed', () => {
  it('notas, comodines y pausas, del más reciente al más antiguo', () => {
    const h = habit({ createdOn: d('2026-03-01') });
    const noted: Entry = { ...entry('2026-03-03'), note: '  Con frío  ' };
    const other: Entry = { ...entry('2026-03-04', 1, 'h2'), note: 'De otro hábito' };
    const blank: Entry = { ...entry('2026-03-05'), note: '   ' };
    // Racha del 2 al 8 (el 1 está en pausa global): el comodín cubre el 9; el 10 rompe.
    const entries = [...entriesOn(days('2026-03-02', 7)), noted, other, blank];
    const pauses = [
      pause('2026-02-20', '2026-03-01'),
      pause('2026-03-12', '2026-03-12', 'h1'),
      pause('2026-03-11', '2026-03-11', 'h2'),
    ];
    const { analysis, history } = setup(h, entries, '2026-03-13', pauses);
    const feed = historyFeed(history, entries, analysis.streak.wildcardUses, pauses);
    expect(feed.map((i) => [i.type, i.day])).toEqual([
      ['pause', '2026-03-12'],
      ['wildcard', '2026-03-09'],
      ['note', '2026-03-03'],
      ['pause', '2026-03-01'],
    ]);
    expect(feed[2]).toMatchObject({ note: 'Con frío' });
    expect(feed[3]).toMatchObject({ end: '2026-03-01', global: true });
  });

  it('vacío si el hábito no ha empezado', () => {
    const h = habit({ createdOn: d('2026-03-10') });
    const { analysis, history } = setup(h, [], '2026-03-05');
    expect(historyFeed(history, [], analysis.streak.wildcardUses, [])).toEqual([]);
  });
});
