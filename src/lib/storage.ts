/**
 * Pide al navegador que no expulse los datos de la app cuando falte espacio.
 * No bloquea el arranque y no muestra nada: Chrome y Edge deciden solos (según uso e
 * instalación); Firefox puede mostrar su propio permiso. Nunca lanza.
 */
export function requestPersistentStorage(): void {
  if (typeof navigator === 'undefined' || typeof navigator.storage?.persist !== 'function') {
    if (import.meta.env.DEV) console.info('[storage] persist() no está disponible');
    return;
  }
  navigator.storage.persist().then(
    (granted) => {
      if (import.meta.env.DEV) console.info(`[storage] persist() → ${granted}`);
    },
    (error: unknown) => {
      if (import.meta.env.DEV) console.info('[storage] persist() falló', error);
    },
  );
}
