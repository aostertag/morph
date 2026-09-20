import {
  createPause,
  deletePause,
  type PauseInput,
  restorePause,
  updatePause,
} from '@/db/repos/pauses';
import type { Pause } from '@/domain/types';
import { notify, notifyError } from '@/lib/toast';

/** Todas las escrituras de pausas avisan con un toast que permite deshacer. */
async function run(action: () => Promise<void>): Promise<boolean> {
  try {
    await action();
    return true;
  } catch (error) {
    notifyError(error);
    return false;
  }
}

export function addPause(input: PauseInput): Promise<boolean> {
  return run(async () => {
    const created = await createPause(input);
    notify('Pausa creada', { undo: async () => void (await deletePause(created.id)) });
  });
}

export function editPause(id: string, patch: PauseInput): Promise<boolean> {
  return run(async () => {
    const previous = await updatePause(id, patch);
    notify('Pausa actualizada', { undo: () => restorePause(previous) });
  });
}

export function removePause(pause: Pause): Promise<boolean> {
  return run(async () => {
    const removed = await deletePause(pause.id);
    if (!removed) return;
    notify('Pausa eliminada', { undo: () => restorePause(removed) });
  });
}
