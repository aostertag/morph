import { useEffect, useState } from 'react';
import type { LocalDay } from '@/domain/day';
import type { Habit } from '@/domain/types';
import { withUnit } from '@/lib/format';

/** `unsupported` si el navegador no tiene la API de notificaciones. */
export type NotificationSupport = NotificationPermission | 'unsupported';

export function notificationSupport(): NotificationSupport {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
}

/**
 * Estado del permiso. Se relee al volver a la pestaña porque el usuario puede
 * haberlo cambiado desde los ajustes del navegador.
 */
export function useNotificationSupport(): [NotificationSupport, () => Promise<void>] {
  const [support, setSupport] = useState<NotificationSupport>(notificationSupport);
  useEffect(() => {
    const refresh = () => setSupport(notificationSupport());
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  const request = async () => {
    if (typeof Notification === 'undefined') return;
    try {
      await Notification.requestPermission();
    } finally {
      setSupport(notificationSupport());
    }
  };
  return [support, request];
}

function bodyFor(habit: Habit): string {
  if (habit.target !== null && habit.kind !== 'boolean') {
    return `Meta de hoy: ${withUnit(habit.target, habit.unit)}.`;
  }
  return 'Pendiente hoy.';
}

/**
 * Muestra el aviso. Con service worker se usa su registro (es lo único que
 * funciona en Android); sin él, la API directa.
 */
export async function showReminder(habit: Habit): Promise<void> {
  if (notificationSupport() !== 'granted') return;
  const options: NotificationOptions = {
    body: bodyFor(habit),
    tag: `recordatorio-${habit.id}`,
    icon: '/pwa-192.png',
    badge: '/pwa-192.png',
    data: { url: '/' },
  };
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) {
      await registration.showNotification(habit.name, options);
      return;
    }
  } catch {
    // Se prueba la API directa.
  }
  try {
    const notification = new Notification(habit.name, options);
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch {
    // Sin permiso efectivo o sin soporte: no hay nada más que hacer.
  }
}

/*
 * Avisos ya enviados hoy. Se guardan para no repetirlos al recargar la página ni
 * entre pestañas; solo se conservan los del día en curso.
 */

const FIRED_KEY = 'tracker:reminders-fired';

interface FiredStore {
  readonly day: LocalDay;
  readonly keys: readonly string[];
}

export function loadFired(today: LocalDay): Set<string> {
  try {
    const raw = localStorage.getItem(FIRED_KEY);
    if (!raw) return new Set();
    const stored = JSON.parse(raw) as Partial<FiredStore>;
    return stored.day === today && Array.isArray(stored.keys) ? new Set(stored.keys) : new Set();
  } catch {
    return new Set();
  }
}

export function saveFired(today: LocalDay, keys: ReadonlySet<string>): void {
  try {
    const value: FiredStore = { day: today, keys: [...keys] };
    localStorage.setItem(FIRED_KEY, JSON.stringify(value));
  } catch {
    // Sin almacenamiento, un aviso podría repetirse tras recargar: es aceptable.
  }
}
