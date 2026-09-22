import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { App } from '@/app/App';
import { getEntry } from '@/db/repos/entries';
import { createHabit } from '@/db/repos/habits';
import { updateSettings } from '@/db/repos/settings';
import { addDays } from '@/domain/day';
import { useShortcutsDialog } from '@/state/shortcutsDialog';
import { habitInput, preloadLazyScreens, todayLocal } from '@/test/render';

// Las pantallas `lazy()` se compilan en frío la primera vez: ver `preloadLazyScreens`.
beforeAll(preloadLazyScreens);

beforeEach(async () => {
  window.history.pushState({}, '', '/');
  useShortcutsDialog.getState().setOpen(false);
  await updateSettings({ onboardingDone: true });
});

/**
 * Control positivo de los tests que comprueban que una tecla no hizo nada: pulsa `2`
 * (el segundo hábito) y espera a que se registre. Así se sabe que los atajos estaban
 * vivos, y como las escrituras en `entries` van en cola, cualquier escritura que
 * hubiera provocado una tecla anterior ya estaría en la base.
 */
async function expectShortcutsIdle(user: ReturnType<typeof userEvent.setup>, controlId: string) {
  await user.keyboard('2');
  await waitFor(async () =>
    expect(await getEntry(controlId, todayLocal())).toMatchObject({ value: 1 }),
  );
}

async function open() {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('heading', { level: 1 });
  return user;
}

describe('atajos de teclado en Hoy', () => {
  it('los números marcan los hábitos en el orden en que se ven', async () => {
    const leer = await createHabit(habitInput({ name: 'Leer' }));
    const correr = await createHabit(habitInput({ name: 'Correr' }));
    const user = await open();
    const leerBox = await screen.findByRole('checkbox', { name: 'Leer' });
    const correrBox = screen.getByRole('checkbox', { name: 'Correr' });

    await user.keyboard('2');
    await waitFor(() => expect(correrBox).toBeChecked());
    expect(await getEntry(correr.id, todayLocal())).toMatchObject({ value: 1 });
    expect(await getEntry(leer.id, todayLocal())).toBeUndefined();

    // Marcar y desmarcar deciden según lo que se ve: antes de volver a pulsar hay que
    // esperar a que la casilla se pinte, no solo a que la base tenga el registro (el
    // repintado llega después, con `liveQuery`). Ver CLAUDE.md, «Pendiente».
    await user.keyboard('1');
    await waitFor(() => expect(leerBox).toBeChecked());
    expect(await getEntry(leer.id, todayLocal())).toMatchObject({ value: 1 });

    // Pulsar otra vez desmarca.
    await user.keyboard('1');
    await waitFor(() => expect(leerBox).not.toBeChecked());
    expect(await getEntry(leer.id, todayLocal())).toBeUndefined();
  });

  it('la numeración sigue el agrupado por momento del día, no el orden de creación', async () => {
    const tarde = await createHabit(habitInput({ name: 'Paseo', timeOfDay: 'evening' }));
    const manana = await createHabit(habitInput({ name: 'Meditar', timeOfDay: 'morning' }));
    const user = await open();
    await screen.findByRole('checkbox', { name: 'Meditar' });

    await user.keyboard('1');
    await waitFor(async () =>
      expect(await getEntry(manana.id, todayLocal())).toMatchObject({ value: 1 }),
    );
    expect(await getEntry(tarde.id, todayLocal())).toBeUndefined();
  });

  it('en un hábito cuantitativo suma un paso', async () => {
    const agua = await createHabit(
      habitInput({ name: 'Agua', kind: 'quantity', target: 8, unit: 'vasos' }),
    );
    const user = await open();
    await screen.findByRole('button', { name: /Agua \(vasos\)/ });
    await user.keyboard('1');
    await user.keyboard('1');
    await waitFor(async () =>
      expect(await getEntry(agua.id, todayLocal())).toMatchObject({ value: 2 }),
    );
  });

  it('un número sin hábito, o con Ctrl, no hace nada', async () => {
    const leer = await createHabit(habitInput({ name: 'Leer' }));
    const correr = await createHabit(habitInput({ name: 'Correr' }));
    const user = await open();
    await screen.findByRole('checkbox', { name: 'Leer' });
    await user.keyboard('7');
    await user.keyboard('{Control>}1{/Control}');
    await expectShortcutsIdle(user, correr.id);
    expect(await getEntry(leer.id, todayLocal())).toBeUndefined();
  });

  it('escribiendo en un campo no se marca nada', async () => {
    const leer = await createHabit(habitInput({ name: 'Leer' }));
    const correr = await createHabit(habitInput({ name: 'Correr' }));
    const user = await open();
    const note = await screen.findByRole('textbox', { name: 'Nota del día' });
    await user.type(note, '1 hora de lectura, n?');
    expect(note).toHaveValue('1 hora de lectura, n?');
    note.blur();
    await expectShortcutsIdle(user, correr.id);
    expect(await getEntry(leer.id, todayLocal())).toBeUndefined();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(window.location.pathname).toBe('/');
  });

  it('las flechas cambian de día y no pasan de hoy', async () => {
    await createHabit(habitInput({ name: 'Leer', createdOn: addDays(todayLocal(), -30) }));
    const user = await open();
    await screen.findByRole('checkbox', { name: 'Leer' });

    await user.keyboard('{ArrowLeft}');
    await waitFor(() => expect(window.location.search).toBe(`?dia=${addDays(todayLocal(), -1)}`));
    await user.keyboard('{ArrowLeft}');
    await waitFor(() => expect(window.location.search).toBe(`?dia=${addDays(todayLocal(), -2)}`));

    await user.keyboard('{ArrowRight}{ArrowRight}');
    await waitFor(() => expect(window.location.search).toBe(''));
    await user.keyboard('{ArrowRight}');
    expect(window.location.search).toBe('');
  });

  it('en un día ya cerrado por el límite retroactivo, los números no registran', async () => {
    const leer = await createHabit(
      habitInput({ name: 'Leer', createdOn: addDays(todayLocal(), -30) }),
    );
    window.history.pushState({}, '', `/?dia=${addDays(todayLocal(), -10)}`);
    const user = await open();
    expect(await screen.findByRole('checkbox', { name: 'Leer' })).toBeDisabled();
    await user.keyboard('1');

    // Control: tres días más adelante (hace 7) el día ya se puede registrar y la misma
    // tecla sí marca. Las escrituras van en cola, así que si la primera pulsación
    // hubiera escrito, ya estaría en la base.
    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}');
    const open7 = addDays(todayLocal(), -7);
    await waitFor(() => expect(window.location.search).toBe(`?dia=${open7}`));
    const box = screen.getByRole('checkbox', { name: 'Leer' });
    await waitFor(() => expect(box).toBeEnabled());
    await user.keyboard('1');
    await waitFor(async () => expect(await getEntry(leer.id, open7)).toMatchObject({ value: 1 }));
    expect(await getEntry(leer.id, addDays(todayLocal(), -10))).toBeUndefined();
  });

  it('con el foco en un radio, las flechas mueven el radio y no el día', async () => {
    await createHabit(habitInput({ name: 'Leer' }));
    const user = await open();
    const mood = await screen.findByRole('group', { name: 'Ánimo' });
    const first = within(mood).getAllByRole('radio')[0];
    if (!first) throw new Error('faltan los radios de ánimo');
    first.focus();
    await user.keyboard('{ArrowRight}');
    expect(window.location.search).toBe('');

    // Control: fuera del radio, la misma flecha sí cambia de día. La flecha movió el foco
    // al radio siguiente, así que se suelta el que lo tenga ahora.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    await user.keyboard('{ArrowLeft}');
    await waitFor(() => expect(window.location.search).toBe(`?dia=${addDays(todayLocal(), -1)}`));
  });
});

