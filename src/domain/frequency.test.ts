import { describe, expect, it } from 'vitest';
import { d } from '@/test/factories';
import {
  isScheduledOn,
  nextPeriod,
  periodContaining,
  periodLength,
  periodUnit,
  proratedRequirement,
  validateFrequency,
} from './frequency';
import type { Frequency } from './types';

const daily: Frequency = { type: 'daily' };
const monWedFri: Frequency = { type: 'weekdays', days: [1, 3, 5] };
const threePerWeek: Frequency = { type: 'perWeek', times: 3 };
const tenPerMonth: Frequency = { type: 'perMonth', times: 10 };

describe('periodUnit', () => {
  it('asigna la unidad de evaluación según la frecuencia', () => {
    expect(periodUnit(daily)).toBe('day');
    expect(periodUnit(monWedFri)).toBe('day');
    expect(periodUnit(threePerWeek)).toBe('week');
    expect(periodUnit(tenPerMonth)).toBe('month');
  });
});

describe('isScheduledOn', () => {
  it('en días concretos solo programa esos días', () => {
    expect(isScheduledOn(monWedFri, d('2026-09-14'))).toBe(true); // lunes
    expect(isScheduledOn(monWedFri, d('2026-09-15'))).toBe(false); // martes
    expect(isScheduledOn(monWedFri, d('2026-09-18'))).toBe(true); // viernes
  });

  it('en frecuencias por período cualquier día vale', () => {
    expect(isScheduledOn(threePerWeek, d('2026-09-15'))).toBe(true);
    expect(isScheduledOn(tenPerMonth, d('2026-09-15'))).toBe(true);
  });
});

describe('periodContaining / nextPeriod', () => {
  it('semanas según el primer día configurado', () => {
    expect(periodContaining(threePerWeek, d('2026-09-19'), 1)).toEqual({
      start: '2026-09-14',
      end: '2026-09-20',
    });
    expect(periodContaining(threePerWeek, d('2026-09-19'), 0)).toEqual({
      start: '2026-09-13',
      end: '2026-09-19',
    });
  });

  it('meses encadenados, incluido febrero bisiesto', () => {
    let period = periodContaining(tenPerMonth, d('2024-01-31'), 1);
    expect(period).toEqual({ start: '2024-01-01', end: '2024-01-31' });
    period = nextPeriod(tenPerMonth, period, 1);
    expect(period).toEqual({ start: '2024-02-01', end: '2024-02-29' });
    expect(periodLength(tenPerMonth, period)).toBe(29);
    period = nextPeriod(tenPerMonth, period, 1);
    expect(period).toEqual({ start: '2024-03-01', end: '2024-03-31' });
  });

  it('semanas encadenadas cruzando el año', () => {
    const period = nextPeriod(threePerWeek, periodContaining(threePerWeek, d('2026-12-27'), 1), 1);
    expect(period).toEqual({ start: '2026-12-28', end: '2027-01-03' });
  });
});

describe('proratedRequirement', () => {
  it('no prorratea un período completo', () => {
    expect(proratedRequirement(3, 7, 7)).toBe(3);
  });

  it('prorratea redondeando hacia arriba', () => {
    expect(proratedRequirement(3, 5, 7)).toBe(3); // 2,14 → 3
    expect(proratedRequirement(3, 3, 7)).toBe(2); // 1,29 → 2
    expect(proratedRequirement(3, 2, 7)).toBe(1); // 0,86 → 1
    expect(proratedRequirement(10, 14, 28)).toBe(5);
  });

  it('nunca pide más días de los disponibles', () => {
    expect(proratedRequirement(7, 2, 7)).toBe(2);
    expect(proratedRequirement(3, 0, 7)).toBe(0);
  });
});

describe('validateFrequency', () => {
  it('acepta frecuencias correctas', () => {
    expect(validateFrequency(daily, 'boolean')).toBeNull();
    expect(validateFrequency(monWedFri, 'avoid')).toBeNull();
    expect(validateFrequency(threePerWeek, 'quantity')).toBeNull();
  });

  it('rechaza frecuencias incoherentes', () => {
    expect(validateFrequency({ type: 'weekdays', days: [] }, 'boolean')).not.toBeNull();
    expect(validateFrequency({ type: 'weekdays', days: [1, 1] }, 'boolean')).not.toBeNull();
    expect(validateFrequency({ type: 'perWeek', times: 0 }, 'boolean')).not.toBeNull();
    expect(validateFrequency({ type: 'perWeek', times: 8 }, 'boolean')).not.toBeNull();
    expect(validateFrequency({ type: 'perMonth', times: 2.5 }, 'boolean')).not.toBeNull();
    expect(validateFrequency(threePerWeek, 'avoid')).not.toBeNull();
  });
});
