import { describe, expect, it } from 'vitest';
import { d, days } from '@/test/factories';
import {
  addDays,
  addMonths,
  dayNumber,
  daysInMonth,
  diffDays,
  eachDay,
  endOfMonth,
  endOfWeek,
  fromDayNumber,
  isLocalDay,
  startOfMonth,
  startOfWeek,
  toLocalDate,
  toLocalDay,
  weekdayOf,
} from './day';

describe('entorno', () => {
  it('se ejecuta en la zona horaria del proyecto de tests', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(process.env.TZ);
  });
});

describe('isLocalDay', () => {
  it('acepta fechas civiles reales', () => {
    expect(isLocalDay('2026-09-19')).toBe(true);
    expect(isLocalDay('2024-02-29')).toBe(true);
    expect(isLocalDay('2000-02-29')).toBe(true);
  });

  it('rechaza fechas imposibles o mal formadas', () => {
    expect(isLocalDay('2026-02-29')).toBe(false);
    expect(isLocalDay('1900-02-29')).toBe(false);
    expect(isLocalDay('2026-04-31')).toBe(false);
    expect(isLocalDay('2026-13-01')).toBe(false);
    expect(isLocalDay('2026-9-1')).toBe(false);
    expect(isLocalDay('2026-09-19T00:00')).toBe(false);
    expect(isLocalDay(20260919)).toBe(false);
  });
});

describe('aritmética de días', () => {
  it('dayNumber y fromDayNumber son inversos', () => {
    for (const day of days('2023-12-25', 800)) {
      expect(fromDayNumber(dayNumber(day))).toBe(day);
    }
  });

  it('suma días cruzando fin de mes, de año y 29 de febrero', () => {
    expect(addDays(d('2026-01-31'), 1)).toBe('2026-02-01');
    expect(addDays(d('2026-12-31'), 1)).toBe('2027-01-01');
    expect(addDays(d('2024-02-28'), 1)).toBe('2024-02-29');
    expect(addDays(d('2024-02-29'), 1)).toBe('2024-03-01');
    expect(addDays(d('2026-02-28'), 1)).toBe('2026-03-01');
    expect(addDays(d('2026-03-01'), -1)).toBe('2026-02-28');
  });

  it('diffDays cuenta días civiles, no horas', () => {
    expect(diffDays(d('2024-01-01'), d('2025-01-01'))).toBe(366);
    expect(diffDays(d('2026-01-01'), d('2027-01-01'))).toBe(365);
    expect(diffDays(d('2026-09-19'), d('2026-09-12'))).toBe(-7);
  });

  it('los días de cambio de horario miden un día exacto', () => {
    // Madrid y Nueva York en marzo/octubre-noviembre; Santiago en abril/septiembre.
    for (const day of [
      '2026-03-08',
      '2026-03-29',
      '2026-04-05',
      '2026-09-06',
      '2026-10-25',
      '2026-11-01',
    ]) {
      const local = d(day);
      expect(addDays(local, 1)).toBe(fromDayNumber(dayNumber(local) + 1));
      expect(diffDays(local, addDays(local, 1))).toBe(1);
    }
  });

  it('eachDay incluye ambos extremos', () => {
    expect(eachDay(d('2024-02-27'), d('2024-03-01'))).toEqual([
      '2024-02-27',
      '2024-02-28',
      '2024-02-29',
      '2024-03-01',
    ]);
    expect(eachDay(d('2026-01-02'), d('2026-01-01'))).toEqual([]);
  });
});

describe('semanas', () => {
  it('weekdayOf coincide con el calendario', () => {
    expect(weekdayOf(d('1970-01-01'))).toBe(4);
    expect(weekdayOf(d('2026-09-19'))).toBe(6);
    expect(weekdayOf(d('2026-09-20'))).toBe(0);
    expect(weekdayOf(d('2024-02-29'))).toBe(4);
    expect(weekdayOf(d('1969-12-31'))).toBe(3);
  });

  it('respeta el primer día de la semana configurado', () => {
    const saturday = d('2026-09-19');
    expect(startOfWeek(saturday, 1)).toBe('2026-09-14');
    expect(endOfWeek(saturday, 1)).toBe('2026-09-20');
    expect(startOfWeek(saturday, 0)).toBe('2026-09-13');
    expect(endOfWeek(saturday, 0)).toBe('2026-09-19');
    expect(startOfWeek(saturday, 6)).toBe('2026-09-19');
  });

  it('una semana que cruza el cambio de año', () => {
    expect(startOfWeek(d('2027-01-01'), 1)).toBe('2026-12-28');
    expect(endOfWeek(d('2026-12-30'), 1)).toBe('2027-01-03');
  });
});

describe('meses', () => {
  it('conoce la longitud de febrero en años bisiestos', () => {
    expect(daysInMonth(d('2024-02-10'))).toBe(29);
    expect(daysInMonth(d('2026-02-10'))).toBe(28);
    expect(daysInMonth(d('2000-02-10'))).toBe(29);
    expect(daysInMonth(d('2100-02-10'))).toBe(28);
    expect(endOfMonth(d('2024-02-10'))).toBe('2024-02-29');
    expect(startOfMonth(d('2024-02-29'))).toBe('2024-02-01');
  });

  it('addMonths ajusta al último día válido', () => {
    expect(addMonths(d('2024-01-31'), 1)).toBe('2024-02-29');
    expect(addMonths(d('2026-01-31'), 1)).toBe('2026-02-28');
    expect(addMonths(d('2026-12-15'), 1)).toBe('2027-01-15');
    expect(addMonths(d('2026-01-15'), -1)).toBe('2025-12-15');
  });
});

describe('conversión con instantes locales', () => {
  it('toLocalDate y toLocalDay son inversos todos los días del año, incluido el cambio de horario', () => {
    for (const day of days('2026-01-01', 365)) {
      expect(toLocalDay(toLocalDate(day))).toBe(day);
    }
  });

  it('cada hora del año pertenece a un día local consecutivo de 23 a 25 horas', () => {
    const hoursPerDay = new Map<string, number>();
    const start = new Date(2026, 0, 1).getTime();
    const end = new Date(2027, 0, 1).getTime();
    for (let t = start; t < end; t += 3_600_000) {
      const day = toLocalDay(t);
      hoursPerDay.set(day, (hoursPerDay.get(day) ?? 0) + 1);
    }
    const seen = [...hoursPerDay.keys()];
    expect(seen).toEqual(days('2026-01-01', 365));
    for (const hours of hoursPerDay.values()) {
      expect([23, 24, 25]).toContain(hours);
    }
  });

  it('un registro a las 00:30 del día del cambio de horario cae en ese día', () => {
    const instant = new Date(2026, 2, 29, 0, 30);
    expect(toLocalDay(instant)).toBe('2026-03-29');
    const lateNight = new Date(2026, 9, 24, 23, 59);
    expect(toLocalDay(lateNight)).toBe('2026-10-24');
  });
});
