import { beforeEach, describe, expect, it } from 'vitest';
import type { HabitInput } from '@/domain/habit';
import { d, habit as habitFixture } from '@/test/factories';
import { ValidationError } from './errors';
import { createCategory, deleteCategory, listCategories } from './repos/categories';
import { getDayLog, restoreDayLog, updateDayLog } from './repos/dayLogs';
import {
  adjustEntryValue,
  entriesBetween,
  entriesForHabit,
  getEntry,
  restoreEntry,
  setEntryNote,
  setEntryValue,
} from './repos/entries';
import {
  archiveHabit,
  createHabit,
  deleteHabit,
  getHabit,
  listHabits,
  reorderHabits,
  restoreHabit,
  unarchiveHabit,
  undoUnarchive,
  updateHabit,
} from './repos/habits';
import { createPause, deletePause, listPauses, restorePause } from './repos/pauses';
import { getSettings, updateSettings } from './repos/settings';
import { db } from './schema';

function input(overrides: Partial<HabitInput> = {}): HabitInput {
  const { id: _id, order: _order, archivedOn: _archived, ...rest } = habitFixture();
  return { ...rest, ...overrides };
}

beforeEach(async () => {
  await db.open();
  await Promise.all(db.tables.map((table) => table.clear()));
});

describe('hábitos', () => {
  it('crea con orden creciente y normaliza los datos', async () => {
    const a = await createHabit(input({ name: '  Leer ' }));
    const b = await createHabit(input({ name: 'Correr', kind: 'boolean', target: 5 }));
    expect(a).toMatchObject({ name: 'Leer', order: 0, archivedOn: null });
    expect(b).toMatchObject({ order: 1, target: null });
    expect((await listHabits()).map((h) => h.name)).toEqual(['Leer', 'Correr']);
  });

  it('rechaza datos no válidos sin guardar nada', async () => {
    await expect(createHabit(input({ name: '' }))).rejects.toBeInstanceOf(ValidationError);
    expect(await listHabits()).toEqual([]);
  });

  it('actualiza conservando id, orden y archivado', async () => {
    const created = await createHabit(input());
    const updated = await updateHabit(created.id, input({ name: 'Leer 20 páginas' }));
    expect(updated).toMatchObject({ id: created.id, order: 0, name: 'Leer 20 páginas' });
  });

  it('actualizar un hábito inexistente da un error de validación', async () => {
    await expect(updateHabit('nope', input())).rejects.toBeInstanceOf(ValidationError);
  });

  it('reordena', async () => {
    const a = await createHabit(input({ name: 'A' }));
    const b = await createHabit(input({ name: 'B' }));
    const c = await createHabit(input({ name: 'C' }));
    await reorderHabits([c.id, a.id, b.id]);
    expect((await listHabits()).map((h) => h.name)).toEqual(['C', 'A', 'B']);
  });

  it('eliminar borra su historial y se puede restaurar entero', async () => {
    const h = await createHabit(input());
    const other = await createHabit(input({ name: 'Otro' }));
    await setEntryValue(h.id, d('2026-01-01'), 1);
    await setEntryValue(other.id, d('2026-01-01'), 1);
    await createPause({
      habitId: h.id,
      start: d('2026-02-01'),
      end: d('2026-02-03'),
      reason: 'otro',
      note: null,
    });

    const deleted = await deleteHabit(h.id);
    expect(deleted?.entries).toHaveLength(1);
    expect(await getHabit(h.id)).toBeUndefined();
    expect(await db.entries.count()).toBe(1);
    expect(await listPauses()).toEqual([]);

    if (!deleted) throw new Error('esperaba un hábito eliminado');
    await restoreHabit(deleted);
    expect(await getHabit(h.id)).toEqual(h);
    expect(await entriesForHabit(h.id)).toHaveLength(1);
    expect(await listPauses()).toHaveLength(1);
  });
});

describe('registros', () => {
  const day = d('2026-03-29');

  it('uno por hábito y día: fijar el valor actualiza el mismo registro', async () => {
    expect(await setEntryValue('h1', day, 3, 100)).toBeNull();
    const previous = await setEntryValue('h1', day, 5, 200);
    expect(previous).toMatchObject({ value: 3, loggedAt: 100 });
    expect(await db.entries.count()).toBe(1);
    expect(await getEntry('h1', day)).toMatchObject({ value: 5, loggedAt: 200, id: previous?.id });
  });

  it('el índice compuesto impide duplicados', async () => {
    await setEntryValue('h1', day, 1);
    const dup = { id: 'otro', habitId: 'h1', date: day, value: 1, note: null, loggedAt: 0 };
    await expect(db.entries.add(dup)).rejects.toThrow();
  });

  it('ajusta con +/- sin bajar de 0 y borra el registro al llegar a 0', async () => {
    await adjustEntryValue('h1', day, 2);
    await adjustEntryValue('h1', day, 3);
    expect((await getEntry('h1', day))?.value).toBe(5);
    await adjustEntryValue('h1', day, -10);
    expect(await getEntry('h1', day)).toBeUndefined();
  });

  it('un registro con nota sobrevive con valor 0', async () => {
    await setEntryNote('h1', day, 'Día duro');
    expect(await getEntry('h1', day)).toMatchObject({ value: 0, note: 'Día duro' });
    await setEntryValue('h1', day, 1);
    expect(await getEntry('h1', day)).toMatchObject({ value: 1, note: 'Día duro' });
  });

  it('deshacer restaura exactamente el estado anterior', async () => {
    const first = await setEntryValue('h1', day, 1);
    await restoreEntry('h1', day, first);
    expect(await getEntry('h1', day)).toBeUndefined();

    await setEntryValue('h1', day, 4, 10);
    const beforeChange = await setEntryValue('h1', day, 9, 20);
    await restoreEntry('h1', day, beforeChange);
    expect(await getEntry('h1', day)).toMatchObject({ value: 4, loggedAt: 10 });
  });

  it('consulta por hábito y rango de fechas', async () => {
    for (const date of ['2026-01-01', '2026-01-15', '2026-02-01']) {
      await setEntryValue('h1', d(date), 1);
      await setEntryValue('h2', d(date), 1);
    }
    const jan = await entriesForHabit('h1', d('2026-01-01'), d('2026-01-31'));
    expect(jan.map((e) => e.date)).toEqual(['2026-01-01', '2026-01-15']);
    expect(await entriesForHabit('h1')).toHaveLength(3);
    expect(await entriesBetween(d('2026-01-10'), d('2026-02-01'))).toHaveLength(4);
  });
});

