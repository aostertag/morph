import type { LocalDay } from '@/domain/day';
import {
  archiveDayFor,
  type HabitInput,
  normalizeHabitInput,
  unarchiveGap,
  validateHabitInput,
} from '@/domain/habit';
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

/** Sustituye el hábito por una versión anterior (para deshacer ediciones). */
export function restoreHabitRecord(habit: Habit): Promise<void> {
  return withStorage(async () => {
    await db.habits.put(habit);
  });
}

async function requireHabit(id: string): Promise<Habit> {
  const habit = await db.habits.get(id);
  if (!habit) throw new ValidationError('El hábito ya no existe.');
  return habit;
}

/**
 * Archiva conservando el historial. Hoy cuenta solo si ya tiene registro.
 * Devuelve el hábito anterior para deshacer.
 */
export function archiveHabit(id: string, today: LocalDay): Promise<Habit> {
  return withStorage(() =>
    db.transaction('rw', db.habits, db.entries, async () => {
      const previous = await requireHabit(id);
      const hasEntryToday =
        (await db.entries.where('[habitId+date]').equals([id, today]).count()) > 0;
      await db.habits.update(id, { archivedOn: archiveDayFor(today, hasEntryToday) });
      return previous;
    }),
  );
}

export interface UnarchiveResult {
  readonly previous: Habit;
  /** Pausa creada para el tiempo que estuvo archivado; `null` si no hizo falta. */
  readonly gapPause: Pause | null;
}

/**
 * Restaura un hábito archivado. El tiempo que estuvo archivado queda en pausa,
 * así que ni rompe la racha ni cuenta como fallado.
 */
export function unarchiveHabit(id: string, today: LocalDay): Promise<UnarchiveResult> {
  return withStorage(() =>
    db.transaction('rw', db.habits, db.pauses, async () => {
      const previous = await requireHabit(id);
      if (previous.archivedOn === null) return { previous, gapPause: null };
      const gap = unarchiveGap(previous.archivedOn, today);
      let gapPause: Pause | null = null;
      if (gap) {
        gapPause = { id: newId(), habitId: id, ...gap, reason: 'otro', note: 'Archivado' };
        await db.pauses.add(gapPause);
      }
      await db.habits.update(id, { archivedOn: null });
      return { previous, gapPause };
    }),
  );
}

export function undoUnarchive(result: UnarchiveResult): Promise<void> {
  return withStorage(() =>
    db.transaction('rw', db.habits, db.pauses, async () => {
      await db.habits.put(result.previous);
      if (result.gapPause) await db.pauses.delete(result.gapPause.id);
    }),
  );
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
