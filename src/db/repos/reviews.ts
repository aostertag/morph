import type { LocalDay } from '@/domain/day';
import type { WeeklyReview } from '@/domain/types';
import { withStorage } from '../errors';
import { db } from '../schema';

export function getReview(weekStart: LocalDay): Promise<WeeklyReview | undefined> {
  return withStorage(() => db.reviews.get(weekStart));
}

/** Revisiones de la más reciente a la más antigua. */
export function listReviews(): Promise<WeeklyReview[]> {
  return withStorage(() => db.reviews.orderBy('weekStart').reverse().toArray());
}

/**
 * Guarda la reflexión de una semana y devuelve la anterior (`null` si no había)
 * para poder deshacer. Una reflexión vacía borra la revisión: en el historial no
 * pintan nada las semanas en blanco.
 */
export function saveReflection(
  weekStart: LocalDay,
  reflection: string,
  now: number = Date.now(),
): Promise<WeeklyReview | null> {
  return withStorage(() =>
    db.transaction('rw', db.reviews, async () => {
      const current = await db.reviews.get(weekStart);
      const clean = reflection.trim();
      if (clean === '') {
        await db.reviews.delete(weekStart);
      } else {
        await db.reviews.put({
          weekStart,
          reflection: clean,
          createdAt: current?.createdAt ?? now,
          updatedAt: now,
        });
      }
      return current ?? null;
    }),
  );
}

export function restoreReview(weekStart: LocalDay, snapshot: WeeklyReview | null): Promise<void> {
  return withStorage(async () => {
    if (snapshot) await db.reviews.put(snapshot);
    else await db.reviews.delete(weekStart);
  });
}
