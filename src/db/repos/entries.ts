import type { LocalDay } from '@/domain/day';
import type { Entry } from '@/domain/types';
import { withStorage } from '../errors';
import { db, newId } from '../schema';

/** Estado anterior de un registro, para deshacer. `null` si no existía. */
export type EntrySnapshot = Entry | null;

export function getEntry(habitId: string, date: LocalDay): Promise<Entry | undefined> {
  return withStorage(() => db.entries.where('[habitId+date]').equals([habitId, date]).first());
}

/** Registros de un hábito ordenados por fecha, opcionalmente limitados a [from, to]. */
export function entriesForHabit(habitId: string, from?: LocalDay, to?: LocalDay): Promise<Entry[]> {
  return withStorage(() =>
    db.entries
      .where('[habitId+date]')
      .between([habitId, from ?? ''], [habitId, to ?? '￿'], true, true)
      .toArray(),
  );
}

/** Registros de todos los hábitos en [from, to], ordenados por fecha. */
export function entriesBetween(from: LocalDay, to: LocalDay): Promise<Entry[]> {
  return withStorage(() => db.entries.where('date').between(from, to, true, true).toArray());
}

export function entriesOnDay(date: LocalDay): Promise<Entry[]> {
  return withStorage(() => db.entries.where('date').equals(date).toArray());
}

type Change = (current: Entry | undefined) => { value: number; note: string | null };

/** Escribe el registro del día; un valor 0 sin nota lo elimina. */
function write(
  habitId: string,
  date: LocalDay,
  change: Change,
  now: number,
): Promise<EntrySnapshot> {
  return withStorage(() =>
    db.transaction('rw', db.entries, async () => {
      const current = await db.entries.where('[habitId+date]').equals([habitId, date]).first();
      const { value, note } = change(current);
      if (value <= 0 && !note) {
        if (current) await db.entries.delete(current.id);
      } else {
        await db.entries.put({
          id: current?.id ?? newId(),
          habitId,
          date,
          value: Math.max(0, value),
          note,
          loggedAt: now,
        });
      }
      return current ?? null;
    }),
  );
}

/** Fija el valor del día y devuelve el estado anterior para poder deshacer. */
export function setEntryValue(
  habitId: string,
  date: LocalDay,
  value: number,
  now: number = Date.now(),
): Promise<EntrySnapshot> {
  return write(habitId, date, (current) => ({ value, note: current?.note ?? null }), now);
}

/** Suma (o resta) al valor del día sin bajar de 0. */
export function adjustEntryValue(
  habitId: string,
  date: LocalDay,
  delta: number,
  now: number = Date.now(),
): Promise<EntrySnapshot> {
  return write(
    habitId,
    date,
    (current) => ({
      value: Math.max(0, (current?.value ?? 0) + delta),
      note: current?.note ?? null,
    }),
    now,
  );
}

export function setEntryNote(
  habitId: string,
  date: LocalDay,
  note: string,
  now: number = Date.now(),
): Promise<EntrySnapshot> {
  const clean = note.trim() || null;
  return write(habitId, date, (current) => ({ value: current?.value ?? 0, note: clean }), now);
}

/** Deja el registro del día exactamente como estaba en `snapshot`. */
export function restoreEntry(
  habitId: string,
  date: LocalDay,
  snapshot: EntrySnapshot,
): Promise<void> {
  return withStorage(() =>
    db.transaction('rw', db.entries, async () => {
      await db.entries.where('[habitId+date]').equals([habitId, date]).delete();
      if (snapshot) await db.entries.put(snapshot);
    }),
  );
}
