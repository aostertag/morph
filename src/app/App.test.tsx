import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it } from 'vitest';
import { updateSettings } from '@/db/repos/settings';
import { preloadLazyScreens } from '@/test/render';
import { App } from './App';

// Las pantallas `lazy()` se compilan en frío la primera vez: ver `preloadLazyScreens`.
beforeAll(preloadLazyScreens);

describe('app', () => {
  it('arranca en Hoy y navega a Hábitos', async () => {
    await updateSettings({ onboardingDone: true });
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByText('Todavía no hay hábitos.')).toBeInTheDocument();

    const [nav] = screen.getAllByRole('navigation', { name: 'Principal' });
    if (!nav) throw new Error('falta la navegación');
    expect(within(nav).getByRole('link', { name: 'Hoy' })).toHaveAttribute('aria-current', 'page');

    await user.click(within(nav).getByRole('link', { name: 'Hábitos' }));
    expect(await screen.findByRole('heading', { name: 'Hábitos', level: 1 })).toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('al cambiar de pantalla pone el título y lleva el foco al contenido', async () => {
    await updateSettings({ onboardingDone: true });
    window.history.pushState({}, '', '/');
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Todavía no hay hábitos.');
    expect(document.title).toBe('Hoy / Morph');

    const [nav] = screen.getAllByRole('navigation', { name: 'Principal' });
    if (!nav) throw new Error('falta la navegación');
    await user.click(within(nav).getByRole('link', { name: 'Ajustes' }));
    await screen.findByRole('heading', { name: 'Ajustes', level: 1 });
    expect(document.title).toBe('Ajustes / Morph');
    expect(document.getElementById('contenido')).toHaveFocus();
  });

  it('el pie de Ajustes lleva a la página de privacidad', async () => {
    await updateSettings({ onboardingDone: true });
    window.history.pushState({}, '', '/ajustes');
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Ajustes', level: 1 });

    await user.click(screen.getByRole('link', { name: 'Privacidad' }));
    await screen.findByRole('heading', { name: 'Privacidad', level: 1 });
    expect(document.title).toBe('Privacidad / Morph');
  });
});
