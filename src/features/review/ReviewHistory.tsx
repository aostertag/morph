import { useState } from 'react';
import { Link } from 'react-router';
import type { LocalDay } from '@/domain/day';
import { weekOf } from '@/domain/review';
import type { WeeklyReview } from '@/domain/types';
import { formatWeek } from '@/lib/format';

const PAGE = 20;

/** Revisiones escritas, de la más reciente a la más antigua. */
export function ReviewHistory({
  reviews,
  current,
  today,
}: {
  reviews: readonly WeeklyReview[];
  /** La semana que se está viendo, para no enlazarla a sí misma. */
  current: LocalDay;
  today: LocalDay;
}) {
  const [visible, setVisible] = useState(PAGE);
  if (reviews.length === 0) return null;

  return (
    <section aria-labelledby="revisiones" className="mt-12">
      <h2 id="revisiones" className="label-caps mb-3 border-b border-border pb-2">
        Revisiones anteriores
      </h2>
      <ol>
        {reviews.slice(0, visible).map((review) => {
          const label = formatWeek(weekOf(review.weekStart), today);
          return (
            <li key={review.weekStart} className="border-b border-border py-3">
              <p className="text-md font-medium">
                {review.weekStart === current ? (
                  <span aria-current="true">{label}</span>
                ) : (
                  <Link
                    to={`/revision?semana=${review.weekStart}`}
                    className="rounded-sm underline-offset-4 hover:underline"
                  >
                    {label}
                  </Link>
                )}
              </p>
              <p className="mt-1 text-md text-text-muted">{review.reflection}</p>
            </li>
          );
        })}
      </ol>
      {visible < reviews.length && (
        <button
          type="button"
          onClick={() => setVisible((n) => n + PAGE)}
          className="mt-4 min-h-touch text-md text-accent underline-offset-4 hover:underline"
        >
          Ver más ({reviews.length - visible})
        </button>
      )}
    </section>
  );
}
