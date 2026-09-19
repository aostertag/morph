import type { LocalDay } from '@/domain/day';
import { type HabitInput, normalizeHabitInput, validateHabitInput } from '@/domain/habit';
import type { Entry, Habit, Pause } from '@/domain/types';
import { ValidationError, withStorage } from '../errors';
import { db, newId } from '../schema';

function assertValid(input: HabitInput): HabitInput {
  const errors = validateHabitInput(input);
  const first = Object.values(errors)[0];
  if (first) throw new ValidationError(first, errors);
  return normalizeHabitInput(input);
}

/** Todos los hábitos (activos y archivados) en el orden del usuario. */
export function listHabits(): Promise<Habit[]> {
  return withStorage(() => db.habits.orderBy('order').toArray());
}

export function getHabit(id: string): Promise<Habit | undefined> {
  return withStorage(() => db.habits.get(id));
}

export async function createHabit(input: HabitInput): Promise<Habit> {
  const data = assertValid(input);
  return withStorage(() =>
    db.transaction('rw', db.habits, async () => {
      const last = await db.habits.orderBy('order').last();
      const habit: Habit = {
        ...data,
        id: newId(),
        order: (last?.order ?? -1) + 1,
        archivedOn: null,
      };
      await db.habits.add(habit);
      return habit;
    }),
  );
}

export async function updateHabit(id: string, input: HabitInput): Promise<Habit> {
  const data = assertValid(input);
  return withStorage(() =>
    db.transaction('rw', db.habits, async () => {
      const current = await db.habits.get(id);
      if (!current) throw new ValidationError('El hábito ya no existe.');
      const next: Habit = { ...current, ...data };
      await db.habits.put(next);
      return next;
    }),
  );
}

export function setArchived(id: string, archivedOn: LocalDay | null): Promise<void> {
  return withStorage(async () => {
    await db.habits.update(id, { archivedOn });
  });
}

/** Guarda el nuevo orden: la posición en `ids` pasa a ser el `order`. */
export function reorderHabits(ids: readonly string[]): Promise<void> {
  return withStorage(() =>
    db.transaction('rw', db.habits, async () => {
      await Promise.all(ids.map((id, order) => db.habits.update(id, { order })));
    }),
  );
}

export interface DeletedHabit {
  readonly habit: Habit;
  readonly entries: readonly Entry[];
  readonly pauses: readonly Pause[];
}

/** Elimina el hábito con todo su historial y devuelve lo borrado para poder restaurarlo. */
export function deleteHabit(id: string): Promise<DeletedHabit | undefined> {
  return withStorage(() =>
    db.transaction('rw', db.habits, db.entries, db.pauses, async () => {
      const habit = await db.habits.get(id);
      if (!habit) return undefined;
      const entries = await db.entries.where('habitId').equals(id).toArray();
      const pauses = await db.pauses.where('habitId').equals(id).toArray();
      await db.entries.where('habitId').equals(id).delete();
      await db.pauses.where('habitId').equals(id).delete();
      await db.habits.delete(id);
      return { habit, entries, pauses };
    }),
  );
}

export function restoreHabit(deleted: DeletedHabit): Promise<void> {
  return withStorage(() =>
    db.transaction('rw', db.habits, db.entries, db.pauses, async () => {
      await db.habits.put(deleted.habit);
      await db.entries.bulkPut([...deleted.entries]);
      await db.pauses.bulkPut([...deleted.pauses]);
    }),
  );
}
