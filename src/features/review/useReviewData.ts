import type { LocalDay } from '@/domain/day';
import type { HabitHistory } from '@/domain/history';
import type { HabitAnalysis } from '@/domain/today';
import type { DayLog, Settings, WeeklyReview } from '@/domain/types';
import { useHabitAnalyses } from '@/features/today/useHabitAnalyses';
import { useDayLogs, useReviews } from '@/hooks/useData';
import { cachedHistory } from '@/lib/analysisCache';

export interface ReviewData {
  readonly settings: Settings;
  /** Historia día a día de todos los hábitos que ya existían hoy. */
  readonly histories: readonly HabitHistory[];
  /** Los análisis, para leer las rachas a fecha de hoy. */
  readonly analyses: readonly HabitAnalysis[];
  readonly dayLogs: readonly DayLog[];
  /** Reflexiones escritas, de la más reciente a la más antigua. */
  readonly reviews: readonly WeeklyReview[];
  readonly hasHabits: boolean;
}

/**
 * Datos de la revisión semanal. Como las estadísticas, reutiliza los análisis de
 * la caché compartida: abrir esta pantalla no recalcula ningún historial.
 */
export function useReviewData(today: LocalDay): ReviewData | undefined {
  const data = useHabitAnalyses(today);
  const dayLogs = useDayLogs();
  const reviews = useReviews();

  if (!data || !dayLogs || !reviews) return undefined;
  return {
    settings: data.settings,
    histories: data.analyses.map((analysis) => cachedHistory(analysis, today)),
    analyses: data.analyses,
    dayLogs,
    reviews,
    hasHabits: data.hasHabits,
  };
}
