import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_DATA, readSnapshot, replaceAllData } from '@/db/repos/dataset';
import { setEntryValue } from '@/db/repos/entries';
import { createHabit } from '@/db/repos/habits';
import { createPause, listPauses } from '@/db/repos/pauses';
import { getSettings } from '@/db/repos/settings';
import { buildBackup, parseBackup, serializeBackup } from '@/domain/backup';
import { addDays } from '@/domain/day';
import { type DataSet, DEFAULT_SETTINGS } from '@/domain/types';
import { d, entry, habit } from '@/test/factories';
import { habitInput, renderRoute, todayLocal } from '@/test/render';
import { SettingsScreen } from './SettingsScreen';

const downloads: { filename: string; content: string }[] = [];
vi.mock('@/lib/download', () => ({
  downloadTextFile: (filename: string, content: string) => {
    downloads.push({ filename, content });
  },
}));

beforeEach(() => {
  downloads.length = 0;
});

function backupFile(data: DataSet, name = 'copia.json', settings = DEFAULT_SETTINGS): File {
  const text = serializeBackup(buildBackup(data, settings, new Date('2026-09-01T10:00:00Z')));
  return new File([text], name, { type: 'application/json' });
}

const importedData: DataSet = {
  ...EMPTY_DATA,
  habits: [
    habit({ id: 'i1', name: 'Importado uno' }),
    habit({ id: 'i2', name: 'Importado dos', order: 1 }),
  ],
  entries: [
    entry('2026-08-01', 1, 'i1'),
    entry('2026-08-02', 1, 'i1'),
    entry('2026-08-01', 1, 'i2'),
  ],
};

async function importFile(user: ReturnType<typeof renderRoute>['user'], file: File) {
  await user.upload(await screen.findByLabelText('Archivo de copia de seguridad'), file);
}

describe('ajustes: preferencias', () => {
  it('cambia el tema y lo guarda', async () => {
    const { user } = renderRoute(<SettingsScreen />);
    await user.click(await screen.findByRole('radio', { name: 'Oscuro' }));
    await waitFor(async () => expect((await getSettings()).theme).toBe('dark'));
  });

  it('cambia el primer día de la semana', async () => {
    const { user } = renderRoute(<SettingsScreen />);
    await user.selectOptions(await screen.findByLabelText('La semana empieza el'), '0');
    await waitFor(async () => expect((await getSettings()).weekStartsOn).toBe(0));
  });

  it('el límite retroactivo se guarda al terminar de escribir, no en cada tecla', async () => {
    const { user } = renderRoute(<SettingsScreen />);
    const input = await screen.findByLabelText('Registrar días anteriores');
    await user.clear(input);
    await user.type(input, '14');
    // Escribir «14» pasa por «1», que sería válido: nada se guarda hasta salir del campo.
    expect((await getSettings()).retroLimitDays).toBe(7);
    await user.tab();
    await waitFor(async () => expect((await getSettings()).retroLimitDays).toBe(14));

    // Enter también confirma, sin salir del campo.
    await user.clear(input);
    await user.type(input, '30{Enter}');
    await waitFor(async () => expect((await getSettings()).retroLimitDays).toBe(30));

    // Un valor fuera de rango se avisa y no se guarda; se recupera al salir del campo.
    await user.clear(input);
    await user.type(input, '400');
    expect(await screen.findByText(/número entero entre 0 y 365/)).toBeInTheDocument();
    await user.tab();
    expect(input).toHaveValue('30');
    expect((await getSettings()).retroLimitDays).toBe(30);
  });
});

describe('ajustes: aviso de almacenamiento', () => {
  it('avisa de que los datos viven solo en este navegador', async () => {
    renderRoute(<SettingsScreen />);
    expect(await screen.findByText(/viven solo en este navegador/)).toBeInTheDocument();
  });
});

describe('ajustes: exportar', () => {
  it('la copia exportada es un archivo que la propia app acepta', async () => {
    await createHabit(habitInput({ name: 'Leer' }));
    const { user } = renderRoute(<SettingsScreen />);
    await user.click(await screen.findByRole('button', { name: 'Exportar copia' }));
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(downloads[0]?.filename).toMatch(/^habitos-copia-\d{4}-\d{2}-\d{2}\.json$/);
    const parsed = parseBackup(downloads[0]?.content ?? '');
    expect(parsed.ok && parsed.backup.data.habits.map((h) => h.name)).toEqual(['Leer']);
  });

  it('exporta los registros en CSV', async () => {
    const h = await createHabit(habitInput({ name: 'Leer' }));
    await setEntryValue(h.id, todayLocal(), 1);
    const { user } = renderRoute(<SettingsScreen />);
    await user.click(await screen.findByRole('button', { name: 'Exportar CSV' }));
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(downloads[0]?.content).toContain('fecha,habito,tipo,valor,unidad,nota');
    expect(downloads[0]?.content).toContain(`${todayLocal()},Leer,Sí/No,1,,`);
  });
});

