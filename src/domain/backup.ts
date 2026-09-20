import { z } from 'zod';
import { isLocalDay, type LocalDay, type Weekday } from './day';
import { type HabitInput, validateHabitInput } from './habit';
import { type DataSet, HABIT_COLORS, type Habit, type Settings } from './types';

/*
 * Copia de seguridad completa. Todo lo que hay aquí es puro: recibe el texto del
 * archivo y devuelve o bien una copia validada de arriba abajo o bien la lista de
 * problemas. La base de datos no se toca hasta que `parseBackup` dice `ok`.
 *
 * La validación va por etapas y en este orden, porque cada una supone la anterior:
 *   1. el texto es JSON;
 *   2. es una copia de esta app y de una versión que sabemos leer (y se migra);
 *   3. cada campo de cada registro tiene la forma y el tipo correctos;
 *   4. cada hábito cumple las reglas del formulario;
 *   5. las referencias entre tablas cuadran y no hay duplicados que el índice
 *      único de la base rechazaría a mitad de la escritura.
 */

export const BACKUP_FORMAT = 'habit-tracker-backup';
/** Versión que escribe esta app. Al cambiar el formato: subirla y añadir su migración. */
export const BACKUP_VERSION = 1;

/** Archivos por encima de esto se rechazan sin leerlos: una copia real pesa unos MB. */
export const BACKUP_MAX_BYTES = 50 * 1024 * 1024;

/** Cuántos problemas se detallan antes de resumir el resto. */
export const MAX_REPORTED_ERRORS = 10;

export interface Backup {
  readonly format: typeof BACKUP_FORMAT;
  readonly version: number;
  /** Instante de la exportación, ISO 8601. */
  readonly exportedAt: string;
  readonly settings: Settings;
  readonly data: DataSet;
}

export interface BackupSummary {
  readonly habits: number;
  readonly entries: number;
  readonly dayLogs: number;
  readonly pauses: number;
  readonly reviews: number;
  readonly categories: number;
}

export type BackupResult =
  | { readonly ok: true; readonly backup: Backup; readonly summary: BackupSummary }
  | {
      readonly ok: false;
      /** Problemas detallados, como mucho `MAX_REPORTED_ERRORS`. */
      readonly errors: readonly string[];
      /** Cuántos problemas más había sin detallar. */
      readonly more: number;
    };

export function summarize(data: DataSet): BackupSummary {
  return {
    habits: data.habits.length,
    entries: data.entries.length,
    dayLogs: data.dayLogs.length,
    pauses: data.pauses.length,
    reviews: data.reviews.length,
    categories: data.categories.length,
  };
}

export function buildBackup(data: DataSet, settings: Settings, exportedAt: Date): Backup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: exportedAt.toISOString(),
    settings,
    data,
  };
}

export function serializeBackup(backup: Backup): string {
  return JSON.stringify(backup, null, 2);
}

/*
 * Esquemas. Son estrictos: un campo desconocido es un error, porque significa que
 * el archivo no es lo que creemos (o que se ha editado a mano).
 */

const day = z.custom<LocalDay>(
  (value) => isLocalDay(value),
  'Fecha no válida: se esperaba un día real con formato AAAA-MM-DD.',
);
const id = z.string().min(1).max(100);
const shortText = z.string().max(2_000);
const longText = z.string().max(50_000);
const timestamp = z.number().finite().nonnegative();
const weekday = z.literal([0, 1, 2, 3, 4, 5, 6] as const satisfies readonly Weekday[]);
const scale = z.literal([1, 2, 3, 4, 5]);

const frequency = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('daily') }),
  z.strictObject({ type: z.literal('weekdays'), days: z.array(weekday).max(7) }),
  z.strictObject({ type: z.literal('perWeek'), times: z.int() }),
  z.strictObject({ type: z.literal('perMonth'), times: z.int() }),
]);

