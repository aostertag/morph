import { describe, expect, it } from 'vitest';
import { d, days, entriesOn, entry, habit, pause } from '@/test/factories';
import { buildHistory, heatLevel, recordOn, relapseLevel } from './history';
import { analyzeHabit } from './today';
import type { Entry, Habit, Pause } from './types';

function history(h: Habit, entries: Entry[], today: string, pauses: Pause[] = []) {
  const ctx = { today: d(today), weekStartsOn: 1 as const, pauses };
  return buildHistory(analyzeHabit(h, entries, ctx), d(today));
}

describe('buildHistory', () => {
  it('un registro por día desde la creación hasta hoy', () => {
    const h = habit({ createdOn: d('2026-03-01') });
    const hist = history(h, entriesOn(['2026-03-02']), '2026-03-05');
    expect(hist.days.map((r) => r.day)).toEqual(days('2026-03-01', 5));
    expect(recordOn(hist, d('2026-03-02'))).toMatchObject({ value: 1, success: true });
    expect(recordOn(hist, d('2026-03-01'))?.unit?.status).toBe('missed');
    expect(recordOn(hist, d('2026-03-05'))?.unit?.status).toBe('pending');
  });

  it('se detiene en el día del archivado', () => {
    const h = habit({ createdOn: d('2026-03-01'), archivedOn: d('2026-03-03') });
    const hist = history(h, [], '2026-03-10');
    expect(hist.days.at(-1)?.day).toBe('2026-03-03');
    expect(recordOn(hist, d('2026-03-04'))).toBeUndefined();
  });

  it('vacía si el hábito empieza en el futuro', () => {
    const h = habit({ createdOn: d('2026-03-10') });
    expect(history(h, [], '2026-03-05').days).toEqual([]);
  });

  it('días concretos: los días que no tocan no tienen unidad', () => {
    // 2026-03-02 es lunes.
    const h = habit({ createdOn: d('2026-03-02'), frequency: { type: 'weekdays', days: [1, 3] } });
    const hist = history(h, entriesOn(['2026-03-02']), '2026-03-05');
    expect(recordOn(hist, d('2026-03-03'))).toMatchObject({ scheduled: false, unit: null });
    expect(recordOn(hist, d('2026-03-04'))?.unit?.status).toBe('missed');
  });

  it('por semana: cada día apunta a la unidad de su semana', () => {
    const h = habit({ createdOn: d('2026-03-02'), frequency: { type: 'perWeek', times: 2 } });
    const hist = history(h, entriesOn(['2026-03-03', '2026-03-05']), '2026-03-12');
    const week1 = recordOn(hist, d('2026-03-08'))?.unit;
    expect(week1).toMatchObject({ start: '2026-03-02', status: 'done' });
    expect(recordOn(hist, d('2026-03-09'))?.unit).toMatchObject({ start: '2026-03-09' });
  });

  it('marca los días cuya unidad cubrió un comodín', () => {
    const h = habit({ createdOn: d('2026-03-01') });
    const hist = history(h, entriesOn([...days('2026-03-01', 7), '2026-03-09']), '2026-03-10');
    expect(recordOn(hist, d('2026-03-08'))).toMatchObject({ wildcard: true });
    expect(recordOn(hist, d('2026-03-07'))).toMatchObject({ wildcard: false });
  });

  it('marca las pausas', () => {
    const h = habit({ createdOn: d('2026-03-01') });
    const hist = history(h, [], '2026-03-05', [pause('2026-03-02', '2026-03-03')]);
    expect(hist.days.map((r) => r.paused)).toEqual([false, true, true, false, false]);
  });

  it('incluye el 29 de febrero en años bisiestos', () => {
    const h = habit({ createdOn: d('2028-02-27') });
    const hist = history(h, [entry('2028-02-29')], '2028-03-01');
    expect(hist.days.map((r) => r.day)).toEqual([
      '2028-02-27',
      '2028-02-28',
      '2028-02-29',
      '2028-03-01',
    ]);
    expect(recordOn(hist, d('2028-03-01'))?.day).toBe('2028-03-01');
  });
});

describe('heatLevel', () => {
  it('sí/no: hecho es el máximo', () => {
    expect(heatLevel({ kind: 'boolean', target: null }, 0)).toBe(0);
    expect(heatLevel({ kind: 'boolean', target: null }, 1)).toBe(4);
  });

  it('cantidad: proporcional a la meta', () => {
    const h = { kind: 'quantity' as const, target: 9 };
    expect([0, 1, 3, 5, 6, 8, 9, 20].map((v) => heatLevel(h, v))).toEqual([0, 1, 2, 2, 3, 3, 4, 4]);
  });
});

describe('relapseLevel', () => {
  it('ninguna, 1, 2, 3 o más', () => {
    expect([0, 1, 2, 3, 7].map(relapseLevel)).toEqual([0, 1, 2, 3, 3]);
  });
});
