import { useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { isLocalDay, type LocalDay, startOfWeek, type Weekday } from '@/domain/day';
import { lastCompleteWeek, weekOf, weekSummary } from '@/domain/review';
import { useToday } from '@/hooks/useToday';
import { formatWeek } from '@/lib/format';
import { ButtonLink } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { ReflectionForm } from './ReflectionForm';
import { ReviewHistory } from './ReviewHistory';
import { dismissReview } from './reviewActions';
import { useReviewData } from './useReviewData';
import { WeekReport } from './WeekReport';

/**
 * Semana elegida en la URL (`/revision?semana=YYYY-MM-DD`). Solo valen semanas
 * ya cerradas que empiecen el día configurado; cualquier otra cosa cae en la
 * última semana cerrada.
 */
function useWeekStart(today: LocalDay, weekStartsOn: Weekday): LocalDay {
  const [params] = useSearchParams();
  const requested = params.get('semana');
  const fallback = lastCompleteWeek(today, weekStartsOn).from;
  if (!requested || !isLocalDay(requested)) return fallback;
  if (startOfWeek(requested, weekStartsOn) !== requested) return fallback;
  return requested <= fallback ? requested : fallback;
}

export function ReviewScreen() {
  const today = useToday();
  const data = useReviewData(today);
  const weekStartsOn = data?.settings.weekStartsOn ?? 1;
  const weekStart = useWeekStart(today, weekStartsOn);

  // Abrir la revisión cuenta como haberla ofrecido: el aviso de Hoy ya sobra.
  const offered = data?.settings.lastReviewOffered;
  const latest = lastCompleteWeek(today, weekStartsOn).from;
  useEffect(() => {
    if (data && offered !== latest) void dismissReview(latest);
  }, [data, offered, latest]);

  if (!data) return null;

  const { histories, analyses, dayLogs, reviews, hasHabits } = data;

  if (!hasHabits) {
    return (
      <div className="max-w-list">
        <ScreenHeader title="Revisión semanal" />
        <EmptyState
          title="Todavía no hay nada que revisar."
          text="Crea un hábito y el lunes que viene esta pantalla tendrá algo que contar."
          actions={
            <ButtonLink to="/habitos/nuevo" variant="primary">
              Crear hábito
            </ButtonLink>
          }
        />
      </div>
    );
  }

  const week = weekOf(weekStart);
  const summary = weekSummary(histories, dayLogs, week);
  const review = reviews.find((item) => item.weekStart === weekStart) ?? null;

  return (
    <div>
      <ScreenHeader title="Revisión semanal" eyebrow={formatWeek(week, today)} />

      <WeekReport summary={summary} analyses={analyses} showStreaks={weekStart === latest} />

      <ReflectionForm weekStart={weekStart} review={review} />

      <ReviewHistory reviews={reviews} current={weekStart} today={today} />
    </div>
  );
}
