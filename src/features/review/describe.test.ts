import { describe, expect, it } from 'vitest';
import { buildHistory } from '@/domain/history';
import { weekOf, weekSummary } from '@/domain/review';
import type { HabitRate } from '@/domain/stats';
import { analyzeHabit } from '@/domain/today';
import { d, dayLog, days, entriesOn, habit } from '@/test/factories';
import { describeBest, describeHardest, describeMood, describeSample } from './describe';

const rate = (doneDays: number, daysCount: number): HabitRate => ({
  habit: habit({ name: 'Leer' }),
  rate: {
    ratio: doneDays / daysCount,
    days: daysCount,
    doneDays,
    units: daysCount,
    doneUnits: doneDays,
  },
});

describe('frases de la revisión', () => {
  it('la muestra va siempre con la cifra', () => {
    expect(describeSample(rate(5, 7))).toBe('5 de 7 días');
    expect(describeSample(rate(1, 1))).toBe('1 de 1 día');
  });

  it('nombra al más constante con su porcentaje y su muestra', () => {
    expect(describeBest(rate(7, 7))).toMatch(/^Leer, el más constante: 100\s?% \(7 de 7 días\)\.$/);
  });

  it('nombra al que más costó sin regañar', () => {
    const text = describeHardest(rate(2, 7));
    expect(text).toContain('Leer fue el que más costó');
    expect(text).toContain('(2 de 7 días)');
  });
});

describe('medias de ánimo y energía', () => {
  const week = weekOf(d('2026-09-07'));
  const summaryWith = (logs: Parameters<typeof weekSummary>[1]) => {
    const h = habit({ createdOn: d('2026-08-01') });
    const today = d('2026-09-19');
    const history = buildHistory(
      analyzeHabit(h, entriesOn(days('2026-09-07', 3)), { today, weekStartsOn: 1, pauses: [] }),
      today,
    );
    return weekSummary([history], logs, week);
  };

  it('junta las dos medias con los días registrados', () => {
    const text = describeMood(
      summaryWith([dayLog('2026-09-08', 4, 4), dayLog('2026-09-10', 3, 2)]),
    );
    expect(text).toBe('ánimo 3,5 y energía 3,0 de media, sobre 2 días registrados.');
  });

  it('con solo una de las dos escalas no inventa la otra', () => {
    expect(describeMood(summaryWith([dayLog('2026-09-08', 4, null)]))).toBe(
      'ánimo 4,0 de media, sobre 1 día registrado.',
    );
  });

  it('sin registros no dice nada', () => {
    expect(describeMood(summaryWith([]))).toBeNull();
  });
});
