import type { HabitDayView, DayProgress as Progress } from '@/domain/today';
import { formatPercent } from '@/lib/format';
import { habitColorVar } from '@/ui/HabitMarks';

/** Cifra grande del día y barra segmentada: un segmento por hábito que cuenta. */
export function DayProgress({
  progress,
  views,
}: {
  progress: Progress;
  views: readonly HabitDayView[];
}) {
  const counted = views.filter((v) => v.countsForProgress);
  if (progress.total === 0) return null;

  return (
    <section aria-label="Progreso del día" className="mt-8">
      <div className="flex items-end justify-between gap-6">
        <p className="text-4xl font-semibold">{formatPercent(progress.ratio)}</p>
        <p className="pb-1 text-right text-md text-text-muted">
          <span className="block text-lg font-medium text-text">
            {progress.done} de {progress.total}
          </span>
          {progress.complete ? 'Día completo.' : 'hábitos hechos'}
        </p>
      </div>
      <div
        role="progressbar"
        aria-label="Hábitos hechos"
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-valuenow={progress.done}
        aria-valuetext={`${progress.done} de ${progress.total}`}
        className="mt-3 flex h-1 gap-0.5"
      >
        {counted.map((view) => (
          <span
            key={view.habit.id}
            className="flex-1 transition-[background-color] duration-(--duration-base) ease-(--ease-out)"
            style={{
              backgroundColor: view.doneForProgress
                ? habitColorVar(view.habit.color)
                : 'var(--color-sunken)',
            }}
          />
        ))}
      </div>
    </section>
  );
}