const habitSchema = z.strictObject({
  id,
  name: shortText,
  description: shortText,
  color: z.enum(HABIT_COLORS),
  icon: z.string().max(60).nullable(),
  categoryId: id.nullable(),
  kind: z.enum(['boolean', 'quantity', 'time', 'avoid']),
  target: z.number().finite().nullable(),
  unit: z.string().max(100).nullable(),
  frequency,
  timeOfDay: z.enum(['morning', 'afternoon', 'evening', 'any']),
  reminder: z.strictObject({ time: z.string().max(10), enabled: z.boolean() }).nullable(),
  createdOn: day,
  archivedOn: day.nullable(),
  order: z.int(),
});

const settingsSchema = z.strictObject({
  theme: z.enum(['light', 'dark', 'system']),
  weekStartsOn: weekday,
  retroLimitDays: z.int().min(0).max(365),
  onboardingDone: z.boolean(),
  lastReviewOffered: day.nullable(),
});

const dataSchema = z.strictObject({
  categories: z.array(z.strictObject({ id, name: shortText, order: z.int() })),
  habits: z.array(habitSchema),
  entries: z.array(
    z.strictObject({
      id,
      habitId: id,
      date: day,
      value: z.number().finite().nonnegative(),
      note: longText.nullable(),
      loggedAt: timestamp,
    }),
  ),
  dayLogs: z.array(
    z.strictObject({
      date: day,
      mood: scale.nullable(),
      energy: scale.nullable(),
      note: longText.nullable(),
      updatedAt: timestamp,
    }),
  ),
  pauses: z.array(
    z.strictObject({
      id,
      habitId: id.nullable(),
      start: day,
      end: day,
      reason: z.enum(['vacaciones', 'enfermedad', 'otro']),
      note: shortText.nullable(),
    }),
  ),
  reviews: z.array(
    z.strictObject({
      weekStart: day,
      reflection: longText,
      createdAt: timestamp,
      updatedAt: timestamp,
    }),
  ),
});

const backupSchema = z.strictObject({
  format: z.literal(BACKUP_FORMAT),
  version: z.int(),
  exportedAt: z.string().max(100),
  settings: settingsSchema,
  data: dataSchema,
});

/*
 * Migraciones de formato: `MIGRATIONS[n]` convierte una copia de la versión n en
 * una de la n+1. Hoy solo existe la versión 1, así que no hay ninguna.
 */
const MIGRATIONS: Readonly<
  Record<number, (raw: Record<string, unknown>) => Record<string, unknown>>
> = {};

function migrate(raw: Record<string, unknown>, from: number): Record<string, unknown> {
  let current = raw;
  for (let version = from; version < BACKUP_VERSION; version++) {
    const step = MIGRATIONS[version];
    if (!step) throw new Error(`Falta la migración de la versión ${version}.`);
    current = { ...step(current), version: version + 1 };
  }
  return current;
}

/** Ruta legible: `habits[2].color`. Se quita el `data.` inicial, que no aporta. */
function describePath(path: readonly PropertyKey[]): string {
  const parts = path[0] === 'data' ? path.slice(1) : path;
  let text = '';
  for (const part of parts) {
    text += typeof part === 'number' ? `[${part}]` : `${text ? '.' : ''}${String(part)}`;
  }
  return text || 'archivo';
}

const localeError = z.locales.es().localeError;

function schemaErrors(issues: readonly z.core.$ZodIssue[]): string[] {
  return issues.map((issue) => `${describePath(issue.path)}: ${issue.message}`);
}

function fail(errors: readonly string[]): BackupResult {
  return {
    ok: false,
    errors: errors.slice(0, MAX_REPORTED_ERRORS),
    more: Math.max(0, errors.length - MAX_REPORTED_ERRORS),
  };
}

function habitInputOf(habit: Habit): HabitInput {
  const { id: _id, order: _order, archivedOn: _archivedOn, ...input } = habit;
  return input;
}

function duplicates<T>(items: readonly T[], key: (item: T) => string): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const item of items) {
    const k = key(item);
    if (seen.has(k)) repeated.add(k);
    seen.add(k);
  }
  return [...repeated];
}

