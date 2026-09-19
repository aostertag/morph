import type { LocalDay } from './day';
import type { EvaluatedUnit } from './evaluate';
import type { PeriodUnit } from './frequency';

/** Cada cuántas unidades de racha se gana un comodín. */
export const WILDCARD_EVERY = 7;
/** Máximo de comodines acumulados. */
export const WILDCARD_MAX = 2;

export interface WildcardUse {
  /** Unidad fallada que el comodín cubrió. */
  readonly start: LocalDay;
  readonly end: LocalDay;
}

export interface StreakRange {
  readonly start: LocalDay;
  readonly end: LocalDay;
  /** Unidades cumplidas en la racha (las cubiertas por comodín no suman). */
  readonly length: number;
}

export interface StreakSummary {
  readonly unit: PeriodUnit;
  readonly current: number;
  readonly best: number;
  /** Racha actual; `null` si es 0. */
  readonly currentRange: StreakRange | null;
  /** Mejor racha histórica (la más reciente si hay empate); `null` si nunca hubo. */
  readonly bestRange: StreakRange | null;
  readonly wildcardsAvailable: number;
  /** Todas las veces que un comodín cubrió una unidad fallada, en orden. */
  readonly wildcardUses: readonly WildcardUse[];
}

/**
 * Calcula rachas y comodines recorriendo las unidades en orden.
 *
 * Reglas:
 * - Una unidad cumplida suma 1. Al llegar a un múltiplo de 7 se gana un comodín (máx. 2).
 * - Una unidad fallada gasta un comodín si hay alguno: la racha sigue, sin sumar.
 *   Si no hay, la racha vuelve a 0.
 * - Las unidades en pausa y la unidad en curso sin cumplir no suman ni rompen.
 *
 * Los comodines se derivan de la historia, no se guardan: un registro retroactivo
 * recalcula todo de forma coherente.
 */
export function computeStreaks(unit: PeriodUnit, units: readonly EvaluatedUnit[]): StreakSummary {
  let current = 0;
  let currentStart: LocalDay | null = null;
  let currentEnd: LocalDay | null = null;
  let best: StreakRange | null = null;
  let wildcards = 0;
  const uses: WildcardUse[] = [];

  for (const u of units) {
    switch (u.status) {
      case 'paused':
      case 'pending':
        break;
      case 'done': {
        current++;
        currentStart ??= u.start;
        currentEnd = u.end;
        if (current % WILDCARD_EVERY === 0 && wildcards < WILDCARD_MAX) wildcards++;
        if (best === null || current >= best.length) {
          best = { start: currentStart, end: currentEnd, length: current };
        }
        break;
      }
      case 'missed': {
        if (wildcards > 0) {
          wildcards--;
          uses.push({ start: u.start, end: u.end });
          if (currentStart !== null) currentEnd = u.end;
        } else {
          current = 0;
          currentStart = null;
          currentEnd = null;
        }
        break;
      }
    }
  }

  return {
    unit,
    current,
    best: best?.length ?? 0,
    currentRange:
      current > 0 && currentStart !== null && currentEnd !== null
        ? { start: currentStart, end: currentEnd, length: current }
        : null,
    bestRange: best,
    wildcardsAvailable: wildcards,
    wildcardUses: uses,
  };
}
