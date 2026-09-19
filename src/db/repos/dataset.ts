import type { Category, DayLog, Entry, Habit, Pause, WeeklyReview } from '@/domain/types';
import { withStorage } from '../errors';
import { db } from '../schema';

/** Todos los datos del usuario salvo los ajustes. */
export interface DataSet {
  readonly categories: readonly Category[];
  readonly habits: readonly Habit[];
  readonly entries: readonly Entry[];
  readonly dayLogs: readonly DayLog[];
  readonly pauses: readonly Pause[];
  readonly reviews: readonly WeeklyReview[];
}

/**
 * Sustituye todos los datos en una sola transacción: si algo falla, no cambia nada.
 * Los ajustes se conservan.
 */
export function replaceAllData(data: DataSet): Promise<void> {
  const tables = [db.categories, db.habits, db.entries, db.dayLogs, db.pauses, db.reviews];
  return withStorage(() =>
    db.transaction('rw', tables, async () => {
      await Promise.all(tables.map((table) => table.clear()));
      await db.categories.bulkAdd([...data.categories]);
      await db.habits.bulkAdd([...data.habits]);
      await db.entries.bulkAdd([...data.entries]);
      await db.dayLogs.bulkAdd([...data.dayLogs]);
      await db.pauses.bulkAdd([...data.pauses]);
      await db.reviews.bulkAdd([...data.reviews]);
    }),
  );
}
