import { describe, expect, it } from 'vitest';
import { buildHistory } from '@/domain/history';
import { analyzeHabit } from '@/domain/today';
import type { Entry, Habit, Pause } from '@/domain/types';
import { d, entriesOn, entry, habit, pause } from '@/test/factories';
import {
  availableYears,
  buildHeatmap,
  monthSummaries,
  moveWithin,
  rollingRange,
  yearRange,
} from './heatmapModel';

function history(h: Habit, entries: Entry[], today: string, pauses: Pause[] = []) {
  const ctx = { today: d(today), weekStartsOn: 1 as const, pauses };
  return buildHistory(analyzeHabit(h, entries, ctx), d(today));
}

describe('buildHeatmap', () => {
  const h = habit({ createdOn: d('2026-03-02') });

  it('una columna por semana y siete filas, desde el primer día de la semana', () => {
    const model = buildHeatmap(history(h, [], '2026-03-15'), yearRange(2026, d('2026-03-15')), 1);
    expect(model.weekdays).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(model.weeks[0]?.start).toBe('2025-12-29');
    expect(model.weeks.every((week) => week.cells.length === 7)).toBe(true);
    expect(model.months[0]).toMatchObject({ week: 0, label: 'dic' });
    expect(model.months.map((m) => m.label)).toContain('mar');
  });

  it('respeta el primer día de la semana', () => {
    const model = buildHeatmap(history(h, [], '2026-03-15'), rollingRange(d('2026-03-15'), 0), 0);
    expect(model.weekdays[0]).toBe(0);
    expect(model.weeks).toHaveLength(53);
  });

  it('marca cada día con su estado', () => {
    // De lunes a viernes, con un día en pausa y hoy todavía sin registrar.
    const weekly = habit({
      createdOn: d('2026-03-02'),
      kind: 'quantity',
      target: 8,
      frequency: { type: 'weekdays', days: [1, 2, 3, 4, 5] },
    });
    const model = buildHeatmap(
      history(weekly, [entry('2026-03-02', 8), entry('2026-03-03', 2)], '2026-03-09', [
        pause('2026-03-04', '2026-03-04'),
      ]),
      { from: d('2026-03-02'), to: d('2026-03-15') },
      1,
    );
    const cells = new Map(model.weeks.flatMap((w) => w.cells).map((cell) => [cell.day, cell]));
    expect(cells.get(d('2026-03-02'))).toMatchObject({ kind: 'level', level: 4 });
    expect(cells.get(d('2026-03-03'))).toMatchObject({ kind: 'level', level: 1 });
    expect(cells.get(d('2026-03-04'))).toMatchObject({ kind: 'paused' });
    expect(cells.get(d('2026-03-05'))).toMatchObject({ kind: 'level', level: 0 });
    expect(cells.get(d('2026-03-07'))).toMatchObject({ kind: 'offSchedule' });
    expect(cells.get(d('2026-03-09'))).toMatchObject({ kind: 'level', level: 0, today: true });
    expect(cells.get(d('2026-03-10'))).toMatchObject({ kind: 'outside' });
  });

  it('los días anteriores a la creación son «before» y los posteriores a hoy, «outside»', () => {
    const model = buildHeatmap(
      history(h, [], '2026-03-05'),
      { from: d('2026-02-23'), to: d('2026-03-08') },
      1,
    );
    const cells = new Map(model.weeks.flatMap((w) => w.cells).map((cell) => [cell.day, cell]));
    expect(cells.get(d('2026-02-25'))).toMatchObject({ kind: 'before', record: null });
    expect(cells.get(d('2026-03-01'))).toMatchObject({ kind: 'before' });
    expect(cells.get(d('2026-03-02'))).toMatchObject({ kind: 'level' });
    expect(cells.get(d('2026-03-07'))).toMatchObject({ kind: 'outside' });
  });

  it('en "a evitar" las recaídas tienen su propia escala', () => {
    const avoid = habit({ kind: 'avoid', createdOn: d('2026-03-02') });
    const model = buildHeatmap(
      history(avoid, [entry('2026-03-03'), entry('2026-03-04', 5)], '2026-03-05'),
      { from: d('2026-03-02'), to: d('2026-03-05') },
      1,
    );
    const cells = new Map(model.weeks.flatMap((w) => w.cells).map((cell) => [cell.day, cell]));
    expect(cells.get(d('2026-03-02'))).toMatchObject({ kind: 'level', level: 0 });
    expect(cells.get(d('2026-03-03'))).toMatchObject({ kind: 'relapse', level: 1 });
    expect(cells.get(d('2026-03-04'))).toMatchObject({ kind: 'relapse', level: 3 });
  });

  it('solo se navega por los días del hábito', () => {
    const model = buildHeatmap(history(h, [], '2026-03-15'), rollingRange(d('2026-03-15'), 1), 1);
    expect(model.first).toBe('2026-03-02');
    expect(model.last).toBe('2026-03-15');
    expect(moveWithin(model, d('2026-03-02'), -7)).toBe('2026-03-02');
    expect(moveWithin(model, d('2026-03-15'), 7)).toBe('2026-03-15');
    expect(moveWithin(model, d('2026-03-10'), -7)).toBe('2026-03-03');
  });

  it('un archivado no deja navegar más allá del último día', () => {
    const archived = habit({ createdOn: d('2026-03-02'), archivedOn: d('2026-03-08') });
    const model = buildHeatmap(
      history(archived, [], '2026-03-15'),
      rollingRange(d('2026-03-15'), 1),
      1,
    );
    expect(model.last).toBe('2026-03-08');
  });
});

describe('availableYears', () => {
  it('del año en curso hacia atrás', () => {
    const old = habit({ createdOn: d('2024-11-01') });
    expect(availableYears(history(old, [], '2026-03-15'))).toEqual([2026, 2025, 2024]);
  });
});

describe('monthSummaries', () => {
  it('cuenta cumplidos, días evaluables y total por mes', () => {
    const h = habit({ kind: 'quantity', target: 2, createdOn: d('2026-02-25') });
    const rows = monthSummaries(
      history(
        h,
        [entry('2026-02-26', 2), entry('2026-02-27', 1), entry('2026-03-02', 4)],
        '2026-03-03',
      ),
      { from: d('2026-02-01'), to: d('2026-03-03') },
    );
    expect(rows).toEqual([
      { start: '2026-02-01', hits: 1, scheduled: 4, value: 3 },
      { start: '2026-03-01', hits: 1, scheduled: 3, value: 4 },
    ]);
  });

  it('el rango recorta los meses', () => {
    const h = habit({ createdOn: d('2026-01-01') });
    const rows = monthSummaries(history(h, entriesOn(['2026-02-10']), '2026-03-03'), {
      from: d('2026-02-01'),
      to: d('2026-02-28'),
    });
    expect(rows).toEqual([{ start: '2026-02-01', hits: 1, scheduled: 28, value: 1 }]);
  });
});
