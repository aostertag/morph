import type { Category } from './types';

export const CATEGORY_NAME_MAX = 40;

export type CategoryProblem =
  | { readonly type: 'empty'; readonly message: string }
  | { readonly type: 'tooLong'; readonly message: string }
  | { readonly type: 'duplicate'; readonly message: string; readonly with: Category };

/** Nombre limpio: sin espacios sobrantes en los extremos ni repetidos por dentro. */
export function cleanCategoryName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

/** Clave de comparación: ignora mayúsculas y espacios sobrantes. */
function key(name: string): string {
  return cleanCategoryName(name).toLocaleLowerCase('es');
}

/**
 * Problema de un nombre de categoría, o `null` si vale. `ignoreId` excluye la categoría
 * que se renombra: cambiarle solo las mayúsculas a su propio nombre es válido.
 */
export function categoryNameProblem(
  name: string,
  categories: readonly Category[],
  ignoreId?: string,
): CategoryProblem | null {
  const clean = cleanCategoryName(name);
  if (!clean) return { type: 'empty', message: 'Ponle un nombre a la categoría.' };
  if (clean.length > CATEGORY_NAME_MAX) {
    return { type: 'tooLong', message: `Máximo ${CATEGORY_NAME_MAX} caracteres.` };
  }
  const same = categories.find((c) => c.id !== ignoreId && key(c.name) === key(clean));
  if (same) {
    return {
      type: 'duplicate',
      message: `Ya existe una categoría llamada «${same.name}».`,
      with: same,
    };
  }
  return null;
}
