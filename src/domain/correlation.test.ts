import { describe, expect, it } from 'vitest';
import { d, dayLog, days, entriesOn, habit, pause } from '@/test/factories';
import {
  bonferroniZ,
  type Correlation,
  findCorrelations,
  MIN_GROUP_DAYS,
  normalQuantile,
  outcomesByDay,
} from './correlation';
import { buildHistory, type HabitHistory } from './history';
import type { DayRange } from './range';
import { analyzeHabit } from './today';
import type { DayLog, Entry, Habit, Pause, Scale } from './types';

const TODAY = d('2026-03-22');
const SPAN = days('2026-01-01', 80);
const RANGE: DayRange = { from: d('2026-01-01'), to: d('2026-03-21') };

function history(h: Habit, entries: readonly Entry[], pauses: readonly Pause[] = []): HabitHistory {
  return buildHistory(analyzeHabit(h, entries, { today: TODAY, weekStartsOn: 1, pauses }), TODAY);
}

/** Patrón determinista de 10 días con cinco cumplidos, sin periodicidad semanal. */
function didIt(index: number): boolean {
  return (index * 7) % 10 < 5;
}

function find(report: { findings: readonly Correlation[] }, kind: string, lag: number) {
  return report.findings.find((f) => f.kind === kind && f.lag === lag);
}

describe('normalQuantile', () => {
  it('reproduce los cuantiles conocidos de la normal', () => {
    expect(normalQuantile(0.975)).toBeCloseTo(1.959964, 5);
    expect(normalQuantile(0.995)).toBeCloseTo(2.575829, 5);
    expect(normalQuantile(0.9995)).toBeCloseTo(3.290527, 5);
    expect(normalQuantile(0.5)).toBeCloseTo(0, 9);
    expect(normalQuantile(0.025)).toBeCloseTo(-1.959964, 5);
  });
});

describe('bonferroniZ', () => {
  it('exige más margen cuantas más comparaciones se miran', () => {
    expect(bonferroniZ(1)).toBeCloseTo(1.959964, 5);
    expect(bonferroniZ(20)).toBeGreaterThan(3);
    expect(bonferroniZ(40)).toBeGreaterThan(bonferroniZ(20));
  });
});

describe('outcomesByDay', () => {
  const h = habit({ id: 'leer', createdOn: d('2026-01-01') });

  it('solo incluye días decididos: ni hoy, ni pausas, ni días que no tocan', () => {
    const range: DayRange = { from: d('2026-01-01'), to: TODAY };
    const pausa = pause('2026-01-03', '2026-01-04', 'leer');
    const outcomes = outcomesByDay(
      history(h, entriesOn(['2026-01-01', '2026-01-05'], 1, 'leer'), [pausa]),
      range,
      d('2026-01-06'),
    );
    expect([...outcomes.entries()]).toEqual([
      ['2026-01-01', true],
      ['2026-01-02', false],
      ['2026-01-05', true],
    ]);
  });

  it('en los hábitos de días concretos solo cuentan los días que tocan', () => {
    const lunes = habit({
      id: 'lunes',
      createdOn: d('2026-01-01'),
      frequency: { type: 'weekdays', days: [1] },
    });
    const outcomes = outcomesByDay(history(lunes, []), RANGE, TODAY);
    expect(outcomes.size).toBe(11);
  });

  it('en "a evitar", ocurrir es recaer', () => {
    const redes = habit({ id: 'redes', kind: 'avoid', createdOn: d('2026-01-01') });
    const outcomes = outcomesByDay(
      history(redes, entriesOn(['2026-01-02'], 1, 'redes')),
      { from: d('2026-01-01'), to: d('2026-01-03') },
      d('2026-01-04'),
    );
    expect([...outcomes.values()]).toEqual([false, true, false]);
  });
});

