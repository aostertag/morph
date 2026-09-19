import { type DayLogPatch, restoreDayLog, updateDayLog } from '@/db/repos/dayLogs';
import type { LocalDay } from '@/domain/day';
import type { Scale } from '@/domain/types';
import { ENERGY_LABEL, formatRelativeDay, MOOD_LABEL } from '@/lib/format';
import { notify, notifyError } from '@/lib/toast';

/*
 * Registro de ánimo, energía y nota del día. Como el resto de escrituras, avisa
 * con un toast que permite deshacer; todas las del mismo día comparten clave,
 * así que corregir la escala varias veces seguidas deja un solo toast.
 */

function dayNote(day: LocalDay, today: LocalDay): string {
  return day === today ? '' : ` (${formatRelativeDay(day, today).toLowerCase()})`;
}

async function save(day: LocalDay, today: LocalDay, patch: DayLogPatch, message: string) {
  try {
    const snapshot = await updateDayLog(day, patch);
    notify(`${message}${dayNote(day, today)}`, {
      key: `daylog:${day}`,
      undo: () => restoreDayLog(day, snapshot),
    });
  } catch (error) {
    notifyError(error);
  }
}

export function setMood(day: LocalDay, today: LocalDay, mood: Scale | null): Promise<void> {
  return save(
    day,
    today,
    { mood },
    mood === null ? 'Ánimo quitado' : `Ánimo: ${MOOD_LABEL[mood].toLowerCase()}`,
  );
}

export function setEnergy(day: LocalDay, today: LocalDay, energy: Scale | null): Promise<void> {
  return save(
    day,
    today,
    { energy },
    energy === null ? 'Energía quitada' : `Energía: ${ENERGY_LABEL[energy].toLowerCase()}`,
  );
}

export function setDayNote(day: LocalDay, today: LocalDay, note: string): Promise<void> {
  const clean = note.trim();
  return save(
    day,
    today,
    { note: clean || null },
    clean ? 'Nota del día guardada' : 'Nota del día borrada',
  );
}
