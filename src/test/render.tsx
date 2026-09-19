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