describe('ajustes: importar', () => {
  it('un archivo válido pide confirmación, sustituye los datos y se puede deshacer', async () => {
    await createHabit(habitInput({ name: 'Mío' }));
    const { user } = renderRoute(<SettingsScreen />);
    await importFile(user, backupFile(importedData));

    const dialog = await screen.findByRole('alertdialog', { name: /Sustituir tus datos/ });
    expect(dialog).toHaveTextContent('2 hábitos, 3 registros');
    expect(dialog).toHaveTextContent('1 hábito, 0 registros');
    // Hasta confirmar no ha cambiado nada.
    expect((await readSnapshot()).data.habits.map((h) => h.name)).toEqual(['Mío']);

    await user.click(within(dialog).getByRole('button', { name: 'Sustituir datos' }));
    await waitFor(async () =>
      expect((await readSnapshot()).data.habits.map((h) => h.name).sort()).toEqual([
        'Importado dos',
        'Importado uno',
      ]),
    );
    expect((await readSnapshot()).data.entries).toHaveLength(3);

    await user.click(await screen.findByRole('button', { name: 'Deshacer' }));
    await waitFor(async () =>
      expect((await readSnapshot()).data.habits.map((h) => h.name)).toEqual(['Mío']),
    );
  });

  it('cancelar la confirmación no cambia nada', async () => {
    await createHabit(habitInput({ name: 'Mío' }));
    const { user } = renderRoute(<SettingsScreen />);
    await importFile(user, backupFile(importedData));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect((await readSnapshot()).data.habits.map((h) => h.name)).toEqual(['Mío']);
  });

  it('un archivo con un problema no toca nada y dice cuál es', async () => {
    await createHabit(habitInput({ name: 'Mío' }));
    const before = await readSnapshot();
    const broken = {
      ...importedData,
      // Un hábito con un registro repetido el mismo día: el índice único lo rechazaría.
      entries: [entry('2026-08-01', 1, 'i1'), entry('2026-08-01', 3, 'i1')],
    };
    const { user } = renderRoute(<SettingsScreen />);
    await importFile(user, backupFile(broken, 'roto.json'));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No se ha importado nada');
    expect(alert).toHaveTextContent('roto.json');
    expect(alert).toHaveTextContent('Hay dos registros de «Importado uno» el 2026-08-01');
    expect(alert).toHaveTextContent('siguen exactamente como estaban');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(await readSnapshot()).toEqual(before);
  });

  it('un archivo que no es JSON no toca nada', async () => {
    await createHabit(habitInput({ name: 'Mío' }));
    const before = await readSnapshot();
    const { user } = renderRoute(<SettingsScreen />);
    await importFile(user, new File(['{"format": "habit-tra'], 'cortado.json'));
    expect(await screen.findByRole('alert')).toHaveTextContent('no es JSON válido');
    expect(await readSnapshot()).toEqual(before);
  });

  it('un archivo de otra app no toca nada', async () => {
    await createHabit(habitInput({ name: 'Mío' }));
    const before = await readSnapshot();
    const { user } = renderRoute(<SettingsScreen />);
    await importFile(user, new File(['{"habits": []}'], 'otra.json'));
    expect(await screen.findByRole('alert')).toHaveTextContent('no es una copia de seguridad');
    expect(await readSnapshot()).toEqual(before);
  });

  it('una copia de una versión futura pide actualizar la app', async () => {
    const raw = JSON.parse(
      serializeBackup(buildBackup(importedData, DEFAULT_SETTINGS, new Date())),
    );
    raw.version = 99;
    const { user } = renderRoute(<SettingsScreen />);
    await importFile(user, new File([JSON.stringify(raw)], 'futura.json'));
    expect(await screen.findByRole('alert')).toHaveTextContent('versión más nueva');
  });

  it('un error de escritura a mitad de la importación no deja nada a medias', async () => {
    await createHabit(habitInput({ name: 'Mío' }));
    const before = await readSnapshot();
    const { user } = renderRoute(<SettingsScreen />);
    // Pasa la validación pero falla al escribir: se fuerza con un identificador que
    // la tabla rechaza. Se comprueba a nivel de repositorio en `db/dataset.test.ts`;
    // aquí, que la pantalla lo comunica y los datos siguen intactos.
    const bad = {
      ...importedData,
      habits: [importedData.habits[0], importedData.habits[0]].filter(Boolean),
    } as unknown as DataSet;
    await importFile(user, backupFile(bad));
    expect(await screen.findByRole('alert')).toHaveTextContent('mismo identificador');
    expect(await readSnapshot()).toEqual(before);
  });
});

