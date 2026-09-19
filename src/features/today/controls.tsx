import { Check, Minus, Play, Plus, Square } from 'lucide-react';
import { type KeyboardEvent, useRef, useState } from 'react';
import { quantityStep } from '@/domain/habit';
import type { HabitDayView } from '@/domain/today';
import { useNow } from '@/hooks/useToday';
import { cx } from '@/lib/cx';
import { formatElapsed, formatNumber } from '@/lib/format';
import type { RunningTimer } from '@/state/timer';
import { IconButton } from '@/ui/Button';
import { habitColorVar } from '@/ui/HabitMarks';

/* Controles de registro de cada tipo de hábito. Sin lógica de datos: reciben callbacks. */

export function DoneCheckbox({
  view,
  disabled,
  onToggle,
}: {
  view: HabitDayView;
  disabled: boolean;
  onToggle: () => void;
}) {
  const done = view.value > 0;
  return (
    <label
      className={cx(
        'pressable flex size-touch shrink-0 cursor-pointer items-center justify-center rounded-md',
        'has-focus-visible:outline-2 has-focus-visible:outline-accent',
        'has-disabled:cursor-not-allowed has-disabled:opacity-50',
      )}
    >
      <input
        type="checkbox"
        checked={done}
        disabled={disabled}
        onChange={onToggle}
        className="sr-only"
      />
      <span className="sr-only">{view.habit.name}</span>
      <span
        aria-hidden="true"
        className={cx(
          'flex size-7 items-center justify-center rounded-sm border-2 text-on-habit',
          'transition-[background-color,border-color] duration-(--duration-fast) ease-(--ease-out)',
          done ? 'border-transparent' : 'border-border-strong',
        )}
        style={done ? { backgroundColor: habitColorVar(view.habit.color) } : undefined}
      >
        {done && <Check size={18} strokeWidth={2.5} />}
      </span>
    </label>
  );
}

/**
 * Valor editable: muestra "5/8" y al pulsarlo se convierte en un campo numérico.
 * Intro o salir del campo guarda; Escape cancela.
 */
function ValueEditor({
  value,
  target,
  met,
  color,
  label,
  disabled,
  onCommit,
}: {
  value: number;
  target: number | null;
  met: boolean;
  color: string;
  label: string;
  disabled: boolean;
  onCommit: (value: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const cancelled = useRef(false);

  const commit = () => {
    setEditing(false);
    if (cancelled.current) return;
    const parsed = Number(draft.replace(',', '.'));
    if (Number.isFinite(parsed) && parsed >= 0 && parsed !== value)
      onCommit(Math.min(parsed, 1_000_000));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') event.currentTarget.blur();
    if (event.key === 'Escape') {
      cancelled.current = true;
      event.currentTarget.blur();
    }
  };

  if (editing) {
    return (
      <input
        type="text"
        inputMode="decimal"
        aria-label={label}
        // biome-ignore lint/a11y/noAutofocus: el campo aparece por petición explícita del usuario
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
        onFocus={(e) => e.currentTarget.select()}
        className="h-9 w-20 rounded-md border border-border-strong bg-surface px-2 text-right text-base"
      />
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={`${label}: ${formatNumber(value)}${target === null ? '' : ` de ${formatNumber(target)}`}. Editar`}
      onClick={() => {
        cancelled.current = false;
        setDraft(String(value));
        setEditing(true);
      }}
      className="min-h-touch min-w-16 rounded-md px-1 text-right text-md hover:bg-sunken disabled:cursor-not-allowed disabled:hover:bg-transparent"
    >
      <span className="font-medium" style={met ? { color } : undefined}>
        {formatNumber(value)}
      </span>
      {target !== null && <span className="text-text-muted">/{formatNumber(target)}</span>}
    </button>
  );
}

export function QuantityControl({
  view,
  disabled,
  onAdjust,
  onSet,
}: {
  view: HabitDayView;
  disabled: boolean;
  onAdjust: (delta: number) => void;
  onSet: (value: number) => void;
}) {
  const { habit } = view;
  const step = quantityStep(habit.target);
  const unit = habit.unit ?? '';
  return (
    <div className="flex items-center">
      <IconButton
        label={`Restar ${formatNumber(step)} ${unit} a ${habit.name}`}
        icon={<Minus size={18} aria-hidden="true" />}
        disabled={disabled || view.value <= 0}
        onClick={() => onAdjust(-step)}
      />
      <ValueEditor
        value={view.value}
        target={habit.target}
        met={view.success}
        color={habitColorVar(habit.color)}
        label={`${habit.name} (${unit})`}
        disabled={disabled}
        onCommit={onSet}
      />
      <IconButton
        label={`Sumar ${formatNumber(step)} ${unit} a ${habit.name}`}
        icon={<Plus size={18} aria-hidden="true" />}
        disabled={disabled}
        onClick={() => onAdjust(step)}
      />
    </div>
  );
}

export function TimeControl({
  view,
  disabled,
  canTime,
  timer,
  onStart,
  onStop,
  onSet,
}: {
  view: HabitDayView;
  disabled: boolean;
  /** El cronómetro solo se ofrece para hoy. */
  canTime: boolean;
  timer: RunningTimer | undefined;
  onStart: () => void;
  onStop: () => void;
  onSet: (minutes: number) => void;
}) {
  const { habit } = view;
  const now = useNow(1000, timer !== undefined);

  if (timer) {
    return (
      <div className="flex items-center gap-1">
        <span
          className="flex items-center gap-2 px-1 text-md font-medium"
          role="timer"
          aria-live="off"
        >
          <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
          {formatElapsed(now - timer.startedAt)}
        </span>
        <IconButton
          label={`Detener el cronómetro de ${habit.name}`}
          icon={<Square size={16} aria-hidden="true" />}
          onClick={onStop}
          className="text-accent"
        />
      </div>
    );
  }

  return (
    <div className="flex items-center">
      <ValueEditor
        value={view.value}
        target={habit.target}
        met={view.success}
        color={habitColorVar(habit.color)}
        label={`${habit.name} (minutos)`}
        disabled={disabled}
        onCommit={onSet}
      />
      <span className="pr-1 pl-0.5 text-sm text-text-muted">min</span>
      {canTime && (
        <IconButton
          label={`Iniciar el cronómetro de ${habit.name}`}
          icon={<Play size={18} aria-hidden="true" />}
          disabled={disabled}
          onClick={onStart}
        />
      )}
    </div>
  );
}

export function RelapseToggle({
  view,
  disabled,
  onToggle,
}: {
  view: HabitDayView;
  disabled: boolean;
  onToggle: () => void;
}) {
  const relapsed = view.value > 0;
  return (
    <button
      type="button"
      aria-pressed={relapsed}
      aria-label={
        relapsed
          ? `Quitar la recaída de ${view.habit.name}`
          : `Registrar una recaída en ${view.habit.name}`
      }
      disabled={disabled}
      onClick={onToggle}
      className={cx(
        'pressable min-h-touch rounded-md border px-3 text-md',
        'transition-[background-color,border-color,color,transform] duration-(--duration-fast)',
        'disabled:cursor-not-allowed disabled:opacity-50',
        relapsed
          ? 'border-danger font-medium text-danger'
          : 'border-border-strong text-text-muted hover:bg-sunken hover:text-text',
      )}
    >
      Recaída
    </button>
  );
}
