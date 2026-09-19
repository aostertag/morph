import { describe, expect, it } from 'vitest';
import { d } from '@/test/factories';
import {
  clampRange,
  previousRange,
  rangeDays,
  resolveRange,
  startOfQuarter,
  startOfYear,
} from './range';

describe('startOfQuarter', () => {
  it('lleva cada mes al inicio de su trimestre', () => {
    expect(startOfQuarter(d('2026-01-15'))).toBe('2026-01-01');
    expect(startOfQuarter(d('2026-03-31'))).toBe('2026-01-01');
    expect(startOfQuarter(d('2026-04-01'))).toBe('2026-04-01');
    expect(startOfQuarter(d('2026-09-19'))).toBe('2026-07-01');
    expect(startOfQuarter(d('2026-12-31'))).toBe('2026-10-01');
  });
});

describe('startOfYear', () => {
  it('lleva al 1 de enero', () => {
    expect(startOfYear(d('2026-09-19'))).toBe('2026-01-01');
    expect(startOfYear(d('2024-01-01'))).toBe('2024-01-01');
  });
});

describe('resolveRange', () => {
  const today = d('2026-09-19'); // sábado

  it('la semana empieza el día configurado y termina hoy', () => {
    expect(resolveRange('week', today, 1)).toEqual({ from: '2026-09-14', to: today });
    expect(resolveRange('week', today, 0)).toEqual({ from: '2026-09-13', to: today });
  });

  it('mes, trimestre y año son períodos naturales en curso', () => {
    expect(resolveRange('month', today, 1)).toEqual({ from: '2026-09-01', to: today });
    expect(resolveRange('quarter', today, 1)).toEqual({ from: '2026-07-01', to: today });
    expect(resolveRange('year', today, 1)).toEqual({ from: '2026-01-01', to: today });
  });

  it('el rango personalizado ordena las fechas y no pasa de hoy', () => {
    expect(
      resolveRange('custom', today, 1, { from: d('2026-09-30'), to: d('2026-09-01') }),
    ).toEqual({ from: '2026-09-01', to: today });
  });

  it('sin fechas, el rango personalizado es hoy', () => {
    expect(resolveRange('custom', today, 1, null)).toEqual({ from: today, to: today });
  });
});

describe('clampRange', () => {
  it('recorta el futuro por los dos extremos', () => {
    const today = d('2026-09-19');
    expect(clampRange(d('2026-10-01'), d('2026-10-20'), today)).toEqual({
      from: today,
      to: today,
    });
  });
});

describe('previousRange', () => {
  it('compara el mismo número de días transcurridos', () => {
    const range = { from: d('2026-09-01'), to: d('2026-09-12') };
    const previous = previousRange(range, 'month');
    expect(previous).toEqual({ from: '2026-08-01', to: '2026-08-12' });
    expect(rangeDays(previous)).toBe(rangeDays(range));
  });

  it('nunca se sale del período anterior aunque sea más corto', () => {
    // Marzo completo (31 días) contra febrero, que solo tiene 28.
    const previous = previousRange({ from: d('2026-03-01'), to: d('2026-03-31') }, 'month');
    expect(previous).toEqual({ from: '2026-02-01', to: '2026-02-28' });
  });

  it('respeta el 29 de febrero', () => {
    const range = { from: d('2024-02-01'), to: d('2024-02-29') };
    expect(previousRange(range, 'month')).toEqual({ from: '2024-01-01', to: '2024-01-29' });
  });

  it('retrocede una semana, un trimestre o un año completos', () => {
    expect(previousRange({ from: d('2026-09-14'), to: d('2026-09-19') }, 'week')).toEqual({
      from: '2026-09-07',
      to: '2026-09-12',
    });
    // El trimestre anterior cuenta los mismos 81 días, no la misma fecha:
    // abril y mayo suman menos días que julio y agosto.
    expect(previousRange({ from: d('2026-07-01'), to: d('2026-09-19') }, 'quarter')).toEqual({
      from: '2026-04-01',
      to: '2026-06-20',
    });
    expect(previousRange({ from: d('2026-01-01'), to: d('2026-09-19') }, 'year')).toEqual({
      from: '2025-01-01',
      to: '2025-09-19',
    });
  });

  it('el personalizado es el bloque inmediatamente anterior de la misma longitud', () => {
    const range = { from: d('2026-09-10'), to: d('2026-09-19') };
    expect(previousRange(range, 'custom')).toEqual({ from: '2026-08-31', to: '2026-09-09' });
  });
});