describe('atajos globales', () => {
  it('N abre el formulario de nuevo hábito y vuelve a Hoy al terminar', async () => {
    const user = await open();
    await user.keyboard('n');
    expect(await screen.findByRole('heading', { name: 'Nuevo hábito' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/habitos/nuevo');
    expect(window.location.search).toBe('?volver=hoy');
  });

  it('N desde otra pantalla abre el formulario sin volver a Hoy', async () => {
    window.history.pushState({}, '', '/ajustes');
    const user = await open();
    await user.keyboard('n');
    await waitFor(() => expect(window.location.pathname).toBe('/habitos/nuevo'));
    expect(window.location.search).toBe('');
  });

  it('? abre la lista de atajos y Escape la cierra', async () => {
    const user = await open();
    await user.keyboard('?');
    const dialog = await screen.findByRole('dialog', { name: 'Atajos de teclado' });
    expect(within(dialog).getByText('Nuevo hábito.')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('con el diálogo abierto, las teclas no actúan sobre la pantalla', async () => {
    const leer = await createHabit(habitInput({ name: 'Leer' }));
    const correr = await createHabit(habitInput({ name: 'Correr' }));
    const user = await open();
    await screen.findByRole('checkbox', { name: 'Leer' });
    await user.keyboard('?');
    await screen.findByRole('dialog', { name: 'Atajos de teclado' });
    await user.keyboard('1');
    await user.keyboard('n');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await expectShortcutsIdle(user, correr.id);
    expect(await getEntry(leer.id, todayLocal())).toBeUndefined();
    expect(window.location.pathname).toBe('/');
  });

  it('Ajustes tiene un botón para ver los atajos', async () => {
    window.history.pushState({}, '', '/ajustes');
    const user = await open();
    await user.click(await screen.findByRole('button', { name: 'Ver atajos' }));
    expect(await screen.findByRole('dialog', { name: 'Atajos de teclado' })).toBeInTheDocument();
  });
});