describe('ajustes: borrar todo', () => {
  it('exige escribir la palabra, borra y se puede deshacer', async () => {
    await createHabit(habitInput({ name: 'Mío' }));
    const { user } = renderRoute(<SettingsScreen />);
    await user.click(await screen.findByRole('button', { name: 'Borrar todo…' }));

    const dialog = await screen.findByRole('alertdialog', { name: /Borrar todos los datos/ });
    const confirm = within(dialog).getByRole('button', { name: 'Borrar todo' });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/Escribe «BORRAR»/), 'borrar ya');
    expect(confirm).toBeDisabled();
    await user.clear(within(dialog).getByLabelText(/Escribe «BORRAR»/));
    await user.type(within(dialog).getByLabelText(/Escribe «BORRAR»/), 'BORRAR');
    expect(confirm).toBeEnabled();
    await user.click(confirm);

    await waitFor(async () => expect((await readSnapshot()).data.habits).toHaveLength(0));
    await user.click(await screen.findByRole('button', { name: 'Deshacer' }));
    await waitFor(async () =>
      expect((await readSnapshot()).data.habits.map((h) => h.name)).toEqual(['Mío']),
    );
  });

  it('cancelar no borra nada', async () => {
    await createHabit(habitInput({ name: 'Mío' }));
    const { user } = renderRoute(<SettingsScreen />);
    await user.click(await screen.findByRole('button', { name: 'Borrar todo…' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect((await readSnapshot()).data.habits).toHaveLength(1);
  });
});

describe('ajustes: pausas', () => {
  const today = todayLocal();

  async function openForm(user: ReturnType<typeof renderRoute>['user']) {
    await user.click(await screen.findByRole('button', { name: 'Añadir pausa' }));
    return screen.findByRole('form', { name: 'Nueva pausa' });
  }

  it('crea una pausa global con motivo y nota, y se puede deshacer', async () => {
    const { user } = renderRoute(<SettingsScreen />);
    const form = await openForm(user);
    fireEvent.change(within(form).getByLabelText('Desde'), {
      target: { value: addDays(today, 1) },
    });
    fireEvent.change(within(form).getByLabelText('Hasta'), {
      target: { value: addDays(today, 5) },
    });
    await user.click(within(form).getByRole('radio', { name: 'Enfermedad' }));
    await user.type(within(form).getByLabelText('Nota (opcional)'), 'Gripe');
    expect(within(form).getByText('5 días, ambos incluidos.')).toBeInTheDocument();
    await user.click(within(form).getByRole('button', { name: 'Crear pausa' }));

    await waitFor(async () =>
      expect(await listPauses()).toMatchObject([
        {
          habitId: null,
          start: addDays(today, 1),
          end: addDays(today, 5),
          reason: 'enfermedad',
          note: 'Gripe',
        },
      ]),
    );
    expect(await screen.findByText('Próxima')).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: 'Deshacer' }));
    await waitFor(async () => expect(await listPauses()).toHaveLength(0));
  });

  it('crea una pausa de un solo hábito', async () => {
    const h = await createHabit(habitInput({ name: 'Leer' }));
    const { user } = renderRoute(<SettingsScreen />);
    const form = await openForm(user);
    await user.selectOptions(within(form).getByLabelText('Se aplica a'), 'Leer');
    await user.click(within(form).getByRole('button', { name: 'Crear pausa' }));
    await waitFor(async () => expect(await listPauses()).toMatchObject([{ habitId: h.id }]));
  });

  it('un rango invertido se avisa y no se puede guardar', async () => {
    const { user } = renderRoute(<SettingsScreen />);
    const form = await openForm(user);
    fireEvent.change(within(form).getByLabelText('Desde'), {
      target: { value: addDays(today, 5) },
    });
    fireEvent.change(within(form).getByLabelText('Hasta'), {
      target: { value: addDays(today, 1) },
    });
    expect(await within(form).findByRole('alert')).toHaveTextContent('no puede ser anterior');
    expect(within(form).getByRole('button', { name: 'Crear pausa' })).toBeDisabled();
    expect(await listPauses()).toHaveLength(0);
  });

  it('un solape con otra pausa del mismo ámbito se avisa y no se puede guardar', async () => {
    await createPause({
      habitId: null,
      start: d('2026-08-01'),
      end: d('2026-08-10'),
      reason: 'vacaciones',
      note: null,
    });
    const { user } = renderRoute(<SettingsScreen />);
    const form = await openForm(user);
    fireEvent.change(within(form).getByLabelText('Desde'), { target: { value: '2026-08-05' } });
    fireEvent.change(within(form).getByLabelText('Hasta'), { target: { value: '2026-08-15' } });
    expect(await within(form).findByRole('alert')).toHaveTextContent('Se solapa con otra pausa');
    expect(within(form).getByRole('button', { name: 'Crear pausa' })).toBeDisabled();

    // Pausas seguidas sí valen.
    fireEvent.change(within(form).getByLabelText('Desde'), { target: { value: '2026-08-11' } });
    await waitFor(() =>
      expect(within(form).getByRole('button', { name: 'Crear pausa' })).toBeEnabled(),
    );
  });

  it('edita una pausa y se puede deshacer', async () => {
    const p = await createPause({
      habitId: null,
      start: d('2026-08-01'),
      end: d('2026-08-10'),
      reason: 'vacaciones',
      note: null,
    });
    const { user } = renderRoute(<SettingsScreen />);
    await user.click(await screen.findByRole('button', { name: /Acciones de la pausa/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'Editar' }));
    const form = await screen.findByRole('form', { name: 'Editar pausa' });
    fireEvent.change(within(form).getByLabelText('Hasta'), { target: { value: '2026-08-20' } });
    await user.click(within(form).getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(async () => expect((await listPauses())[0]?.end).toBe('2026-08-20'));

    await user.click(await screen.findByRole('button', { name: 'Deshacer' }));
    await waitFor(async () => expect(await listPauses()).toEqual([p]));
  });

  it('al editar, una pausa no choca consigo misma', async () => {
    await createPause({
      habitId: null,
      start: d('2026-08-01'),
      end: d('2026-08-10'),
      reason: 'vacaciones',
      note: null,
    });
    const { user } = renderRoute(<SettingsScreen />);
    await user.click(await screen.findByRole('button', { name: /Acciones de la pausa/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'Editar' }));
    const form = await screen.findByRole('form', { name: 'Editar pausa' });
    fireEvent.change(within(form).getByLabelText('Hasta'), { target: { value: '2026-08-12' } });
    expect(within(form).queryByRole('alert')).not.toBeInTheDocument();
    expect(within(form).getByRole('button', { name: 'Guardar cambios' })).toBeEnabled();
  });

  it('elimina con confirmación y se puede deshacer', async () => {
    const p = await createPause({
      habitId: null,
      start: d('2026-08-01'),
      end: d('2026-08-10'),
      reason: 'vacaciones',
      note: null,
    });
    const { user } = renderRoute(<SettingsScreen />);
    await user.click(await screen.findByRole('button', { name: /Acciones de la pausa/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'Eliminar' }));
    const dialog = await screen.findByRole('alertdialog', { name: /Eliminar esta pausa/ });
    expect(await listPauses()).toHaveLength(1);
    await user.click(within(dialog).getByRole('button', { name: 'Eliminar pausa' }));
    await waitFor(async () => expect(await listPauses()).toHaveLength(0));
    await user.click(await screen.findByRole('button', { name: 'Deshacer' }));
    await waitFor(async () => expect(await listPauses()).toEqual([p]));
  });

  it('sin pausas lo dice', async () => {
    renderRoute(<SettingsScreen />);
    expect(await screen.findByText('No hay pausas.')).toBeInTheDocument();
  });
});

describe('ajustes: recordatorios', () => {
  it('lista los hábitos con aviso y explica la limitación', async () => {
    await createHabit(habitInput({ name: 'Meditar', reminder: { time: '07:30', enabled: true } }));
    await createHabit(habitInput({ name: 'Leer' }));
    renderRoute(<SettingsScreen />);
    const section = await screen.findByRole('region', { name: 'Recordatorios' });
    expect(within(section).getByRole('link', { name: 'Meditar' })).toBeInTheDocument();
    expect(within(section).getByText('07:30')).toBeInTheDocument();
    expect(within(section).queryByRole('link', { name: 'Leer' })).not.toBeInTheDocument();
    expect(section).toHaveTextContent('solo salen mientras esté abierta');
  });

  it('sin soporte de notificaciones lo dice', async () => {
    renderRoute(<SettingsScreen />);
    expect(await screen.findByText(/no permite notificaciones/)).toBeInTheDocument();
  });
});

describe('ajustes: estado inicial', () => {
  it('sin datos no rompe', async () => {
    await replaceAllData(EMPTY_DATA, null);
    renderRoute(<SettingsScreen />);
    expect(await screen.findByRole('heading', { name: 'Ajustes' })).toBeInTheDocument();
  });
});
