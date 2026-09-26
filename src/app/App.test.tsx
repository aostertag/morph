import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
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

  describe('desplazamiento al cambiar de pantalla', () => {
    const tops = (spy: { mock: { calls: unknown[][] } }) =>
      spy.mock.calls.map(([arg]) => (arg as ScrollToOptions).top);

    afterEach(() => {
      vi.restoreAllMocks();
      Object.defineProperty(window, 'scrollY', { value: 0, configurable: true, writable: true });
    });

    function setScrollY(y: number) {
      Object.defineProperty(window, 'scrollY', { value: y, configurable: true, writable: true });
      window.dispatchEvent(new Event('scroll'));
    }

    async function openSettings() {
      await updateSettings({ onboardingDone: true });
      window.history.pushState({}, '', '/ajustes');
      const user = userEvent.setup();
      render(<App />);
      await screen.findByRole('heading', { name: 'Ajustes', level: 1 });
      return user;
    }

    it('otra ruta empieza arriba, aunque la anterior estuviera desplazada', async () => {
      const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
      const user = await openSettings();
      setScrollY(2000);
      expect(scrollTo).not.toHaveBeenCalled();

      await user.click(screen.getByRole('link', { name: 'Privacidad' }));
      await screen.findByRole('heading', { name: 'Privacidad', level: 1 });
      expect(tops(scrollTo)).toEqual([0]);
      expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' });
      expect(document.getElementById('contenido')).toHaveFocus();
    });

    it('un cambio solo de la URL de búsqueda (otro día) no mueve nada', async () => {
      const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
      await updateSettings({ onboardingDone: true });
      window.history.pushState({}, '', '/');
      const user = userEvent.setup();
      render(<App />);
      await screen.findByText('Todavía no hay hábitos.');

      await user.keyboard('{ArrowLeft}');
      await vi.waitFor(() => expect(window.location.search).toContain('dia='));
      expect(scrollTo).not.toHaveBeenCalled();

      // Control positivo: cambiar de ruta sí mueve.
      const [nav] = screen.getAllByRole('navigation', { name: 'Principal' });
      if (!nav) throw new Error('falta la navegación');
      await user.click(within(nav).getByRole('link', { name: 'Ajustes' }));
      await screen.findByRole('heading', { name: 'Ajustes', level: 1 });
      expect(tops(scrollTo)).toEqual([0]);
    });

    it('volver atrás recupera la posición de esa pantalla, no la pone arriba', async () => {
      const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
      const user = await openSettings();
      setScrollY(1234);

      await user.click(screen.getByRole('link', { name: 'Privacidad' }));
      await screen.findByRole('heading', { name: 'Privacidad', level: 1 });
      scrollTo.mockClear();

      act(() => window.history.back());
      await screen.findByRole('heading', { name: 'Ajustes', level: 1 });
      await vi.waitFor(() => expect(tops(scrollTo)).toContain(1234));
      expect(tops(scrollTo)).not.toContain(0);
    });
  });
});
