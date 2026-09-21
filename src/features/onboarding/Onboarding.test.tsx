import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createHabit } from '@/db/repos/habits';
import { getSettings, updateSettings } from '@/db/repos/settings';
import { habitInput, renderRoute } from '@/test/render';
import { TodayScreen } from '../today/TodayScreen';

describe('onboarding', () => {
  it('la primera vez, sin hábitos, empieza por el primer paso', async () => {
    renderRoute(<TodayScreen />);
    expect(
      await screen.findByRole('heading', { name: 'Registra lo que haces, día a día.' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Paso 1 de 3')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Atrás' })).not.toBeInTheDocument();
  });

  it('avanza y retrocede entre los tres pasos, moviendo el foco al título', async () => {
    const { user } = renderRoute(<TodayScreen />);
    await user.click(await screen.findByRole('button', { name: 'Siguiente' }));

    const second = await screen.findByRole('heading', {
      name: 'Una racha no se rompe por un mal día.',
    });
    expect(second).toHaveFocus();
    expect(screen.getByText('Paso 2 de 3')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(await screen.findByRole('heading', { name: 'Empieza con un hábito.' })).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Siguiente' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Beber agua/ })).toHaveAttribute(
      'href',
      '/habitos/nuevo?plantilla=agua&volver=hoy',
    );
    // «Empezar en blanco» es una fila más de la lista, después de las plantillas.
    const rows = within(screen.getByRole('list')).getAllByRole('link');
    const blank = screen.getByRole('link', { name: /Empezar en blanco/ });
    expect(blank).toHaveAttribute('href', '/habitos/nuevo?plantilla=blanco&volver=hoy');
    expect(rows.at(-1)).toBe(blank);
    expect(rows).toHaveLength(5);

    await user.click(screen.getByRole('button', { name: 'Atrás' }));
    expect(
      await screen.findByRole('heading', { name: 'Una racha no se rompe por un mal día.' }),
    ).toBeInTheDocument();
  });

  it('se puede saltar desde cualquier paso y no vuelve a salir', async () => {
    const { user } = renderRoute(<TodayScreen />);
    await user.click(await screen.findByRole('button', { name: 'Siguiente' }));
    await user.click(await screen.findByRole('button', { name: 'Saltar introducción' }));

    expect(await screen.findByText('Todavía no hay hábitos.')).toBeInTheDocument();
    expect((await getSettings()).onboardingDone).toBe(true);
    expect(screen.queryByText(/Paso \d de 3/)).not.toBeInTheDocument();
  });

  it('elegir una plantilla lo da por terminado', async () => {
    const { user } = renderRoute(<TodayScreen />);
    await user.click(await screen.findByRole('button', { name: 'Siguiente' }));
    await user.click(await screen.findByRole('button', { name: 'Siguiente' }));
    await user.click(await screen.findByRole('link', { name: /Beber agua/ }));
    await waitFor(async () => expect((await getSettings()).onboardingDone).toBe(true));
  });

  it('con hábitos ya creados no aparece', async () => {
    await createHabit(habitInput({ name: 'Leer' }));
    renderRoute(<TodayScreen />);
    expect(await screen.findByRole('checkbox', { name: 'Leer' })).toBeInTheDocument();
    expect(screen.queryByText(/Paso \d de 3/)).not.toBeInTheDocument();
  });

  it('una vez completado, sin hábitos se ve el estado vacío normal', async () => {
    await updateSettings({ onboardingDone: true });
    renderRoute(<TodayScreen />);
    expect(await screen.findByText('Todavía no hay hábitos.')).toBeInTheDocument();
  });
});
