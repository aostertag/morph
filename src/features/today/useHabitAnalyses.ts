import type { LocalDay } from '@/domain/day';
import type { EvaluationContext } from '@/domain/evaluate';
import { analyzeHabit, type HabitAnalysis } from '@/domain/today';
import type { Entry, Habit, Pause, Settings } from '@/domain/types';
import { useEntriesByHabit, useHabits, usePauses, useSettings } from '@/hooks/useData';

/*
 * Caché de análisis por (hábito, historial, contexto). Los objetos de hábito y los
 * arrays de registros conservan su identidad mientras no cambian, así que al marcar
 * un hábito solo se recalcula ese; los demás salen de la caché.
 */
const cache = new WeakMap<
  Habit,
  WeakMap<readonly Entry[], { key: string; analysis: HabitAnalysis }>
>();

const EMPTY: readonly Entry[] = [];

function contextKey(ctx: EvaluationContext): string {
  const pauses = ctx.pauses.map((p) => `${p.id}:${p.habitId}:${p.start}:${p.end}`).join(',');
  return `${ctx.today}|${ctx.weekStartsOn}|${pauses}`;
}

function cachedAnalysis(
  habit: Habit,
  entries: readonly Entry[],
  ctx: EvaluationContext,
  key: string,
): HabitAnalysis {
  let byEntries = cache.get(habit);
  if (!byEntries) {
    byEntries = new WeakMap();
    cache.set(habit, byEntries);
  }
  const hit = byEntries.get(entries);
  if (hit && hit.key === key) return hit.analysis;
  const analysis = analyzeHabit(habit, entries, ctx);
  byEntries.set(entries, { key, analysis });
  return analysis;
}

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
