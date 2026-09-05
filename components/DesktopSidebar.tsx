"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { esAdmin as checkEsAdmin } from "@/components/navItems";
import { MovimientoFab } from "@/components/MovimientoRapido";
import { ThemeToggle } from "@/components/ThemeToggle";

// Sidebar fijo de escritorio — reemplaza al antiguo header horizontal
// (DesktopNav.tsx, eliminado). El celular no se toca: sigue usando
// BottomNav + /mas tal cual (ver navItems.tsx), esta lista es una IA
// pensada para escritorio, con más espacio disponible.
//
// Difiere de navItems.tsx a propósito en 2 lugares:
//  - "Fijos" y "Compras en cuotas" son ítems propios acá (apuntan a
//    /gastos?tab=fijos y /gastos?tab=cuotas) en vez de un único "Gastos",
//    para que la barra lateral se lea como el resto de apps de este tipo —
//    la pantalla de destino sigue siendo la misma (/gastos con pestañas),
//    así que no hace falta ninguna pantalla nueva.
//  - No incluye Auto/Salud/Ingresos/Calendario/Admin — esos quedan
//    alcanzables desde "Más" (al final de esta lista), igual que en el
//    celular, para no saturar la barra. Quedará para otra pasada decidir
//    si conviene subir alguno acá.
const ITEMS = [
  {
    href: "/",
    label: "Inicio",
    icon: (a: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.4 : 2}>
        <path d="M3 11.5 12 4l9 7.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5.5 10v9a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1v-9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/tarjetas",
    label: "Cuentas",
    icon: (a: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.4 : 2}>
        <rect x="3" y="6" width="18" height="13" rx="2.5" />
        <path d="M3 10h18" strokeLinecap="round" />
        <path d="M7 15h4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/presupuesto",
    label: "Presupuestos",
    icon: (a: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.4 : 2}>
        <path d="M12 3v9l7.5 4.3" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="9" />
      </svg>
    ),
  },
  {
    href: "/gastos?tab=fijos",
    label: "Fijos",
    activo: (p: string) => p === "/gastos",
    icon: (a: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.4 : 2}>
        <rect x="4" y="3.5" width="16" height="17" rx="2" />
        <path d="M8 8h8M8 12h8M8 16h5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/metas-ahorro",
    label: "Metas",
    icon: (a: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.4 : 2}>
        <circle cx="12" cy="12" r="8.5" />
        <circle cx="12" cy="12" r="4" />
      </svg>
    ),
  },
  {
    href: "/gastos?tab=cuotas",
    label: "Compras en cuotas",
    activo: () => false, // "Fijos" ya marca /gastos como activo; evita que ambos se iluminen a la vez
    icon: (a: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.4 : 2}>
        <rect x="3.5" y="5" width="17" height="14" rx="2" />
        <path d="M3.5 9.5h17" strokeLinecap="round" />
        <path d="M7 14h4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/reportes",
    label: "Reportes",
    icon: (a: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.4 : 2}>
        <rect x="4" y="12" width="4.5" height="8" rx="1.2" />
        <rect x="10.2" y="7" width="4.5" height="13" rx="1.2" />
        <rect x="16.4" y="3.5" width="4.5" height="16.5" rx="1.2" />
      </svg>
    ),
  },
  {
    href: "/personas",
    label: "Personas",
    icon: (a: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.4 : 2}>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" strokeLinecap="round" />
        <circle cx="17" cy="8.5" r="2.3" />
        <path d="M20.5 18.3c0-2.3-1.7-4.1-4-4.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/grupos",
    label: "Grupos",
    icon: (a: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.4 : 2}>
        <rect x="3.5" y="4" width="17" height="6" rx="1.5" />
        <rect x="3.5" y="14" width="7.5" height="6" rx="1.5" />
        <rect x="13" y="14" width="7.5" height="6" rx="1.5" />
      </svg>
    ),
  },
  {
    href: "/mas",
    label: "Más",
    icon: (a: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.4 : 2}>
        <rect x="4" y="4" width="7" height="7" rx="1.8" />
        <rect x="13" y="4" width="7" height="7" rx="1.8" />
        <rect x="4" y="13" width="7" height="7" rx="1.8" />
        <rect x="13" y="13" width="7" height="7" rx="1.8" />
      </svg>
    ),
  },
];

export function DesktopSidebar() {
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const esAdmin = checkEsAdmin(session?.user?.email);

  async function cerrarSesion() {
    await supabase.auth.signOut();
  }

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-gray-100 bg-white px-4 py-5 dark:border-white/10 dark:bg-black">
      <div className="mb-5 flex items-center gap-2.5 px-1">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-gradient text-white">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
            <path d="M3 11.5 12 4l9 7.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M5.5 10v9a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1v-9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <p className="text-sm font-bold leading-tight text-gray-800 dark:text-white">Gastos del Hogar</p>
      </div>

      <div className="mb-4">
        <MovimientoFab variante="boton-lateral" />
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
        {ITEMS.map((item) => {
          const [hrefBase] = item.href.split("?");
          const active = item.activo ? item.activo(pathname) : pathname === hrefBase;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                active
                  ? "bg-purple-50 font-semibold text-brand-from dark:bg-white/10 dark:text-white"
                  : "text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-white/5"
              }`}
            >
              <span className={active ? "text-brand-from dark:text-white" : "text-gray-400 dark:text-gray-500"}>{item.icon(active)}</span>
              {item.label}
            </Link>
          );
        })}
        {esAdmin && (
          <Link
            href="/admin"
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
              pathname === "/admin"
                ? "bg-purple-50 font-semibold text-brand-from dark:bg-white/10 dark:text-white"
                : "text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-white/5"
            }`}
          >
            <span className={pathname === "/admin" ? "text-brand-from dark:text-white" : "text-gray-400 dark:text-gray-500"}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={pathname === "/admin" ? 2.4 : 2}>
                <path d="M12 3.5 5 6.5v5c0 4.5 3 7.5 7 8.5 4-1 7-4 7-8.5v-5L12 3.5Z" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M9.5 12 11 13.5 14.5 10" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            Admin
          </Link>
        )}
      </nav>

      {/* Cuadro de perfil: mismo lugar que en /mas del celular (PerfilPropioCard),
          pero acá vive siempre visible al fondo del Sidebar en vez de en su
          propia pantalla, ya que en escritorio no hace falta un destino "Más"
          separado para llegar al perfil. */}
      <div className="mt-3 rounded-2xl border border-gray-100 p-3 dark:border-white/10">
        <p className="truncate text-xs font-semibold text-gray-700 dark:text-gray-200">{session?.user?.email ?? "Cuenta"}</p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500">Tema</span>
          <ThemeToggle />
        </div>
        <button
          onClick={cerrarSesion}
          className="mt-2 w-full rounded-lg border border-gray-200 py-1.5 text-[11px] font-medium text-gray-500 hover:border-red-200 hover:text-red-400 dark:border-white/10 dark:text-gray-400 dark:hover:border-red-400/40 dark:hover:text-red-400"
        >
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
