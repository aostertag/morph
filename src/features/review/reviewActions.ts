import { restoreReview, saveReflection } from '@/db/repos/reviews';
import { updateSettings } from '@/db/repos/settings';
import type { LocalDay } from '@/domain/day';
import { notify, notifyError } from '@/lib/toast';

/*
 * Escrituras de la revisión semanal. Como el resto de la app, guardar avisa con
 * un toast que permite deshacer y todas las escrituras de la misma semana
 * comparten clave, así que corregir la reflexión deja un único aviso.
 */

/** Guarda la reflexión de la semana; vacía, la borra. */
export async function saveReview(weekStart: LocalDay, reflection: string): Promise<void> {
  try {
    const snapshot = await saveReflection(weekStart, reflection);
    // Escrita la revisión, el aviso de Hoy ya no tiene nada que ofrecer.
    await updateSettings({ lastReviewOffered: weekStart });
    notify(reflection.trim() ? 'Revisión guardada' : 'Revisión borrada', {
      key: `review:${weekStart}`,
      undo: () => restoreReview(weekStart, snapshot),
    });
  } catch (error) {
    notifyError(error);
  }
}

/**
 * Aparta el aviso de la semana sin escribir nada. No lleva "deshacer": no se ha
 * perdido nada y la revisión sigue estando en su pantalla.
 */
export async function dismissReview(weekStart: LocalDay): Promise<void> {
  try {
    await updateSettings({ lastReviewOffered: weekStart });
  } catch (error) {
    notifyError(error);
  }
}
