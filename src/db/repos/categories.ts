import { categoryNameProblem, cleanCategoryName } from '@/domain/categories';
import type { Category } from '@/domain/types';
import { ValidationError, withStorage } from '../errors';
import { db, newId } from '../schema';

/** Lo que borrar una categoría deja para poder deshacerlo. */
export interface DeletedCategory {
  readonly category: Category;
  /** Hábitos que la usaban (archivados incluidos) y que han quedado sin categoría. */
  readonly habitIds: readonly string[];
}

/** Última barrera: el formulario ya avisa en vivo con la misma regla. */
async function assertName(name: string, ignoreId?: string): Promise<string> {
  const problem = categoryNameProblem(name, await db.categories.toArray(), ignoreId);
  if (problem) throw new ValidationError(problem.message, { name: problem.message });
  return cleanCategoryName(name);
}

export function listCategories(): Promise<Category[]> {
  return withStorage(() => db.categories.orderBy('order').toArray());
}

/** Hábitos que usan cada categoría, archivados incluidos. Las que no usa nadie no aparecen. */
export function categoryUsage(): Promise<Map<string, number>> {
  return withStorage(async () => {
    const usage = new Map<string, number>();
    await db.habits.each((h) => {
      if (h.categoryId !== null) usage.set(h.categoryId, (usage.get(h.categoryId) ?? 0) + 1);
    });
    return usage;
  });
}

export function createCategory(name: string): Promise<Category> {
  return withStorage(() =>
    db.transaction('rw', db.categories, async () => {
      const clean = await assertName(name);
      const last = await db.categories.orderBy('order').last();
      const category: Category = { id: newId(), name: clean, order: (last?.order ?? -1) + 1 };
      await db.categories.add(category);
      return category;
    }),
  );
}

/** Renombra y devuelve la categoría anterior para poder deshacer. */
export function renameCategory(id: string, name: string): Promise<Category> {
  return withStorage(() =>
    db.transaction('rw', db.categories, async () => {
      const previous = await db.categories.get(id);
      if (!previous) throw new ValidationError('Esa categoría ya no existe.');
      const clean = await assertName(name, id);
      await db.categories.put({ ...previous, name: clean });
      return previous;
    }),
  );
}

/**
 * Elimina la categoría; sus hábitos quedan sin categoría y no cambia nada más de ellos.
 * Devuelve la categoría y los hábitos afectados (`undefined` si ya no existía).
 */
export function deleteCategory(id: string): Promise<DeletedCategory | undefined> {
  return withStorage(() =>
    db.transaction('rw', db.categories, db.habits, async () => {
      const category = await db.categories.get(id);
      if (!category) return undefined;
      const affected = await db.habits.filter((h) => h.categoryId === id).toArray();
      const habitIds = affected.map((h) => h.id);
      await Promise.all(habitIds.map((habitId) => db.habits.update(habitId, { categoryId: null })));
      await db.categories.delete(id);
      return { category, habitIds };
    }),
  );
}

/**
 * Deshace un borrado o un renombrado: vuelve a poner la categoría tal como estaba y
 * reasigna a sus hábitos. Un hábito que ya no existe o que recibió otra categoría
 * entretanto se deja como está.
 */
export function restoreCategory(
  category: Category,
  habitIds: readonly string[] = [],
): Promise<void> {
  return withStorage(() =>
    db.transaction('rw', db.categories, db.habits, async () => {
      await db.categories.put(category);
      for (const habitId of habitIds) {
        const habit = await db.habits.get(habitId);
        if (habit && habit.categoryId === null) {
          await db.habits.update(habitId, { categoryId: category.id });
        }
      }
    }),
  );
}
