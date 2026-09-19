import { describe, expect, it } from 'vitest';
import { d } from '@/test/factories';
import {
  describeFrequency,
  formatDate,
  formatElapsed,
  formatMinutes,
  formatNumber,
  formatPercent,
  formatRelativeDay,
  formatStreak,
  formatWeekday,
  orderedWeekdays,
} from './format';

describe('formato', () => {
  it('números y porcentajes en español', () => {
    expect(formatNumber(10000)).toBe('10.000');
    expect(formatNumber(4.1)).toBe('4,1');
    expect(formatPercent(0.571)).toMatch(/^57\s?%$/);
  });

  it('fechas', () => {
    expect(formatWeekday(d('2026-09-19'))).toBe('Sábado');
    expect(formatDate(d('2026-09-19'), d('2026-09-19'))).toBe('19 de septiembre');
    expect(formatDate(d('2025-12-31'), d('2026-01-02'))).toBe('31 de diciembre de 2025');
  });

  it('días relativos', () => {
    const today = d('2026-09-19');
    expect(formatRelativeDay(today, today)).toBe('Hoy');
    expect(formatRelativeDay(d('2026-09-18'), today)).toBe('Ayer');
    expect(formatRelativeDay(d('2026-09-16'), today)).toBe('Hace 3 días');
    expect(formatRelativeDay(d('2026-09-01'), today)).toBe('1 sep');
  });

  it('frecuencias', () => {
    expect(describeFrequency({ type: 'daily' })).toBe('Todos los días');
    expect(describeFrequency({ type: 'weekdays', days: [5, 1, 3] })).toBe('Lun, Mié y Vie');
    expect(describeFrequency({ type: 'weekdays', days: [0, 1] }, 0)).toBe('Dom y Lun');
    expect(describeFrequency({ type: 'perWeek', times: 3 })).toBe('3 veces por semana');
    expect(describeFrequency({ type: 'perMonth', times: 1 })).toBe('1 vez al mes');
  });

  it('orden de la semana según el primer día', () => {
    expect(orderedWeekdays(1)).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(orderedWeekdays(0)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('rachas, minutos y cronómetro', () => {
    expect(formatStreak(12, 'day')).toBe('12 d');
    expect(formatStreak(1, 'month')).toBe('1 mes');
    expect(formatMinutes(25)).toBe('25 min');
    expect(formatMinutes(65)).toBe('1 h 5 min');
    expect(formatElapsed(245_000)).toBe('4:05');
    expect(formatElapsed(3_729_000)).toBe('1:02:09');
  });
});
