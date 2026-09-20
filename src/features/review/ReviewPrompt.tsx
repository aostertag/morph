import type { LocalDay } from '@/domain/day';
import { lastCompleteWeek, reviewPending, weekSummary } from '@/domain/review';
import type { HabitAnalysis } from '@/domain/today';
import type { Settings, WeeklyReview } from '@/domain/types';
import { cachedHistory } from '@/lib/analysisCache';
import { formatPercent, formatWeek } from '@/lib/format';
import { Button, ButtonLink } from '@/ui/Button';
import { dismissReview } from './reviewActions';

/**
 * Aviso de la revisión de la semana pasada, la primera vez que se abre la app en
 * la semana. No es una tarjeta ni interrumpe nada: una línea entre dos bordes,
 * con lo justo para decidir si merece la pena entrar.
 */
export function ReviewPrompt({
  analyses,
  settings,
  reviews,
  today,
}: {
  analyses: readonly HabitAnalysis[];
  settings: Settings;
  reviews: readonly WeeklyReview[];
  today: LocalDay;
}) {
  const week = lastCompleteWeek(today, settings.weekStartsOn);
  const histories = analyses.map((analysis) => cachedHistory(analysis, today));
  const summary = weekSummary(histories, [], week);
  const written = reviews.some((review) => review.weekStart === week.from);

  if (!reviewPending(summary, settings.lastReviewOffered, written)) return null;

  const { ratio } = summary.score.current;

  return (
    <section aria-labelledby="aviso-revision" className="mt-4 border-y border-border py-3">
      <h2 id="aviso-revision" className="label-caps">
        Revisión de la semana pasada
      </h2>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <p className="text-md">
          {formatWeek(week, today)}
          {ratio !== null && <> · {formatPercent(ratio)} de cumplimiento</>}
        </p>
        <div className="flex items-center gap-2">
          <ButtonLink to="/revision" variant="secondary">
            Ver revisión
          </ButtonLink>
          <Button variant="ghost" onClick={() => void dismissReview(week.from)}>
            Ahora no
          </Button>
        </div>
      </div>
    </section>
  );
}
