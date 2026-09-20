import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import type { LocalDay } from '@/domain/day';

/**
 * Cronómetros de hábitos por tiempo. Solo se guarda el instante de inicio, así que
 * sobreviven a recargar la página: el tiempo transcurrido se recalcula al volver.
 */
export interface RunningTimer {
  readonly habitId: string;
  /** Día al que se sumarán los minutos: el día en que empezó. */
  readonly day: LocalDay;
  readonly startedAt: number;
}

interface TimerState {
  readonly running: Readonly<Record<string, RunningTimer>>;
  start: (habitId: string, day: LocalDay, now: number) => void;
  /** Detiene y devuelve el cronómetro, o `undefined` si no estaba en marcha. */
  stop: (habitId: string) => RunningTimer | undefined;
  /** Vuelve a poner en marcha un cronómetro detenido (deshacer). */
  resume: (timer: RunningTimer) => void;
  /** Descarta todos los cronómetros (al sustituir o borrar los datos). */
  clearAll: () => void;
}

/** localStorage que no falla si el navegador lo bloquea (modo privado, permisos). */
const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
    } catch {
      // Sin almacenamiento el cronómetro funciona, pero no sobrevive a una recarga.
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
    } catch {
      // Nada que hacer.
    }
  },
};

export const useTimerStore = create<TimerState>()(
  persist(
    (set, get) => ({
      running: {},
      start: (habitId, day, now) =>
        set((state) => ({
          running: { ...state.running, [habitId]: { habitId, day, startedAt: now } },
        })),
      stop: (habitId) => {
        const timer = get().running[habitId];
        if (!timer) return undefined;
        const { [habitId]: _removed, ...rest } = get().running;
        set({ running: rest });
        return timer;
      },
      resume: (timer) =>
        set((state) => ({ running: { ...state.running, [timer.habitId]: timer } })),
      clearAll: () => set({ running: {} }),
    }),
    {
      name: 'tracker:timers',
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({ running: state.running }),
    },
  ),
);

/** Minutos completos transcurridos, redondeados al más cercano. */
export function elapsedMinutes(timer: RunningTimer, now: number): number {
  return Math.round(Math.max(0, now - timer.startedAt) / 60_000);
}
