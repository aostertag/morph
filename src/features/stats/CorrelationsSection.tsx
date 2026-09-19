import { type CorrelationReport, MIN_GROUP_DAYS } from '@/domain/correlation';
import { formatNumber, formatPercent } from '@/lib/format';
import {
  CORRELATION_CAVEAT,
  describeComparisons,
  describeCorrelation,
  describeSample,
} from './describe';

function whyNothing(report: CorrelationReport, hasPairs: boolean): string {
  if (report.compared === 0) {
    return hasPairs
      ? 'Todavía no hay días suficientes para comparar nada.'
      : 'Aquí aparecerán las relaciones entre tus hábitos y con tu ánimo y energía, cuando haya días suficientes.';
  }
  if (report.tested === 0) {
    return `Ninguna pareja llega a ${MIN_GROUP_DAYS} días en cada grupo, que es el mínimo para decir algo.`;
  }
  return 'Ninguna diferencia es lo bastante grande ni lo bastante firme como para afirmarla.';
}

/**
 * Correlaciones. Solo aparece lo que pasa los tres filtros (muestra, tamaño y
 * margen de confianza); de lo demás se da el recuento, sin insinuar nada.
 */
export function CorrelationsSection({
  report,
  hasPairs,
  moodPending,
}: {
  report: CorrelationReport;
  /** Hay al menos dos hábitos con historia o registros de ánimo. */
  hasPairs: boolean;
  /** No hay ningún registro de ánimo o energía en el período. */
  moodPending: boolean;
}) {
  return (
    <section aria-labelledby="correlaciones" className="mt-12">
      <h2 id="correlaciones" className="label-caps mb-3 border-b border-border pb-2">
        Correlaciones
      </h2>

      {report.findings.length === 0 ? (
        <p className="max-w-prose text-md text-text-muted">{whyNothing(report, hasPairs)}</p>
      ) : (
        <ul className="flex flex-col gap-5">
          {report.findings.map((correlation) => (
            <li
              key={`${correlation.kind}-${correlation.source.id}-${correlation.target?.id ?? ''}-${correlation.lag}`}
            >
              <p className="max-w-prose text-base">{describeCorrelation(correlation)}</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-muted">
                <span className="label-caps">
                  {correlation.lag === 1 ? 'Día siguiente' : 'Mismo día'}
                </span>
                <span>{describeSample(correlation)}</span>
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 flex flex-col gap-1 border-t border-border pt-3 text-sm text-text-muted">
        <p>{describeComparisons(report)}</p>
        {report.tested > 0 && (
          <p>
            Cada comparación se exige al {formatPercent(report.confidence)} de confianza, más
            estricto de lo normal porque se miran muchas parejas a la vez.
          </p>
        )}
        {moodPending && (
          <p>
            Sin ánimo ni energía registrados en el período solo se comparan los hábitos entre sí. Se
            anotan en Hoy, en un momento.
          </p>
        )}
        {!moodPending && report.scaleDays > 0 && (
          <p>
            {formatNumber(report.scaleDays)}{' '}
            {report.scaleDays === 1 ? 'día con ánimo o energía' : 'días con ánimo o energía'}{' '}
            registrados en el período.
          </p>
        )}
        <p>{CORRELATION_CAVEAT}</p>
      </div>
    </section>
  );
}
