import { EMPTY_DATA, readSnapshot, restoreSnapshot } from '@/db/repos/dataset';
import {
  BACKUP_MAX_BYTES,
  type Backup,
  type BackupResult,
  buildBackup,
  parseBackup,
  serializeBackup,
  summarize,
} from '@/domain/backup';
import { entriesToCsv } from '@/domain/csv';
import { toLocalDay } from '@/domain/day';
import { DEFAULT_SETTINGS } from '@/domain/types';
import { downloadTextFile } from '@/lib/download';
import { formatNumber } from '@/lib/format';
import { notify, notifyError } from '@/lib/toast';
import { useTimerStore } from '@/state/timer';

/*
 * Exportar, importar y borrar. Importar y borrar sustituyen todo en una única
 * transacción (`restoreSnapshot`) y devuelven el estado anterior, que es lo que
 * usa "Deshacer": nunca hay un estado intermedio ni una pérdida sin salida.
 */

function stamp(): string {
  return toLocalDay(Date.now());
}

function counts(habits: number, entries: number): string {
  const h = `${formatNumber(habits)} ${habits === 1 ? 'hábito' : 'hábitos'}`;
  const e = `${formatNumber(entries)} ${entries === 1 ? 'registro' : 'registros'}`;
  return `${h} y ${e}`;
}

export async function exportBackup(): Promise<void> {
  try {
    const { data, settings } = await readSnapshot();
    const backup = buildBackup(data, settings ?? DEFAULT_SETTINGS, new Date());
    downloadTextFile(`habitos-copia-${stamp()}.json`, serializeBackup(backup), 'application/json');
    notify(`Copia guardada: ${counts(data.habits.length, data.entries.length)}.`);
  } catch (error) {
    notifyError(error);
  }
}

export async function exportCsv(): Promise<void> {
  try {
    const { data } = await readSnapshot();
    // El BOM hace que Excel abra el archivo como UTF-8 y respete las tildes.
    downloadTextFile(
      `habitos-registros-${stamp()}.csv`,
      `﻿${entriesToCsv(data.habits, data.entries)}`,
      'text/csv;charset=utf-8',
    );
    notify(`Registros exportados: ${formatNumber(data.entries.length)}.`);
  } catch (error) {
    notifyError(error);
  }
}

/** Lee y valida un archivo. No toca la base de datos. */
export async function readBackupFile(file: File): Promise<BackupResult> {
  if (file.size > BACKUP_MAX_BYTES) {
    return {
      ok: false,
      errors: ['El archivo es demasiado grande para ser una copia de seguridad de esta app.'],
      more: 0,
    };
  }
  let text: string;
  try {
    text = await file.text();
  } catch {
    return {
      ok: false,
      errors: ['No se pudo leer el archivo. Vuelve a elegirlo.'],
      more: 0,
    };
  }
  return parseBackup(text);
}

/** Lo que hay guardado ahora, para decir qué se va a sustituir. */
export async function currentCounts() {
  return summarize((await readSnapshot()).data);
}

/** Sustituye todo por el contenido de una copia ya validada. */
export async function applyBackup(backup: Backup): Promise<void> {
  try {
    const previous = await restoreSnapshot({ data: backup.data, settings: backup.settings });
    useTimerStore.getState().clearAll();
    notify(`Copia importada: ${counts(backup.data.habits.length, backup.data.entries.length)}.`, {
      undo: async () => {
        await restoreSnapshot(previous);
        useTimerStore.getState().clearAll();
      },
    });
  } catch (error) {
    notifyError(error);
  }
}

/** Borra los datos y los ajustes. */
export async function deleteEverything(): Promise<void> {
  try {
    const previous = await restoreSnapshot({ data: EMPTY_DATA, settings: null });
    useTimerStore.getState().clearAll();
    notify('Todos los datos se han borrado.', {
      undo: async () => {
        await restoreSnapshot(previous);
      },
    });
  } catch (error) {
    notifyError(error);
  }
}
