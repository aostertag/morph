import { type LocalDay, toLocalDate } from './day';
import type { Habit } from './types';

/**
 * Recordatorios. Sin servidor push, solo pueden dispararse con la app abierta (o
 * en segundo plano el rato que el navegador la mantenga viva). Aquí vive la parte
 * pura: qué avisos tocan ahora y cuándo es el siguiente.
 */

/** Un aviso que llega más tarde que esto se descarta: ya no sirve de recordatorio. */
export const REMINDER_GRACE_MS = 30 * 60_000;

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Instante (ms) de una hora local `HH:mm` de un día concreto; `null` si no es válida. */
export function reminderAt(day: LocalDay, time: string): number | null {
  const match = TIME_RE.exec(time);
  if (!match) return null;
  const date = toLocalDate(day);
  date.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return date.getTime();
}

export function reminderKey(habitId: string, day: LocalDay): string {
  return `${habitId}:${day}`;
}

export interface ReminderCandidate {
  readonly habit: Habit;
  /** Hoy toca, no está en pausa y aún no está hecho. */
  readonly pending: boolean;
}

export interface ReminderPlan {
  /** Avisos que deben salir ya. */
  readonly due: readonly Habit[];
  /** Instante del siguiente aviso de hoy, si queda alguno. */
  readonly nextAt: number | null;
}

/**
 * Qué avisar ahora y cuándo volver a mirar. Un aviso ya enviado hoy (`fired`) no se
 * repite, uno pasado hace más de `graceMs` se da por perdido y uno de un hábito que
 * ya no está pendiente no sale.
 */
export function planReminders(
  candidates: readonly ReminderCandidate[],
  now: number,
  today: LocalDay,
  fired: ReadonlySet<string>,
  graceMs: number = REMINDER_GRACE_MS,
): ReminderPlan {
  const due: Habit[] = [];
  let nextAt: number | null = null;

  for (const { habit, pending } of candidates) {
    const { reminder } = habit;
    if (!pending || !reminder?.enabled || habit.archivedOn !== null) continue;
    if (fired.has(reminderKey(habit.id, today))) continue;
    const at = reminderAt(today, reminder.time);
    if (at === null) continue;
    if (at > now) {
      nextAt = nextAt === null ? at : Math.min(nextAt, at);
    } else if (now - at <= graceMs) {
      due.push(habit);
    }
  }
  return { due, nextAt };
}
