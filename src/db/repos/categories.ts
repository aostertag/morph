import type { Category } from '@/domain/types';
import { ValidationError, withStorage } from '../errors';
import { db, newId } from '../schema';

const NAME_MAX = 40;

function cleanName(name: string): string {
  const clean = name.trim().replace(/\s+/g, ' ');
  if (!clean) throw new ValidationError('Ponle un nombre a la categoría.');
  if (clean.length > NAME_MAX) throw new ValidationError(`Máximo ${NAME_MAX} caracteres.`);
  return clean;
}

export function listCategories(): Promise<Category[]> {
  return withStorage(() => db.categories.orderBy('order').toArray());
}

export async function createCategory(name: string): Promise<Category> {
  const clean = cleanName(name);
  return withStorage(() =>
    db.transaction('rw', db.categories, async () => {
      const last = await db.categories.orderBy('order').last();
      const category: Category = { id: newId(), name: clean, order: (last?.order ?? -1) + 1 };
      await db.categories.add(category);
      return category;
    }),
  );
}

export async function renameCategory(id: string, name: string): Promise<void> {
  const clean = cleanName(name);
  return withStorage(async () => {
    await db.categories.update(id, { name: clean });
  });
}

/** Elimina la categoría; sus hábitos quedan sin categoría. */
export function deleteCategory(id: string): Promise<void> {
  return withStorage(() =>
    db.transaction('rw', db.categories, db.habits, async () => {
      await db.habits.filter((h) => h.categoryId === id).modify({ categoryId: null });
      await db.categories.delete(id);
    }),
  );
}
