// Se carga dentro del service worker (`importScripts`). Al pulsar un recordatorio,
// enfoca la app si ya está abierta y, si no, la abre.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => 'focus' in client);
      return open ? open.focus() : self.clients.openWindow(target);
    }),
  );
});