/** Reglas de cada hábito y referencias entre tablas. Supone que la forma ya es correcta. */
export function checkIntegrity(data: DataSet): string[] {
  const errors: string[] = [];
  const habitName = new Map(data.habits.map((h) => [h.id, h.name]));
  const categoryIds = new Set(data.categories.map((c) => c.id));
  const label = (habitId: string) => `«${habitName.get(habitId) ?? habitId}»`;

  data.habits.forEach((habit, index) => {
    for (const [field, message] of Object.entries(validateHabitInput(habitInputOf(habit)))) {
      errors.push(`habits[${index}] (${label(habit.id)}) · ${field}: ${message}`);
    }
    if (habit.archivedOn !== null && habit.archivedOn < habit.createdOn) {
      errors.push(`habits[${index}] (${label(habit.id)}): termina antes de empezar.`);
    }
    if (habit.categoryId !== null && !categoryIds.has(habit.categoryId)) {
      errors.push(`habits[${index}] (${label(habit.id)}): su categoría no existe en el archivo.`);
    }
  });

  for (const [table, ids] of [
    ['categorías', duplicates(data.categories, (c) => c.id)],
    ['hábitos', duplicates(data.habits, (h) => h.id)],
    ['registros', duplicates(data.entries, (e) => e.id)],
    ['pausas', duplicates(data.pauses, (p) => p.id)],
  ] as const) {
    for (const repeated of ids)
      errors.push(`Hay dos ${table} con el mismo identificador (${repeated}).`);
  }

  for (const key of duplicates(data.entries, (e) => `${e.habitId}\u0000${e.date}`)) {
    const [habitId = '', date = ''] = key.split('\u0000');
    errors.push(`Hay dos registros de ${label(habitId)} el ${date}: solo se admite uno por día.`);
  }
  for (const date of duplicates(data.dayLogs, (l) => l.date)) {
    errors.push(`Hay dos registros de ánimo del día ${date}.`);
  }
  for (const week of duplicates(data.reviews, (r) => r.weekStart)) {
    errors.push(`Hay dos revisiones de la semana que empieza el ${week}.`);
  }

  data.entries.forEach((entry, index) => {
    if (!habitName.has(entry.habitId)) {
      errors.push(`entries[${index}]: pertenece a un hábito que no está en el archivo.`);
    }
  });
  data.pauses.forEach((pause, index) => {
    if (pause.habitId !== null && !habitName.has(pause.habitId)) {
      errors.push(`pauses[${index}]: pertenece a un hábito que no está en el archivo.`);
    }
    if (pause.end < pause.start) {
      errors.push(`pauses[${index}]: la fecha de fin es anterior a la de inicio.`);
    }
  });

  return errors;
}

/** Valida una copia ya convertida de JSON. */
export function validateBackup(raw: unknown): BackupResult {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return fail(['El archivo no es una copia de seguridad de esta app.']);
  }
  const envelope = raw as Record<string, unknown>;
  if (envelope['format'] !== BACKUP_FORMAT) {
    return fail(['El archivo no es una copia de seguridad de esta app.']);
  }
  const version = envelope['version'];
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return fail(['El archivo no indica una versión válida.']);
  }
  if (version > BACKUP_VERSION) {
    return fail([
      `La copia es de una versión más nueva (${version}) que esta app (${BACKUP_VERSION}). Actualiza la app y vuelve a intentarlo.`,
    ]);
  }

  const parsed = backupSchema.safeParse(migrate(envelope, version), { error: localeError });
  if (!parsed.success) return fail(schemaErrors(parsed.error.issues));

  const backup: Backup = parsed.data;
  const problems = checkIntegrity(backup.data);
  if (problems.length > 0) return fail(problems);

  return { ok: true, backup, summary: summarize(backup.data) };
}

/** Lee el texto de un archivo. Es la única entrada pública para importar. */
export function parseBackup(text: string): BackupResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return fail(['El archivo no es JSON válido. ¿Está incompleto o dañado?']);
  }
  return validateBackup(raw);
}
