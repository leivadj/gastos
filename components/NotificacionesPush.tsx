"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { esIOS, estaInstaladaComoApp, soportaPush, urlBase64ToUint8Array } from "@/lib/pushClient";

type Estado = "cargando" | "no_soportado" | "ios_falta_instalar" | "inactivo" | "activo" | "guardando";

// Fila "Notificaciones" del perfil (/mas, dentro de PerfilPropioCard) — deja
// prender/apagar el aviso push que llega apenas GastosBot detecta un
// movimiento nuevo en el correo (ver app/api/sugerencias-correo). Autónomo:
// se fija solo si ya hay una suscripción activa, y guarda/borra la fila en
// push_subscriptions (ver migration_30_push_subscriptions.sql) bajo tu
// propia cuenta (RLS).
export function NotificacionesPush({ compacto = false }: { compacto?: boolean } = {}) {
  const [estado, setEstado] = useState<Estado>("cargando");
  const [error, setError] = useState("");

  useEffect(() => {
    async function detectar() {
      if (!soportaPush()) {
        // En iPhone/iPad sin instalar a la pantalla de inicio, el navegador
        // directamente no expone las APIs de push — por eso "no soportado"
        // en iOS se trata aparte (mensaje "instalá la app"), no como un
        // error genérico de navegador incompatible.
        setEstado(esIOS() && !estaInstaladaComoApp() ? "ios_falta_instalar" : "no_soportado");
        return;
      }
      if (esIOS() && !estaInstaladaComoApp()) {
        setEstado("ios_falta_instalar");
        return;
      }
      try {
        const registro = await navigator.serviceWorker.register("/sw.js");
        const sub = await registro.pushManager.getSubscription();
        setEstado(sub ? "activo" : "inactivo");
      } catch {
        setEstado("inactivo");
      }
    }
    detectar();
  }, []);

  async function activar() {
    setError("");
    setEstado("guardando");
    try {
      const clavePublica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!clavePublica) {
        throw new Error("Falta configurar NEXT_PUBLIC_VAPID_PUBLIC_KEY.");
      }

      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") {
        setError(permiso === "denied" ? "Bloqueaste las notificaciones para esta app en el navegador." : "No se activaron las notificaciones.");
        setEstado("inactivo");
        return;
      }

      const registro = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      let sub = await registro.pushManager.getSubscription();
      if (!sub) {
        sub = await registro.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(clavePublica) as BufferSource,
        });
      }

      const json = sub.toJSON();
      const { error: errDb } = await supabase.from("push_subscriptions").upsert(
        {
          endpoint: sub.endpoint,
          p256dh: json.keys?.p256dh ?? "",
          auth: json.keys?.auth ?? "",
        },
        { onConflict: "endpoint" }
      );
      if (errDb) throw errDb;

      setEstado("activo");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo activar las notificaciones.");
      setEstado("inactivo");
    }
  }

  async function desactivar() {
    setError("");
    setEstado("guardando");
    try {
      const registro = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await registro?.pushManager.getSubscription();
      if (sub) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        await sub.unsubscribe();
      }
      setEstado("inactivo");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo desactivar.");
      setEstado("activo");
    }
  }

  if (estado === "cargando") return null;

  // "Compacto" (usada dentro de la sección "Configuración" de /mas, ronda 6
  // del rediseño): sin su propio recuadro con borde — ya vive dentro de la
  // lista de filas de esa sección, que pone el borde/separador por afuera.
  const contenedor = compacto ? "py-3" : "mt-3 rounded-lg border border-gray-200 px-3 py-2 dark:border-white/10";

  if (estado === "no_soportado") {
    return (
      <div className={contenedor}>
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Notificaciones</span>
        <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">Tu navegador no soporta notificaciones push.</p>
      </div>
    );
  }

  if (estado === "ios_falta_instalar") {
    return (
      <div className={contenedor}>
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Notificaciones</span>
        <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
          Para recibir avisos en el iPhone, primero agregá esta app a tu pantalla de inicio (compartir → &quot;Agregar a pantalla de
          inicio&quot;) y abrila desde ahí — no funciona desde una pestaña de Safari.
        </p>
      </div>
    );
  }

  const activo = estado === "activo";
  const guardando = estado === "guardando";

  return (
    <div className={contenedor}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Notificaciones</span>
        <button
          type="button"
          onClick={activo ? desactivar : activar}
          disabled={guardando}
          className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold transition disabled:opacity-60 ${
            activo
              ? "border border-gray-200 text-gray-500 hover:border-red-200 hover:text-red-500 dark:border-white/10 dark:text-gray-300"
              : "bg-brand-gradient text-white"
          }`}
        >
          {guardando ? "…" : activo ? "Desactivar" : "Activar"}
        </button>
      </div>
      <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
        {activo ? "Te avisamos apenas aparece una sugerencia nueva del correo del banco." : "Recibí un aviso en el celular apenas se detecta un movimiento nuevo en el correo."}
      </p>
      {error && <p className="mt-1 text-[11px] text-red-500 dark:text-red-400">{error}</p>}
    </div>
  );
}
