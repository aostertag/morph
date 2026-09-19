import { describe, expect, it } from 'vitest';
import { d, entriesOn, entry, habit, pause } from '@/test/factories';
import type { Weekday } from './day';
import {
  canLogOn,
  type EvaluatedUnit,
  type EvaluationContext,
  evaluateHabit,
  isDaySuccess,
} from './evaluate';
import type { Pause } from './types';

function ctx(today: string, pauses: Pause[] = [], weekStartsOn: Weekday = 1): EvaluationContext {
  return { today: d(today), weekStartsOn, pauses };
}

function summary(units: readonly EvaluatedUnit[]): string[] {
  return units.map((u) => `${u.start} ${u.status}`);
}

describe('isDaySuccess', () => {
  it('sí/no se cumple con cualquier registro', () => {
    expect(isDaySuccess({ kind: 'boolean', target: null }, 1)).toBe(true);
    expect(isDaySuccess({ kind: 'boolean', target: null }, 0)).toBe(false);
  });

  it('cuantitativo y tiempo se cumplen al alcanzar la meta', () => {
    expect(isDaySuccess({ kind: 'quantity', target: 8 }, 7)).toBe(false);
    expect(isDaySuccess({ kind: 'quantity', target: 8 }, 8)).toBe(true);
    expect(isDaySuccess({ kind: 'quantity', target: 8 }, 11)).toBe(true);
    expect(isDaySuccess({ kind: 'time', target: 30 }, 29.5)).toBe(false);
    expect(isDaySuccess({ kind: 'time', target: 30 }, 30)).toBe(true);
  });

  it('a evitar se cumple cuando no hay registro', () => {
    expect(isDaySuccess({ kind: 'avoid', target: null }, 0)).toBe(true);
    expect(isDaySuccess({ kind: 'avoid', target: null }, 1)).toBe(false);
  });
});

describe('evaluateHabit · diario', () => {
  it('evalúa cada día desde la creación y deja hoy pendiente', () => {
    const h = habit({ createdOn: d('2026-01-01') });
    const entries = entriesOn(['2026-01-01', '2026-01-02', '2026-01-04']);
    const { unit, units } = evaluateHabit(h, entries, ctx('2026-01-05'));
    expect(unit).toBe('day');
    expect(summary(units)).toEqual([
      '2026-01-01 done',
      '2026-01-02 done',
      '2026-01-03 missed',
      '2026-01-04 done',
      '2026-01-05 pending',
    ]);
  });

  it('marca hoy como cumplido en cuanto se registra', () => {
    const h = habit({ createdOn: d('2026-01-05') });
    const { units } = evaluateHabit(h, entriesOn(['2026-01-05']), ctx('2026-01-05'));
    expect(summary(units)).toEqual(['2026-01-05 done']);
  });

  it('ignora registros de otros hábitos', () => {
    const h = habit({ createdOn: d('2026-01-01') });
    const { units } = evaluateHabit(h, [entry('2026-01-01', 1, 'h2')], ctx('2026-01-02'));
    expect(summary(units)).toEqual(['2026-01-01 missed', '2026-01-02 pending']);
  });

  it('no evalúa nada si el hábito se crea en el futuro', () => {
    const h = habit({ createdOn: d('2026-02-01') });
    expect(evaluateHabit(h, [], ctx('2026-01-15')).units).toEqual([]);
  });

  it('cuantitativo: guarda el valor real y cumple solo al llegar a la meta', () => {
    const h = habit({ kind: 'quantity', target: 8, unit: 'vasos', createdOn: d('2026-01-01') });
    const entries = [entry('2026-01-01', 8), entry('2026-01-02', 5), entry('2026-01-03', 10)];
    const { units } = evaluateHabit(h, entries, ctx('2026-01-04'));
    expect(summary(units)).toEqual([
      '2026-01-01 done',
      '2026-01-02 missed',
      '2026-01-03 done',
      '2026-01-04 pending',
    ]);
  });

  it('cruza el 29 de febrero en año bisiesto', () => {
    const h = habit({ createdOn: d('2024-02-28') });
    const entries = entriesOn(['2024-02-28', '2024-02-29', '2024-03-01']);
    const { units } = evaluateHabit(h, entries, ctx('2024-03-01'));
    expect(summary(units)).toEqual(['2024-02-28 done', '2024-02-29 done', '2024-03-01 done']);
  });

  it('los días de cambio de horario son días normales', () => {
    const h = habit({ createdOn: d('2026-03-28') });
    const entries = entriesOn(['2026-03-28', '2026-03-29', '2026-03-30']);
    const { units } = evaluateHabit(h, entries, ctx('2026-03-30'));
    expect(units).toHaveLength(3);
    expect(units.every((u) => u.status === 'done')).toBe(true);
  });
});

