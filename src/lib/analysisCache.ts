import type { LocalDay } from '@/domain/day';
import type { EvaluationContext } from '@/domain/evaluate';
import { buildHistory, type HabitHistory } from '@/domain/history';
import { analyzeHabit, type HabitAnalysis } from '@/domain/today';
import type { Entry, Habit } from '@/domain/types';

/*
 * Caché de análisis por (hábito, historial, contexto). Los objetos de hábito y los
 * arrays de registros conservan su identidad mientras no cambian, así que al marcar
 * un hábito solo se recalcula ese; los demás salen de la caché. La comparten la
 * pantalla Hoy y el detalle, que así no repite el trabajo al abrirse.
 */
const cache = new WeakMap<
  Habit,
  WeakMap<readonly Entry[], { key: string; analysis: HabitAnalysis }>
>();

export function contextKey(ctx: EvaluationContext): string {
  const pauses = ctx.pauses.map((p) => `${p.id}:${p.habitId}:${p.start}:${p.end}`).join(',');
  return `${ctx.today}|${ctx.weekStartsOn}|${pauses}`;
}

export function cachedAnalysis(
  habit: Habit,
  entries: readonly Entry[],
  ctx: EvaluationContext,
  key: string = contextKey(ctx),
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

/*
 * Historias día a día, cacheadas por identidad del análisis. Las estadísticas
 * globales necesitan la historia de todos los hábitos a la vez; sin esto se
 * reconstruirían enteras en cada render.
 */
const histories = new WeakMap<HabitAnalysis, { today: LocalDay; history: HabitHistory }>();

export function cachedHistory(analysis: HabitAnalysis, today: LocalDay): HabitHistory {
  const hit = histories.get(analysis);
  if (hit && hit.today === today) return hit.history;
  const history = buildHistory(analysis, today);
  histories.set(analysis, { today, history });
  return history;
}
