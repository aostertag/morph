import { describe, expect, it } from 'vitest';
import { d, days, entriesOn, habit } from '@/test/factories';
import { evaluateHabit } from './evaluate';
import { buildHistory } from './history';
import { milestones } from './milestones';
import { periodScore } from './stats';
import { computeStreaks } from './streaks';
import { analyzeHabit, buildDayView } from './today';

/*
 * Un hábito que aún no ha empezado (createdOn > hoy) no debe dejar rastro: ni días
 * fallados, ni rachas, ni hitos, ni peso en las estadísticas. Empieza a contar solo
 * cuando llega su fecha.
 */

const today = d('2026-09-20');
const ctx = { today, weekStartsOn: 1 as const, pauses: [] };
const frequencies = [
  { type: 'daily' },
  { type: 'weekdays', days: [1, 3, 5] },
  { type: 'perWeek', times: 3 },
  { type: 'perMonth', times: 8 },
] as const;

describe('hábito que empieza más adelante', () => {
  for (const frequency of frequencies) {
    describe(frequency.type, () => {
      const future = habit({ id: 'f', createdOn: d('2026-09-24'), frequency });

      it('no genera unidades evaluadas, así que nada cuenta como fallado', () => {
        expect(evaluateHabit(future, [], ctx).units).toEqual([]);
      });

      it('no tiene racha, comodines ni hitos', () => {
        const analysis = analyzeHabit(future, [], ctx);
        expect(analysis.streak.current).toBe(0);
        expect(analysis.streak.best).toBe(0);
        const history = buildHistory(analysis, today);
        expect(history.days).toEqual([]);
        const reached = milestones(history, analysis.streak);
        expect(reached.achieved).toEqual([]);
      });
    });
  }

  it('el día de inicio pasa a contar con normalidad', () => {
    const future = habit({ id: 'f', createdOn: d('2026-09-24') });
    const later = { ...ctx, today: d('2026-09-26') };
    const units = evaluateHabit(future, entriesOn(days('2026-09-24', 1), 1, 'f'), later).units;
    // 24 hecho, 25 fallado, 26 (hoy) pendiente: nada de antes del 24.
    expect(units.map((u) => [u.start, u.status])).toEqual([
      ['2026-09-24', 'done'],
      ['2026-09-25', 'missed'],
      ['2026-09-26', 'pending'],
    ]);
  });

  it('no aparece como programado en un día anterior al inicio', () => {
    const future = habit({ id: 'f', createdOn: d('2026-09-24') });
    expect(buildDayView(future, [], ctx, today).scheduled).toBe(false);
    expect(buildDayView(future, [], ctx, d('2026-09-19')).scheduled).toBe(false);
  });

  it('no altera la puntuación del período si se mezcla con otros hábitos', () => {
    const range = { from: d('2026-09-13'), to: d('2026-09-19') };
    const active = habit({ id: 'a', createdOn: d('2026-09-01') });
    const activeHistory = buildHistory(
      analyzeHabit(active, entriesOn(days('2026-09-13', 5), 1, 'a'), ctx),
      today,
    );
    const futureHistory = buildHistory(
      analyzeHabit(habit({ id: 'f', createdOn: d('2026-09-24') }), [], ctx),
      today,
    );
    expect(periodScore([activeHistory, futureHistory], range)).toEqual(
      periodScore([activeHistory], range),
    );
  });
});

describe('composición de hábitos', () => {
  it('computeStreaks con cero unidades no inventa nada', () => {
    expect(computeStreaks('day', []).current).toBe(0);
  });
});