describe('evaluateHabit · días concretos', () => {
  it('solo evalúa los días programados', () => {
    const h = habit({
      frequency: { type: 'weekdays', days: [1, 3, 5] },
      createdOn: d('2026-01-05'), // lunes
    });
    const entries = entriesOn(['2026-01-05', '2026-01-09']);
    const { units } = evaluateHabit(h, entries, ctx('2026-01-11'));
    expect(summary(units)).toEqual(['2026-01-05 done', '2026-01-07 missed', '2026-01-09 done']);
  });

  it('un día no programado no deja nada pendiente', () => {
    const h = habit({ frequency: { type: 'weekdays', days: [1] }, createdOn: d('2026-01-05') });
    const { units } = evaluateHabit(h, entriesOn(['2026-01-05']), ctx('2026-01-06'));
    expect(summary(units)).toEqual(['2026-01-05 done']);
  });
});

describe('evaluateHabit · a evitar', () => {
  it('cada día sin registro es un día limpio; una recaída es un fallo', () => {
    const h = habit({ kind: 'avoid', createdOn: d('2026-01-01') });
    const { units } = evaluateHabit(h, entriesOn(['2026-01-03']), ctx('2026-01-05'));
    expect(summary(units)).toEqual([
      '2026-01-01 done',
      '2026-01-02 done',
      '2026-01-03 missed',
      '2026-01-04 done',
      '2026-01-05 pending',
    ]);
  });

  it('una recaída hoy cierra el día como fallado', () => {
    const h = habit({ kind: 'avoid', createdOn: d('2026-01-01') });
    const { units } = evaluateHabit(h, entriesOn(['2026-01-02']), ctx('2026-01-02'));
    expect(summary(units)).toEqual(['2026-01-01 done', '2026-01-02 missed']);
  });
});

