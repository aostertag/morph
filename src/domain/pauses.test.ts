import { describe, expect, it } from 'vitest';
import { d, pause } from '@/test/factories';
import type { LocalDay } from './day';
import {
  findPauseConflict,
  isPausedOn,
  pausedDaysBetween,
  pauseProblem,
  pausesFor,
  validatePause,
} from './pauses';

describe('pausesFor', () => {
  it('incluye las pausas globales y las del hábito, no las de otros', () => {
    const global = pause('2026-08-01', '2026-08-10');
    const mine = pause('2026-09-01', '2026-09-03', 'h1');
    const other = pause('2026-09-05', '2026-09-06', 'h2');
    expect(pausesFor('h1', [global, mine, other])).toEqual([global, mine]);
  });
});

describe('isPausedOn', () => {
  it('incluye los extremos del rango', () => {
    const pauses = [pause('2026-08-01', '2026-08-10')];
    expect(isPausedOn(d('2026-07-31'), pauses)).toBe(false);
    expect(isPausedOn(d('2026-08-01'), pauses)).toBe(true);
    expect(isPausedOn(d('2026-08-10'), pauses)).toBe(true);
    expect(isPausedOn(d('2026-08-11'), pauses)).toBe(false);
  });
});

describe('pausedDaysBetween', () => {
  it('recorta al rango pedido', () => {
    const pauses = [pause('2026-08-05', '2026-08-20')];
    expect(pausedDaysBetween(d('2026-08-01'), d('2026-08-10'), pauses)).toBe(6);
  });

  it('no cuenta dos veces los días de pausas solapadas', () => {
    const pauses = [
      pause('2026-08-01', '2026-08-05'),
      pause('2026-08-04', '2026-08-08', 'h1'),
      pause('2026-08-06', '2026-08-06'),
    ];
    expect(pausedDaysBetween(d('2026-08-01'), d('2026-08-31'), pauses)).toBe(8);
  });

  it('cruza el 29 de febrero', () => {
    const pauses = [pause('2024-02-27', '2024-03-02')];
    expect(pausedDaysBetween(d('2024-02-01'), d('2024-03-31'), pauses)).toBe(5);
  });

  it('devuelve 0 con un rango vacío', () => {
    expect(
      pausedDaysBetween(d('2026-08-10'), d('2026-08-01'), [pause('2026-08-01', '2026-08-10')]),
    ).toBe(0);
  });
});

describe('validatePause', () => {
  it('exige que el fin no sea anterior al inicio', () => {
    expect(validatePause({ start: d('2026-08-10'), end: d('2026-08-01') })).not.toBeNull();
    expect(validatePause({ start: d('2026-08-10'), end: d('2026-08-10') })).toBeNull();
  });
});

describe('findPauseConflict', () => {
  const existing = [
    pause('2026-08-10', '2026-08-20'),
    pause('2026-08-10', '2026-08-20', 'h1'),
    pause('2026-09-01', '2026-09-05', 'h2'),
  ];

  it('detecta el solape dentro del mismo ámbito', () => {
    expect(
      findPauseConflict({ habitId: null, start: d('2026-08-15'), end: d('2026-08-25') }, existing),
    ).toBe(existing[0]);
    expect(
      findPauseConflict({ habitId: 'h1', start: d('2026-08-01'), end: d('2026-08-10') }, existing),
    ).toBe(existing[1]);
  });

  it('un solape de un solo día también cuenta, en ambos extremos', () => {
    expect(
      findPauseConflict({ habitId: 'h2', start: d('2026-09-05'), end: d('2026-09-09') }, existing),
    ).toBe(existing[2]);
    expect(
      findPauseConflict({ habitId: 'h2', start: d('2026-08-30'), end: d('2026-09-01') }, existing),
    ).toBe(existing[2]);
  });

  it('una pausa que contiene a otra choca', () => {
    expect(
      findPauseConflict({ habitId: null, start: d('2026-08-01'), end: d('2026-08-31') }, existing),
    ).toBe(existing[0]);
  });

  it('pausas consecutivas no chocan', () => {
    expect(
      findPauseConflict({ habitId: null, start: d('2026-08-21'), end: d('2026-08-25') }, existing),
    ).toBeNull();
    expect(
      findPauseConflict({ habitId: null, start: d('2026-08-01'), end: d('2026-08-09') }, existing),
    ).toBeNull();
  });

  it('una global y una de un hábito pueden coincidir', () => {
    expect(
      findPauseConflict({ habitId: 'h3', start: d('2026-08-12'), end: d('2026-08-14') }, existing),
    ).toBeNull();
    expect(
      findPauseConflict({ habitId: 'h2', start: d('2026-08-12'), end: d('2026-08-14') }, existing),
    ).toBeNull();
  });

  it('al editar no choca consigo misma', () => {
    const [first] = existing;
    if (!first) throw new Error('fixture');
    expect(
      findPauseConflict(
        { habitId: null, start: d('2026-08-12'), end: d('2026-08-18') },
        existing,
        first.id,
      ),
    ).toBeNull();
  });
});

describe('pauseProblem', () => {
  it('rango invertido', () => {
    expect(
      pauseProblem({ habitId: null, start: d('2026-08-10'), end: d('2026-08-01') }, []),
    ).toMatchObject({
      type: 'range',
    });
  });

  it('un solo día es un rango válido', () => {
    expect(
      pauseProblem({ habitId: null, start: d('2026-08-10'), end: d('2026-08-10') }, []),
    ).toBeNull();
  });

  it('fechas que no existen', () => {
    const bad = { habitId: null, start: '2026-02-30' as LocalDay, end: '2026-03-02' as LocalDay };
    expect(pauseProblem(bad, [])).toMatchObject({ type: 'range' });
  });

  it('el rango se comprueba antes que el solape', () => {
    const problem = pauseProblem({ habitId: null, start: d('2026-08-20'), end: d('2026-08-10') }, [
      pause('2026-08-01', '2026-08-31'),
    ]);
    expect(problem?.type).toBe('range');
  });

  it('devuelve la pausa con la que choca', () => {
    const other = pause('2026-08-01', '2026-08-31');
    expect(
      pauseProblem({ habitId: null, start: d('2026-08-10'), end: d('2026-08-12') }, [other]),
    ).toEqual({
      type: 'overlap',
      with: other,
    });
  });
});
