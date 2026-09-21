import { describe, expect, it } from 'vitest';
import { findCorrelations } from '@/domain/correlation';
import { addDays, type LocalDay, weekdayOf } from '@/domain/day';
import { isScheduledOn } from '@/domain/frequency';
import { validateHabitInput } from '@/domain/habit';
import { buildHistory } from '@/domain/history';
import { completionRate } from '@/domain/metrics';
import { isPausedOn, pausesFor } from '@/domain/pauses';
import { lastCompleteWeek } from '@/domain/review';
import { analyzeHabit } from '@/domain/today';
import type { DayLog, Habit } from '@/domain/types';
import { d } from '@/test/factories';
import { generateSampleData, SAMPLE_DAYS } from './sampleData';

const today = d('2026-09-19');
const data = generateSampleData({ today });

function habitByKey(key: string): Habit {
  const h = data.habits.find((x) => x.id === `demo-h-${key}`);
  if (!h) throw new Error(`Falta el hábito ${key}`);
  return h;
}

function daysWith(key: string): Set<LocalDay> {
  const h = habitByKey(key);
  return new Set(data.entries.filter((e) => e.habitId === h.id && e.value > 0).map((e) => e.date));
}

function mean(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

const CTX = { today, weekStartsOn: 1 as const, pauses: data.pauses };

/** Historia de todos los hábitos generados, como la que ven las estadísticas. */
const histories = data.habits.map((h) => buildHistory(analyzeHabit(h, data.entries, CTX), today));

function rate(key: string, from: LocalDay, to: LocalDay): number {
  const h = habitByKey(key);
  const ctx = { today, weekStartsOn: 1 as const, pauses: data.pauses };
  const history = buildHistory(analyzeHabit(h, data.entries, ctx), today);
  return completionRate(history, from, to).ratio ?? Number.NaN;
}

describe('generateSampleData', () => {
  it('es determinista', () => {
    expect(generateSampleData({ today })).toEqual(data);
    expect(generateSampleData({ today, seed: 7 }).entries).not.toEqual(data.entries);
  });

  it('cubre seis meses hasta hoy', () => {
    const dates = data.entries.map((e) => e.date).sort();
    expect(dates[0]).toBe(addDays(today, -(SAMPLE_DAYS - 1)));
    expect(dates.at(-1)).toBe(today);
  });

  it('todos los hábitos son válidos y cubren tipos y frecuencias', () => {
    for (const h of data.habits) {
      const { id: _id, order: _order, archivedOn: _archivedOn, ...input } = h;
      expect(validateHabitInput(input), h.name).toEqual({});
    }
    expect(new Set(data.habits.map((h) => h.kind))).toEqual(
      new Set(['boolean', 'quantity', 'time', 'avoid']),
    );
    expect(new Set(data.habits.map((h) => h.frequency.type))).toEqual(
      new Set(['daily', 'weekdays', 'perWeek', 'perMonth']),
    );
    expect(data.habits.filter((h) => h.archivedOn !== null)).toHaveLength(1);
    expect(data.habits.some((h) => h.createdOn > addDays(today, -(SAMPLE_DAYS - 1)))).toBe(true);
    const categories = new Set(data.categories.map((c) => c.id));
    expect(data.habits.every((h) => h.categoryId !== null && categories.has(h.categoryId))).toBe(
      true,
    );
  });

  it('incluye un hábito planificado que aún no ha empezado, sin registros', () => {
    const planned = data.habits.filter((h) => h.createdOn > today);
    expect(planned).toHaveLength(1);
    expect(data.entries.some((e) => e.habitId === planned[0]?.id)).toBe(false);
    // No deja rastro en su historia.
    const history = histories.find((h) => h.habit.id === planned[0]?.id);
    expect(history?.days).toEqual([]);
  });

  it('los registros respetan vida, frecuencia y pausas, y son únicos por día', () => {
    const habits = new Map(data.habits.map((h) => [h.id, h]));
    const keys = new Set<string>();
    for (const e of data.entries) {
      const h = habits.get(e.habitId);
      expect(h).toBeDefined();
      if (!h) continue;
      expect(e.value).toBeGreaterThan(0);
      expect(e.date >= h.createdOn && e.date <= (h.archivedOn ?? today)).toBe(true);
      expect(isScheduledOn(h.frequency, e.date)).toBe(true);
      expect(isPausedOn(e.date, pausesFor(h.id, data.pauses))).toBe(false);
      keys.add(`${e.habitId}|${e.date}`);
    }
    expect(keys.size).toBe(data.entries.length);
  });

  it('hoy queda a medias y sin ánimo registrado', () => {
    const todays = data.entries.filter((e) => e.date === today);
    expect(todays.length).toBeGreaterThan(0);
    expect(todays.length).toBeLessThan(data.habits.length - 1);
    expect(data.dayLogs.some((l) => l.date === today)).toBe(false);
  });

  it('ningún texto contiene emojis', () => {
    expect(JSON.stringify(data)).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it('hay hábitos que mejoran y otros que decaen', () => {
    const first = addDays(today, -(SAMPLE_DAYS - 1));
    expect(rate('meditar', addDays(today, -30), addDays(today, -1))).toBeGreaterThan(
      rate('meditar', first, addDays(first, 29)) + 0.2,
    );
    expect(rate('leer', addDays(today, -28), addDays(today, -1))).toBeLessThan(
      rate('leer', addDays(today, -56), addDays(today, -29)) - 0.2,
    );
  });

  describe('correlaciones plausibles, con al menos 14 días en cada grupo', () => {
    function split(logs: readonly DayLog[], inGroup: (l: DayLog) => boolean, pick: keyof DayLog) {
      const yes = logs.filter(inGroup).map((l) => Number(l[pick]));
      const no = logs.filter((l) => !inGroup(l)).map((l) => Number(l[pick]));
      return { yes, no };
    }

    it('el ánimo es mayor los días de ejercicio', () => {
      const exercise = daysWith('ejercicio');
      const { yes, no } = split(data.dayLogs, (l) => exercise.has(l.date), 'mood');
      expect(yes.length).toBeGreaterThanOrEqual(14);
      expect(no.length).toBeGreaterThanOrEqual(14);
      expect(mean(yes) - mean(no)).toBeGreaterThan(0.4);
    });

    it('la energía es mayor tras dormir pronto', () => {
      const slept = daysWith('dormir');
      const { yes, no } = split(data.dayLogs, (l) => slept.has(addDays(l.date, -1)), 'energy');
      expect(yes.length).toBeGreaterThanOrEqual(14);
      expect(no.length).toBeGreaterThanOrEqual(14);
      expect(mean(yes) - mean(no)).toBeGreaterThan(0.4);
    });

    it('el ánimo es menor los días de recaída', () => {
      const relapse = daysWith('redes');
      const { yes, no } = split(data.dayLogs, (l) => relapse.has(l.date), 'mood');
      expect(yes.length).toBeGreaterThanOrEqual(14);
      expect(mean(no) - mean(yes)).toBeGreaterThan(0.3);
    });
  });

  /*
   * Los datos de ejemplo existen para probar las estadísticas: si alguien toca un
   * umbral y la pantalla de correlaciones se queda muda, estos tests lo dicen.
   */
  describe('las correlaciones llegan hasta la pantalla', () => {
    const report = findCorrelations({
      histories,
      dayLogs: data.dayLogs,
      range: { from: addDays(today, -(SAMPLE_DAYS - 1)), to: today },
      today,
    });

    function finding(habitKey: string, kind: string, lag: number) {
      return report.findings.find(
        (f) => f.source.id === `demo-h-${habitKey}` && f.kind === kind && f.lag === lag,
      );
    }

    it('encuentra el ánimo de los días de ejercicio', () => {
      const found = finding('ejercicio', 'mood', 0);
      expect(found).toBeDefined();
      expect(found?.delta).toBeGreaterThan(0.4);
      expect(found?.withDays).toBeGreaterThanOrEqual(14);
      expect(found?.withoutDays).toBeGreaterThanOrEqual(14);
    });

    it('encuentra la energía del día siguiente a dormir pronto', () => {
      const found = finding('dormir', 'energy', 1);
      expect(found).toBeDefined();
      expect(found?.delta).toBeGreaterThan(0.4);
      expect(found?.withDays).toBeGreaterThanOrEqual(14);
      expect(found?.withoutDays).toBeGreaterThanOrEqual(14);
    });

    it('examina bastantes parejas y solo afirma unas pocas', () => {
      expect(report.compared).toBeGreaterThan(20);
      expect(report.tested).toBeGreaterThan(10);
      expect(report.findings.length).toBeLessThanOrEqual(6);
      expect(report.findings.length).toBeGreaterThan(0);
      expect(report.confidence).toBeGreaterThan(0.99);
    });
  });
});

describe('revisiones de ejemplo', () => {
  const last = lastCompleteWeek(today, 1);

  it('escribe cuatro semanas cerradas, todas en lunes', () => {
    expect(data.reviews).toHaveLength(4);
    for (const review of data.reviews) {
      expect(weekdayOf(review.weekStart)).toBe(1);
      expect(review.weekStart < last.from).toBe(true);
      expect(review.reflection).not.toBe('');
    }
  });

  it('deja sin escribir la última semana cerrada, que es la que ofrece el aviso', () => {
    expect(data.reviews.some((r) => r.weekStart === last.from)).toBe(false);
    expect(data.reviews.map((r) => r.weekStart)).toContain(addDays(last.from, -7));
  });

  it('sigue el primer día de la semana configurado', () => {
    const sunday = generateSampleData({ today, weekStartsOn: 0 });
    for (const review of sunday.reviews) expect(weekdayOf(review.weekStart)).toBe(0);
  });

  it('es determinista', () => {
    expect(generateSampleData({ today }).reviews).toEqual(data.reviews);
  });
});
