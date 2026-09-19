import type { LocalDay } from '@/domain/day';
import type { DayLog } from '@/domain/types';
import { withStorage } from '../errors';
import { db } from '../schema';

export type DayLogPatch = Partial<Pick<DayLog, 'mood' | 'energy' | 'note'>>;

export function getDayLog(date: LocalDay): Promise<DayLog | undefined> {
  return withStorage(() => db.dayLogs.get(date));
}

export function dayLogsBetween(from: LocalDay, to: LocalDay): Promise<DayLog[]> {
  return withStorage(() => db.dayLogs.where('date').between(from, to, true, true).toArray());
}

/** Actualiza el registro del día y devuelve el anterior (`null` si no había) para deshacer. */
export function updateDayLog(
  date: LocalDay,
  patch: DayLogPatch,
  now: number = Date.now(),
): Promise<DayLog | null> {
  return withStorage(() =>
    db.transaction('rw', db.dayLogs, async () => {
      const current = await db.dayLogs.get(date);
      const next: DayLog = {
        date,
        mood: current?.mood ?? null,
        energy: current?.energy ?? null,
        note: current?.note ?? null,
        ...patch,
        updatedAt: now,
      };
      const empty = next.mood === null && next.energy === null && !next.note?.trim();
      if (empty) await db.dayLogs.delete(date);
      else await db.dayLogs.put(next);
      return current ?? null;
    }),
  );
}

export function restoreDayLog(date: LocalDay, snapshot: DayLog | null): Promise<void> {
  return withStorage(async () => {
    if (snapshot) await db.dayLogs.put(snapshot);
    else await db.dayLogs.delete(date);
  });
}
