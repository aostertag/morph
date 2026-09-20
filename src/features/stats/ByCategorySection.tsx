import type { RangePreset } from '@/domain/range';
import type { CategoryBreakdown, CategoryGroup } from '@/domain/stats';
import { cx } from '@/lib/cx';
import { formatNumber, formatPercent, formatPoints } from '@/lib/format';
import { BAR_TABLE, BarTableColumns, FIGURE_CELL } from './barTable';
import { previousPeriodLabel } from './describe';

function habitsLabel(count: number): string {
  return `${formatNumber(count)} ${count === 1 ? 'hábito' : 'hábitos'}`;
}

/** "3 hábitos · +8 puntos que el mes anterior"; sin comparación, solo los hábitos. */
function describeGroup(group: CategoryGroup, preset: RangePreset): string {
  const { current, delta } = group.comparison;
  const parts = [habitsLabel(current.habits)];
  if (delta !== null) {
    const same = Math.round(delta * 100) === 0;
    const label = previousPeriodLabel(preset);
    parts.push(same ? `igual que ${label}` : `${formatPoints(delta)} que ${label}`);
  }
  return parts.join(' · ');
}

function Row({
  group,
  preset,
  apart = false,
}: {
  group: CategoryGroup;
  preset: RangePreset;
  /** Separada de las filas de arriba por un hueco (los hábitos sin categoría). */
  apart?: boolean;
}) {
  const { current } = group.comparison;
  const ratio = current.ratio ?? 0;
  const uncategorized = group.category === null;
  // Mismas columnas que Consistencia (`barTable.ts`) para que las barras de las dos secciones
  // queden alineadas. La línea de hábitos y comparación va debajo, a todo el
  // ancho, para no estrechar el nombre en móvil.
  const top = apart ? 'pt-5' : 'pt-2';
  return (
    <>
      <tr>
        <th scope="row" className={cx('pr-3 text-left font-normal', top)}>
          <span className={uncategorized ? 'text-text-muted' : undefined}>
            {group.category?.name ?? 'Sin categoría'}
          </span>
        </th>
        <td className={top}>
          <span aria-hidden="true" className="relative block h-2 w-full bg-sunken">
            <span
              className="absolute inset-y-0 left-0 bg-text"
              style={{ width: `${ratio * 100}%` }}
            />
          </span>
        </td>
        <td className={cx(FIGURE_CELL, top)}>
          {formatPercent(ratio)}{' '}
          <span className="text-text-muted">({formatNumber(current.days)} d)</span>
        </td>
      </tr>
      <tr className="border-b border-border">
        <td colSpan={3} className="pb-2 text-sm text-text-muted">
          {describeGroup(group, preset)}
        </td>
      </tr>
    </>
  );
}

/**
 * Cumplimiento por categoría en el período, con la muestra de cada una. Las que no llegan
 * a una semana de días evaluables se apartan; los hábitos sin categoría van en una fila
 * aparte al final (no compiten en el orden) y los "a evitar" no cuentan, como en la
 * puntuación general.
 */
export function ByCategorySection({
  breakdown,
  preset,
}: {
  breakdown: CategoryBreakdown;
  preset: RangePreset;
}) {
  const { ranked, insufficient, uncategorized } = breakdown;

  return (
    <section aria-labelledby="por-categoria" className="mt-12">
      <h2 id="por-categoria" className="label-caps mb-3 border-b border-border pb-2">
        Por categoría
      </h2>

      {ranked.length === 0 && (
        <p className="text-md text-text-muted">
          Ninguna categoría llega a una semana de días evaluables en este período.
        </p>
      )}

      {(ranked.length > 0 || uncategorized) && (
        <table className={BAR_TABLE}>
          <caption className="sr-only">
            Tasa de cumplimiento de cada categoría en el período, con los días evaluables
          </caption>
          <BarTableColumns />
          <thead className="sr-only">
            <tr>
              <th scope="col">Categoría</th>
              <th scope="col">Proporción</th>
              <th scope="col">Cumplimiento</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((group) => (
              <Row key={group.category?.id} group={group} preset={preset} />
            ))}
            {uncategorized && (
              <Row group={uncategorized} preset={preset} apart={ranked.length > 0} />
            )}
          </tbody>
        </table>
      )}

      {insufficient.length > 0 && (
        <p className="mt-3 text-sm text-text-muted">
          Sin datos suficientes para ordenarlas:{' '}
          {insufficient
            .map(
              (group) =>
                `${group.category?.name ?? 'Sin categoría'} (${formatNumber(group.comparison.current.days)} d)`,
            )
            .join(', ')}
          .
        </p>
      )}
      <p className="mt-3 text-sm text-text-muted">
        Cada categoría se mide con los días evaluables de sus hábitos. Los hábitos a evitar van
        aparte.
      </p>
    </section>
  );
}
