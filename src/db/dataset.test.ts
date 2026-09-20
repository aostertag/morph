import { beforeEach, describe, expect, it } from 'vitest';
import { generateSampleData } from '@/dev/sampleData';
import { buildBackup, parseBackup, serializeBackup } from '@/domain/backup';
import { DEFAULT_SETTINGS } from '@/domain/types';
import { d, dayLog, entry, habit, review } from '@/test/factories';
import { StorageError } from './errors';
import {
  type DataSet,
  EMPTY_DATA,
  readSnapshot,
  replaceAllData,
  restoreSnapshot,
} from './repos/dataset';
import { getSettings, updateSettings } from './repos/settings';
import { db } from './schema';

beforeEach(async () => {
  await db.open();
  await Promise.all(db.tables.map((table) => table.clear()));
});

function sample(): DataSet {
  return generateSampleData({ today: d('2026-09-19'), weekStartsOn: 1 });
}

/** Contenido completo de la base, ordenado por clave primaria, para compararlo. */
async function everything() {
  const { data, settings } = await readSnapshot();
  const by = <T>(rows: readonly T[], key: (row: T) => string) =>
    [...rows].sort((x, y) => key(x).localeCompare(key(y)));
  return {
    settings,
    categories: by(data.categories, (r) => r.id),
    habits: by(data.habits, (r) => r.id),
    entries: by(data.entries, (r) => r.id),
    dayLogs: by(data.dayLogs, (r) => r.date),
    pauses: by(data.pauses, (r) => r.id),
    reviews: by(data.reviews, (r) => r.weekStart),
  };
}

describe('instantánea y sustitución de datos', () => {
  it('lo que se escribe es lo que se lee', async () => {
    const data = sample();
    await replaceAllData(data, { ...DEFAULT_SETTINGS, theme: 'dark', retroLimitDays: 3 });
    const snapshot = await readSnapshot();
    expect(snapshot.data.habits).toHaveLength(data.habits.length);
    expect(snapshot.data.entries).toHaveLength(data.entries.length);
    expect(snapshot.settings).toMatchObject({ theme: 'dark', retroLimitDays: 3 });
  });

  it('sin ajustes en la llamada, los ajustes se conservan', async () => {
    await updateSettings({ theme: 'dark' });
    await replaceAllData(sample());
    expect((await getSettings()).theme).toBe('dark');
  });

  it('con ajustes null, se borran los ajustes', async () => {
    await updateSettings({ theme: 'dark' });
    await replaceAllData(EMPTY_DATA, null);
    expect((await readSnapshot()).settings).toBeNull();
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('un backup exportado y vuelto a importar deja la base idéntica', async () => {
    await replaceAllData(sample(), { ...DEFAULT_SETTINGS, weekStartsOn: 0 });
    const before = await everything();
    const { data, settings } = await readSnapshot();
    const text = serializeBackup(buildBackup(data, settings ?? DEFAULT_SETTINGS, new Date()));

    const parsed = parseBackup(text);
    if (!parsed.ok) throw new Error(parsed.errors.join(' | '));
    await restoreSnapshot({ data: parsed.backup.data, settings: parsed.backup.settings });

    expect(await everything()).toEqual(before);
  });
});

describe('atomicidad: si la escritura falla, no cambia nada', () => {
  async function seed() {
    await replaceAllData(sample(), { ...DEFAULT_SETTINGS, theme: 'dark' });
    return everything();
  }

  it('un duplicado que el índice único rechaza a mitad de la escritura', async () => {
    const before = await seed();
    const bad: DataSet = {
      ...EMPTY_DATA,
      habits: [habit({ id: 'x1' })],
      // Mismo hábito y día: el índice único &[habitId+date] lo rechaza al añadir.
      entries: [entry('2026-02-01', 1, 'x1'), entry('2026-02-01', 1, 'x1')],
    };
    await expect(replaceAllData(bad, DEFAULT_SETTINGS)).rejects.toBeInstanceOf(StorageError);
    expect(await everything()).toEqual(before);
  });

  it('un fallo en la última tabla, con todas las demás ya escritas', async () => {
    const before = await seed();
    const bad: DataSet = {
      ...EMPTY_DATA,
      habits: [habit({ id: 'x1' })],
      entries: [entry('2026-02-01', 1, 'x1')],
      dayLogs: [dayLog('2026-02-01', 3)],
      // Dos revisiones con la misma clave primaria: falla al final de la transacción.
      reviews: [review('2026-01-26'), review('2026-01-26')],
    };
    await expect(
      replaceAllData(bad, { ...DEFAULT_SETTINGS, theme: 'light' }),
    ).rejects.toBeInstanceOf(StorageError);
    expect(await everything()).toEqual(before);
  });

  it('un fallo al restaurar tampoco toca los ajustes', async () => {
    const before = await seed();
    const bad: DataSet = { ...EMPTY_DATA, habits: [habit({ id: 'a' }), habit({ id: 'a' })] };
    await expect(
      restoreSnapshot({ data: bad, settings: { ...DEFAULT_SETTINGS, theme: 'light' } }),
    ).rejects.toBeInstanceOf(StorageError);
    expect(await everything()).toEqual(before);
  });
});

describe('deshacer una restauración', () => {
  it('restaurar devuelve el estado anterior y volver a restaurarlo lo recupera', async () => {
    await replaceAllData(sample(), { ...DEFAULT_SETTINGS, theme: 'dark' });
    const before = await everything();

    const previous = await restoreSnapshot({ data: EMPTY_DATA, settings: null });
    expect((await readSnapshot()).data.habits).toHaveLength(0);

    await restoreSnapshot(previous);
    expect(await everything()).toEqual(before);
  });
});