describe('evaluateHabit · X veces por semana', () => {
  const threePerWeek = { type: 'perWeek', times: 3 } as const;

  it('no hacerlo un martes no rompe nada mientras se llegue a la meta', () => {
    const h = habit({ frequency: threePerWeek, createdOn: d('2026-01-05') });
    // Semana del 5 al 11: lunes, jueves y domingo.
    const entries = entriesOn(['2026-01-05', '2026-01-08', '2026-01-11']);
    const { unit, units } = evaluateHabit(h, entries, ctx('2026-01-11'));
    expect(unit).toBe('week');
    expect(units).toEqual([
      { start: '2026-01-05', end: '2026-01-11', status: 'done', required: 3, achieved: 3 },
    ]);
  });

  it('la semana en curso queda pendiente aunque ya no dé tiempo', () => {
    const h = habit({ frequency: threePerWeek, createdOn: d('2026-01-05') });
    const { units } = evaluateHabit(h, [], ctx('2026-01-11'));
    expect(units[0]?.status).toBe('pending');
  });

  it('se cumple antes de acabar la semana', () => {
    const h = habit({ frequency: threePerWeek, createdOn: d('2026-01-05') });
    const entries = entriesOn(['2026-01-05', '2026-01-06', '2026-01-07']);
    const { units } = evaluateHabit(h, entries, ctx('2026-01-07'));
    expect(units[0]?.status).toBe('done');
  });

  it('una semana cerrada sin llegar a la meta es un fallo', () => {
    const h = habit({ frequency: threePerWeek, createdOn: d('2026-01-05') });
    const entries = entriesOn(['2026-01-05', '2026-01-06']);
    const { units } = evaluateHabit(h, entries, ctx('2026-01-12'));
    expect(summary(units)).toEqual(['2026-01-05 missed', '2026-01-12 pending']);
  });

  it('creado a mitad de semana prorratea la primera semana', () => {
    // Creado el miércoles 7: quedan 5 días de 7 → ceil(3 · 5/7) = 3.
    const wednesday = habit({ frequency: threePerWeek, createdOn: d('2026-01-07') });
    expect(evaluateHabit(wednesday, [], ctx('2026-01-07')).units[0]).toMatchObject({
      start: '2026-01-05',
      required: 3,
    });
    // Creado el sábado 10: quedan 2 días → ceil(3 · 2/7) = 1.
    const saturday = habit({ frequency: threePerWeek, createdOn: d('2026-01-10') });
    const { units } = evaluateHabit(saturday, entriesOn(['2026-01-11']), ctx('2026-01-12'));
    expect(units[0]).toMatchObject({ status: 'done', required: 1, achieved: 1 });
  });

  it('los registros anteriores a la creación no cuentan', () => {
    const h = habit({ frequency: threePerWeek, createdOn: d('2026-01-07') });
    const entries = entriesOn(['2026-01-05', '2026-01-06', '2026-01-07']);
    const { units } = evaluateHabit(h, entries, ctx('2026-01-12'));
    expect(units[0]).toMatchObject({ status: 'missed', achieved: 1 });
  });

  it('agrupa según el primer día de la semana configurado', () => {
    const h = habit({ frequency: threePerWeek, createdOn: d('2026-01-04') });
    // Domingo 11, lunes 12 y martes 13.
    const entries = entriesOn(['2026-01-11', '2026-01-12', '2026-01-13']);
    const mondayStart = evaluateHabit(h, entries, ctx('2026-01-13', [], 1)).units;
    const sundayStart = evaluateHabit(h, entries, ctx('2026-01-13', [], 0)).units;
    expect(mondayStart.at(-1)).toMatchObject({
      start: '2026-01-12',
      achieved: 2,
      status: 'pending',
    });
    expect(sundayStart.at(-1)).toMatchObject({ start: '2026-01-11', achieved: 3, status: 'done' });
  });

  it('cuantitativo semanal: solo cuentan los días que alcanzan la meta', () => {
    const h = habit({
      kind: 'quantity',
      target: 5000,
      frequency: { type: 'perWeek', times: 2 },
      createdOn: d('2026-01-05'),
    });
    const entries = [
      entry('2026-01-05', 6000),
      entry('2026-01-06', 4000),
      entry('2026-01-07', 5000),
    ];
    const { units } = evaluateHabit(h, entries, ctx('2026-01-12'));
    expect(units[0]).toMatchObject({ status: 'done', achieved: 2 });
  });
});

describe('evaluateHabit · X veces al mes', () => {
  it('usa la longitud real del mes y prorratea si se crea a mitad', () => {
    const h = habit({ frequency: { type: 'perMonth', times: 10 }, createdOn: d('2026-02-15') });
    const { unit, units } = evaluateHabit(h, [], ctx('2026-03-02'));
    expect(unit).toBe('month');
    expect(units).toEqual([
      { start: '2026-02-01', end: '2026-02-28', status: 'missed', required: 5, achieved: 0 },
      { start: '2026-03-01', end: '2026-03-31', status: 'pending', required: 10, achieved: 0 },
    ]);
  });

  it('febrero bisiesto tiene 29 días elegibles', () => {
    const h = habit({ frequency: { type: 'perMonth', times: 29 }, createdOn: d('2024-02-01') });
    const all = Array.from({ length: 29 }, (_, i) => `2024-02-${String(i + 1).padStart(2, '0')}`);
    const { units } = evaluateHabit(h, entriesOn(all), ctx('2024-03-01'));
    expect(units[0]).toMatchObject({ status: 'done', required: 29, achieved: 29 });
  });
});

