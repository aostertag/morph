import type { LocalDay } from '@/domain/day';
import type { EvaluationContext } from '@/domain/evaluate';
import type { HabitAnalysis } from '@/domain/today';
import type { Entry, Pause, Settings } from '@/domain/types';
import { useEntriesByHabit, useHabits, usePauses, useSettings } from '@/hooks/useData';
import { cachedAnalysis, contextKey } from '@/lib/analysisCache';

const EMPTY: readonly Entry[] = [];

export interface HabitAnalyses {
  readonly settings: Settings;
  readonly pauses: readonly Pause[];
  readonly ctx: EvaluationContext;
  /** Hábitos creados hasta hoy, en el orden del usuario, con su historial evaluado. */
  readonly analyses: readonly HabitAnalysis[];
  /** Hay al menos un hábito (activo o archivado). */
  readonly hasHabits: boolean;
}

export function useHabitAnalyses(today: LocalDay): HabitAnalyses | undefined {
  const habits = useHabits();
  const pauses = usePauses();
  const settings = useSettings();
  const relevant = (habits ?? []).filter((h) => h.createdOn <= today);
  const entries = useEntriesByHabit(relevant.map((h) => h.id));

  if (!habits || !pauses || !settings || !entries) return undefined;

  const ctx: EvaluationContext = { today, weekStartsOn: settings.weekStartsOn, pauses };
  const key = contextKey(ctx);
  return {
    settings,
    pauses,
    ctx,
    analyses: relevant.map((h) => cachedAnalysis(h, entries.get(h.id) ?? EMPTY, ctx, key)),
    hasHabits: habits.length > 0,
  };
}
