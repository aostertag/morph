import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createCategory } from '@/db/repos/categories';
import { setEntryValue } from '@/db/repos/entries';
import { createHabit } from '@/db/repos/habits';
import { addDays, type LocalDay } from '@/domain/day';
import type { HabitInput } from '@/domain/habit';
import { habitInput, renderRoute, todayLocal } from '@/test/render';
import { StatsScreen } from './StatsScreen';

const today = todayLocal();
const back = (n: number): LocalDay => addDays(today, -n);

function show() {
  // Personalizado con los 60 días exactos que crea `habit()`, no `rango=trimestre`:
  // el trimestre en curso puede tener menos días (p. ej. el 1 de enero) y dejar
  // categorías con menos días evaluables de los que el historial realmente tiene.
  return renderRoute(<StatsScreen />, {
    path: '/estadisticas',
    url: `/estadisticas?rango=personalizado&desde=${back(60)}&hasta=${back(1)}`,
  });
}

async function habit(name: string, did: (i: number) => boolean, extra: Partial<HabitInput> = {}) {
  const created = await createHabit(habitInput({ name, createdOn: back(60), ...extra }));
  for (let i = 1; i <= 60; i++) if (did(i)) await setEntryValue(created.id, back(i), 1);
  return created;
}

describe('estadísticas: por categoría', () => {
  it('sin categorías con hábitos la sección no aparece', async () => {
    await habit('Leer', () => true);
    await createCategory('Vacía');
    show();
    await screen.findByRole('region', { name: 'Puntuación del período' });
    expect(screen.queryByRole('region', { name: 'Por categoría' })).not.toBeInTheDocument();
  });

  it('con una categoría con hábitos compara categorías, con su muestra', async () => {
    const salud = await createCategory('Salud');
    const mente = await createCategory('Mente');
    await habit('Correr', (i) => i % 2 === 0, { categoryId: salud.id });
    await habit('Leer', () => true, { categoryId: mente.id });
    await habit('Suelto', () => true);
    show();

    const section = await screen.findByRole('region', { name: 'Por categoría' });
    // Cada categoría ocupa una fila con su nombre y otra debajo con sus hábitos y la comparación.
    const rows = within(section)
      .getAllByRole('row')
      .filter((row) => within(row).queryByRole('rowheader') !== null);
    // Mente (100 %) + Salud (50 %) + Sin categoría, siempre la última.
    const names = rows.map((row) => within(row).getByRole('rowheader').textContent);
    expect(names).toEqual(['Mente', 'Salud', 'Sin categoría']);
    expect(within(rows[1] as HTMLElement).getByText(/\(\d+ d\)/)).toBeInTheDocument();
    expect(within(section).getAllByText(/^1 hábito/)).toHaveLength(3);
    expect(within(section).getByText(/Los hábitos a evitar van aparte/)).toBeInTheDocument();
  });

  it('las categorías con pocos días se apartan en vez de salir como las peores', async () => {
    const salud = await createCategory('Salud');
    const nueva = await createCategory('Nueva');
    await habit('Correr', () => true, { categoryId: salud.id });
    await createHabit(habitInput({ name: 'Reciente', createdOn: back(3), categoryId: nueva.id }));
    show();

    const section = await screen.findByRole('region', { name: 'Por categoría' });
    expect(within(section).queryByRole('rowheader', { name: /Nueva/ })).not.toBeInTheDocument();
    expect(
      within(section).getByText(/Sin datos suficientes para ordenarlas: Nueva \(3 d\)/),
    ).toBeInTheDocument();
  });

  it('los hábitos a evitar no cuentan: una categoría solo con ellos no genera la sección', async () => {
    const mente = await createCategory('Mente');
    await habit('Redes', () => false, { kind: 'avoid', categoryId: mente.id });
    await habit('Leer', () => true);
    show();
    await screen.findByRole('region', { name: 'Puntuación del período' });
    expect(screen.queryByRole('region', { name: 'Por categoría' })).not.toBeInTheDocument();
  });
});
