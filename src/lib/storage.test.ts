import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestPersistentStorage } from './storage';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('requestPersistentStorage', () => {
  it('pide la persistencia una sola vez', () => {
    const persist = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('navigator', { storage: { persist } });
    vi.spyOn(console, 'info').mockImplementation(() => {});
    requestPersistentStorage();
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('no falla si el navegador no tiene la API', () => {
    vi.stubGlobal('navigator', {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    expect(() => requestPersistentStorage()).not.toThrow();
  });

  it('no propaga un rechazo', async () => {
    const persist = vi.fn().mockRejectedValue(new Error('no'));
    vi.stubGlobal('navigator', { storage: { persist } });
    vi.spyOn(console, 'info').mockImplementation(() => {});
    expect(() => requestPersistentStorage()).not.toThrow();
    await Promise.resolve();
  });
});
