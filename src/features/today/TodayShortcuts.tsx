import { addDays, type LocalDay } from '@/domain/day';
import { canLogOn } from '@/domain/evaluate';
import { quantityStep } from '@/domain/habit';
import type { HabitDayView } from '@/domain/today';
import { useShortcuts } from '@/hooks/useShortcuts';
import { useTimerStore } from '@/state/timer';
import { adjustValue, startTimer, stopTimer, toggleDone, toggleRelapse } from './actions';

/** Lo que hace la tecla de un número según el tipo del hábito. */
function actOn(view: HabitDayView, today: LocalDay): void {
  switch (view.habit.kind) {
    case 'boolean':
      void toggleDone(view, today);
      return;
    case 'quantity':
      void adjustValue(view, quantityStep(view.habit.target), today);
      return;
    case 'avoid':
      void toggleRelapse(view, today);
      return;
    case 'time': {
      // El cronómetro solo existe para hoy.
      if (view.day !== today) return;
      if (useTimerStore.getState().running[view.habit.id]) void stopTimer(view, today);
      else startTimer(view);
    }
  }
}

/**
 * Atajos de la pantalla Hoy: los números marcan el hábito que lleva ese número y
 * las flechas cambian de día. No pinta nada.
 */
export function TodayShortcuts({
  views,
  day,
  today,
  retroLimitDays,
  onSelectDay,
}: {
  /** Los hábitos en el orden en que se ven, que es el de la numeración. */
  views: readonly HabitDayView[];
  day: LocalDay;
  today: LocalDay;
  retroLimitDays: number;
  onSelectDay: (day: LocalDay) => void;
}) {
  useShortcuts((shortcut) => {
    switch (shortcut.type) {
      case 'prevDay':
        onSelectDay(addDays(day, -1));
        return;
      case 'nextDay':
        if (day < today) onSelectDay(addDays(day, 1));
        return;
      case 'habit': {
        const view = views[shortcut.index];
        if (view && canLogOn(view.habit, day, today, retroLimitDays) === 'ok') actOn(view, today);
        return;
      }
      default:
    }
  });
  return null;
}
