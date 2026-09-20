import { useEffect } from 'react';
import { planReminders, reminderKey } from '@/domain/reminders';
import { viewForDay } from '@/domain/today';
import { useHabitAnalyses } from '@/features/today/useHabitAnalyses';
import { useToday } from '@/hooks/useToday';
import { loadFired, saveFired, showReminder, useNotificationSupport } from './notifications';

/** El temporizador del navegador no admite esperas mayores que esto. */
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

/**
 * Dispara los recordatorios mientras la app está abierta. No pinta nada: vigila los
 * datos de hoy, avisa de lo que toca y se reprograma para el siguiente aviso. Al
 * volver a la pestaña vuelve a mirar, porque los temporizadores se congelan con el
 * dispositivo en reposo.
 */
export function RemindersRunner() {
  const today = useToday();
  const data = useHabitAnalyses(today);
  const [support] = useNotificationSupport();

  useEffect(() => {
    if (!data || support !== 'granted') return;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const candidates = data.analyses
      .filter((analysis) => analysis.habit.reminder?.enabled)
      .map((analysis) => {
        const view = viewForDay(analysis, today);
        return {
          habit: analysis.habit,
          pending: view.countsForProgress && !view.doneForProgress,
        };
      });
    if (candidates.length === 0) return;

    const run = () => {
      clearTimeout(timer);
      const fired = loadFired(today);
      const plan = planReminders(candidates, Date.now(), today, fired);
      for (const habit of plan.due) {
        fired.add(reminderKey(habit.id, today));
        void showReminder(habit);
      }
      if (plan.due.length > 0) saveFired(today, fired);
      if (plan.nextAt !== null) {
        // Medio segundo de margen para que el reloj ya haya pasado la hora.
        const wait = Math.min(Math.max(plan.nextAt - Date.now(), 0) + 500, MAX_TIMEOUT_MS);
        timer = setTimeout(run, wait);
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') run();
    };

    run();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [data, support, today]);

  return null;
}
