import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { setEntryValue } from '@/db/repos/entries';
import { createHabit, listHabits } from '@/db/repos/habits';
import { addDays } from '@/domain/day';
import { habitInput, renderRoute, todayLocal } from '@/test/render';
import { EditHabitScreen, NewHabitScreen } from './HabitFormScreens';

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

  it('«Ninguno» es una opción más del selector de icono', async () => {
    const { user } = renderRoute(<NewHabitScreen />, {
      path: '/habitos/nuevo',
      url: '/habitos/nuevo?plantilla=blanco',
    });
    const none = await screen.findByRole('radio', { name: 'Ninguno' });
    const book = screen.getByRole('radio', { name: 'Libro' });
    expect(none).toBeChecked();
    // Misma caja y mismo estado elegido que el resto: solo cambia el dibujo.
    expect(none.parentElement?.className).toBe(book.parentElement?.className);
    expect(none.parentElement).toHaveAttribute('title', 'Ninguno');
    expect(book.parentElement).toHaveAttribute('title', 'Libro');

    await user.click(book);
    expect(book).toBeChecked();
    expect(none).not.toBeChecked();
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

  it('guarda un recordatorio con su hora', async () => {
    const { user } = renderRoute(<NewHabitScreen />, {
      path: '/habitos/nuevo',
      url: '/habitos/nuevo?plantilla=blanco',
    });
    await user.type(await screen.findByRole('textbox', { name: 'Nombre' }), 'Meditar');
    expect(screen.queryByLabelText('Hora del aviso')).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Con aviso' }));
    const time = screen.getByLabelText('Hora del aviso');
    expect(time).toHaveValue('09:00');
    fireEvent.change(time, { target: { value: '07:30' } });
    await user.click(screen.getByRole('button', { name: 'Crear hábito' }));

    await screen.findByText('Otra pantalla');
    const [created] = await listHabits();
    expect(created?.reminder).toEqual({ time: '07:30', enabled: true });
  });

  it('sin aviso, el hábito no lleva recordatorio', async () => {
    const { user } = renderRoute(<NewHabitScreen />, {
      path: '/habitos/nuevo',
      url: '/habitos/nuevo?plantilla=blanco',
    });
    await user.type(await screen.findByRole('textbox', { name: 'Nombre' }), 'Leer');
    expect(screen.getByRole('radio', { name: 'Sin aviso' })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Crear hábito' }));
    await screen.findByText('Otra pantalla');
    const [created] = await listHabits();
    expect(created?.reminder).toBeNull();
  });

  it('los hábitos a evitar no ofrecen recordatorio', async () => {
    const { user } = renderRoute(<NewHabitScreen />, {
      path: '/habitos/nuevo',
      url: '/habitos/nuevo?plantilla=blanco',
    });
    await screen.findByRole('textbox', { name: 'Nombre' });
    expect(screen.getByRole('radio', { name: 'Con aviso' })).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'A evitar' }));
    expect(screen.queryByRole('radio', { name: 'Con aviso' })).not.toBeInTheDocument();
  });
});

describe('editar hábito: fecha de inicio', () => {
  it('se puede adelantar dentro del límite y se guarda', async () => {
    const created = await createHabit(habitInput({ name: 'Leer' }));
    const { user } = renderRoute(<EditHabitScreen />, {
      path: '/habitos/:id/editar',
      url: `/habitos/${created.id}/editar`,
    });
    const start = await screen.findByLabelText('Empieza el');
    const wanted = addDays(todayLocal(), -3);
    fireEvent.change(start, { target: { value: wanted } });
    expect(start).toHaveValue(wanted);
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await screen.findByText('Otra pantalla');
    expect((await listHabits())[0]?.createdOn).toBe(wanted);
  });

  it('no deja pasar del primer registro ni del límite retroactivo', async () => {
    const today = todayLocal();
    const created = await createHabit(habitInput({ name: 'Leer', createdOn: addDays(today, -5) }));
    await setEntryValue(created.id, addDays(today, -2), 1);
    renderRoute(<EditHabitScreen />, {
      path: '/habitos/:id/editar',
      url: `/habitos/${created.id}/editar`,
    });
    const start = await screen.findByLabelText('Empieza el');
    expect(start).toHaveAttribute('max', addDays(today, -2));
    expect(start).toHaveAttribute('min', addDays(today, -7));
    fireEvent.change(start, { target: { value: addDays(today, -1) } });
    expect(start).toHaveValue(addDays(today, -5));
  });
});
