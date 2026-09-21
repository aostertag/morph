import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { archiveHabit, createHabit, getHabit } from '@/db/repos/habits';
import { addDays } from '@/domain/day';
import { habitInput, renderRoute, todayLocal } from '@/test/render';
import { HabitsScreen } from './HabitsScreen';

describe('gestión de hábitos', () => {
  it('lista los activos con asa de reordenación accesible', async () => {
    await createHabit(habitInput({ name: 'Leer' }));
    await createHabit(habitInput({ name: 'Agua', kind: 'quantity', target: 8, unit: 'vasos' }));
    renderRoute(<HabitsScreen />, { path: '/habitos', url: '/habitos' });
    expect(await screen.findByRole('button', { name: 'Reordenar Leer' })).toBeInTheDocument();
    expect(screen.getByText('8 vasos · Todos los días')).toBeInTheDocument();
  });

  it('distingue los hábitos que aún no han empezado y no permite archivarlos', async () => {
    const today = todayLocal();
    await createHabit(habitInput({ name: 'Leer' }));
    await createHabit(habitInput({ name: 'Correr', createdOn: addDays(today, 4) }));
    const { user } = renderRoute(<HabitsScreen />, { path: '/habitos', url: '/habitos' });

    const upcoming = (await screen.findByRole('link', { name: 'Correr' })).closest('li');
    expect(upcoming).toHaveTextContent(/Empieza el .* · Todos los días/);
    // La fila activa no lleva esa marca.
    const active = screen.getByRole('link', { name: 'Leer' }).closest('li');
    expect(active).not.toHaveTextContent(/Empieza el/);

    await user.click(screen.getByRole('button', { name: 'Acciones de Leer' }));
    expect(await screen.findByRole('menuitem', { name: 'Archivar' })).toBeInTheDocument();
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: 'Acciones de Correr' }));
    expect(await screen.findByRole('menuitem', { name: 'Editar' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Archivar' })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Eliminar/ })).toBeInTheDocument();
  });

  it('restaurar un archivado lo devuelve a la lista y pone en pausa el hueco', async () => {
    const habit = await createHabit(
      habitInput({ name: 'Leer', createdOn: addDays(todayLocal(), -20) }),
    );
    await archiveHabit(habit.id, addDays(todayLocal(), -10));
    const { user } = renderRoute(<HabitsScreen />, { path: '/habitos', url: '/habitos' });

    const archived = await screen.findByRole('region', { name: /Archivados/ });
    await user.click(within(archived).getByRole('button', { name: 'Restaurar' }));

    expect(await screen.findByRole('button', { name: 'Reordenar Leer' })).toBeInTheDocument();
    expect((await getHabit(habit.id))?.archivedOn).toBeNull();
    expect(await screen.findByText('Leer: restaurado')).toBeInTheDocument();
  });

  it('eliminar pide confirmación', async () => {
    const habit = await createHabit(habitInput({ name: 'Leer' }));
    await archiveHabit(habit.id, todayLocal());
    const { user } = renderRoute(<HabitsScreen />, { path: '/habitos', url: '/habitos' });

    const archived = await screen.findByRole('region', { name: /Archivados/ });
    await user.click(within(archived).getByRole('button', { name: 'Eliminar' }));
    const dialog = await screen.findByRole('alertdialog', { name: '¿Eliminar «Leer»?' });
    await user.click(within(dialog).getByRole('button', { name: 'Eliminar' }));

    expect(await screen.findByText('Leer: eliminado')).toBeInTheDocument();
    expect(await getHabit(habit.id)).toBeUndefined();
  });
});
