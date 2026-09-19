import type { Correlation, CorrelationReport } from '@/domain/correlation';
import type { Habit } from '@/domain/types';
import { formatNumber, formatPercent, formatScaleValue } from '@/lib/format';

/*
 * El texto de las correlaciones. Cada frase lleva dentro su muestra y ninguna
 * usa verbos de causa ("mejora", "hace que", "gracias a"): lo que se ha medido
 * es que dos cosas van juntas, y eso es lo que se dice.
 */

export const CORRELATION_CAVEAT =
  'Esto es correlación, no causa: dos cosas pueden ir juntas por una tercera razón, o por casualidad.';

/** "Los días que cumples Ejercicio" / "Los días después de recaer en Redes". */
function subject(habit: Habit, lag: 0 | 1): string {
  const avoid = habit.kind === 'avoid';
  if (lag === 1) {
    return avoid
      ? `Los días después de recaer en ${habit.name}`
      : `Los días después de cumplir ${habit.name}`;
  }
  return avoid ? `Los días que recaes en ${habit.name}` : `Los días que cumples ${habit.name}`;
}

function rest(lag: 0 | 1): string {
  return lag === 1 ? 'los demás' : 'los demás días';
}

export function describeCorrelation(correlation: Correlation): string {
  const head = subject(correlation.source, correlation.lag);

  if (correlation.kind === 'habit') {
    const target = correlation.target;
    if (!target) return head;
    const verb = target.kind === 'avoid' ? 'recaes en' : 'cumples';
    return `${head}, ${verb} ${target.name} el ${formatPercent(correlation.withValue)}; ${rest(
      correlation.lag,
    )}, el ${formatPercent(correlation.withoutValue)}.`;
  }

  const measure = correlation.kind === 'mood' ? 'tu ánimo medio es' : 'tu energía media es';
  return `${head}, ${measure} ${formatScaleValue(correlation.withValue)}; ${rest(
    correlation.lag,
  )}, ${formatScaleValue(correlation.withoutValue)}.`;
}

/** La muestra siempre acompaña a la frase: sin ella, la frase no vale nada. */
export function describeSample(correlation: Correlation): string {
  const yes = `${formatNumber(correlation.withDays)} días que sí`;
  const no = `${formatNumber(correlation.withoutDays)} que no`;
  return `Muestra: ${yes} y ${no}.`;
}

/** Recuento honesto de lo que se miró y de lo que se descartó. */
export function describeComparisons(report: CorrelationReport): string {
  if (report.compared === 0) return 'No hay parejas que comparar todavía.';
  const compared =
    report.compared === 1
      ? 'Se examinó 1 comparación'
      : `Se examinaron ${formatNumber(report.compared)} comparaciones`;
  const tested =
    report.tested === 1
      ? '1 tenía muestra suficiente'
      : `${formatNumber(report.tested)} tenían muestra suficiente`;
  const found =
    report.qualified === 1
      ? '1 muestra una diferencia clara'
      : `${formatNumber(report.qualified)} muestran una diferencia clara`;
  const shown =
    report.findings.length < report.qualified
      ? report.findings.length === 1
        ? ' Aquí solo va la más marcada, una por pareja.'
        : ` Aquí van las ${formatNumber(report.findings.length)} más marcadas, una por pareja.`
      : '';
  return `${compared}; ${tested} y ${found}.${shown}`;
}
