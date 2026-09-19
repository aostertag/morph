import type { Dexie, Transaction } from 'dexie';

/**
 * Historial de versiones del esquema. Nunca se edita una versión publicada:
 * cada cambio añade una entrada nueva con su `upgrade` si hay que transformar datos.
 *
 * `stores` solo declara la clave primaria y los campos indexados; el resto de
 * campos se guarda igual sin declararse.
 */
export interface Migration {
  readonly version: number;
  readonly stores: Readonly<Record<string, string | null>>;
  readonly upgrade?: (tx: Transaction) => Promise<void> | void;
}

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    stores: {
      habits: 'id, order',
      // Un registro por hábito y día; las consultas por rango de fechas usan el índice compuesto.
      entries: 'id, &[habitId+date], date, habitId',
      dayLogs: 'date',
      pauses: 'id, habitId, start',
      reviews: 'weekStart',
      categories: 'id, order',
      settings: 'key',
    },
  },
];

export function applyMigrations(db: Dexie, migrations: readonly Migration[]): void {
  let previous = 0;
  for (const migration of migrations) {
    if (migration.version <= previous) {
      throw new Error(`Las migraciones deben tener versiones crecientes (${migration.version}).`);
    }
    previous = migration.version;
    const version = db.version(migration.version).stores(migration.stores);
    if (migration.upgrade) version.upgrade(migration.upgrade);
  }
}
