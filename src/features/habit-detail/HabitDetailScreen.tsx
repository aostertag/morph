import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ChartFigure } from '@/charts/ChartFigure';
import type { LocalDay, Weekday } from '@/domain/day';
import { recordOn } from '@/domain/history';
import type { Habit } from '@/domain/types';
import { DeleteDialog } from '@/features/habits/DeleteDialog';
import { describeHabit } from '@/features/habits/describe';
import { archive, unarchive } from '@/features/habits/habitActions';
import { useCategories } from '@/hooks/useData';
import { useToday } from '@/hooks/useToday';
import { cx } from '@/lib/cx';
import { formatDate, HABIT_KIND_LABEL } from '@/lib/format';
import { ActionsMenu } from '@/ui/ActionsMenu';
import { ButtonLink } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ColorBar, HabitIcon } from '@/ui/HabitMarks';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { DayPanel } from './DayPanel';
import { Heatmap, MonthTable } from './Heatmap';
import { HistoryList } from './HistoryList';
import { availableYears, type HeatRange, rollingRange, yearRange } from './heatmapModel';
import { MilestonesSection } from './MilestonesSection';
import { Figures, RatesTable } from './Summary';
import { useHabitDetail } from './useHabitDetail';
import { ValueSection } from './ValueSection';
import { WeekdayTable } from './WeekdayTable';
import { WeeklyChart } from './WeeklyChart';

function Header({
  habit,
  today,
  weekStartsOn,
  categoryName,
  onDelete,
}: {
  habit: Habit;
  today: LocalDay;
  weekStartsOn: Weekday;
  categoryName: string | undefined;
  onDelete: () => void;
}) {
  return (
    <ScreenHeader
      title={habit.name}
      wrapTitle
      actionsBelowOnMobile
      eyebrow={HABIT_KIND_LABEL[habit.kind]}
      mark={
        <>
          <ColorBar color={habit.color} />
          {habit.icon && (
            <span className="mt-7 flex w-5 shrink-0 self-start">
              <HabitIcon name={habit.icon} size={20} />
            </span>
          )}
        </>
      }
      actions={
        <>
          <ButtonLink to={`/habitos/${habit.id}/editar`}>Editar</ButtonLink>
          <ActionsMenu
            label={`Acciones de ${habit.name}`}
            actions={[
              habit.archivedOn === null
                ? { label: 'Archivar', onSelect: () => void archive(habit, today) }
                : { label: 'Restaurar', onSelect: () => void unarchive(habit, today) },
              { label: 'Eliminar…', onSelect: onDelete, destructive: true },
            ]}
          />
        </>
      }
      below={
        (habit.description || habit.archivedOn) && (
          <>
            {habit.description && <p className="max-w-prose text-md">{habit.description}</p>}
            {habit.archivedOn && (
              <p className={cx('text-md text-text-muted', habit.description && 'mt-2')}>
                Archivado: cuenta hasta el {formatDate(habit.archivedOn, today)}.
              </p>
            )}
          </>
        )
      }
    >
      <p className="text-md text-text-muted">
        {describeHabit(habit, weekStartsOn, categoryName, { showAvoid: false })} · desde el{' '}
        {formatDate(habit.createdOn, today)}
      </p>
    </ScreenHeader>
  );
}

export function HabitDetailScreen() {
  const { id = '' } = useParams();
  const today = useToday();
  const navigate = useNavigate();
  const detail = useHabitDetail(id, today);
  const categories = useCategories();
  const [selected, setSelected] = useState<LocalDay | null>(null);
  const [year, setYear] = useState<number | 'rolling'>('rolling');
  const [toDelete, setToDelete] = useState<Habit | null>(null);

  if (detail.state === 'loading') return null;
  if (detail.state === 'missing') {
    return (
      <EmptyState
        standalone
        title="Este hábito no existe."
        text="Puede que lo hayas eliminado."
        actions={<ButtonLink to="/habitos">Ver hábitos</ButtonLink>}
      />
    );
  }

  if (detail.state === 'future') {
    return (
      <EmptyState
        standalone
        title="Este hábito empieza más adelante."
        text={`Empieza a contar el ${formatDate(detail.habit.createdOn, today)}; hasta entonces no hay historial.`}
        actions={<ButtonLink to={`/habitos/${detail.habit.id}/editar`}>Editar hábito</ButtonLink>}
      />
    );
  }

  const { habit, history, entries, analysis, settings, pauses } = detail;
  const { weekStartsOn } = settings;
  const years = availableYears(history);
  const range: HeatRange =
    year === 'rolling' ? rollingRange(today, weekStartsOn) : yearRange(year, today);
  const showYearPicker = years.length > 1;
  const selectedRecord = selected ? (recordOn(history, selected) ?? null) : null;
  const selectedNote = selected
    ? (entries.find((entry) => entry.date === selected)?.note ?? '')
    : '';
  const hasValues = habit.kind === 'quantity' || habit.kind === 'time';

  return (
    <div>
      <Header
        habit={habit}
        today={today}
        weekStartsOn={weekStartsOn}
        categoryName={categories?.find((c) => c.id === habit.categoryId)?.name}
        onDelete={() => setToDelete(habit)}
      />

      <Figures history={history} streak={analysis.streak} />

      <ChartFigure
        title="Calendario"
        tableLabel="Ver por meses"
        table={<MonthTable history={history} range={range} />}
        note="Elige un día para ver qué pasó y escribir una nota."
        controls={
          showYearPicker && (
            <label className="flex items-center gap-2 text-sm text-text-muted">
              <span className="sr-only">Período del calendario</span>
              <select
                value={String(year)}
                onChange={(event) =>
                  setYear(event.target.value === 'rolling' ? 'rolling' : Number(event.target.value))
                }
                className="min-h-8 rounded-md border border-border-strong bg-surface px-2 text-md text-text"
              >
                <option value="rolling">Últimos 12 meses</option>
                {years.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          )
        }
      >
        <Heatmap
          history={history}
          range={range}
          weekStartsOn={weekStartsOn}
          selected={selected}
          onSelect={setSelected}
        />
      </ChartFigure>

      {selected && (
        <DayPanel
          key={selected}
          habit={habit}
          record={selectedRecord}
          note={selectedNote}
          day={selected}
          today={today}
          retroLimitDays={settings.retroLimitDays}
        />
      )}

      <div className="lg:grid lg:grid-cols-2 lg:gap-x-12">
        <div className="min-w-0">
          <WeeklyChart history={history} weekStartsOn={weekStartsOn} />
          {hasValues && <ValueSection history={history} />}
        </div>
        <div className="min-w-0">
          <RatesTable history={history} />
          <MilestonesSection history={history} streak={analysis.streak} />
          <WeekdayTable history={history} weekStartsOn={weekStartsOn} />
          <HistoryList
            history={history}
            entries={entries}
            wildcardUses={analysis.streak.wildcardUses}
            pauses={pauses}
          />
        </div>
      </div>

      <DeleteDialog
        habit={toDelete}
        onClose={() => setToDelete(null)}
        onDeleted={() => navigate('/habitos')}
      />
    </div>
  );
}
