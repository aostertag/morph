import { useSearchParams } from 'react-router';
import { addDays, isLocalDay, type LocalDay } from '@/domain/day';
import { canLogOn } from '@/domain/evaluate';
import { dayProgress, groupByTimeOfDay, viewForDay } from '@/domain/today';
import { ReviewPrompt } from '@/features/review/ReviewPrompt';
import { useDayLog, useReviews } from '@/hooks/useData';
import { useToday } from '@/hooks/useToday';
import { formatRelativeDay, TIME_OF_DAY_LABEL } from '@/lib/format';
import { ButtonLink } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { DayHeader } from './DayHeader';
import { DayLogPanel } from './DayLogPanel';
import { DayProgress } from './DayProgress';
import { HabitRow } from './HabitRow';
import { SidePanel } from './SidePanel';
import { useHabitAnalyses } from './useHabitAnalyses';

/** Día seleccionado en la URL (`?dia=YYYY-MM-DD`); hoy si falta o no es válido. */
function useSelectedDay(today: LocalDay): [LocalDay, (day: LocalDay) => void] {
  const [params, setParams] = useSearchParams();
  const requested = params.get('dia');
  const day = requested && isLocalDay(requested) && requested <= today ? requested : today;
  const select = (next: LocalDay) => {
    setParams(next === today ? {} : { dia: next }, { replace: true });
  };
  return [day, select];
}

export function TodayScreen() {
  const today = useToday();
  const [day, setDay] = useSelectedDay(today);
  const data = useHabitAnalyses(today);
  const log = useDayLog(day);
  const reviews = useReviews();

  if (!data) return null;

  const { analyses, settings, hasHabits } = data;
  const views = analyses.map((a) => viewForDay(a, day)).filter((v) => v.scheduled);
  const progress = dayProgress(views);
  const groups = groupByTimeOfDay(views);
  const tooOld = day < addDays(today, -settings.retroLimitDays);

  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,var(--container-list))_var(--container-panel)] lg:justify-between">
      <div className="min-w-0">
        <DayHeader day={day} today={today} onChange={setDay} />

        {day === today && hasHabits && reviews && (
          <ReviewPrompt analyses={analyses} settings={settings} reviews={reviews} today={today} />
        )}

        {tooOld && (
          <p className="mt-4 border-y border-border py-3 text-md text-text-muted">
            Solo se puede registrar hasta {settings.retroLimitDays}{' '}
            {settings.retroLimitDays === 1 ? 'día' : 'días'} atrás. Este día es de solo lectura.
          </p>
        )}

        {!hasHabits ? (
          <div className="mt-8">
            <EmptyState
              title="Todavía no hay hábitos."
              text="Crea el primero o empieza desde una plantilla."
              actions={
                <ButtonLink to="/habitos/nuevo?volver=hoy" variant="primary">
                  Crear hábito
                </ButtonLink>
              }
            />
          </div>
        ) : views.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              title={`Nada programado para ${day === today ? 'hoy' : formatRelativeDay(day, today).toLowerCase()}.`}
              text="Los hábitos de días concretos solo aparecen los días que tocan."
            />
          </div>
        ) : (
          <>
            <DayProgress progress={progress} views={views} />
            {groups.map((group) => {
              const counted = group.items.filter((v) => v.countsForProgress);
              const done = counted.filter((v) => v.doneForProgress).length;
              const headingId = `grupo-${group.timeOfDay}`;
              return (
                <section key={group.timeOfDay} aria-labelledby={headingId} className="mt-10">
                  <h2
                    id={headingId}
                    className="label-caps flex justify-between border-b border-border pb-2"
                  >
                    <span>{TIME_OF_DAY_LABEL[group.timeOfDay]}</span>
                    {counted.length > 0 && (
                      <span>
                        {done}/{counted.length}
                      </span>
                    )}
                  </h2>
                  <ul>
                    {group.items.map((view) => (
                      <HabitRow
                        key={view.habit.id}
                        view={view}
                        today={today}
                        locked={canLogOn(view.habit, day, today, settings.retroLimitDays) !== 'ok'}
                      />
                    ))}
                  </ul>
                </section>
              );
            })}
          </>
        )}

        {hasHabits && (
          <DayLogPanel day={day} today={today} log={log ?? undefined} locked={tooOld} />
        )}
      </div>

      {hasHabits && (
        <div className="hidden lg:block">
          <SidePanel analyses={analyses} day={day} today={today} onSelectDay={setDay} />
        </div>
      )}
    </div>
  );
}
