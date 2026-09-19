import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('app', () => {
  it('arranca en Hoy y navega a Hábitos', async () => {
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
});
