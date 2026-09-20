import {
  createCategory,
  deleteCategory,
  renameCategory,
  restoreCategory,
} from '@/db/repos/categories';
import type { Category } from '@/domain/types';
import { notify, notifyError } from '@/lib/toast';

/** Todas las escrituras de categorías avisan con un toast que permite deshacer. */
async function run(action: () => Promise<void>): Promise<boolean> {
  try {
    await action();
    return true;
  } catch (error) {
    notifyError(error);
    return false;
  }
}

export function addCategory(name: string): Promise<boolean> {
  return run(async () => {
    const created = await createCategory(name);
    notify('Categoría creada', { undo: async () => void (await deleteCategory(created.id)) });
  });
}

export function editCategory(id: string, name: string): Promise<boolean> {
  return run(async () => {
    const previous = await renameCategory(id, name);
    notify('Categoría renombrada', { undo: () => restoreCategory(previous) });
  });
}

/** Sus hábitos quedan sin categoría; "Deshacer" devuelve la categoría y su asignación. */
export function removeCategory(category: Category): Promise<boolean> {
  return run(async () => {
    const removed = await deleteCategory(category.id);
    if (!removed) return;
    notify('Categoría eliminada', {
      undo: () => restoreCategory(removed.category, removed.habitIds),
    });
  });
}
