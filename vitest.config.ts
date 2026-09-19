import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * La lógica de dominio se ejecuta en varias zonas horarias con cambio de horario
 * distinto (hemisferio norte, hemisferio sur con salto a medianoche, y EE. UU.)
 * para garantizar que un "día" es siempre el día local del usuario.
 */
const TIME_ZONES = ['Europe/Madrid', 'America/Santiago', 'America/New_York'] as const;

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    projects: [
      ...TIME_ZONES.map((tz) => ({
        extends: true as const,
        test: {
          name: `domain · ${tz}`,
          include: ['src/domain/**/*.test.ts'],
          environment: 'node',
          env: { TZ: tz },
        },
      })),
      {
        extends: true,
        test: {
          name: 'db',
          include: ['src/db/**/*.test.ts'],
          environment: 'node',
          setupFiles: ['fake-indexeddb/auto'],
          env: { TZ: 'Europe/Madrid' },
        },
      },
      {
        extends: true,
        test: {
          name: 'ui',
          include: ['src/**/*.test.tsx'],
          environment: 'jsdom',
          setupFiles: ['./src/test/setup.ts'],
        },
      },
    ],
  },
});
