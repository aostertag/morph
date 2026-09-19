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

export function saveReflection(
  weekStart: LocalDay,
  reflection: string,
  now: number = Date.now(),
): Promise<WeeklyReview> {
  return withStorage(() =>
    db.transaction('rw', db.reviews, async () => {
      const current = await db.reviews.get(weekStart);
      const review: WeeklyReview = {
        weekStart,
        reflection: reflection.trim(),
        createdAt: current?.createdAt ?? now,
        updatedAt: now,
      };
      await db.reviews.put(review);
      return review;
    }),
  );
}
