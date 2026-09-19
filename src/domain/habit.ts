import { validateFrequency } from './frequency';
import { HABIT_COLORS, type Habit } from './types';

/** Datos que el usuario define al crear o editar un hábito. */
export type HabitInput = Omit<Habit, 'id' | 'order' | 'archivedOn'>;

export type HabitField =
  | 'name'
  | 'description'
  | 'color'
  | 'target'
  | 'unit'
  | 'frequency'
  | 'reminder';
export type HabitErrors = Partial<Record<HabitField, string>>;

export const NAME_MAX = 60;
export const DESCRIPTION_MAX = 280;
export const UNIT_MAX = 20;

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Limpia espacios y descarta campos que no aplican al tipo de hábito. */
export function normalizeHabitInput(input: HabitInput): HabitInput {
  const needsTarget = input.kind === 'quantity' || input.kind === 'time';
  return {
    ...input,
    name: input.name.trim().replace(/\s+/g, ' '),
    description: input.description.trim(),
    target: needsTarget ? input.target : null,
    unit: unitFor(input),
  };
}

function unitFor(input: HabitInput): string | null {
  if (input.kind === 'time') return 'min';
  if (input.kind === 'quantity') return input.unit?.trim() || null;
  return null;
}

/** Errores por campo, en español. Un objeto vacío significa que es válido. */
export function validateHabitInput(raw: HabitInput): HabitErrors {
  const input = normalizeHabitInput(raw);
  const errors: HabitErrors = {};

  if (input.name.length === 0) errors.name = 'Ponle un nombre.';
  else if (input.name.length > NAME_MAX) errors.name = `Máximo ${NAME_MAX} caracteres.`;

  if (input.description.length > DESCRIPTION_MAX) {
    errors.description = `Máximo ${DESCRIPTION_MAX} caracteres.`;
  }

  if (!HABIT_COLORS.includes(input.color)) errors.color = 'Elige un color de la paleta.';

  if (input.kind === 'quantity' || input.kind === 'time') {
    const { target } = input;
    if (target === null || !Number.isFinite(target) || target <= 0) {
      errors.target =
        input.kind === 'time' ? 'Indica los minutos de la meta.' : 'Indica una meta mayor que 0.';
    } else if (target > 100_000) {
      errors.target = 'La meta es demasiado grande.';
    }
  }

  if (input.kind === 'quantity') {
    if (!input.unit) errors.unit = 'Indica la unidad (vasos, pasos, páginas…).';
    else if (input.unit.length > UNIT_MAX) errors.unit = `Máximo ${UNIT_MAX} caracteres.`;
  }

  const frequencyError = validateFrequency(input.frequency, input.kind);
  if (frequencyError) errors.frequency = frequencyError;

  if (input.reminder && !TIME_RE.test(input.reminder.time)) {
    errors.reminder = 'Hora no válida (HH:mm).';
  }

  return errors;
}

export function isValidHabitInput(input: HabitInput): boolean {
  return Object.keys(validateHabitInput(input)).length === 0;
}
