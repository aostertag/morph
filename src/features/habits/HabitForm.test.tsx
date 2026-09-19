import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { listHabits } from '@/db/repos/habits';
import { renderRoute } from '@/test/render';
import { NewHabitScreen } from './HabitFormScreens';

describe('crear hábito', () => {
  it('ofrece plantillas y la opción en blanco', async () => {
    renderRoute(<NewHabitScreen />, { path: '/habitos/nuevo', url: '/habitos/nuevo' });
    expect(await screen.findByRole('link', { name: /Empezar en blanco/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Beber agua/ })).toBeInTheDocument();
  });

  it('valida antes de guardar y marca el campo con error', async () => {
    const { user } = renderRoute(<NewHabitScreen />, {
      path: '/habitos/nuevo',
      url: '/habitos/nuevo?plantilla=blanco',
    });
    await user.click(await screen.findByRole('button', { name: 'Crear hábito' }));
    const name = screen.getByRole('textbox', { name: 'Nombre' });
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(name).toHaveAccessibleDescription('Ponle un nombre.');
    expect(await listHabits()).toEqual([]);
  });

  it('crea un hábito cuantitativo y vuelve a la lista', async () => {
    const { user } = renderRoute(<NewHabitScreen />, {
      path: '/habitos/nuevo',
      url: '/habitos/nuevo?plantilla=blanco',
    });
    await user.type(await screen.findByRole('textbox', { name: 'Nombre' }), 'Agua');
    await user.click(screen.getByRole('radio', { name: 'Cantidad' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Meta diaria' }), '8');
    await user.type(screen.getByRole('textbox', { name: 'Unidad' }), 'vasos');
    await user.click(screen.getByRole('radio', { name: 'Mañana' }));
    await user.click(screen.getByRole('button', { name: 'Crear hábito' }));

    expect(await screen.findByText('Otra pantalla')).toBeInTheDocument();
    const [created] = await listHabits();
    expect(created).toMatchObject({
      name: 'Agua',
      kind: 'quantity',
      target: 8,
      unit: 'vasos',
      timeOfDay: 'morning',
    });
  });

  it('una plantilla rellena el formulario', async () => {
    renderRoute(<NewHabitScreen />, {
      path: '/habitos/nuevo',
      url: '/habitos/nuevo?plantilla=ejercicio',
    });
    expect(await screen.findByRole('textbox', { name: 'Nombre' })).toHaveValue('Ejercicio');
    expect(screen.getByRole('radio', { name: 'Por semana' })).toBeChecked();
    expect(screen.getByRole('spinbutton', { name: 'Veces por semana' })).toHaveValue(3);
  });

  it('los hábitos a evitar no admiten frecuencias por período', async () => {
    const { user } = renderRoute(<NewHabitScreen />, {
      path: '/habitos/nuevo',
      url: '/habitos/nuevo?plantilla=blanco',
    });
    await user.click(await screen.findByRole('radio', { name: 'A evitar' }));
    expect(screen.getByRole('radio', { name: 'Por semana' })).toBeDisabled();
  });
});
