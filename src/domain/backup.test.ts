import { describe, expect, it } from 'vitest';
import { d, dayLog, entry, habit, pause, review } from '@/test/factories';
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  type Backup,
  buildBackup,
  MAX_REPORTED_ERRORS,
  parseBackup,
  serializeBackup,
  validateBackup,
} from './backup';
import { type DataSet, DEFAULT_SETTINGS } from './types';

function dataset(): DataSet {
  return {
    categories: [{ id: 'c1', name: 'Salud', order: 0 }],
    habits: [
      habit({ id: 'h1', name: 'Leer', categoryId: 'c1' }),
      habit({
        id: 'h2',
        name: 'Agua',
        kind: 'quantity',
        target: 8,
        unit: 'vasos',
        order: 1,
        reminder: { time: '09:30', enabled: true },
      }),
      habit({ id: 'h3', name: 'Fumar', kind: 'avoid', order: 2, archivedOn: d('2026-03-01') }),
    ],
    entries: [entry('2026-02-01', 1, 'h1'), entry('2026-02-02', 5, 'h2')],
    dayLogs: [dayLog('2026-02-01', 4, 3, 'Buen día')],
    pauses: [pause('2026-02-10', '2026-02-12'), pause('2026-02-20', '2026-02-21', 'h1')],
    reviews: [review('2026-01-26')],
  };
}

function backup(data: DataSet = dataset()): Backup {
  return buildBackup(data, DEFAULT_SETTINGS, new Date('2026-09-19T10:00:00Z'));
}

/** Copia editable del archivo, para romperlo de una forma concreta. */
function mutable(
  data: DataSet = dataset(),
): Record<string, unknown> & { data: Record<string, unknown[]> } {
  return JSON.parse(serializeBackup(backup(data)));
}

function errorsOf(text: string): readonly string[] {
  const result = parseBackup(text);
  if (result.ok) throw new Error('Se esperaba que la copia fuera rechazada.');
  return result.errors;
}

