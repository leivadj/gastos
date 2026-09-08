// Service worker de notificaciones push (Web Push) — ver migration_30 y
// components/NotificacionesPush.tsx. Solo hace 2 cosas: mostrar el push que
// llega del servidor (app/api/sugerencias-correo, vía la librería
// `web-push`) y, si lo tocan, abrir/enfocar la app en /sugerencias.
//
// No cachea nada ni intercepta `fetch` a propósito — este service worker
// existe solo para poder recibir push en segundo plano, no como PWA
// offline-first.

self.addEventListener("push", (event) => {
  let datos = {};
  try {
    datos = event.data ? event.data.json() : {};
  } catch {
    datos = { titulo: "Gastos del Hogar", cuerpo: event.data ? event.data.text() : "" };
  }

  const titulo = datos.titulo || "Gastos del Hogar";
  const opciones = {
    body: datos.cuerpo || "Hay una sugerencia nueva del correo del banco.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: datos.url || "/sugerencias" },
  };

  event.waitUntil(self.registration.showNotification(titulo, opciones));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/sugerencias";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((listaClientes) => {
      for (const cliente of listaClientes) {
        // Si ya hay una pestaña/ventana de la app abierta, la enfocamos y
        // navegamos ahí en vez de abrir una nueva.
        if ("focus" in cliente) {
          cliente.navigate(url);
          return cliente.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});
