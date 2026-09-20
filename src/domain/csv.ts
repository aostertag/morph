import type { Entry, Habit, HabitKind } from './types';

const KIND_LABEL: Readonly<Record<HabitKind, string>> = {
  boolean: 'Sí/No',
  quantity: 'Cantidad',
  time: 'Tiempo',
  avoid: 'A evitar',
};

export const CSV_HEADER = ['fecha', 'habito', 'tipo', 'valor', 'unidad', 'nota'] as const;

/**
 * Una celda de texto. Se entrecomilla si hace falta y, si empieza por un carácter
 * que una hoja de cálculo interpretaría como fórmula (`=`, `+`, `-`, `@`, tabulador
 * o retorno), se antepone un apóstrofo: una nota copiada de la web no debe poder
 * ejecutar nada al abrir el archivo.
 */
export function csvText(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Registros como CSV (RFC 4180, saltos CRLF): una fila por hábito y día, en orden cronológico. */
export function entriesToCsv(habits: readonly Habit[], entries: readonly Entry[]): string {
  const byId = new Map(habits.map((habit) => [habit.id, habit]));
  const rows = entries
    .map((entry) => ({ entry, habit: byId.get(entry.habitId) }))
    .sort(
      (a, b) =>
        a.entry.date.localeCompare(b.entry.date) ||
        (a.habit?.order ?? 0) - (b.habit?.order ?? 0) ||
        a.entry.habitId.localeCompare(b.entry.habitId),
    )
    .map(({ entry, habit }) =>
      [
        entry.date,
        csvText(habit?.name ?? ''),
        habit ? KIND_LABEL[habit.kind] : '',
        String(entry.value),
        csvText(habit?.kind === 'time' ? 'min' : (habit?.unit ?? '')),
        csvText(entry.note ?? ''),
      ].join(','),
    );
  return [CSV_HEADER.join(','), ...rows].join('\r\n') + '\r\n';
}
