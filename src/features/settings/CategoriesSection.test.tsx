import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createCategory, listCategories } from '@/db/repos/categories';
import { createHabit, getHabit } from '@/db/repos/habits';
import { habitInput, renderRoute } from '@/test/render';
import { SettingsScreen } from './SettingsScreen';

async function section() {
  const heading = await screen.findByRole('heading', { name: 'Categorías' });
  const region = heading.closest('section');
  if (!region) throw new Error('sin sección');
  return within(region);
}

async function openMenu(
  user: ReturnType<typeof renderRoute>['user'],
  name: string,
  item: 'Renombrar' | 'Eliminar',
) {
  const view = await section();
  await user.click(view.getByRole('button', { name: `Acciones de la categoría ${name}` }));
  await user.click(await screen.findByRole('menuitem', { name: item }));
}

describe('ajustes: categorías', () => {
  it('sin categorías lo dice y ofrece crear', async () => {
    renderRoute(<SettingsScreen />);
    const view = await section();
    expect(view.getByText('No hay categorías.')).toBeInTheDocument();
    expect(view.getByRole('button', { name: 'Añadir categoría' })).toBeInTheDocument();
  });

  it('crea una categoría y avisa', async () => {
    const { user } = renderRoute(<SettingsScreen />);
    const view = await section();
    await user.click(view.getByRole('button', { name: 'Añadir categoría' }));
    await user.type(view.getByLabelText('Nombre'), '  Salud {Enter}');
    expect(await screen.findByText('Categoría creada')).toBeInTheDocument();
    expect((await listCategories()).map((c) => c.name)).toEqual(['Salud']);
    expect(await view.findByText('Sin hábitos')).toBeInTheDocument();
  });

  it('avisa del duplicado al escribir y no deja guardar', async () => {
    await createCategory('Salud');
    const { user } = renderRoute(<SettingsScreen />);
    const view = await section();
    await user.click(view.getByRole('button', { name: 'Añadir categoría' }));
    await user.type(view.getByLabelText('Nombre'), ' salud');
    expect(await view.findByText(/Ya existe una categoría llamada «Salud»/)).toBeInTheDocument();
    expect(view.getByRole('button', { name: 'Crear categoría' })).toBeDisabled();
    expect(await listCategories()).toHaveLength(1);
  });

  it('lista cuántos hábitos usa cada una', async () => {
    const salud = await createCategory('Salud');
    await createCategory('Mente');
    await createHabit(habitInput({ name: 'A', categoryId: salud.id }));
    await createHabit(habitInput({ name: 'B', categoryId: salud.id }));
    renderRoute(<SettingsScreen />);
    const view = await section();
    expect(await view.findByText('2 hábitos')).toBeInTheDocument();
    expect(view.getByText('Sin hábitos')).toBeInTheDocument();
  });

  it('renombra y se puede deshacer', async () => {
    await createCategory('Salud');
    const { user } = renderRoute(<SettingsScreen />);
    await openMenu(user, 'Salud', 'Renombrar');
    const view = await section();
    const field = view.getByLabelText('Nombre');
    await user.clear(field);
    await user.type(field, 'Bienestar{Enter}');
    expect(await screen.findByText('Categoría renombrada')).toBeInTheDocument();
    expect((await listCategories()).map((c) => c.name)).toEqual(['Bienestar']);

    await user.click(screen.getByRole('button', { name: 'Deshacer' }));
    await waitFor(async () =>
      expect((await listCategories()).map((c) => c.name)).toEqual(['Salud']),
    );
  });

  it('borrar dice cuántos hábitos quedan sin categoría, los conserva y se puede deshacer', async () => {
    const salud = await createCategory('Salud');
    const mente = await createCategory('Mente');
    const a = await createHabit(habitInput({ name: 'A', categoryId: salud.id }));
    const b = await createHabit(habitInput({ name: 'B', categoryId: salud.id }));
    const c = await createHabit(habitInput({ name: 'C', categoryId: mente.id }));
    const { user } = renderRoute(<SettingsScreen />);

    await openMenu(user, 'Salud', 'Eliminar');
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('¿Eliminar la categoría «Salud»?')).toBeInTheDocument();
    expect(
      within(dialog).getByText('2 hábitos quedarán sin categoría. No se pierde ningún dato.'),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Eliminar categoría' }));

    expect(await screen.findByText('Categoría eliminada')).toBeInTheDocument();
    expect((await listCategories()).map((x) => x.name)).toEqual(['Mente']);
    expect((await getHabit(a.id))?.categoryId).toBeNull();
    expect((await getHabit(b.id))?.categoryId).toBeNull();
    expect((await getHabit(a.id))?.name).toBe('A');
    expect((await getHabit(c.id))?.categoryId).toBe(mente.id);

    await user.click(screen.getByRole('button', { name: 'Deshacer' }));
    await waitFor(async () =>
      expect((await listCategories()).map((x) => x.name)).toEqual(['Salud', 'Mente']),
    );
    expect((await getHabit(a.id))?.categoryId).toBe(salud.id);
    expect((await getHabit(b.id))?.categoryId).toBe(salud.id);
  });

  it('el diálogo usa el singular con un solo hábito y avisa si no hay ninguno', async () => {
    const salud = await createCategory('Salud');
    await createCategory('Vacía');
    await createHabit(habitInput({ name: 'A', categoryId: salud.id }));
    const { user } = renderRoute(<SettingsScreen />);

    await openMenu(user, 'Salud', 'Eliminar');
    expect(await screen.findByText(/^1 hábito quedará sin categoría/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());

    await openMenu(user, 'Vacía', 'Eliminar');
    expect(await screen.findByText('Ningún hábito la usa.')).toBeInTheDocument();
  });
});
