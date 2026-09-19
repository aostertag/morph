import type { LocalDay } from '@/domain/day';
import type { EvaluationContext } from '@/domain/evaluate';
import { buildHistory, type HabitHistory } from '@/domain/history';
import type { HabitAnalysis } from '@/domain/today';
import type { Entry, Habit, Pause, Settings } from '@/domain/types';
import { useEntriesByHabit, useHabits, usePauses, useSettings } from '@/hooks/useData';
import { cachedAnalysis } from '@/lib/analysisCache';

const EMPTY: readonly Entry[] = [];

export interface HabitDetail {
  readonly habit: Habit;
  readonly entries: readonly Entry[];
  readonly analysis: HabitAnalysis;
  readonly history: HabitHistory;
  readonly settings: Settings;
  readonly pauses: readonly Pause[];
}

export type HabitDetailState =
  | { readonly state: 'loading' }
  | { readonly state: 'missing' }
  | { readonly state: 'future'; readonly habit: Habit }
  | ({ readonly state: 'ready' } & HabitDetail);

/**
 * Datos del detalle: solo se leen los registros de ese hábito. El análisis sale
 * de la caché compartida con Hoy, así que abrir el detalle no recalcula nada.
 */
export function useHabitDetail(id: string, today: LocalDay): HabitDetailState {
  const habits = useHabits();
  const pauses = usePauses();
  const settings = useSettings();
  const habit = habits?.find((h) => h.id === id);
  const entries = useEntriesByHabit(habit ? [habit.id] : []);

  if (!habits || !pauses || !settings || !entries) return { state: 'loading' };
  if (!habit) return { state: 'missing' };
  if (habit.createdOn > today) return { state: 'future', habit };

  const ctx: EvaluationContext = { today, weekStartsOn: settings.weekStartsOn, pauses };
  const own = entries.get(habit.id) ?? EMPTY;
  const analysis = cachedAnalysis(habit, own, ctx);
  return {
    state: 'ready',
    habit,
    entries: own,
    analysis,
    history: buildHistory(analysis, today),
    settings,
    pauses,
  };
}
