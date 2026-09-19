import { describe, expect, it } from 'vitest';
import { describeStorageError, StorageError, ValidationError, withStorage } from './errors';

describe('describeStorageError', () => {
  it('traduce errores nativos y de Dexie', () => {
    expect(describeStorageError(new DOMException('full', 'QuotaExceededError'))).toMatch(/espacio/);
    expect(describeStorageError({ name: 'MissingAPIError' })).toMatch(/ventana privada/);
  });

  it('mira dentro del error envuelto por Dexie', () => {
    const wrapped = { name: 'AbortError', inner: new DOMException('full', 'QuotaExceededError') };
    expect(describeStorageError(wrapped)).toMatch(/espacio/);
  });

  it('usa un mensaje genérico para lo desconocido', () => {
    expect(describeStorageError(new Error('???'))).toMatch(/No se pudo guardar/);
    expect(describeStorageError('texto')).toMatch(/No se pudo guardar/);
  });
});

describe('withStorage', () => {
  it('convierte fallos en StorageError conservando la causa', async () => {
    const cause = new DOMException('x', 'QuotaExceededError');
    const promise = withStorage(() => Promise.reject(cause));
    await expect(promise).rejects.toBeInstanceOf(StorageError);
    await expect(promise).rejects.toMatchObject({ cause });
  });

  it('deja pasar los errores de validación', async () => {
    await expect(
      withStorage(() => Promise.reject(new ValidationError('no'))),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
