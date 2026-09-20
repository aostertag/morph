import { type DataSet, DEFAULT_SETTINGS, type Settings } from '@/domain/types';
import { withStorage } from '../errors';
import { db } from '../schema';

export type { DataSet } from '@/domain/types';

/** Todo lo que guarda la app: los datos y los ajustes (`null` = nunca se han tocado). */
export interface Snapshot {
  readonly data: DataSet;
  readonly settings: Settings | null;
}

export const EMPTY_DATA: DataSet = {
  categories: [],
  habits: [],
  entries: [],
  dayLogs: [],
  pauses: [],
  reviews: [],
};

const DATA_TABLES = [db.categories, db.habits, db.entries, db.dayLogs, db.pauses, db.reviews];

/** Lee todo en una sola transacción, así que el resultado es coherente. */
export function readSnapshot(): Promise<Snapshot> {
  return withStorage(() =>
    db.transaction('r', [...DATA_TABLES, db.settings], async () => {
      const [categories, habits, entries, dayLogs, pauses, reviews, row] = await Promise.all([
        db.categories.toArray(),
        db.habits.toArray(),
        db.entries.toArray(),
        db.dayLogs.toArray(),
        db.pauses.toArray(),
        db.reviews.toArray(),
        db.settings.get('app'),
      ]);
      const { key: _key, ...stored } = row ?? { key: 'app' as const };
      return {
        data: { categories, habits, entries, dayLogs, pauses, reviews },
        settings: row ? { ...DEFAULT_SETTINGS, ...stored } : null,
      };
    }),
  );
}

/**
 * Sustituye los datos en una sola transacción: si algo falla (un duplicado que el
 * índice único rechaza, el disco lleno…) la transacción entera se deshace y no
 * cambia nada. Con `settings` también sustituye los ajustes (`null` los borra);
 * sin él, los ajustes se conservan.
 */
export function replaceAllData(data: DataSet, settings?: Settings | null): Promise<void> {
  const tables = settings === undefined ? DATA_TABLES : [...DATA_TABLES, db.settings];
  return withStorage(() =>
    db.transaction('rw', tables, async () => {
      await Promise.all(DATA_TABLES.map((table) => table.clear()));
      await db.categories.bulkAdd([...data.categories]);
      await db.habits.bulkAdd([...data.habits]);
      await db.entries.bulkAdd([...data.entries]);
      await db.dayLogs.bulkAdd([...data.dayLogs]);
      await db.pauses.bulkAdd([...data.pauses]);
      await db.reviews.bulkAdd([...data.reviews]);
      if (settings === undefined) return;
      if (settings === null) await db.settings.clear();
      else await db.settings.put({ ...settings, key: 'app' });
    }),
  );
}

/** Restaura una copia completa y devuelve el estado anterior, para poder deshacer. */
export async function restoreSnapshot(next: Snapshot): Promise<Snapshot> {
  const previous = await readSnapshot();
  await replaceAllData(next.data, next.settings);
  return previous;
}