describe('registro diario', () => {
  it('combina campos y deshace', async () => {
    const day = d('2026-09-19');
    expect(await updateDayLog(day, { mood: 4 })).toBeNull();
    const before = await updateDayLog(day, { energy: 2 });
    expect(await getDayLog(day)).toMatchObject({ mood: 4, energy: 2, note: null });
    await restoreDayLog(day, before);
    expect(await getDayLog(day)).toMatchObject({ mood: 4, energy: null });
  });

  it('un registro vacío se elimina', async () => {
    const day = d('2026-09-19');
    await updateDayLog(day, { mood: 3 });
    await updateDayLog(day, { mood: null });
    expect(await getDayLog(day)).toBeUndefined();
  });
});

describe('pausas', () => {
  it('valida el rango y se puede deshacer el borrado', async () => {
    await expect(
      createPause({
        habitId: null,
        start: d('2026-08-10'),
        end: d('2026-08-01'),
        reason: 'vacaciones',
        note: null,
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    const p = await createPause({
      habitId: null,
      start: d('2026-08-01'),
      end: d('2026-08-10'),
      reason: 'vacaciones',
      note: '  ',
    });
    expect(p.note).toBeNull();
    const removed = await deletePause(p.id);
    expect(await listPauses()).toEqual([]);
    if (removed) await restorePause(removed);
    expect(await listPauses()).toEqual([p]);
  });
});

describe('categorías', () => {
  it('al eliminarla, sus hábitos quedan sin categoría', async () => {
    const category = await createCategory('Salud');
    const h = await createHabit(input({ categoryId: category.id }));
    await deleteCategory(category.id);
    expect(await listCategories()).toEqual([]);
    expect((await getHabit(h.id))?.categoryId).toBeNull();
  });
});

describe('ajustes', () => {
  it('devuelve valores por defecto y guarda cambios parciales', async () => {
    expect(await getSettings()).toMatchObject({
      weekStartsOn: 1,
      retroLimitDays: 7,
      theme: 'system',
    });
    await updateSettings({ theme: 'dark' });
    await updateSettings({ retroLimitDays: 14 });
    expect(await getSettings()).toMatchObject({
      theme: 'dark',
      retroLimitDays: 14,
      weekStartsOn: 1,
    });
  });

  it('rechaza un límite retroactivo fuera de rango', async () => {
    await expect(updateSettings({ retroLimitDays: -1 })).rejects.toBeInstanceOf(ValidationError);
    await expect(updateSettings({ retroLimitDays: 1.5 })).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('archivar y restaurar', () => {
  it('archivar sin registro hoy deja ayer como último día', async () => {
    const h = await createHabit(input({ createdOn: d('2026-01-01') }));
    const previous = await archiveHabit(h.id, d('2026-01-20'));
    expect(previous.archivedOn).toBeNull();
    expect((await getHabit(h.id))?.archivedOn).toBe('2026-01-19');
  });

  it('archivar con registro hoy conserva hoy', async () => {
    const h = await createHabit(input({ createdOn: d('2026-01-01') }));
    await setEntryValue(h.id, d('2026-01-20'), 1);
    await archiveHabit(h.id, d('2026-01-20'));
    expect((await getHabit(h.id))?.archivedOn).toBe('2026-01-20');
  });

  it('restaurar pone en pausa el tiempo archivado y se puede deshacer', async () => {
    const h = await createHabit(input({ createdOn: d('2026-01-01') }));
    await archiveHabit(h.id, d('2026-01-11'));
    const result = await unarchiveHabit(h.id, d('2026-01-20'));
    expect((await getHabit(h.id))?.archivedOn).toBeNull();
    expect(result.gapPause).toMatchObject({
      habitId: h.id,
      start: '2026-01-11',
      end: '2026-01-19',
    });
    expect(await listPauses()).toHaveLength(1);

    await undoUnarchive(result);
    expect((await getHabit(h.id))?.archivedOn).toBe('2026-01-10');
    expect(await listPauses()).toEqual([]);
  });

  it('restaurar al día siguiente no crea pausa', async () => {
    const h = await createHabit(input({ createdOn: d('2026-01-01') }));
    await archiveHabit(h.id, d('2026-01-11'));
    const result = await unarchiveHabit(h.id, d('2026-01-11'));
    expect(result.gapPause).toBeNull();
  });
});
