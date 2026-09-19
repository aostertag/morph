import { Link } from 'react-router';
import type { LocalDay } from '@/domain/day';
import type { HabitDayView } from '@/domain/today';
import { useTimerStore } from '@/state/timer';
import { ColorBar, HabitIcon } from '@/ui/HabitMarks';
import { adjustValue, setValue, startTimer, stopTimer, toggleDone, toggleRelapse } from './actions';
import { DoneCheckbox, QuantityControl, RelapseToggle, TimeControl } from './controls';
import { describeRowContext } from './describe';

interface HabitRowProps {
  readonly view: HabitDayView;
  readonly today: LocalDay;
  /** Registro bloqueado (fuera del límite retroactivo, archivado…). */
  readonly locked: boolean;
  /** Vista previa del formulario: sin enlace ni acciones reales. */
  readonly preview?: boolean;
}

function RowControl({ view, today, locked }: HabitRowProps) {
  const timer = useTimerStore((state) => state.running[view.habit.id]);
  switch (view.habit.kind) {
    case 'boolean':
      return (
        <DoneCheckbox view={view} disabled={locked} onToggle={() => toggleDone(view, today)} />
      );
    case 'quantity':
      return (
        <QuantityControl
          view={view}
          disabled={locked}
          onAdjust={(delta) => adjustValue(view, delta, today)}
          onSet={(value) => setValue(view, value, today)}
        />
      );
    case 'time':
      return (
        <TimeControl
          view={view}
          disabled={locked}
          canTime={view.day === today}
          timer={timer}
          onStart={() => startTimer(view)}
          onStop={() => stopTimer(view, today)}
          onSet={(minutes) => setValue(view, minutes, today)}
        />
      );
    case 'avoid':
      return (
        <RelapseToggle view={view} disabled={locked} onToggle={() => toggleRelapse(view, today)} />
      );
  }
}

export function HabitRow(props: HabitRowProps) {
  const { view, today, preview = false } = props;
  const { habit } = view;
  return (
    <li className="flex min-h-14 items-stretch gap-3 border-b border-border">
      <ColorBar color={habit.color} />
      <div className="flex min-w-0 flex-1 flex-col justify-center py-2">
        <div className="flex min-w-0 items-center gap-2">
          <HabitIcon name={habit.icon} />
          {preview ? (
            <span className="truncate">{habit.name || 'Sin nombre'}</span>
          ) : (
            <Link
              to={`/habitos/${habit.id}`}
              className="truncate underline-offset-4 hover:underline"
            >
              {habit.name}
            </Link>
          )}
        </div>
        <p className="truncate text-sm text-text-muted">{describeRowContext(view, today)}</p>
      </div>
      <div className="flex shrink-0 items-center" inert={preview}>
        <RowControl {...props} />
      </div>
    </li>
  );
}
