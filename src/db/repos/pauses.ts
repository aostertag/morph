import { pauseProblem } from '@/domain/pauses';
import { PAUSE_REASONS, type Pause } from '@/domain/types';
import { ValidationError, withStorage } from '../errors';
import { db, newId } from '../schema';

export type PauseInput = Omit<Pause, 'id'>;

export function listPauses(): Promise<Pause[]> {
  return withStorage(() => db.pauses.orderBy('start').toArray());
}

/**
 * Última barrera antes de guardar: el formulario ya avisa con fechas formateadas,
 * aquí se comprueba de nuevo dentro de la transacción (otra pestaña pudo cambiar
 * las pausas) y el mensaje usa fechas ISO.
 */
async function assertValid(input: PauseInput, ignoreId?: string): Promise<void> {
  if (!PAUSE_REASONS.includes(input.reason)) throw new ValidationError('Motivo no válido.');
  if (input.habitId !== null && !(await db.habits.get(input.habitId))) {
    throw new ValidationError('Ese hábito ya no existe.');
  }
  const problem = pauseProblem(input, await db.pauses.toArray(), ignoreId);
  if (problem?.type === 'range') throw new ValidationError(problem.message);
  if (problem?.type === 'overlap') {
    throw new ValidationError(
      `Se solapa con otra pausa del mismo ámbito (del ${problem.with.start} al ${problem.with.end}).`,
    );
  }
}

function clean(input: PauseInput): PauseInput {
  return { ...input, note: input.note?.trim() || null };
}

export function createPause(input: PauseInput): Promise<Pause> {
  const next = clean(input);
  return withStorage(() =>
    db.transaction('rw', db.pauses, db.habits, async () => {
      await assertValid(next);
      const pause: Pause = { ...next, id: newId() };
      await db.pauses.add(pause);
      return pause;
    }),
  );
}

/** Cambia una pausa y devuelve la anterior para poder deshacer. */
export function updatePause(id: string, patch: Partial<PauseInput>): Promise<Pause> {
  return withStorage(() =>
    db.transaction('rw', db.pauses, db.habits, async () => {
      const previous = await db.pauses.get(id);
      if (!previous) throw new ValidationError('Esa pausa ya no existe.');
      const { id: _id, ...rest } = previous;
      const next = clean({ ...rest, ...patch });
      await assertValid(next, id);
      await db.pauses.put({ ...next, id });
      return previous;
    }),
  );
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

/** Vuelve a poner una pausa tal como estaba (deshacer un borrado o una edición). */
export function restorePause(pause: Pause): Promise<void> {
  return withStorage(async () => {
    await db.pauses.put(pause);
  });
}
