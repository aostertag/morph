import { Plus } from 'lucide-react';
import { useState } from 'react';
import type { Category, Habit } from '@/domain/types';
import { cx } from '@/lib/cx';
import { formatNumber } from '@/lib/format';
import { ActionsMenu } from '@/ui/ActionsMenu';
import { Button } from '@/ui/Button';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { CategoryForm } from './CategoryForm';
import { addCategory, editCategory, removeCategory } from './categoryActions';

function usedBy(count: number): string {
  if (count === 0) return 'Sin hábitos';
  return `${formatNumber(count)} ${count === 1 ? 'hábito' : 'hábitos'}`;
}

function describeDelete(count: number): string {
  if (count === 0) return 'Ningún hábito la usa.';
  if (count === 1) return '1 hábito quedará sin categoría. No se pierde ningún dato.';
  return `${formatNumber(count)} hábitos quedarán sin categoría. No se pierde ningún dato.`;
}

/** Crear, renombrar y borrar categorías. Borrar una deja sus hábitos sin categoría. */
export function CategoriesSection({
  categories,
  habits,
}: {
  categories: readonly Category[];
  habits: readonly Habit[];
}) {
  // `undefined` = formulario cerrado; `null` = categoría nueva; una categoría = renombrándola.
  const [editing, setEditing] = useState<Category | null | undefined>(undefined);
  const [toDelete, setToDelete] = useState<Category | null>(null);

  // Cuentan también los hábitos archivados: al borrar la categoría la pierden igual.
  const countOf = (id: string) => habits.filter((h) => h.categoryId === id).length;

  return (
    <section aria-labelledby="categorias" className="mt-12">
      <h2 id="categorias" className="label-caps border-b border-border pb-2">
        Categorías
      </h2>
      <p className="mt-3 max-w-prose text-md text-text-muted">
        Agrupan hábitos parecidos. Se asignan al crear o editar un hábito. Si borras una, sus
        hábitos siguen como estaban, solo que sin categoría.
      </p>
      {editing === undefined && (
        <div className="mt-4">
          <Button onClick={() => setEditing(null)}>
            <Plus size={18} aria-hidden="true" />
            Añadir categoría
          </Button>
        </div>
      )}

      {editing !== undefined && (
        <CategoryForm
          key={editing?.id ?? 'nueva'}
          categories={categories}
          editing={editing}
          onSubmit={(name) => (editing ? editCategory(editing.id, name) : addCategory(name))}
          onCancel={() => setEditing(undefined)}
        />
      )}

      {categories.length === 0 ? (
        <p className="mt-4 text-md text-text-muted">No hay categorías.</p>
      ) : (
        // Con el formulario abierto, su propio borde inferior hace de filete superior.
        <ul className={cx('mt-4', editing === undefined && 'border-t border-border')}>
          {categories.map((category) => (
            <li
              key={category.id}
              className="flex min-h-14 items-center gap-3 border-b border-border last:border-b-0"
            >
              <div className="flex min-w-0 flex-1 items-baseline justify-between gap-3 py-2">
                <p className="min-w-0 truncate">{category.name}</p>
                <p className="shrink-0 whitespace-nowrap text-sm text-text-muted">
                  {usedBy(countOf(category.id))}
                </p>
              </div>
              <ActionsMenu
                label={`Acciones de la categoría ${category.name}`}
                actions={[
                  { label: 'Renombrar', onSelect: () => setEditing(category) },
                  { label: 'Eliminar', onSelect: () => setToDelete(category), destructive: true },
                ]}
              />
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => {
          if (!open) setToDelete(null);
        }}
        title={toDelete ? `¿Eliminar la categoría «${toDelete.name}»?` : ''}
        description={toDelete ? describeDelete(countOf(toDelete.id)) : ''}
        confirmLabel="Eliminar categoría"
        destructive
        onConfirm={() => {
          if (toDelete) void removeCategory(toDelete);
        }}
      />
    </section>
  );
}
