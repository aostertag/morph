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

/** Fecha del primer registro de un hábito, o `null` si no tiene ninguno. */
export function firstEntryDate(habitId: string): Promise<LocalDay | null> {
  return withStorage(async () => {
    const first = await db.entries
      .where('[habitId+date]')
      .between([habitId, ''], [habitId, '￿'], true, true)
      .first();
    return first?.date ?? null;
  });
}

/** Registros de todos los hábitos en [from, to], ordenados por fecha. */
export function entriesBetween(from: LocalDay, to: LocalDay): Promise<Entry[]> {
  return withStorage(() => db.entries.where('date').between(from, to, true, true).toArray());
}

export function entriesOnDay(date: LocalDay): Promise<Entry[]> {
  return withStorage(() => db.entries.where('date').equals(date).toArray());
}

type Change = (current: Entry | undefined) => { value: number; note: string | null };

/** Resultado de una escritura: el estado anterior (para deshacer) y el valor final guardado. */
interface WriteResult {
  readonly previous: EntrySnapshot;
  readonly value: number;
}

/** Escribe el registro del día; un valor 0 sin nota lo elimina. `change` decide sobre el valor
 * real dentro de la transacción, así que dos escrituras seguidas siempre se serializan sobre el
 * último estado confirmado, nunca sobre uno leído antes de empezar. */
function write(habitId: string, date: LocalDay, change: Change, now: number): Promise<WriteResult> {
  return withStorage(() =>
    db.transaction('rw', db.entries, async () => {
      const current = await db.entries.where('[habitId+date]').equals([habitId, date]).first();
      const { value, note } = change(current);
      const clamped = Math.max(0, value);
      if (clamped <= 0 && !note) {
        if (current) await db.entries.delete(current.id);
      } else {
        await db.entries.put({
          id: current?.id ?? newId(),
          habitId,
          date,
          value: clamped,
          note,
          loggedAt: now,
        });
      }
      return { previous: current ?? null, value: clamped };
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
  return write(habitId, date, (current) => ({ value, note: current?.note ?? null }), now).then(
    (r) => r.previous,
  );
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
  ).then((r) => r.previous);
}

export function setEntryNote(
  habitId: string,
  date: LocalDay,
  note: string,
  now: number = Date.now(),
): Promise<EntrySnapshot> {
  const clean = note.trim() || null;
  return write(habitId, date, (current) => ({ value: current?.value ?? 0, note: clean }), now).then(
    (r) => r.previous,
  );
}

/**
 * Alterna el registro booleano del día (0↔1) según el valor real en el momento de escribir, no
 * según lo que hubiera pintado antes: dos alternancias muy seguidas siempre se turnan.
 */
export function toggleEntryValue(
  habitId: string,
  date: LocalDay,
  now: number = Date.now(),
): Promise<WriteResult> {
  return write(
    habitId,
    date,
    (current) => ({
      value: (current?.value ?? 0) > 0 ? 0 : 1,
      note: current?.note ?? null,
    }),
    now,
  );
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

export function countEntries(habitId: string): Promise<number> {
  return withStorage(() => db.entries.where('habitId').equals(habitId).count());
}
