import type { LocalDay } from '@/domain/day';
import type { HabitHistory } from '@/domain/history';
import type { DayLog, Settings } from '@/domain/types';
import { useHabitAnalyses } from '@/features/today/useHabitAnalyses';
import { useDayLogs } from '@/hooks/useData';
import { cachedHistory } from '@/lib/analysisCache';

export interface StatsData {
  readonly settings: Settings;
  /** Historia día a día de todos los hábitos que ya existían hoy. */
  readonly histories: readonly HabitHistory[];
  readonly dayLogs: readonly DayLog[];
  readonly hasHabits: boolean;
}

/**
 * Datos de las estadísticas globales. Reutiliza los análisis que ya tiene Hoy en
 * la caché compartida, así que abrir esta pantalla no recalcula el historial.
 */
export function useStats(today: LocalDay): StatsData | undefined {
  const data = useHabitAnalyses(today);
  const dayLogs = useDayLogs();

  if (!data || !dayLogs) return undefined;
  return {
    settings: data.settings,
    histories: data.analyses.map((analysis) => cachedHistory(analysis, today)),
    dayLogs,
    hasHabits: data.hasHabits,
  };
}
