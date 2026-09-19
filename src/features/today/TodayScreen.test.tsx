import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { getEntry } from '@/db/repos/entries';
import { createHabit } from '@/db/repos/habits';
import { addDays } from '@/domain/day';
import { habitInput, renderRoute, todayLocal } from '@/test/render';
import { TodayScreen } from './TodayScreen';

describe('pantalla Hoy', () => {
  it('sin hábitos muestra un estado vacío con acción clara', async () => {
    renderRoute(<TodayScreen />);
    expect(await screen.findByText('Todavía no hay hábitos.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Crear hábito' })).toHaveAttribute(
      'href',
      '/habitos/nuevo?volver=hoy',
    );
  });

  it('marca un hábito con un toque, actualiza el progreso y permite deshacer', async () => {
    const habit = await createHabit(habitInput({ name: 'Leer' }));
    await createHabit(habitInput({ name: 'Correr' }));
    const { user } = renderRoute(<TodayScreen />);

    const checkbox = await screen.findByRole('checkbox', { name: 'Leer' });
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', '0 de 2');

    await user.click(checkbox);
    expect(
      await screen.findByRole('checkbox', { name: 'Leer', checked: true }),
    ).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', '1 de 2');
    expect(await getEntry(habit.id, todayLocal())).toMatchObject({ value: 1 });

    await user.click(await screen.findByRole('button', { name: 'Deshacer' }));
    expect(
      await screen.findByRole('checkbox', { name: 'Leer', checked: false }),
    ).toBeInTheDocument();
    expect(await getEntry(habit.id, todayLocal())).toBeUndefined();
  });

  it('agrupa por momento del día', async () => {
    await createHabit(habitInput({ name: 'Meditar', timeOfDay: 'morning' }));
    await createHabit(habitInput({ name: 'Leer', timeOfDay: 'evening' }));
    renderRoute(<TodayScreen />);
    const morning = await screen.findByRole('region', { name: /Mañana/ });
    expect(within(morning).getByRole('link', { name: 'Meditar' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: /Noche/ })).getByRole('link', { name: 'Leer' }),
    ).toBeInTheDocument();
  });

  it('cuantitativo: +/- y entrada directa guardan el valor real', async () => {
    const habit = await createHabit(
      habitInput({ name: 'Agua', kind: 'quantity', target: 8, unit: 'vasos' }),
    );
    const { user } = renderRoute(<TodayScreen />);

    const plus = await screen.findByRole('button', { name: 'Sumar 1 vasos a Agua' });
    await user.click(plus);
    await user.click(plus);
    await screen.findByRole('button', { name: /Agua \(vasos\): 2 de 8/ });

    await user.click(screen.getByRole('button', { name: /Agua \(vasos\): 2 de 8/ }));
    const input = screen.getByRole('textbox', { name: 'Agua (vasos)' });
    await user.clear(input);
    await user.type(input, '11{Enter}');
    await screen.findByRole('button', { name: /Agua \(vasos\): 11 de 8/ });
    expect(await getEntry(habit.id, todayLocal())).toMatchObject({ value: 11 });
  });

  it('a evitar: registrar una recaída es un conmutador', async () => {
    await createHabit(habitInput({ name: 'Tabaco', kind: 'avoid' }));
    const { user } = renderRoute(<TodayScreen />);
    const toggle = await screen.findByRole('button', { name: 'Registrar una recaída en Tabaco' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await user.click(toggle);
    expect(
      await screen.findByRole('button', { name: 'Quitar la recaída de Tabaco' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('navega a días anteriores y bloquea los que superan el límite retroactivo', async () => {
    await createHabit(habitInput({ name: 'Leer', createdOn: addDays(todayLocal(), -30) }));
    const old = addDays(todayLocal(), -10);
    renderRoute(<TodayScreen />, { url: `/?dia=${old}` });
    expect(await screen.findByText(/Este día es de solo lectura/)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Leer' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Hoy' })).toBeInTheDocument();
  });

  it('ignora fechas futuras en la URL', async () => {
    await createHabit(habitInput({ name: 'Leer' }));
    renderRoute(<TodayScreen />, { url: `/?dia=${addDays(todayLocal(), 3)}` });
    expect(await screen.findByRole('button', { name: 'Día siguiente' })).toBeDisabled();
  });
});
