import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderRoute } from '@/test/render';
import { PrivacyScreen } from './PrivacyScreen';

describe('privacidad', () => {
  it('explica que los datos no salen del navegador', async () => {
    renderRoute(<PrivacyScreen />);
    await screen.findByRole('heading', { name: 'Privacidad', level: 1 });
    expect(screen.getByText(/no hay cuentas ni un servidor/i)).toBeInTheDocument();
    expect(screen.getByText(/Cloudflare Pages/)).toBeInTheDocument();
  });

  it('lleva el icono como identidad, mudo para lectores de pantalla y con tamaño reservado', async () => {
    const { container } = renderRoute(<PrivacyScreen />);
    await screen.findByRole('heading', { name: 'Privacidad', level: 1 });
    const icon = container.querySelector('img[src="/pwa-192.png"]');
    expect(icon).toHaveAttribute('alt', '');
    expect(icon).toHaveAttribute('width', '64');
    expect(icon).toHaveAttribute('height', '64');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
