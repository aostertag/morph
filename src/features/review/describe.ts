import type { WeekSummary } from '@/domain/review';
import type { HabitRate } from '@/domain/stats';
import { formatNumber, formatPercent, formatScaleValue } from '@/lib/format';

/*
 * El texto de la revisión. Cada frase lleva su muestra y ninguna felicita ni
 * regaña: se dice lo que pasó y con cuántos días se ha medido.
 */

/** "5 de 7 días" — la muestra sobre la que se ha medido un hábito. */
export function describeSample(entry: HabitRate): string {
  const { rate } = entry;
  return `${formatNumber(rate.doneDays)} de ${formatNumber(rate.days)} ${
    rate.days === 1 ? 'día' : 'días'
  }`;
}

/** "Leer, el más constante: 100 % (7 de 7 días)." */
export function describeBest(entry: HabitRate): string {
  const ratio = entry.rate.ratio ?? 0;
  return `${entry.habit.name}, el más constante: ${formatPercent(ratio)} (${describeSample(entry)}).`;
}

/** "Correr fue el que más costó: 29 % (2 de 7 días)." */
export function describeHardest(entry: HabitRate): string {
  const ratio = entry.rate.ratio ?? 0;
  return `${entry.habit.name} fue el que más costó: ${formatPercent(ratio)} (${describeSample(entry)}).`;
}

/**
 * "Ánimo 3,5 y energía 4,0 de media, sobre 4 días registrados."
 * `null` si esa semana no se registró ninguno: no hay nada que promediar.
 */
export function describeMood(summary: WeekSummary): string | null {
  const { mood, energy, loggedDays } = summary;
  if (mood === null && energy === null) return null;

  const parts: string[] = [];
  if (mood !== null) parts.push(`ánimo ${formatScaleValue(mood)}`);
  if (energy !== null) parts.push(`energía ${formatScaleValue(energy)}`);
  const days = `${formatNumber(loggedDays)} ${loggedDays === 1 ? 'día registrado' : 'días registrados'}`;
  return `${parts.join(' y ')} de media, sobre ${days}.`;
}
