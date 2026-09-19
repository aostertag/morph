import { useEffect, useState } from 'react';
import { type LocalDay, toLocalDay } from '@/domain/day';

/**
 * Día local actual. Se actualiza al pasar la medianoche y al volver a la pestaña
 * (los temporizadores se congelan con el dispositivo en reposo).
 */
export function useToday(): LocalDay {
  const [today, setToday] = useState(() => toLocalDay(new Date()));

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => setToday(toLocalDay(new Date()));
    const schedule = () => {
      const now = new Date();
      // Un segundo después de la medianoche local (o de la hora que exista si esa medianoche no existe).
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
      timer = setTimeout(() => {
        refresh();
        schedule();
      }, next.getTime() - now.getTime());
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    schedule();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return today;
}

/** Marca de tiempo que avanza cada `intervalMs` mientras `enabled` sea cierto. */
export function useNow(intervalMs: number, enabled: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, enabled]);
  return now;
}
