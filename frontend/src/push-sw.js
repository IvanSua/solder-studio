/**
 * Push notification handler for TiendaRopa.
 *
 * This script is loaded as a separate service worker alongside the Angular SW.
 * It handles `push` and `notificationclick` events from the browser.
 *
 * Registration: see app.config.ts — registered via navigator.serviceWorker.register('/push-sw.js')
 */

self.addEventListener('push', event => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'TiendaRopa', body: event.data.text(), url: '/' };
  }

  const title   = payload.title  ?? 'TiendaRopa';
  const options = {
    body:      payload.body    ?? '',
    icon:      payload.icon    ?? '/assets/icons/icon-192x192.png',
    badge:     payload.badge   ?? '/assets/icons/icon-72x72.png',
    tag:       payload.tag     ?? 'tiendaropa-notification',
    data:      { url: payload.url ?? '/' },
    timestamp: payload.timestamp ?? Date.now(),
    renotify:  false,
    requireInteraction: false,
    actions: payload.url ? [{ action: 'open', title: 'Ver' }] : [],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();

  const url = event.notification.data?.url ?? '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // If the app is already open, focus and navigate
      for (const client of windowClients) {
        if ('focus' in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      // Otherwise, open a new window
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
