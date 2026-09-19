import { describe, expect, it } from 'vitest';
import { d, pause } from '@/test/factories';
import { isPausedOn, pausedDaysBetween, pausesFor, validatePause } from './pauses';

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
