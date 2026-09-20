import { beforeEach, describe, expect, it } from 'vitest';
import { eachDay, type LocalDay } from '@/domain/day';
import { buildHistory } from '@/domain/history';
import { completionRate } from '@/domain/metrics';
import { periodScore } from '@/domain/stats';
import { analyzeHabit, dayProgress, viewForDay } from '@/domain/today';
import { buildHeatmap, yearRange } from '@/features/habit-detail/heatmapModel';
import { d, habit } from '@/test/factories';
import { entriesForHabit, setEntryValue } from './repos/entries';
import { createHabit } from './repos/habits';
import { createPause, deletePause, listPauses, updatePause } from './repos/pauses';
import { db } from './schema';

/*
 * Las pausas viajan por todo el sistema: se crean con el repositorio y se leen por
 * cada camino que las consume. Un hábito diario que empieza el 1 de septiembre,
 * cumplido del 1 al 7 y del 15 al 19, y fallado del 8 al 14.
 */

const today = d('2026-09-19');
const DONE = [...eachDay(d('2026-09-01'), d('2026-09-07')), ...eachDay(d('2026-09-15'), today)];

beforeEach(async () => {
  await db.open();
  await Promise.all(db.tables.map((table) => table.clear()));
});

async function seed() {
  const { id: _id, order: _order, archivedOn: _archived, ...input } = habit();
  const created = await createHabit({ ...input, createdOn: d('2026-09-01') });
  for (const day of DONE) await setEntryValue(created.id, day, 1);
  return created;
}

async function analysis(habitId: string) {
  const stored = await db.habits.get(habitId);
  if (!stored) throw new Error('hábito no encontrado');
  const ctx = { today, weekStartsOn: 1 as const, pauses: await listPauses() };
  return analyzeHabit(stored, await entriesForHabit(habitId), ctx);
}

const week = { from: d('2026-09-01'), to: today };

describe('una pausa se refleja en todas las pantallas', () => {
  it('sin pausa, la semana fallada cuenta en contra', async () => {
    const h = await seed();
    const a = await analysis(h.id);
    const rate = completionRate(buildHistory(a, today), week.from, week.to);
    expect(rate).toMatchObject({ days: 19, doneDays: 12 });
    expect(a.streak.current).toBeLessThan(12);
  });

  describe('con la semana fallada en pausa', () => {
    it('Hoy: los días en pausa no cuentan ni están pendientes', async () => {
      const h = await seed();
      await createPause({
        habitId: h.id,
        start: d('2026-09-08'),
        end: d('2026-09-14'),
        reason: 'enfermedad',
        note: null,
      });
      const a = await analysis(h.id);
      const view = viewForDay(a, d('2026-09-10'));
      expect(view).toMatchObject({
        paused: true,
        countsForProgress: false,
        doneForProgress: false,
      });
      expect(dayProgress([view].filter((v) => v.scheduled))).toMatchObject({ total: 0 });
      // Un día normal sigue contando.
      expect(viewForDay(a, d('2026-09-16'))).toMatchObject({
        paused: false,
        countsForProgress: true,
      });
    });

    it('rachas: la racha sigue como si esos días no existieran', async () => {
      const h = await seed();
      await createPause({
        habitId: h.id,
        start: d('2026-09-08'),
        end: d('2026-09-14'),
        reason: 'vacaciones',
        note: null,
      });
      const { streak } = await analysis(h.id);
      expect(streak.current).toBe(12);
      expect(streak.best).toBe(12);
      expect(streak.currentRange).toMatchObject({ start: '2026-09-01', end: '2026-09-19' });
    });

    it('heatmap: los días en pausa salen como pausa, no como fallo', async () => {
      const h = await seed();
      await createPause({
        habitId: h.id,
        start: d('2026-09-08'),
        end: d('2026-09-14'),
        reason: 'vacaciones',
        note: null,
      });
      const model = buildHeatmap(
        buildHistory(await analysis(h.id), today),
        yearRange(2026, today),
        1,
      );
      const kinds = new Map(model.weeks.flatMap((w) => w.cells).map((c) => [c.day, c.kind]));
      for (const day of eachDay(d('2026-09-08'), d('2026-09-14'))) {
        expect(kinds.get(day)).toBe('paused');
      }
      expect(kinds.get(d('2026-09-07'))).toBe('level');
      expect(kinds.get(d('2026-09-15'))).toBe('level');
    });

    it('estadísticas: la tasa y la puntuación solo miran los días evaluables', async () => {
      const h = await seed();
      await createPause({
        habitId: h.id,
        start: d('2026-09-08'),
        end: d('2026-09-14'),
        reason: 'vacaciones',
        note: null,
      });
      const history = buildHistory(await analysis(h.id), today);
      expect(completionRate(history, week.from, week.to)).toMatchObject({
        days: 12,
        doneDays: 12,
        ratio: 1,
      });
      expect(periodScore([history], week)).toMatchObject({ ratio: 1, days: 12 });
    });
  });

  it('una pausa global afecta a todos los hábitos', async () => {
    const a = await seed();
    const { id: _id, order: _order, archivedOn: _archived, ...input } = habit({ name: 'Otro' });
    const b = await createHabit({ ...input, createdOn: d('2026-09-01') });
    await createPause({
      habitId: null,
      start: d('2026-09-08'),
      end: d('2026-09-14'),
      reason: 'vacaciones',
      note: null,
    });
    for (const id of [a.id, b.id]) {
      expect(viewForDay(await analysis(id), d('2026-09-10')).paused).toBe(true);
    }
  });

  it('una pausa de otro hábito no afecta a este', async () => {
    const a = await seed();
    const { id: _id, order: _order, archivedOn: _archived, ...input } = habit({ name: 'Otro' });
    const b = await createHabit({ ...input, createdOn: d('2026-09-01') });
    await createPause({
      habitId: b.id,
      start: d('2026-09-08'),
      end: d('2026-09-14'),
      reason: 'otro',
      note: null,
    });
    expect(viewForDay(await analysis(a.id), d('2026-09-10')).paused).toBe(false);
  });

  it('editar o borrar la pausa recalcula todo con coherencia', async () => {
    const h = await seed();
    const pause = await createPause({
      habitId: h.id,
      start: d('2026-09-08'),
      end: d('2026-09-14'),
      reason: 'vacaciones',
      note: null,
    });
    expect((await analysis(h.id)).streak.current).toBe(12);

    // Acortarla deja tres días fallados sin cubrir: la racha vuelve a romperse.
    await updatePause(pause.id, { end: d('2026-09-10') });
    const shorter = await analysis(h.id);
    expect(viewForDay(shorter, d('2026-09-12')).paused).toBe(false);
    expect(shorter.streak.current).toBeLessThan(12);

    await deletePause(pause.id);
    const none = await analysis(h.id);
    expect(viewForDay(none, d('2026-09-09')).paused).toBe(false);
    const rate = completionRate(buildHistory(none, today), week.from, week.to);
    expect(rate.days).toBe(19);
  });

  it('una pausa que empieza mañana no afecta a hoy', async () => {
    const h = await seed();
    await createPause({
      habitId: h.id,
      start: d('2026-09-20' as LocalDay),
      end: d('2026-09-25'),
      reason: 'vacaciones',
      note: null,
    });
    expect(viewForDay(await analysis(h.id), today).paused).toBe(false);
  });
});
