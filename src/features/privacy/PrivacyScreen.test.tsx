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
});
