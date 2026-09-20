import { useState } from 'react';
import { CATEGORY_NAME_MAX, categoryNameProblem } from '@/domain/categories';
import type { Category } from '@/domain/types';
import { Button } from '@/ui/Button';
import { Field, inputClasses } from '@/ui/Field';

interface CategoryFormProps {
  readonly categories: readonly Category[];
  /** La categoría que se renombra; `null` para crear una nueva. */
  readonly editing: Category | null;
  readonly onSubmit: (name: string) => Promise<boolean>;
  readonly onCancel: () => void;
}

/**
 * Crear o renombrar una categoría. El nombre se valida mientras se escribe con la misma
 * regla que aplica la base de datos; con un problema, "Guardar" queda desactivado. El
 * error no se enseña hasta que hay algo escrito: un campo vacío recién abierto no grita.
 */
export function CategoryForm({ categories, editing, onSubmit, onCancel }: CategoryFormProps) {
  const [name, setName] = useState(editing?.name ?? '');
  const [saving, setSaving] = useState(false);

  const problem = categoryNameProblem(name, categories, editing?.id);
  const shown = name.trim() ? problem : null;

  const submit = async () => {
    if (problem || saving) return;
    setSaving(true);
    const saved = await onSubmit(name);
    setSaving(false);
    if (saved) onCancel();
  };

  return (
    <form
      aria-label={editing ? 'Renombrar categoría' : 'Nueva categoría'}
      className="mt-4 flex flex-col gap-5 border-y border-border py-5"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <Field label="Nombre" error={shown?.message}>
        {(props) => (
          <input
            {...props}
            type="text"
            maxLength={CATEGORY_NAME_MAX}
            autoComplete="off"
            className={inputClasses}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        )}
      </Field>
      <div className="flex flex-wrap justify-end gap-3">
        <Button onClick={onCancel}>Cancelar</Button>
        <Button type="submit" variant="primary" disabled={problem !== null || saving}>
          {editing ? 'Guardar cambios' : 'Crear categoría'}
        </Button>
      </div>
    </form>
  );
}
