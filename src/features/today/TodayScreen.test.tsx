import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { getDayLog, updateDayLog } from '@/db/repos/dayLogs';
import { getEntry, setEntryValue } from '@/db/repos/entries';
import { createHabit } from '@/db/repos/habits';
import { saveReflection } from '@/db/repos/reviews';
import { getSettings, updateSettings } from '@/db/repos/settings';
import { addDays } from '@/domain/day';
import { lastCompleteWeek } from '@/domain/review';
import { formatWeek } from '@/lib/format';
import { habitInput, renderRoute, todayLocal } from '@/test/render';
import { TodayScreen } from './TodayScreen';

describe('pantalla Hoy', () => {
  it('sin hábitos muestra un estado vacío con acción clara', async () => {
    await updateSettings({ onboardingDone: true });
    renderRoute(<TodayScreen />);
    expect(await screen.findByText('Todavía no hay hábitos.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Crear hábito' })).toHaveAttribute(
      'href',
      '/habitos/nuevo?volver=hoy',
    );
  });

  it('un hábito que aún no ha empezado no sale ni cuenta en el progreso', async () => {
    await createHabit(habitInput({ name: 'Leer' }));
    await createHabit(habitInput({ name: 'Correr', createdOn: addDays(todayLocal(), 3) }));
    renderRoute(<TodayScreen />);

    expect(await screen.findByRole('checkbox', { name: 'Leer' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Correr' })).not.toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', '0 de 1');
  });

  it('con solo hábitos futuros lo dice en vez de «nada programado»', async () => {
    await updateSettings({ onboardingDone: true });
    await createHabit(habitInput({ name: 'Correr', createdOn: addDays(todayLocal(), 3) }));
    renderRoute(<TodayScreen />);

    expect(await screen.findByText('Tus hábitos empiezan más adelante.')).toBeInTheDocument();
    expect(screen.queryByText(/Nada programado/)).not.toBeInTheDocument();
    expect(screen.queryByText('Todavía no hay hábitos.')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver hábitos' })).toHaveAttribute('href', '/habitos');
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

  it('la barra de progreso se llena de izquierda a derecha', async () => {
    await createHabit(habitInput({ name: 'Uno', color: 'rojo' }));
    await createHabit(habitInput({ name: 'Dos', color: 'verde' }));
    await createHabit(habitInput({ name: 'Tres', color: 'azul' }));
    const { user } = renderRoute(<TodayScreen />);

    await user.click(await screen.findByRole('checkbox', { name: 'Tres' }));
    await screen.findByRole('checkbox', { name: 'Tres', checked: true });

    const segments = [...screen.getByRole('progressbar').children];
    expect(segments.map((s) => s.getAttribute('style'))).toEqual([
      'border-color: var(--color-habit-azul); background-color: var(--color-habit-azul);',
      'border-color: var(--color-border-strong);',
      'border-color: var(--color-border-strong);',
    ]);
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

  describe('ánimo, energía y nota del día', () => {
    it('guarda el ánimo con su significado y permite deshacer', async () => {
      await createHabit(habitInput({ name: 'Leer' }));
      const { user } = renderRoute(<TodayScreen />);

      const group = await screen.findByRole('group', { name: 'Ánimo' });
      await user.click(within(group).getByRole('radio', { name: '4, bueno' }));

      expect(await within(group).findByText('Bueno')).toBeInTheDocument();
      expect(await getDayLog(todayLocal())).toMatchObject({ mood: 4 });

      await user.click(await screen.findByRole('button', { name: 'Deshacer' }));
      await waitFor(async () => {
        expect(await getDayLog(todayLocal())).toBeUndefined();
      });
    });

    it('la energía se puede quitar', async () => {
      await createHabit(habitInput({ name: 'Leer' }));
      const { user } = renderRoute(<TodayScreen />);

      const group = await screen.findByRole('group', { name: 'Energía' });
      await user.click(within(group).getByRole('radio', { name: '2, baja' }));
      expect(await getDayLog(todayLocal())).toMatchObject({ energy: 2 });

      await user.click(within(group).getByRole('button', { name: 'Quitar' }));
      await waitFor(async () => {
        expect(await getDayLog(todayLocal())).toBeUndefined();
      });
    });

    it('guarda la nota del día', async () => {
      await createHabit(habitInput({ name: 'Leer' }));
      const { user } = renderRoute(<TodayScreen />);

      const note = await screen.findByRole('textbox', { name: 'Nota del día' });
      await user.type(note, 'Día tranquilo');
      await user.click(screen.getByRole('button', { name: 'Guardar nota' }));

      expect(await getDayLog(todayLocal())).toMatchObject({ note: 'Día tranquilo' });
    });

    it('fuera del límite retroactivo solo se lee', async () => {
      await createHabit(habitInput({ name: 'Leer', createdOn: addDays(todayLocal(), -30) }));
      const old = addDays(todayLocal(), -10);
      await updateDayLog(old, { mood: 5, note: 'Buen día' });
      renderRoute(<TodayScreen />, { url: `/?dia=${old}` });

      expect(await screen.findByText(/Ánimo: muy bueno/)).toBeInTheDocument();
      expect(screen.getByText('Buen día')).toBeInTheDocument();
      expect(screen.queryByRole('group', { name: 'Ánimo' })).not.toBeInTheDocument();
    });
  });

  describe('aviso de la revisión semanal', () => {
    const week = lastCompleteWeek(todayLocal(), 1);

    /** Hábito con historia suficiente para que la semana pasada se pueda evaluar. */
    async function habitWithLastWeek() {
      const habit = await createHabit(
        habitInput({ name: 'Leer', createdOn: addDays(todayLocal(), -20) }),
      );
      for (const offset of [0, 1, 3, 5]) {
        await setEntryValue(habit.id, addDays(week.from, offset), 1);
      }
      return habit;
    }

    it('ofrece la semana pasada y "Ahora no" lo retira', async () => {
      await habitWithLastWeek();
      const { user } = renderRoute(<TodayScreen />);

      const prompt = await screen.findByRole('region', { name: 'Revisión de la semana pasada' });
      expect(
        within(prompt).getByText(formatWeek(week, todayLocal()), { exact: false }),
      ).toBeInTheDocument();
      expect(within(prompt).getByText(/57 % de cumplimiento/)).toBeInTheDocument();
      expect(within(prompt).getByRole('link', { name: 'Ver revisión' })).toHaveAttribute(
        'href',
        '/revision',
      );

      await user.click(within(prompt).getByRole('button', { name: 'Ahora no' }));
      await waitFor(() => {
        expect(
          screen.queryByRole('region', { name: 'Revisión de la semana pasada' }),
        ).not.toBeInTheDocument();
      });
      expect((await getSettings()).lastReviewOffered).toBe(week.from);
    });

    it('no lo ofrece si esa semana ya tiene reflexión', async () => {
      await habitWithLastWeek();
      await saveReflection(week.from, 'Ya escrita.');
      renderRoute(<TodayScreen />);

      await screen.findByRole('checkbox', { name: 'Leer' });
      expect(
        screen.queryByRole('region', { name: 'Revisión de la semana pasada' }),
      ).not.toBeInTheDocument();
    });
  });
});
