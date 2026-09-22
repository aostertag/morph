import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setEntryValue } from '@/db/repos/entries';
import { createHabit } from '@/db/repos/habits';
import { useHabitAnalyses } from '@/features/today/useHabitAnalyses';
import { habitInput, renderRoute, todayLocal } from '@/test/render';
import { RemindersRunner } from './RemindersRunner';

const shown: { title: string; body: string | undefined }[] = [];

function stubNotification(permission: NotificationPermission) {
  class FakeNotification {
    static permission: NotificationPermission = permission;
    onclick: (() => void) | null = null;
    constructor(title: string, options?: NotificationOptions) {
      shown.push({ title, body: options?.body });
    }
    close() {}
  }
  vi.stubGlobal('Notification', FakeNotification);
  return {
    grant() {
      FakeNotification.permission = 'granted';
    },
  };
}

beforeEach(() => {
  shown.length = 0;
  // Solo se congela la fecha: el resto (IndexedDB, temporizadores de React) sigue real.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 19, 10, 0, 0));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const reminder = (time: string) => ({ time, enabled: true });

/**
 * Control positivo de los tests que comprueban que algo no avisó: un hábito pendiente
 * cuya hora acaba de pasar y que sí debe avisar. Cuando llega su aviso, el runner ya ha
 * evaluado los mismos datos que el hábito del test; esperar un tiempo fijo no lo
 * garantizaba (con la máquina cargada, los datos podían tardar más).
 */
async function controlHabit() {
  await createHabit(habitInput({ name: 'Control', reminder: reminder('09:55') }));
}

const CONTROL = { title: 'Control', body: 'Pendiente hoy.' };

describe('recordatorios', () => {
  it('avisa de un hábito pendiente cuya hora acaba de pasar, y solo una vez', async () => {
    stubNotification('granted');
    await createHabit(habitInput({ name: 'Meditar', reminder: reminder('09:50') }));

    const first = renderRoute(<RemindersRunner />);
    await waitFor(() => expect(shown).toEqual([{ title: 'Meditar', body: 'Pendiente hoy.' }]));
    first.unmount();

    // Recargar la página el mismo día no repite el aviso.
    await controlHabit();
    renderRoute(<RemindersRunner />);
    await waitFor(() => expect(shown).toContainEqual(CONTROL));
    expect(shown).toEqual([{ title: 'Meditar', body: 'Pendiente hoy.' }, CONTROL]);
  });

  it('en un hábito con meta, el aviso la recuerda', async () => {
    stubNotification('granted');
    await createHabit(
      habitInput({
        name: 'Agua',
        kind: 'quantity',
        target: 8,
        unit: 'vasos',
        reminder: reminder('09:45'),
      }),
    );
    renderRoute(<RemindersRunner />);
    await waitFor(() => expect(shown).toEqual([{ title: 'Agua', body: 'Meta de hoy: 8 vasos.' }]));
  });

  it('no avisa si el hábito ya está hecho hoy', async () => {
    stubNotification('granted');
    const habit = await createHabit(habitInput({ name: 'Leer', reminder: reminder('09:50') }));
    await setEntryValue(habit.id, todayLocal(), 1);
    await controlHabit();
    renderRoute(<RemindersRunner />);
    await waitFor(() => expect(shown).toContainEqual(CONTROL));
    expect(shown).toEqual([CONTROL]);
  });

  it('no avisa sin permiso de notificaciones', async () => {
    const permission = stubNotification('default');
    await createHabit(habitInput({ name: 'Leer', reminder: reminder('09:50') }));
    // Sin permiso no avisa nada, así que no cabe un hábito de control: un testigo con los
    // mismos datos dice cuándo están cargados, y al final se concede el permiso para ver
    // que entonces sí avisa (el hábito estaba bien preparado).
    function DataProbe() {
      return useHabitAnalyses(todayLocal()) ? <p>datos cargados</p> : null;
    }
    renderRoute(
      <>
        <RemindersRunner />
        <DataProbe />
      </>,
    );
    await screen.findByText('datos cargados');
    expect(shown).toEqual([]);

    permission.grant();
    window.dispatchEvent(new Event('focus'));
    await waitFor(() => expect(shown).toEqual([{ title: 'Leer', body: 'Pendiente hoy.' }]));
  });

  it('no avisa de un recordatorio desactivado ni de uno que ya pasó hace mucho', async () => {
    stubNotification('granted');
    await createHabit(habitInput({ name: 'Apagado', reminder: { time: '09:50', enabled: false } }));
    await createHabit(habitInput({ name: 'Antiguo', reminder: reminder('07:00') }));
    await controlHabit();
    renderRoute(<RemindersRunner />);
    await waitFor(() => expect(shown).toContainEqual(CONTROL));
    expect(shown).toEqual([CONTROL]);
  });

  it('un hábito de días concretos que hoy no toca no avisa', async () => {
    stubNotification('granted');
    // El 19 de septiembre de 2026 es sábado (6): el hábito solo toca los lunes.
    await createHabit(
      habitInput({
        name: 'Solo lunes',
        frequency: { type: 'weekdays', days: [1] },
        reminder: reminder('09:50'),
      }),
    );
    await controlHabit();
    renderRoute(<RemindersRunner />);
    await waitFor(() => expect(shown).toContainEqual(CONTROL));
    expect(shown).toEqual([CONTROL]);
  });
});
