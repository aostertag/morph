import { describe, expect, it } from 'vitest';
import { buildDayView } from '@/domain/today';
import { d, entriesOn, entry, habit, pause } from '@/test/factories';
import { describeRowContext } from './describe';

const ctx = (today: string, pauses = [pause('2000-01-01', '2000-01-01')]) => ({
  today: d(today),
  weekStartsOn: 1 as const,
  pauses,
});

function context(
  h: ReturnType<typeof habit>,
  days: string[],
  today: string,
  pauses?: ReturnType<typeof pause>[],
) {
  return describeRowContext(
    buildDayView(h, entriesOn(days), ctx(today, pauses), d(today)),
    d(today),
  );
}

describe('describeRowContext', () => {
  it('sin historia', () => {
    expect(context(habit({ createdOn: d('2026-01-05') }), [], '2026-01-05')).toBe('Sin racha');
  });

  it('racha diaria', () => {
    expect(
      context(habit({ createdOn: d('2026-01-01') }), ['2026-01-01', '2026-01-02'], '2026-01-03'),
    ).toBe('Racha 2 d');
  });

  it('mejor racha cuando la actual se rompió', () => {
    expect(
      context(habit({ createdOn: d('2026-01-01') }), ['2026-01-01', '2026-01-02'], '2026-01-05'),
    ).toBe('Mejor racha 2 d');
  });

  it('comodín usado ayer', () => {
    const days = ['01', '02', '03', '04', '05', '06', '07'].map((n) => `2026-01-${n}`);
    expect(context(habit({ createdOn: d('2026-01-01') }), days, '2026-01-09')).toBe(
      'Racha 7 d · comodín usado ayer',
    );
  });

  it('semanal: progreso de la semana y racha en semanas', () => {
    const h = habit({ frequency: { type: 'perWeek', times: 2 }, createdOn: d('2026-01-05') });
    expect(context(h, ['2026-01-05', '2026-01-06', '2026-01-12'], '2026-01-13')).toBe(
      '1 de 2 esta semana · Racha 1 sem',
    );
  });

  it('a evitar: días sin recaer', () => {
    const h = habit({ kind: 'avoid', createdOn: d('2026-01-01') });
    expect(context(h, [], '2026-01-04')).toBe('3 d sin recaer');
  });

  it('en pausa', () => {
    const h = habit({ createdOn: d('2026-01-01') });
    expect(context(h, [], '2026-01-04', [pause('2026-01-04', '2026-01-10')])).toBe('En pausa');
  });

  it('cuantitativo por encima de la meta muestra el valor real', () => {
    const h = habit({ kind: 'quantity', target: 8, unit: 'vasos', createdOn: d('2026-01-04') });
    const view = buildDayView(h, [entry('2026-01-04', 11)], ctx('2026-01-04'), d('2026-01-04'));
    expect(describeRowContext(view, d('2026-01-04'))).toBe('Racha 1 d · 11 vasos registrados');
  });
});
