import { screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { updateDayLog } from '@/db/repos/dayLogs';
import { setEntryValue } from '@/db/repos/entries';
import { createHabit } from '@/db/repos/habits';
import { addDays, type LocalDay, startOfWeek, toLocalDay } from '@/domain/day';
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
    // Personalizado con los 60 días exactos del historial (no `rango=trimestre`:
    // el trimestre en curso puede tener menos días, o un número impar, y entonces
    // 30 días cumplidos de un total distinto ya no da el 50 % exacto).
    show(`/estadisticas?rango=personalizado&desde=${back(60)}&hasta=${back(1)}`);

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
    // Personalizado, no `rango=trimestre`: el trimestre en curso puede tener menos
    // días que la muestra mínima y dejar a "Antiguo" también sin datos suficientes.
    show(`/estadisticas?rango=personalizado&desde=${back(30)}&hasta=${back(1)}`);

    const ranking = await screen.findByRole('region', { name: 'Consistencia' });
    expect(within(ranking).getByRole('link', { name: 'Antiguo' })).toBeInTheDocument();
    expect(
      within(ranking).getByText(/Sin datos suficientes para ordenarlos: Recién creado/),
    ).toBeInTheDocument();
  });

  it('no señala el mejor día de la semana sin muestra en todos', async () => {
    await habitWithHistory('Leer', () => true, 10);
    // Personalizado de 9 días terminado ayer: por debajo de las dos semanas que
    // exige weekdayBreakdown, y a diferencia de `rango=semana` no depende de qué
    // día de la semana sea "hoy" (con `rango=semana`, si hoy es el primer día de
    // la semana configurada no hay ningún día evaluable todavía: ver el test
    // siguiente).
    show(`/estadisticas?rango=personalizado&desde=${back(9)}&hasta=${back(1)}`);
    const section = await screen.findByRole('region', { name: 'Por día de la semana' });
    expect(within(section).getByText(/Hacen falta al menos dos semanas/)).toBeInTheDocument();
  });

  describe('con "hoy" el primer día de la semana', () => {
    // Lunes real, no relativo al "hoy" fijado en setup.ts: así la prueba no
    // depende de qué fecha use por defecto o `TEST_TODAY`.
    const monday = new Date(2026, 5, 15, 12, 0, 0);
    let before: Date;

    beforeEach(() => {
      before = new Date();
      vi.setSystemTime(monday);
    });

    afterEach(() => {
      vi.setSystemTime(before);
    });

    it('con rango=semana dice que no hay días evaluables, no que falten dos semanas', async () => {
      const mondayDay = toLocalDay(monday);
      await createHabit(habitInput({ name: 'Leer', createdOn: addDays(mondayDay, -30) }));
      show('/estadisticas?rango=semana');
      const section = await screen.findByRole('region', { name: 'Por día de la semana' });
      expect(within(section).getByText('Sin días evaluables en este período.')).toBeInTheDocument();
    });
  });

  it('sin datos suficientes no afirma ninguna correlación, pero dice qué miró', async () => {
    await habitWithHistory('Leer', (i) => i % 2 === 0, 20);
    await habitWithHistory('Correr', (i) => i % 3 === 0, 20);
    // Personalizado con los 20 días exactos del historial, no `rango=mes`: el mes
    // en curso puede tener muchos menos días (p. ej. el día 1) y dejar la muestra
    // sin ningún día evaluable en vez de sin los 14 que exige la comparación.
    show(`/estadisticas?rango=personalizado&desde=${back(20)}&hasta=${back(1)}`);

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
    // Personalizado con los 120 días exactos del historial, no `rango=trimestre`:
    // el trimestre en curso puede no llegar a cubrirlos todos.
    show(`/estadisticas?rango=personalizado&desde=${back(120)}&hasta=${back(1)}`);

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
    // Personalizado con los DAYS días exactos del historial, no `rango=trimestre`:
    // el trimestre en curso puede no llegar a cubrirlos todos.
    show(`/estadisticas?rango=personalizado&desde=${back(DAYS)}&hasta=${back(1)}`);

    const section = await screen.findByRole('region', { name: 'Correlaciones' });
    expect(
      await within(section).findByText(/Los días después de cumplir Dormir temprano, tu energía/),
    ).toBeInTheDocument();
    expect(within(section).getByText('Día siguiente')).toBeInTheDocument();
  });
});
