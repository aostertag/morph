import { validatePause } from '@/domain/pauses';
import type { Pause } from '@/domain/types';
import { ValidationError, withStorage } from '../errors';
import { db, newId } from '../schema';

export function listPauses(): Promise<Pause[]> {
  return withStorage(() => db.pauses.orderBy('start').toArray());
}

export async function createPause(input: Omit<Pause, 'id'>): Promise<Pause> {
  const error = validatePause(input);
  if (error) throw new ValidationError(error);
  const pause: Pause = { ...input, note: input.note?.trim() || null, id: newId() };
  return withStorage(async () => {
    await db.pauses.add(pause);
    return pause;
  });
}

/** Elimina la pausa y la devuelve para poder deshacer. */
export function deletePause(id: string): Promise<Pause | undefined> {
  return withStorage(() =>
    db.transaction('rw', db.pauses, async () => {
      const pause = await db.pauses.get(id);
      await db.pauses.delete(id);
      return pause;
    }),
  );
}

export function restorePause(pause: Pause): Promise<void> {
  return withStorage(async () => {
    await db.pauses.put(pause);
  });
}
