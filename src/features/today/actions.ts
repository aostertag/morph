import {
  adjustEntryValue,
  restoreEntry,
  setEntryValue,
  toggleEntryValue,
} from '@/db/repos/entries';
import type { LocalDay } from '@/domain/day';
import type { HabitDayView } from '@/domain/today';
import { formatNumber, formatRelativeDay } from '@/lib/format';
import { notify, notifyError } from '@/lib/toast';
import { elapsedMinutes, type RunningTimer, useTimerStore } from '@/state/timer';

/*
 * Acciones de registro de la pantalla Hoy. Todas avisan con un toast que permite
 * deshacer; los toasts se agrupan por hábito y día para deshacer ráfagas enteras.
 */

function dayNote(day: LocalDay, today: LocalDay): string {
  return day === today ? '' : ` (${formatRelativeDay(day, today).toLowerCase()})`;
}

function entryKey(view: HabitDayView): string {
  return `entry:${view.habit.id}:${view.day}`;
}

async function run(action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (error) {
    notifyError(error);
  }
}

export function toggleDone(view: HabitDayView, today: LocalDay): Promise<void> {
  return run(async () => {
    const { habit, day } = view;
    const { previous, value } = await toggleEntryValue(habit.id, day);
    notify(`${habit.name}: ${value ? 'hecho' : 'desmarcado'}${dayNote(day, today)}`, {
      key: entryKey(view),
      undo: () => restoreEntry(habit.id, day, previous),
    });
  });
}

function quantityMessage(view: HabitDayView, value: number, today: LocalDay): string {
  const { habit } = view;
  const target = habit.target === null ? '' : ` de ${formatNumber(habit.target)}`;
  const unit = habit.unit ? ` ${habit.unit}` : '';
  return `${habit.name}: ${formatNumber(value)}${target}${unit}${dayNote(view.day, today)}`;
}

export function adjustValue(view: HabitDayView, delta: number, today: LocalDay): Promise<void> {
  return run(async () => {
    const { habit, day } = view;
    const snapshot = await adjustEntryValue(habit.id, day, delta);
    const value = Math.max(0, (snapshot?.value ?? 0) + delta);
    notify(quantityMessage(view, value, today), {
      key: entryKey(view),
      undo: () => restoreEntry(habit.id, day, snapshot),
    });
  });
}

export function setValue(view: HabitDayView, value: number, today: LocalDay): Promise<void> {
  return run(async () => {
    const { habit, day } = view;
    const snapshot = await setEntryValue(habit.id, day, value);
    notify(quantityMessage(view, value, today), {
      key: entryKey(view),
      undo: () => restoreEntry(habit.id, day, snapshot),
    });
  });
}

export function toggleRelapse(view: HabitDayView, today: LocalDay): Promise<void> {
  return run(async () => {
    const { habit, day } = view;
    const { previous, value } = await toggleEntryValue(habit.id, day);
    notify(
      `${habit.name}: ${value ? 'recaída registrada' : 'recaída quitada'}${dayNote(day, today)}`,
      { key: entryKey(view), undo: () => restoreEntry(habit.id, day, previous) },
    );
  });
}

export function startTimer(view: HabitDayView): void {
  useTimerStore.getState().start(view.habit.id, view.day, Date.now());
}

/** Detiene el cronómetro y suma los minutos al día en que empezó. */
export function stopTimer(view: HabitDayView, today: LocalDay): Promise<void> {
  const { habit } = view;
  const timer: RunningTimer | undefined = useTimerStore.getState().stop(habit.id);
  if (!timer) return Promise.resolve();
  const resume = async () => useTimerStore.getState().resume(timer);
  const minutes = elapsedMinutes(timer, Date.now());
  if (minutes < 1) {
    notify(`${habit.name}: menos de un minuto, no se ha sumado nada`, { undo: resume });
    return Promise.resolve();
  }
  return run(async () => {
    const snapshot = await adjustEntryValue(habit.id, timer.day, minutes);
    notify(`${habit.name}: +${minutes} min${dayNote(timer.day, today)}`, {
      undo: async () => {
        await restoreEntry(habit.id, timer.day, snapshot);
        await resume();
      },
    });
  });
}
