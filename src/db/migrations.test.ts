import { afterEach, describe, expect, it } from 'vitest';
import { d, habit } from '@/test/factories';
import { applyMigrations, MIGRATIONS, type Migration } from './migrations';
import { TrackerDB } from './schema';

const opened: TrackerDB[] = [];

function openDb(name: string, migrations: readonly Migration[]): TrackerDB {
  const instance = new TrackerDB(name, migrations);
  opened.push(instance);
  return instance;
}

afterEach(async () => {
  for (const instance of opened.splice(0)) {
    instance.close();
    await instance.delete();
  }
});

describe('esquema actual', () => {
  it('declara las tablas e índices esperados', async () => {
    const instance = openDb('schema-test', MIGRATIONS);
    await instance.open();
    const tables = Object.fromEntries(
      instance.tables.map((t) => [t.name, t.schema.indexes.map((i) => i.name).sort()]),
    );
    expect(Object.keys(tables).sort()).toEqual([
      'categories',
      'dayLogs',
      'entries',
      'habits',
      'pauses',
      'reviews',
      'settings',
    ]);
    expect(tables.entries).toEqual(['[habitId+date]', 'date', 'habitId']);
    expect(instance.entries.schema.indexes.find((i) => i.name === '[habitId+date]')?.unique).toBe(
      true,
    );
  });
});

describe('infraestructura de migraciones', () => {
  it('migra una base v1 con datos a una versión nueva conservándolos', async () => {
    const name = 'migration-test';
    const v1 = openDb(name, MIGRATIONS);
    const stored = habit({ id: 'h1', createdOn: d('2026-01-01') });
    await v1.habits.add(stored);
    await v1.entries.add({
      id: 'e1',
      habitId: 'h1',
      date: d('2026-01-01'),
      value: 1,
      note: null,
      loggedAt: 0,
    });
    v1.close();

    // Una v2 hipotética que añade un índice y transforma datos.
    const v2Migration: Migration = {
      version: 2,
      stores: { habits: 'id, order, kind' },
      upgrade: async (tx) => {
        await tx
          .table('habits')
          .toCollection()
          .modify((h: { name: string }) => {
            h.name = h.name.toUpperCase();
          });
      },
    };
    const v2 = openDb(name, [...MIGRATIONS, v2Migration]);
    await v2.open();

    expect(v2.verno).toBe(2);
    expect(await v2.habits.get('h1')).toMatchObject({ name: 'LEER', createdOn: '2026-01-01' });
    expect(await v2.entries.count()).toBe(1);
    expect(await v2.habits.where('kind').equals('boolean').count()).toBe(1);
  });

  it('rechaza versiones no crecientes', () => {
    const broken: Migration[] = [
      { version: 2, stores: {} },
      { version: 1, stores: {} },
    ];
    expect(() => applyMigrations(openDb('broken', []), broken)).toThrow();
  });
});
