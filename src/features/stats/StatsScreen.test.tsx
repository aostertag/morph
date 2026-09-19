import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { updateDayLog } from '@/db/repos/dayLogs';
import { setEntryValue } from '@/db/repos/entries';
import { createHabit } from '@/db/repos/habits';
import { addDays, type LocalDay, startOfWeek } from '@/domain/day';
import type { Scale } from '@/domain/types';
import { describeRange } from '@/lib/format';
import { habitInput, renderRoute, todayLocal } from '@/test/render';
import { StatsScreen } from './StatsScreen';

const today = todayLocal();

function show(url = '/estadisticas') {
  return renderRoute(<StatsScreen />, { path: '/estadisticas', url });
}

/** Día `n` días antes de hoy (1 = ayer). */
function back(n: number): LocalDay {
  return addDays(today, -n);
}

/** Hábito con 120 días de historia cumplidos según `did`. */
async function habitWithHistory(
  name: string,
  did: (index: number) => boolean,
  days = 120,
): Promise<string> {
  const habit = await createHabit(habitInput({ name, createdOn: back(days) }));
  for (let i = 1; i <= days; i++) {
    if (did(i)) await setEntryValue(habit.id, back(i), 1);
  }
  return habit.id;
}

describe('estadísticas globales', () => {
  it('sin hábitos no finge tener datos', async () => {
    show();
    expect(await screen.findByText('Todavía no hay nada que medir.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Crear hábito' })).toBeInTheDocument();
  });

  it('da la puntuación del período con su muestra', async () => {
    await habitWithHistory('Leer', (i) => i % 2 === 0, 60);
    show('/estadisticas?rango=trimestre');

    const score = await screen.findByRole('region', { name: 'Puntuación del período' });
    expect(within(score).getByText(/días evaluables de 1 hábito/)).toBeInTheDocument();
    expect(within(score).getAllByText('50 %').length).toBeGreaterThan(0);
  });

  it('cambiar de período cambia el rango que se analiza', async () => {
    await habitWithHistory('Leer', () => true, 40);
    const { user } = show('/estadisticas?rango=ano');

    const picker = await screen.findByLabelText('Período');
    await user.selectOptions(picker, screen.getByRole('option', { name: 'Esta semana' }));

    const week = startOfWeek(today, 1);
    expect(
      await screen.findByText(describeRange({ from: week, to: today }, today)),
    ).toBeInTheDocument();
  });

  it('el rango personalizado muestra las dos fechas', async () => {
    await habitWithHistory('Leer', () => true, 40);
    const { user } = show();
    await user.selectOptions(
      await screen.findByLabelText('Período'),
      screen.getByRole('option', { name: 'Personalizado' }),
    );
    expect(await screen.findByLabelText('Desde')).toHaveValue(addDays(today, -29));
    expect(screen.getByLabelText('Hasta')).toHaveValue(today);
  });

  it('aparta los hábitos con pocos días en vez de ponerlos los últimos', async () => {
    await habitWithHistory('Antiguo', () => true, 60);
    await createHabit(habitInput({ name: 'Recién creado', createdOn: back(1) }));
    show('/estadisticas?rango=trimestre');

    const ranking = await screen.findByRole('region', { name: 'Consistencia' });
    expect(within(ranking).getByRole('link', { name: 'Antiguo' })).toBeInTheDocument();
    expect(
      within(ranking).getByText(/Sin datos suficientes para ordenarlos: Recién creado/),
    ).toBeInTheDocument();
  });

  it('no señala el mejor día de la semana sin muestra en todos', async () => {
    await habitWithHistory('Leer', () => true, 10);
    show('/estadisticas?rango=semana');
    const section = await screen.findByRole('region', { name: 'Por día de la semana' });
    expect(within(section).getByText(/Hacen falta al menos dos semanas/)).toBeInTheDocument();
  });

  it('sin datos suficientes no afirma ninguna correlación, pero dice qué miró', async () => {
    await habitWithHistory('Leer', (i) => i % 2 === 0, 20);
    await habitWithHistory('Correr', (i) => i % 3 === 0, 20);
    show('/estadisticas?rango=mes');

    const section = await screen.findByRole('region', { name: 'Correlaciones' });

    expect(within(section).getByText(/Ninguna pareja llega a 14 días/)).toBeInTheDocument();
    expect(within(section).getByText(/Se examinó 1 comparación/)).toBeInTheDocument();
    expect(within(section).getByText(/Esto es correlación, no causa/)).toBeInTheDocument();
  });

  it('afirma una correlación solo con muestra, tamaño y margen, y la explica', async () => {
    // Ánimo alto los días de ejercicio, bajo el resto, durante cuatro meses.
    const did = (i: number) => i % 2 === 0;
    await habitWithHistory('Ejercicio', did, 120);
    for (let i = 1; i <= 120; i++) {
      await updateDayLog(back(i), { mood: (did(i) ? 5 : 2) as Scale });
    }
    show('/estadisticas?rango=trimestre');

    const section = await screen.findByRole('region', { name: 'Correlaciones' });
    expect(
      await within(section).findByText(
        /Los días que cumples Ejercicio, tu ánimo medio es 5,0; los demás días, 2,0\./,
      ),
    ).toBeInTheDocument();
    expect(
      within(section).getByText(/Muestra: \d+ días que sí y \d+ que no\./),
    ).toBeInTheDocument();
    expect(within(section).getByText('Mismo día')).toBeInTheDocument();
    expect(within(section).getByText(/Esto es correlación, no causa/)).toBeInTheDocument();
  });

  it('distingue el efecto del día siguiente', async () => {
    // Patrón sin alternancia: si el hábito fuera día sí, día no, el mismo día y
    // el siguiente dirían lo mismo al revés y no se distinguiría nada.
    const DAYS = 120;
    const pattern = (k: number) => (k * 7) % 10 < 5;
    const habit = await createHabit(habitInput({ name: 'Dormir temprano', createdOn: back(DAYS) }));
    for (let k = 0; k < DAYS; k++) {
      const day = addDays(back(DAYS), k);
      if (pattern(k)) await setEntryValue(habit.id, day, 1);
      // La energía de un día depende de si se cumplió la víspera.
      await updateDayLog(day, { energy: (k > 0 && pattern(k - 1) ? 5 : 2) as Scale });
    }
    show('/estadisticas?rango=trimestre');

    const section = await screen.findByRole('region', { name: 'Correlaciones' });
    expect(
      await within(section).findByText(/Los días después de cumplir Dormir temprano, tu energía/),
    ).toBeInTheDocument();
    expect(within(section).getByText('Día siguiente')).toBeInTheDocument();
  });
});
