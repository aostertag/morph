import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { getEntry, setEntryValue } from '@/db/repos/entries';
import { createHabit } from '@/db/repos/habits';
import { addDays, type LocalDay } from '@/domain/day';
import type { Habit } from '@/domain/types';
import { formatDate } from '@/lib/format';
import { habitInput, renderRoute, todayLocal } from '@/test/render';
import { HabitDetailScreen } from './HabitDetailScreen';

const today = todayLocal();

function show(habit: Habit) {
  return renderRoute(<HabitDetailScreen />, {
    path: '/habitos/:id',
    url: `/habitos/${habit.id}`,
  });
}

/** Etiqueta de la celda del heatmap de un día. */
function cellFor(day: LocalDay) {
  return screen.getByRole('button', { name: new RegExp(`${formatDate(day, today)}:`) });
}

async function habitWithHistory(overrides = {}) {
  const habit = await createHabit(
    habitInput({ name: 'Leer', createdOn: addDays(today, -20), ...overrides }),
  );
  for (let i = 1; i <= 10; i++) await setEntryValue(habit.id, addDays(today, -i), 1);
  return habit;
}

describe('detalle de hábito', () => {
  it('un hábito que no existe lleva a la lista', async () => {
    renderRoute(<HabitDetailScreen />, { path: '/habitos/:id', url: '/habitos/nada' });
    expect(await screen.findByText('Este hábito no existe.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver hábitos' })).toBeInTheDocument();
  });

  it('presenta las cifras del hábito', async () => {
    const habit = await habitWithHistory();
    show(habit);

    expect(await screen.findByRole('heading', { level: 1, name: 'Leer' })).toBeInTheDocument();
    expect(screen.getByText('Racha actual')).toBeInTheDocument();
    // La racha actual y la mejor coinciden: diez días.
    expect(screen.getAllByText('10 d')).toHaveLength(2);
    // Diez días cumplidos de los veinte ya cerrados.
    const rates = within(screen.getByRole('region', { name: 'Cumplimiento' }));
    expect(rates.getByRole('row', { name: /Desde el principio/ })).toHaveTextContent(
      '50 %10 de 20 días',
    );
  });

  it('la cabecera da el nombre entero, una sola vez las acciones y sin repetir el tipo', async () => {
    const habit = await createHabit(
      habitInput({
        name: 'Redes sociales antes de dormir',
        kind: 'avoid',
        target: null,
        frequency: { type: 'daily' },
        timeOfDay: 'any',
        description: 'Dejar el móvil fuera del dormitorio.',
      }),
    );
    show(habit);

    const title = await screen.findByRole('heading', {
      level: 1,
      name: 'Redes sociales antes de dormir',
    });
    // Se parte en líneas en vez de cortarse con puntos suspensivos.
    expect(title.querySelector('.truncate')).toBeNull();
    expect(screen.getAllByRole('link', { name: 'Editar' })).toHaveLength(1);
    // El sobretítulo ya dice «A evitar»: la línea de contexto no lo repite.
    expect(screen.getByText(/^Todos los días · desde el/)).not.toHaveTextContent('A evitar');
    expect(screen.getByText('Dejar el móvil fuera del dormitorio.')).toBeInTheDocument();
  });

  it('el heatmap se navega con el teclado y abre el día elegido', async () => {
    const habit = await habitWithHistory();
    const { user } = show(habit);

    const yesterday = addDays(today, -1);
    await user.click(
      await screen.findByRole('button', { name: new RegExp(`${formatDate(yesterday, today)}:`) }),
    );
    expect(
      screen.getByRole('heading', { level: 3, name: new RegExp(formatDate(yesterday, today)) }),
    ).toBeInTheDocument();

    await user.keyboard('{ArrowUp}{Enter}');
    const before = addDays(today, -2);
    expect(
      screen.getByRole('heading', { level: 3, name: new RegExp(formatDate(before, today)) }),
    ).toBeInTheDocument();
  });

  it('el calendario ofrece su resumen por meses', async () => {
    const habit = await habitWithHistory();
    const { user } = show(habit);

    await user.click(await screen.findByRole('button', { name: 'Ver por meses' }));
    const table = screen.getByRole('table', { name: 'Resumen por meses' });
    expect(within(table).getAllByRole('row').length).toBeGreaterThan(1);
    await user.click(screen.getByRole('button', { name: 'Ver gráfico' }));
    expect(screen.queryByRole('table', { name: 'Resumen por meses' })).not.toBeInTheDocument();
  });

  it('escribe la nota de un día y permite deshacerla', async () => {
    const habit = await habitWithHistory();
    const { user } = show(habit);

    await screen.findByRole('heading', { level: 1, name: 'Leer' });
    await user.click(cellFor(addDays(today, -1)));
    await user.type(screen.getByRole('textbox', { name: 'Nota del día' }), 'Capítulo 4');
    await user.click(screen.getByRole('button', { name: 'Guardar nota' }));

    expect(await screen.findByText('Nota guardada.')).toBeInTheDocument();
    expect((await getEntry(habit.id, addDays(today, -1)))?.note).toBe('Capítulo 4');

    await user.click(screen.getByRole('button', { name: 'Deshacer' }));
    await waitFor(async () =>
      expect((await getEntry(habit.id, addDays(today, -1)))?.note).toBeNull(),
    );
  });

  it('los hábitos de cantidad muestran media, máximo y total', async () => {
    const habit = await createHabit(
      habitInput({
        name: 'Agua',
        kind: 'quantity',
        target: 8,
        unit: 'vasos',
        createdOn: addDays(today, -10),
      }),
    );
    await setEntryValue(habit.id, addDays(today, -1), 8);
    await setEntryValue(habit.id, addDays(today, -2), 4);
    show(habit);

    expect(await screen.findByText('Media')).toBeInTheDocument();
    expect(screen.getByText('6 vasos')).toBeInTheDocument();
    expect(screen.getByText('12 vasos')).toBeInTheDocument();
  });

  it('un hábito a evitar habla de recaídas', async () => {
    const habit = await createHabit(
      habitInput({ name: 'Redes', kind: 'avoid', createdOn: addDays(today, -10) }),
    );
    await setEntryValue(habit.id, addDays(today, -3), 1);
    show(habit);

    expect(await screen.findByText('Sin recaer')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Recaídas por día de la semana' }),
    ).toBeInTheDocument();
  });
});
