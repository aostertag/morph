import { Check } from 'lucide-react';
import type { HabitHistory } from '@/domain/history';
import { type Milestone, milestones } from '@/domain/milestones';
import type { StreakSummary } from '@/domain/streaks';
import { formatNumber, formatShortDate } from '@/lib/format';
import { describeMilestone } from './describe';

/** Lo que falta para el siguiente hito, en texto y en una barra fina. */
function Pending({ milestone, label }: { milestone: Milestone; label: string }) {
  const ratio = Math.min(milestone.progress / milestone.threshold, 1);
  return (
    <li className="border-b border-border py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <p className="text-md text-text-muted">{label}</p>
        <p className="text-sm text-text-muted">
          {formatNumber(milestone.progress)} de {formatNumber(milestone.threshold)}
        </p>
      </div>
      <span aria-hidden="true" className="mt-2 block h-0.5 w-full bg-border">
        <span className="block h-full bg-text" style={{ width: `${ratio * 100}%` }} />
      </span>
    </li>
  );
}

/**
 * Hitos del hábito. Se derivan de la historia, así que un registro retroactivo
 * los recoloca solo; no hay nada guardado que pueda quedarse mintiendo.
 */
export function MilestonesSection({
  history,
  streak,
}: {
  history: HabitHistory;
  streak: StreakSummary;
}) {
  const { achieved, next, unit } = milestones(history, streak);
  if (achieved.length === 0 && next.length === 0) return null;

  const label = (milestone: Milestone) => describeMilestone(milestone, unit, history.habit.kind);

  return (
    <section className="mt-12" aria-labelledby="hitos">
      <h2 id="hitos" className="label-caps mb-3 border-b border-border pb-2">
        Hitos
      </h2>
      <ol>
        {achieved.map((milestone) => (
          <li
            key={`${milestone.kind}-${milestone.threshold}`}
            className="flex flex-wrap items-baseline justify-between gap-x-4 border-b border-border py-3"
          >
            <p className="flex items-baseline gap-2 text-md">
              <Check size={16} aria-hidden="true" className="shrink-0 self-center" />
              {label(milestone)}
            </p>
            <p className="text-sm text-text-muted">
              {milestone.achievedOn && formatShortDate(milestone.achievedOn)}
            </p>
          </li>
        ))}
        {next.map((milestone) => (
          <Pending
            key={`${milestone.kind}-${milestone.threshold}`}
            milestone={milestone}
            label={label(milestone)}
          />
        ))}
      </ol>
      {achieved.length === 0 && (
        <p className="mt-3 text-sm text-text-muted">
          Todavía no hay ninguno alcanzado; arriba está lo que falta para el primero.
        </p>
      )}
    </section>
  );
}
