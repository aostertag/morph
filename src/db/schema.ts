import { Dexie, type EntityTable, type Table } from 'dexie';
import type { LocalDay } from '@/domain/day';
import type { Category, DayLog, Entry, Habit, Pause, Settings, WeeklyReview } from '@/domain/types';
import { applyMigrations, MIGRATIONS, type Migration } from './migrations';

export const DB_NAME = 'habit-tracker';

export type SettingsRow = Settings & { readonly key: 'app' };

export class TrackerDB extends Dexie {
  habits!: EntityTable<Habit, 'id'>;
  entries!: EntityTable<Entry, 'id'>;
  dayLogs!: Table<DayLog, LocalDay>;
  pauses!: EntityTable<Pause, 'id'>;
  reviews!: Table<WeeklyReview, LocalDay>;
  categories!: EntityTable<Category, 'id'>;
  settings!: Table<SettingsRow, 'app'>;

  constructor(name: string = DB_NAME, migrations: readonly Migration[] = MIGRATIONS) {
    super(name);
    applyMigrations(this, migrations);
  }
}

export const db = new TrackerDB();

export function newId(): string {
  return crypto.randomUUID();
}