describe('copia de seguridad: lo que se acepta', () => {
  it('una copia exportada se vuelve a leer idéntica', () => {
    const original = backup();
    const result = parseBackup(serializeBackup(original));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.backup).toEqual(original);
      expect(result.summary).toEqual({
        habits: 3,
        entries: 2,
        dayLogs: 1,
        pauses: 2,
        reviews: 1,
        categories: 1,
      });
    }
  });

  it('acepta un hábito que aún no ha empezado y lo devuelve idéntico', () => {
    const data = dataset();
    const planned = habit({ id: 'h4', name: 'Correr', order: 3, createdOn: d('2027-06-01') });
    const withFuture: DataSet = { ...data, habits: [...data.habits, planned] };
    const result = parseBackup(serializeBackup(backup(withFuture)));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.backup.data.habits).toContainEqual(planned);
  });

  it('acepta una base vacía', () => {
    const empty: DataSet = {
      categories: [],
      habits: [],
      entries: [],
      dayLogs: [],
      pauses: [],
      reviews: [],
    };
    expect(parseBackup(serializeBackup(backup(empty))).ok).toBe(true);
  });

  it('declara formato y versión', () => {
    expect(backup()).toMatchObject({ format: BACKUP_FORMAT, version: BACKUP_VERSION });
  });

  it('lee una copia grande sin problema', () => {
    const data = dataset();
    const many = Array.from({ length: 20_000 }, (_, i) => ({
      ...entry('2026-02-01', 1, 'h1'),
      id: `big${i}`,
      date: d(
        `2026-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
      ),
      habitId: `h${(i % 3) + 1}`,
    }));
    // Se quitan los repetidos por hábito y día: solo se mide la lectura.
    const unique = [...new Map(many.map((e) => [`${e.habitId}${e.date}`, e])).values()];
    expect(parseBackup(serializeBackup(backup({ ...data, entries: unique }))).ok).toBe(true);
  });
});

describe('copia de seguridad: lo que se rechaza', () => {
  it('texto que no es JSON', () => {
    expect(errorsOf('{"format": "habit-')).toEqual([
      'El archivo no es JSON válido. ¿Está incompleto o dañado?',
    ]);
    expect(errorsOf('')).toHaveLength(1);
  });

  it.each([
    ['un array', '[]'],
    ['null', 'null'],
    ['un número', '3'],
    ['un objeto de otra app', '{"habits": []}'],
    ['otro formato', '{"format": "otra-app", "version": 1}'],
  ])('%s no es una copia de esta app', (_name, text) => {
    expect(errorsOf(text)).toEqual(['El archivo no es una copia de seguridad de esta app.']);
  });

  it('versión ausente o no válida', () => {
    for (const version of [undefined, 0, -1, 1.5, '1', null]) {
      const raw = { ...mutable(), version };
      expect(errorsOf(JSON.stringify(raw))).toEqual(['El archivo no indica una versión válida.']);
    }
  });

  it('versión futura: pide actualizar la app en vez de adivinar', () => {
    const [message] = errorsOf(JSON.stringify({ ...mutable(), version: BACKUP_VERSION + 1 }));
    expect(message).toContain('más nueva');
  });

  it('un campo desconocido en la raíz', () => {
    expect(errorsOf(JSON.stringify({ ...mutable(), extra: 1 }))[0]).toContain('archivo:');
  });

  it('un campo desconocido dentro de un registro, con su ruta', () => {
    const raw = mutable();
    (raw.data.habits?.[0] as Record<string, unknown>)['secreto'] = true;
    expect(errorsOf(JSON.stringify(raw))[0]).toContain('habits[0]');
  });

  it('falta una tabla', () => {
    const raw = mutable();
    delete raw.data['entries'];
    expect(errorsOf(JSON.stringify(raw))[0]).toContain('entries');
  });

  it('faltan los ajustes', () => {
    const raw = mutable();
    delete raw['settings'];
    expect(errorsOf(JSON.stringify(raw))[0]).toContain('settings');
  });

  it.each([
    ['color fuera de la paleta', 'habits', 0, 'color', 'rosa'],
    ['tipo de hábito desconocido', 'habits', 0, 'kind', 'otro'],
    ['fecha inexistente', 'entries', 0, 'date', '2026-02-30'],
    ['fecha sin ceros', 'entries', 0, 'date', '2026-2-3'],
    ['fecha con hora', 'entries', 0, 'date', '2026-02-03T10:00'],
    ['valor negativo', 'entries', 0, 'value', -1],
    ['valor no numérico', 'entries', 0, 'value', '3'],
    ['valor nulo (era NaN)', 'entries', 0, 'value', null],
    ['ánimo fuera de escala', 'dayLogs', 0, 'mood', 6],
    ['ánimo decimal', 'dayLogs', 0, 'mood', 3.5],
    ['motivo de pausa desconocido', 'pauses', 0, 'reason', 'viaje'],
    ['identificador vacío', 'habits', 0, 'id', ''],
  ] as const)('%s', (_name, table, index, field, value) => {
    const raw = mutable();
    (raw.data[table]?.[index] as Record<string, unknown>)[field] = value;
    const errors = errorsOf(JSON.stringify(raw));
    expect(errors[0]).toContain(`${table}[${index}]`);
    expect(errors[0]).toContain(field);
  });

  it('frecuencia mal formada', () => {
    const raw = mutable();
    (raw.data.habits?.[0] as Record<string, unknown>)['frequency'] = { type: 'cada-tanto' };
    expect(errorsOf(JSON.stringify(raw))[0]).toContain('habits[0].frequency');
  });

  it('ajustes fuera de rango', () => {
    const raw = mutable();
    raw['settings'] = { ...DEFAULT_SETTINGS, retroLimitDays: 4000 };
    expect(errorsOf(JSON.stringify(raw))[0]).toContain('settings.retroLimitDays');
  });
});

describe('copia de seguridad: coherencia entre tablas', () => {
  it('dos registros del mismo hábito y día', () => {
    const data = dataset();
    const errors = errorsOf(
      serializeBackup(
        backup({ ...data, entries: [entry('2026-02-01', 1, 'h1'), entry('2026-02-01', 3, 'h1')] }),
      ),
    );
    expect(errors).toEqual([
      'Hay dos registros de «Leer» el 2026-02-01: solo se admite uno por día.',
    ]);
  });

  it('un registro de un hábito que no está en el archivo', () => {
    const data = dataset();
    const errors = errorsOf(
      serializeBackup(backup({ ...data, entries: [entry('2026-02-01', 1, 'fantasma')] })),
    );
    expect(errors[0]).toContain('entries[0]');
  });

  it('una pausa de un hábito que no está en el archivo', () => {
    const data = dataset();
    const errors = errorsOf(
      serializeBackup(backup({ ...data, pauses: [pause('2026-02-01', '2026-02-02', 'fantasma')] })),
    );
    expect(errors[0]).toContain('pauses[0]');
  });

  it('una pausa con el rango invertido', () => {
    const data = dataset();
    const errors = errorsOf(
      serializeBackup(backup({ ...data, pauses: [pause('2026-02-05', '2026-02-01')] })),
    );
    expect(errors[0]).toContain('fecha de fin es anterior');
  });

  it('identificadores repetidos', () => {
    const data = dataset();
    const [first] = data.habits;
    if (!first) throw new Error('fixture');
    const errors = errorsOf(serializeBackup(backup({ ...data, habits: [...data.habits, first] })));
    expect(errors.some((e) => e.includes('mismo identificador'))).toBe(true);
  });

  it('una categoría que no existe', () => {
    const data = dataset();
    const errors = errorsOf(
      serializeBackup(
        backup({ ...data, habits: [habit({ id: 'h1', name: 'Leer', categoryId: 'nada' })] }),
      ),
    );
    expect(errors[0]).toContain('su categoría no existe');
  });

  it('un hábito archivado antes de crearse', () => {
    const data = dataset();
    const errors = errorsOf(
      serializeBackup(
        backup({
          ...data,
          habits: [habit({ id: 'h1', createdOn: d('2026-03-01'), archivedOn: d('2026-02-01') })],
        }),
      ),
    );
    expect(errors[0]).toContain('termina antes de empezar');
  });

  it('un hábito que no pasaría el formulario', () => {
    const data = dataset();
    const errors = errorsOf(
      serializeBackup(
        backup({
          ...data,
          habits: [
            habit({
              id: 'h1',
              name: 'Fumar',
              kind: 'avoid',
              frequency: { type: 'perWeek', times: 3 },
            }),
          ],
        }),
      ),
    );
    expect(errors[0]).toContain('«Fumar»');
    expect(errors[0]).toContain('frequency');
  });

  it('dos ánimos del mismo día y dos revisiones de la misma semana', () => {
    const data = dataset();
    const errors = errorsOf(
      serializeBackup(
        backup({
          ...data,
          dayLogs: [dayLog('2026-02-01', 3), dayLog('2026-02-01', 4)],
          reviews: [review('2026-01-26'), review('2026-01-26')],
        }),
      ),
    );
    expect(errors).toHaveLength(2);
  });

  it('avisa de todos los problemas, no solo del primero, con un tope', () => {
    const data = dataset();
    const orphans = Array.from({ length: 25 }, (_, i) => ({
      ...entry('2026-02-01', 1, `fantasma${i}`),
    }));
    const result = validateBackup(
      JSON.parse(serializeBackup(backup({ ...data, entries: orphans }))),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toHaveLength(MAX_REPORTED_ERRORS);
      expect(result.more).toBe(25 - MAX_REPORTED_ERRORS);
    }
  });

  it('un archivo inválido nunca se acepta a medias', () => {
    const data = dataset();
    const result = parseBackup(
      serializeBackup(
        backup({ ...data, entries: [...data.entries, entry('2026-02-02', 5, 'fantasma')] }),
      ),
    );
    expect(result.ok).toBe(false);
    expect('backup' in result).toBe(false);
  });
});
