import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { updateDayLog } from '@/db/repos/dayLogs';
import { setEntryValue } from '@/db/repos/entries';
import { createHabit } from '@/db/repos/habits';
import { getReview, saveReflection } from '@/db/repos/reviews';
import { getSettings } from '@/db/repos/settings';
import { addDays, eachDay, type LocalDay } from '@/domain/day';
import { lastCompleteWeek, weekOf } from '@/domain/review';
import { formatWeek } from '@/lib/format';
import { habitInput, renderRoute, todayLocal } from '@/test/render';
import { ReviewScreen } from './ReviewScreen';

const today = todayLocal();
const week = lastCompleteWeek(today, 1);

function show(url = '/revision') {
  return renderRoute(<ReviewScreen />, { path: '/revision', url });
}

/** Hábito diario con registro todos los días desde hace `days` hasta hoy. */
async function habitWithStreak(name: string, days = 30): Promise<string> {
  const from = addDays(today, -days);
  const habit = await createHabit(habitInput({ name, createdOn: from }));
  for (const day of eachDay(from, today)) {
    await setEntryValue(habit.id, day, 1);
  }
  return habit.id;
}

/** Los siete días de la semana que se revisa. */
function weekDays(from: LocalDay = week.from): readonly LocalDay[] {
  return [...eachDay(from, addDays(from, 6))];
}

describe('revisión semanal', () => {
  it('sin hábitos no finge tener nada que revisar', async () => {
    show();
    expect(await screen.findByText('Todavía no hay nada que revisar.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Crear hábito' })).toBeInTheDocument();
  });

  it('resume la última semana cerrada con su muestra', async () => {
    await habitWithStreak('Leer');
    for (const day of weekDays()) await updateDayLog(day, { mood: 4, energy: 3 });
    show();

    expect(await screen.findByText(formatWeek(week, today))).toBeInTheDocument();

    const score = await screen.findByRole('region', { name: 'Cumplimiento de la semana' });
    expect(within(score).getByText('100 %')).toBeInTheDocument();
    expect(within(score).getByText(/7 días evaluables de 1 hábito/)).toBeInTheDocument();

    const habits = screen.getByRole('region', { name: 'Hábitos' });
    expect(within(habits).getByRole('link', { name: 'Leer' })).toBeInTheDocument();
    expect(within(habits).getByText('7 de 7 días')).toBeInTheDocument();

    const highlights = screen.getByRole('region', { name: 'Lo que destacó' });
    expect(within(highlights).getByText(/Leer, el más constante: 100 %/)).toBeInTheDocument();
    expect(
      within(highlights).getByText(/ánimo 4,0 y energía 3,0 de media, sobre 7 días registrados/),
    ).toBeInTheDocument();

    // Las rachas van a fecha de hoy, así que solo salen en la semana más reciente.
    expect(screen.getByRole('region', { name: 'Rachas vivas' })).toBeInTheDocument();
  });

  it('guarda la reflexión, la relee y deja deshacer', async () => {
    await habitWithStreak('Leer');
    const { user } = show();

    const field = await screen.findByRole('textbox', { name: 'Qué te llevas de la semana' });
    await user.type(field, 'Semana sostenida, sin sobresaltos.');
    await user.click(screen.getByRole('button', { name: 'Guardar reflexión' }));

    await waitFor(async () => {
      expect(await getReview(week.from)).toMatchObject({
        reflection: 'Semana sostenida, sin sobresaltos.',
      });
    });

    // La semana que se está viendo aparece en el historial, sin enlazarse a sí misma.
    const history = await screen.findByRole('region', { name: 'Revisiones anteriores' });
    expect(within(history).getByText(formatWeek(week, today))).toHaveAttribute(
      'aria-current',
      'true',
    );

    await user.click(await screen.findByRole('button', { name: 'Deshacer' }));
    await waitFor(async () => {
      expect(await getReview(week.from)).toBeUndefined();
    });
  });

  it('el historial lleva a semanas anteriores', async () => {
    await habitWithStreak('Leer', 40);
    const older = addDays(week.from, -14);
    await saveReflection(addDays(week.from, -7), 'La semana de la mudanza.');
    await saveReflection(older, 'Dos días perdidos por el viaje.');
    const { user } = show();

    const history = await screen.findByRole('region', { name: 'Revisiones anteriores' });
    const link = within(history).getByRole('link', { name: formatWeek(weekOf(older), today) });
    expect(link).toHaveAttribute('href', `/revision?semana=${older}`);

    await user.click(link);

    const header = await screen.findByRole('banner');
    expect(await within(header).findByText(formatWeek(weekOf(older), today))).toBeInTheDocument();
    // En una semana antigua las rachas no vienen al caso: van a fecha de hoy.
    await waitFor(() => {
      expect(screen.queryByRole('region', { name: 'Rachas vivas' })).not.toBeInTheDocument();
    });
  });

  it('una semana inválida en la URL cae en la última cerrada', async () => {
    await habitWithStreak('Leer');
    // Un miércoles no empieza ninguna semana con `weekStartsOn: 1`.
    show(`/revision?semana=${addDays(week.from, 2)}`);
    expect(await screen.findByText(formatWeek(week, today))).toBeInTheDocument();
  });

  it('abrir la revisión retira el aviso de Hoy', async () => {
    await habitWithStreak('Leer');
    show();
    await screen.findByRole('region', { name: 'Cumplimiento de la semana' });
    await waitFor(async () => {
      expect((await getSettings()).lastReviewOffered).toBe(week.from);
    });
  });
});
