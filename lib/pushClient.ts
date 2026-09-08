// Helpers de Web Push del lado del navegador — usados solo por
// components/NotificacionesPush.tsx. La clave pública VAPID viene en
// base64url (formato estándar de VAPID) pero `PushManager.subscribe`
// pide un Uint8Array, de ahí la conversión.
export function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const salida = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    salida[i] = raw.charCodeAt(i);
  }
  return salida;
}

// true si el navegador soporta Service Worker + Push + Notification. En
// iPhone, esto da true solo si la app está instalada en la pantalla de
// inicio (ahí Safari expone estas APIs; en una pestaña normal de Safari no
// existen todavía).
export function soportaPush(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

// En iOS, Web Push solo funciona si la PWA está "instalada" (agregada a la
// pantalla de inicio) y corriendo en modo standalone — no alcanza con tenerla
// abierta en una pestaña de Safari. display-mode: standalone es la forma
// estándar de detectar eso.
export function estaInstaladaComoApp(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

export function esIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