describe('findCorrelations', () => {
  const ejercicio = habit({ id: 'ej', name: 'Ejercicio', createdOn: d('2026-01-01') });

  /** Registros del hábito en los días que marca `pattern`. */
  function entriesFor(id: string, pattern: (index: number) => boolean): Entry[] {
    return entriesOn(
      SPAN.filter((_, index) => pattern(index)),
      1,
      id,
    );
  }

  /** Un registro de ánimo o energía por día, calculado desde el índice. */
  function logs(value: (index: number) => { mood?: Scale; energy?: Scale }): DayLog[] {
    return SPAN.map((day, index) => {
      const { mood = null, energy = null } = value(index);
      return dayLog(day, mood, energy);
    });
  }

  it('encuentra una diferencia clara de ánimo e indica la muestra', () => {
    const report = findCorrelations({
      histories: [history(ejercicio, entriesFor('ej', didIt))],
      dayLogs: logs((index) => ({ mood: (didIt(index) ? (index % 5 === 0 ? 4 : 5) : 3) as Scale })),
      range: RANGE,
      today: TODAY,
    });

    const finding = find(report, 'mood', 0);
    expect(finding?.source.name).toBe('Ejercicio');
    expect(finding?.withValue).toBeGreaterThan(4.5);
    expect(finding?.withoutValue).toBe(3);
    expect(finding?.withDays).toBe(40);
    expect(finding?.withoutDays).toBe(40);
    expect(finding?.delta).toBeGreaterThan(1.5);
    expect(report.tested).toBe(2); // ánimo el mismo día y con un día de desfase
  });

  it('no dice nada si un grupo no llega a 14 días', () => {
    const escaso = (index: number) => index < MIN_GROUP_DAYS - 1;
    const report = findCorrelations({
      histories: [history(ejercicio, entriesFor('ej', escaso))],
      dayLogs: logs((index) => ({ mood: (escaso(index) ? 5 : 2) as Scale })),
      range: RANGE,
      today: TODAY,
    });
    expect(report.findings).toHaveLength(0);
    expect(report.compared).toBe(2);
    expect(report.tested).toBe(0);
  });

  it('no dice nada si la diferencia es pequeña aunque haya muchos días', () => {
    const report = findCorrelations({
      histories: [history(ejercicio, entriesFor('ej', didIt))],
      dayLogs: logs((index) => ({ mood: (didIt(index) && index % 10 === 0 ? 4 : 3) as Scale })),
      range: RANGE,
      today: TODAY,
    });
    expect(report.findings).toHaveLength(0);
    expect(report.tested).toBe(2);
  });

  it('no dice nada cuando la diferencia cabe dentro del ruido', () => {
    // Ánimo alternante sin relación con el hábito: la diferencia es casi cero.
    const report = findCorrelations({
      histories: [history(ejercicio, entriesFor('ej', didIt))],
      dayLogs: logs((index) => ({ mood: ((index % 4) + 1) as Scale })),
      range: RANGE,
      today: TODAY,
    });
    expect(report.findings).toHaveLength(0);
  });

  it('encuentra el efecto del día siguiente y lo distingue del mismo día', () => {
    const dormir = habit({ id: 'dormir', name: 'Dormir temprano', createdOn: d('2026-01-01') });
    const report = findCorrelations({
      histories: [history(dormir, entriesFor('dormir', didIt))],
      // La energía depende de si se durmió pronto la víspera, no del propio día.
      dayLogs: logs((index) => ({ energy: (index > 0 && didIt(index - 1) ? 4 : 2) as Scale })),
      range: RANGE,
      today: TODAY,
    });

    const delayed = find(report, 'energy', 1);
    expect(delayed?.source.name).toBe('Dormir temprano');
    expect(delayed?.delta).toBeCloseTo(2, 1);
    expect(find(report, 'energy', 0)).toBeUndefined();
    expect(report.compared).toBe(2);
  });

  it('cuenta las comparaciones con desfase en el total examinado', () => {
    const report = findCorrelations({
      histories: [history(ejercicio, entriesFor('ej', didIt))],
      dayLogs: logs((index) => ({ mood: 3 as Scale, energy: (didIt(index) ? 4 : 2) as Scale })),
      range: RANGE,
      today: TODAY,
    });
    // Dos escalas × dos desfases.
    expect(report.compared).toBe(4);
    expect(report.tested).toBe(4);
    expect(report.confidence).toBeGreaterThan(0.98);
  });

  it('no cuenta dos veces la misma pareja cuando los dos desfases dicen lo mismo', () => {
    const report = findCorrelations({
      histories: [history(ejercicio, entriesFor('ej', didIt))],
      // El ánimo se mantiene alto el día del hábito y el siguiente.
      dayLogs: logs((index) => ({ mood: (didIt(index) || didIt(index - 1) ? 5 : 2) as Scale })),
      range: RANGE,
      today: TODAY,
    });

    expect(report.tested).toBe(2);
    expect(report.qualified).toBe(2);
    // Se lista una sola frase: la misma historia contada dos veces sería ruido.
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0]?.lag).toBe(0);
  });

  it('compara hábitos entre sí y enseña las dos tasas', () => {
    const lectura = habit({ id: 'lec', name: 'Lectura', createdOn: d('2026-01-01') });
    const report = findCorrelations({
      histories: [
        history(ejercicio, entriesFor('ej', didIt)),
        // Lectura coincide con ejercicio casi siempre, pero no del todo.
        history(
          lectura,
          entriesFor('lec', (index) => (index % 10 === 3 ? false : didIt(index))),
        ),
      ],
      dayLogs: [],
      range: RANGE,
      today: TODAY,
    });

    const finding = report.findings.find((f) => f.kind === 'habit');
    expect(finding?.source.name).toBe('Ejercicio');
    expect(finding?.target?.name).toBe('Lectura');
    expect(finding?.withValue).toBeCloseTo(0.8, 2);
    expect(finding?.withoutValue).toBe(0);
    expect(report.compared).toBe(1);
  });

  it('sin registros de ánimo no plantea comparaciones de ánimo', () => {
    const report = findCorrelations({
      histories: [history(ejercicio, entriesFor('ej', didIt))],
      dayLogs: [],
      range: RANGE,
      today: TODAY,
    });
    expect(report.compared).toBe(0);
    expect(report.scaleDays).toBe(0);
    expect(report.findings).toHaveLength(0);
  });

  it('solo usa días dentro del rango', () => {
    const shortRange: DayRange = { from: d('2026-03-01'), to: d('2026-03-21') };
    const report = findCorrelations({
      histories: [history(ejercicio, entriesFor('ej', didIt))],
      dayLogs: logs((index) => ({ mood: (didIt(index) ? 5 : 2) as Scale })),
      range: shortRange,
      today: TODAY,
    });
    // 21 días: ningún grupo llega a 14.
    expect(report.tested).toBe(0);
    expect(report.findings).toHaveLength(0);
  });
});
