import { beforeEach, describe, expect, it } from 'vitest';
import type { HabitInput } from '@/domain/habit';
import { d, habit as habitFixture } from '@/test/factories';
import { ValidationError } from './errors';
import {
  categoryUsage,
  createCategory,
  deleteCategory,
  listCategories,
  renameCategory,
  restoreCategory,
} from './repos/categories';
import { setEntryValue } from './repos/entries';
import { archiveHabit, createHabit, getHabit, updateHabit } from './repos/habits';
import { createPause, listPauses } from './repos/pauses';
import { db } from './schema';

function input(overrides: Partial<HabitInput> = {}): HabitInput {
  const { id: _id, order: _order, archivedOn: _archived, ...rest } = habitFixture();
  return { ...rest, createdOn: d('2026-01-01'), ...overrides };
}

beforeEach(async () => {
  await db.open();
  await Promise.all(db.tables.map((table) => table.clear()));
});

describe('categorías: validación', () => {
  it('rechaza vacío, solo espacios y nombres demasiado largos', async () => {
    await expect(createCategory('')).rejects.toBeInstanceOf(ValidationError);
    await expect(createCategory('   ')).rejects.toBeInstanceOf(ValidationError);
    await expect(createCategory('x'.repeat(41))).rejects.toBeInstanceOf(ValidationError);
    expect(await listCategories()).toEqual([]);
  });

  it('limpia espacios sobrantes al guardar', async () => {
    const c = await createCategory('  Vida   social ');
    expect(c.name).toBe('Vida social');
  });

  it('rechaza duplicados ignorando mayúsculas y espacios sobrantes', async () => {
    await createCategory('Salud');
    await expect(createCategory('salud')).rejects.toBeInstanceOf(ValidationError);
    await expect(createCategory('  SALUD  ')).rejects.toBeInstanceOf(ValidationError);
    await expect(createCategory('Árbol')).resolves.toBeDefined();
    await expect(createCategory('árbol')).rejects.toBeInstanceOf(ValidationError);
    expect(await listCategories()).toHaveLength(2);
  });

  it('renombrar: cambiar solo las mayúsculas de su propio nombre vale; chocar con otra no', async () => {
    const salud = await createCategory('Salud');
    const mente = await createCategory('Mente');
    const previous = await renameCategory(salud.id, 'SALUD');
    expect(previous.name).toBe('Salud');
    expect((await listCategories()).map((c) => c.name)).toEqual(['SALUD', 'Mente']);
    await expect(renameCategory(mente.id, ' salud ')).rejects.toBeInstanceOf(ValidationError);
    await expect(renameCategory(mente.id, '')).rejects.toBeInstanceOf(ValidationError);
    expect((await listCategories()).map((c) => c.name)).toEqual(['SALUD', 'Mente']);
  });

  it('renombrar una categoría que ya no existe da un error claro', async () => {
    await expect(renameCategory('nada', 'Algo')).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('categorías: uso', () => {
  it('cuenta los hábitos de cada categoría, archivados incluidos', async () => {
    const a = await createCategory('Salud');
    const b = await createCategory('Mente');
    await createCategory('Vacía');
    await createHabit(input({ name: 'Correr', categoryId: a.id }));
    const old = await createHabit(input({ name: 'Yoga', categoryId: a.id }));
    await archiveHabit(old.id, d('2026-02-01'));
    await createHabit(input({ name: 'Leer', categoryId: b.id }));
    await createHabit(input({ name: 'Sin categoría', categoryId: null }));
    const usage = await categoryUsage();
    expect(usage.get(a.id)).toBe(2);
    expect(usage.get(b.id)).toBe(1);
    expect(usage.size).toBe(2);
  });
});

describe('categorías: borrar', () => {
  async function scenario() {
    const salud = await createCategory('Salud');
    const mente = await createCategory('Mente');
    const correr = await createHabit(input({ name: 'Correr', categoryId: salud.id }));
    const dormir = await createHabit(input({ name: 'Dormir', categoryId: salud.id }));
    const leer = await createHabit(input({ name: 'Leer', categoryId: mente.id }));
    const suelto = await createHabit(input({ name: 'Suelto', categoryId: null }));
    await setEntryValue(correr.id, d('2026-01-05'), 1);
    await setEntryValue(correr.id, d('2026-01-06'), 1);
    await setEntryValue(leer.id, d('2026-01-05'), 1);
    await createPause({
      habitId: correr.id,
      start: d('2026-01-10'),
      end: d('2026-01-12'),
      reason: 'otro',
      note: null,
    });
    return { salud, mente, correr, dormir, leer, suelto };
  }

  it('sus hábitos quedan sin categoría y no cambia nada más de ellos', async () => {
    const { salud, correr, dormir } = await scenario();
    const before = { correr: await getHabit(correr.id), dormir: await getHabit(dormir.id) };

    const removed = await deleteCategory(salud.id);

    expect(removed?.category).toEqual(salud);
    expect([...(removed?.habitIds ?? [])].sort()).toEqual([correr.id, dormir.id].sort());
    expect((await listCategories()).map((c) => c.name)).toEqual(['Mente']);
    expect(await getHabit(correr.id)).toEqual({ ...before.correr, categoryId: null });
    expect(await getHabit(dormir.id)).toEqual({ ...before.dormir, categoryId: null });
  });

  it('no pierde registros ni pausas, y no toca otros hábitos', async () => {
    const { salud, leer, suelto } = await scenario();
    const entriesBefore = await db.entries.toArray();
    const pausesBefore = await listPauses();
    const habitsCount = await db.habits.count();
    const leerBefore = await getHabit(leer.id);
    const sueltoBefore = await getHabit(suelto.id);

    await deleteCategory(salud.id);

    expect(await db.entries.toArray()).toEqual(entriesBefore);
    expect(await listPauses()).toEqual(pausesBefore);
    expect(await db.habits.count()).toBe(habitsCount);
    expect(await getHabit(leer.id)).toEqual(leerBefore);
    expect(await getHabit(suelto.id)).toEqual(sueltoBefore);
  });

  it('borrar una categoría sin hábitos, o que ya no existe, no rompe nada', async () => {
    const vacia = await createCategory('Vacía');
    expect((await deleteCategory(vacia.id))?.habitIds).toEqual([]);
    expect(await deleteCategory(vacia.id)).toBeUndefined();
  });

  it('es atómico: si falla, la categoría y los hábitos quedan como estaban', async () => {
    const { salud, correr } = await scenario();
    const original = db.categories.delete.bind(db.categories);
    db.categories.delete = (() => Promise.reject(new Error('fallo simulado'))) as never;
    try {
      await expect(deleteCategory(salud.id)).rejects.toBeDefined();
    } finally {
      db.categories.delete = original;
    }
    expect((await listCategories()).map((c) => c.id)).toContain(salud.id);
    expect((await getHabit(correr.id))?.categoryId).toBe(salud.id);
  });

  it('un hábito archivado también queda sin categoría', async () => {
    const { salud, dormir } = await scenario();
    await archiveHabit(dormir.id, d('2026-02-01'));
    const archived = await getHabit(dormir.id);
    expect(archived?.archivedOn).not.toBeNull();
    await deleteCategory(salud.id);
    expect(await getHabit(dormir.id)).toEqual({ ...archived, categoryId: null });
  });
});

describe('categorías: deshacer el borrado', () => {
  it('restaura la categoría (mismo id y orden) y su asignación en esos hábitos', async () => {
    const salud = await createCategory('Salud');
    const mente = await createCategory('Mente');
    const a = await createHabit(input({ name: 'A', categoryId: salud.id }));
    const b = await createHabit(input({ name: 'B', categoryId: salud.id }));
    const c = await createHabit(input({ name: 'C', categoryId: mente.id }));
    const habitsBefore = await db.habits.toArray();

    const removed = await deleteCategory(salud.id);
    if (!removed) throw new Error('debía existir');
    await restoreCategory(removed.category, removed.habitIds);

    expect(await listCategories()).toEqual([salud, mente]);
    expect((await getHabit(a.id))?.categoryId).toBe(salud.id);
    expect((await getHabit(b.id))?.categoryId).toBe(salud.id);
    expect((await getHabit(c.id))?.categoryId).toBe(mente.id);
    expect(await db.habits.toArray()).toEqual(habitsBefore);
  });

  it('no pisa un hábito al que se asignó otra categoría entretanto', async () => {
    const salud = await createCategory('Salud');
    const mente = await createCategory('Mente');
    const a = await createHabit(input({ name: 'A', categoryId: salud.id }));
    const b = await createHabit(input({ name: 'B', categoryId: salud.id }));

    const removed = await deleteCategory(salud.id);
    if (!removed) throw new Error('debía existir');
    await updateHabit(a.id, input({ name: 'A', categoryId: mente.id }));
    await restoreCategory(removed.category, removed.habitIds);

    expect((await getHabit(a.id))?.categoryId).toBe(mente.id);
    expect((await getHabit(b.id))?.categoryId).toBe(salud.id);
  });

  it('no falla si un hábito se eliminó entretanto', async () => {
    const salud = await createCategory('Salud');
    const a = await createHabit(input({ name: 'A', categoryId: salud.id }));
    const b = await createHabit(input({ name: 'B', categoryId: salud.id }));

    const removed = await deleteCategory(salud.id);
    if (!removed) throw new Error('debía existir');
    await db.habits.delete(a.id);
    await restoreCategory(removed.category, removed.habitIds);

    expect(await getHabit(a.id)).toBeUndefined();
    expect((await getHabit(b.id))?.categoryId).toBe(salud.id);
    expect(await listCategories()).toEqual([salud]);
  });

  it('deshacer un renombrado devuelve el nombre anterior', async () => {
    const salud = await createCategory('Salud');
    const previous = await renameCategory(salud.id, 'Bienestar');
    await restoreCategory(previous);
    expect(await listCategories()).toEqual([salud]);
  });
});
