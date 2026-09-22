import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { Toaster } from 'sonner';
import { toLocalDay } from '@/domain/day';
import type { HabitInput } from '@/domain/habit';
import { habit } from './factories';

/** Renderiza una pantalla dentro de un router en memoria, con el Toaster montado. */
export function renderRoute(element: ReactNode, { path = '/', url = '/' } = {}) {
  const user = userEvent.setup();
  const result = render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path={path} element={element} />
        <Route path="*" element={<p>Otra pantalla</p>} />
      </Routes>
      <Toaster theme="light" />
    </MemoryRouter>,
  );
  return { user, ...result };
}

export function todayLocal() {
  return toLocalDay(new Date());
}

export function habitInput(overrides: Partial<HabitInput> = {}): HabitInput {
  const { id: _id, order: _order, archivedOn: _archived, ...rest } = habit();
  return { ...rest, createdOn: todayLocal(), ...overrides };
}

/**
 * Importa de antemano los módulos que la app carga con `lazy()`. En Vitest, la primera
 * importación de cada uno los compila en frío (dnd-kit, Base UI, Zod, Recharts…): con la
 * máquina cargada eso llegó a pasar de 1,2 s, más que el segundo que espera `findBy`,
 * mientras que el render en sí tarda decenas de milisegundos. Precargados, las esperas
 * de los tests que navegan miden la pantalla, no el compilador. En producción esos
 * módulos son trozos ya construidos: nada de esto aplica allí.
 */
export async function preloadLazyScreens(): Promise<void> {
  await Promise.all([
    import('@/features/habits/HabitsScreen'),
    import('@/features/habits/HabitFormScreens'),
    import('@/features/stats/StatsScreen'),
    import('@/features/review/ReviewScreen'),
    import('@/features/settings/SettingsScreen'),
    import('@/features/habit-detail/HabitDetailScreen'),
    import('@/features/shortcuts/ShortcutsDialog'),
  ]);
}
