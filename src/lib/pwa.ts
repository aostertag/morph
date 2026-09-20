import { notify } from './toast';

/**
 * Registra el service worker (solo en producción). Cuando hay una versión nueva no
 * se recarga por sorpresa: se avisa y el usuario decide cuándo.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  void import('virtual:pwa-register').then(({ registerSW }) => {
    const update = registerSW({
      onNeedRefresh() {
        notify('Hay una versión nueva de la app.', {
          persist: true,
          action: { label: 'Recargar', run: () => void update(true) },
        });
      },
      onOfflineReady() {
        notify('La app ya funciona sin conexión.');
      },
    });
  });
}
