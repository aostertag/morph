import { Link } from 'react-router';
import type { AvoidSummary } from '@/domain/stats';
import { formatNumber } from '@/lib/format';
import { ColorBar } from '@/ui/HabitMarks';

function relapseText(count: number): string {
  return count === 1 ? '1 recaída' : `${formatNumber(count)} recaídas`;
}

function comparison(summary: AvoidSummary): string {
  if (summary.previousRelapses === null) return 'Sin período anterior con el que comparar.';
  const delta = summary.relapses - summary.previousRelapses;
  const before = `${relapseText(summary.previousRelapses)} antes`;
  if (delta === 0) return `Igual que el período anterior: ${before}.`;
  return `${delta > 0 ? 'Más' : 'Menos'} que el período anterior: ${before}.`;
}

/** Los hábitos a evitar no puntúan: se cuentan sus recaídas y sus días limpios. */
export function AvoidSection({ summaries }: { summaries: readonly AvoidSummary[] }) {
  if (summaries.length === 0) return null;

  return (
    <section aria-labelledby="a-evitar" className="mt-12">
      <h2 id="a-evitar" className="label-caps mb-3 border-b border-border pb-2">
        A evitar
      </h2>
      <ul>
        {summaries.map((summary) => (
          <li key={summary.habit.id} className="border-b border-border py-3">
            <div className="flex items-baseline gap-2">
              <ColorBar color={summary.habit.color} className="h-4 self-center" />
              <Link
                to={`/habitos/${summary.habit.id}`}
                className="min-w-0 flex-1 truncate rounded-sm text-md underline-offset-4 hover:underline"
              >
                {summary.habit.name}
              </Link>
              <span className="shrink-0 text-lg font-medium">{relapseText(summary.relapses)}</span>
            </div>
            <p className="mt-1 text-sm text-text-muted">
              {formatNumber(summary.cleanDays)}{' '}
              {summary.cleanDays === 1 ? 'día limpio' : 'días limpios'} en el período.{' '}
              {comparison(summary)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
