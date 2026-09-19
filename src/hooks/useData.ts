import { liveQuery } from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { listCategories } from '@/db/repos/categories';
import { entriesForHabit } from '@/db/repos/entries';
import { listHabits } from '@/db/repos/habits';
import { listPauses } from '@/db/repos/pauses';
import { getSettings } from '@/db/repos/settings';
import type { Category, Entry, Habit, Pause, Settings } from '@/domain/types';

/*
 * Lecturas reactivas: se vuelven a ejecutar solas cuando cambian los datos que leen.
 * `undefined` significa "cargando". Los errores de IndexedDB se lanzan durante el
 * render y los recoge el ErrorBoundary de la app.
 */

export function useHabits(): Habit[] | undefined {
  return useLiveQuery(listHabits);
}

export function usePauses(): Pause[] | undefined {
  return useLiveQuery(listPauses);
}

export function useSettings(): Settings | undefined {
  return useLiveQuery(getSettings);
}

export function useCategories(): Category[] | undefined {
  return useLiveQuery(listCategories);
}

interface EntriesState {
  readonly key: string;
  readonly map: ReadonlyMap<string, readonly Entry[]>;
}

/**
 * Historial completo de varios hábitos con una suscripción por hábito: al registrar
 * algo solo se vuelve a leer ese hábito, no los demás. Cada array conserva su
 * identidad mientras no cambie, lo que permite cachear los cálculos derivados.
 */
export function useEntriesByHabit(
  habitIds: readonly string[],
): ReadonlyMap<string, readonly Entry[]> | undefined {
  const key = habitIds.join('|');
  const [state, setState] = useState<EntriesState | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    const ids = key === '' ? [] : key.split('|');
    const map = new Map<string, readonly Entry[]>();
    if (ids.length === 0) {
      setState({ key, map });
      return;
    }
    const subscriptions = ids.map((id) =>
      liveQuery(() => entriesForHabit(id)).subscribe({
        next: (rows) => {
          map.set(id, rows);
          if (map.size === ids.length) setState({ key, map: new Map(map) });
        },
        error: setError,
      }),
    );
    return () => {
      for (const s of subscriptions) s.unsubscribe();
    };
  }, [key]);

  if (error) throw error;
  return state?.key === key ? state.map : undefined;
}