describe('evaluateHabit · pausas', () => {
  it('los días en pausa son neutros aunque haya registro', () => {
    const h = habit({ createdOn: d('2026-01-01') });
    const entries = entriesOn(['2026-01-01', '2026-01-03']);
    const { units } = evaluateHabit(
      h,
      entries,
      ctx('2026-01-05', [pause('2026-01-02', '2026-01-03')]),
    );
    expect(summary(units)).toEqual([
      '2026-01-01 done',
      '2026-01-02 paused',
      '2026-01-03 paused',
      '2026-01-04 missed',
      '2026-01-05 pending',
    ]);
  });

  it('las pausas de otro hábito no afectan', () => {
    const h = habit({ createdOn: d('2026-01-01') });
    const { units } = evaluateHabit(
      h,
      [],
      ctx('2026-01-02', [pause('2026-01-01', '2026-01-01', 'h2')]),
    );
    expect(units[0]?.status).toBe('missed');
  });

  it('una semana con días en pausa reduce la meta proporcionalmente', () => {
    const h = habit({ frequency: { type: 'perWeek', times: 3 }, createdOn: d('2026-01-05') });
    // 4 días en pausa: quedan 3 → ceil(3 · 3/7) = 2.
    const pauses = [pause('2026-01-05', '2026-01-08', 'h1')];
    const entries = entriesOn(['2026-01-06', '2026-01-09', '2026-01-10']);
    const { units } = evaluateHabit(h, entries, ctx('2026-01-12', pauses));
    expect(units[0]).toMatchObject({ status: 'done', required: 2, achieved: 2 });
  });

  it('una semana entera en pausa es neutra', () => {
    const h = habit({ frequency: { type: 'perWeek', times: 3 }, createdOn: d('2026-01-05') });
    const { units } = evaluateHabit(h, [], ctx('2026-01-12', [pause('2026-01-05', '2026-01-11')]));
    expect(units[0]).toMatchObject({ status: 'paused', required: 0 });
  });
});

describe('evaluateHabit · archivado', () => {
  it('deja de evaluar tras el día de archivado', () => {
    const h = habit({ createdOn: d('2026-01-01'), archivedOn: d('2026-01-03') });
    const { units } = evaluateHabit(h, entriesOn(['2026-01-01']), ctx('2026-01-10'));
    expect(summary(units)).toEqual(['2026-01-01 done', '2026-01-02 missed', '2026-01-03 missed']);
  });

  it('cierra la semana del archivado con meta prorrateada', () => {
    const h = habit({
      frequency: { type: 'perWeek', times: 3 },
      createdOn: d('2026-01-05'),
      archivedOn: d('2026-01-07'),
    });
    // 3 días elegibles → ceil(3 · 3/7) = 2.
    const { units } = evaluateHabit(h, entriesOn(['2026-01-05', '2026-01-06']), ctx('2026-01-20'));
    expect(units).toEqual([
      { start: '2026-01-05', end: '2026-01-11', status: 'done', required: 2, achieved: 2 },
    ]);
  });
});

describe('canLogOn', () => {
  const h = habit({ createdOn: d('2026-01-01') });

  it('permite hoy y hasta el límite retroactivo', () => {
    expect(canLogOn(h, d('2026-01-20'), d('2026-01-20'), 7)).toBe('ok');
    expect(canLogOn(h, d('2026-01-13'), d('2026-01-20'), 7)).toBe('ok');
    expect(canLogOn(h, d('2026-01-12'), d('2026-01-20'), 7)).toBe('tooOld');
  });

  it('respeta un límite configurado distinto', () => {
    expect(canLogOn(h, d('2026-01-19'), d('2026-01-20'), 0)).toBe('tooOld');
    expect(canLogOn(h, d('2026-01-05'), d('2026-01-20'), 30)).toBe('ok');
  });

  it('no permite el futuro, antes de la creación ni después del archivado', () => {
    expect(canLogOn(h, d('2026-01-21'), d('2026-01-20'), 7)).toBe('future');
    expect(canLogOn(h, d('2025-12-31'), d('2026-01-02'), 7)).toBe('beforeStart');
    const archived = habit({ createdOn: d('2026-01-01'), archivedOn: d('2026-01-15') });
    expect(canLogOn(archived, d('2026-01-16'), d('2026-01-20'), 7)).toBe('archived');
  });

  it('el límite cruza el 29 de febrero', () => {
    const leap = habit({ createdOn: d('2024-01-01') });
    expect(canLogOn(leap, d('2024-02-23'), d('2024-03-01'), 7)).toBe('ok');
    expect(canLogOn(leap, d('2024-02-22'), d('2024-03-01'), 7)).toBe('tooOld');
  });
});
