import { DEFAULT_SETTINGS, type Settings } from '@/domain/types';
import { ValidationError, withStorage } from '../errors';
import { db, type SettingsRow } from '../schema';

function fromRow(row: SettingsRow | undefined): Settings {
  if (!row) return DEFAULT_SETTINGS;
  const { key: _key, ...stored } = row;
  return { ...DEFAULT_SETTINGS, ...stored };
}

/** Ajustes guardados, completados con los valores por defecto. */
export function getSettings(): Promise<Settings> {
  return withStorage(async () => fromRow(await db.settings.get('app')));
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  if (patch.retroLimitDays !== undefined) {
    const days = patch.retroLimitDays;
    if (!Number.isInteger(days) || days < 0 || days > 365) {
      throw new ValidationError('El límite retroactivo debe estar entre 0 y 365 días.');
    }
  }
  return withStorage(() =>
    db.transaction('rw', db.settings, async () => {
      const next: Settings = { ...fromRow(await db.settings.get('app')), ...patch };
      await db.settings.put({ ...next, key: 'app' });
      return next;
    }),
  );
}
