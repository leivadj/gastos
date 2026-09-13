"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useRef, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { esAdmin as checkEsAdmin } from "@/components/navItems";
import { MovimientoFab } from "@/components/MovimientoRapido";
import { useTheme, PreferenciaTema } from "@/lib/theme";
import { Persona } from "@/lib/types";

// Rail de escritorio — calcado del mockup (Main.dc.html / InicioOscuro.dc.html
// / ReportesWeb.dc.html / AdminWeb.dc.html): 84px de ancho, SOLO íconos (sin
// texto), sin personalización. Reemplaza al sidebar anterior de 240px con
// etiquetas + "Personalizar menú" + atajos dinámicos por cuenta/grupo/marca/
// categoría — Felipe pidió calcar el mockup exacto y dejar lo que no está ahí
// oculto (ver mockup-v2-decisiones.md, "Menú lateral (sidebar) de escritorio").
//
// Los 8 destinos y su orden son fijos, tal como aparecen en los 4 artboards
// de escritorio del mockup (mismo orden en los 4): Inicio, Cuentas, Gastos,
// Presupuesto, Calendario, Movimientos, Reportes, y Personas — que en
// AdminWeb.dc.html ese mismo puesto lo ocupa Admin, así que acá alterna
// según esAdmin, igual que ese artboard sugiere.
//
// "Gastos" apunta a /gastos (la pantalla con pestañas Fijos/Variables/Cuotas/
// Diarios) en vez de separarlo en 2 accesos como hacía el sidebar anterior —
// el mockup solo tiene un ícono para esto.
type ItemRail = {
  key: string;
  href: string;
  label: string;
  icon: ReactNode;
};

const ITEMS: ItemRail[] = [
  {
    key: "inicio",
    href: "/",
    label: "Inicio",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path d="M3 11.5 12 4l9 7.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5.5 10v9a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1v-9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: "cuentas",
    href: "/tarjetas",
    label: "Cuentas",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <rect x="3" y="6" width="18" height="13" rx="2.5" />
        <path d="M3 10h18" strokeLinecap="round" />
        <path d="M7 15h4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: "gastos",
    href: "/gastos",
    label: "Gastos",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <rect x="4" y="3.5" width="16" height="17" rx="2" />
        <path d="M8 8h8M8 12h8M8 16h5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: "presupuesto",
    href: "/presupuesto",
    label: "Presupuesto",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path d="M12 3v9l7.5 4.3" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="9" />
      </svg>
    ),
  },
  {
    key: "calendario",
    href: "/calendario-pagos",
    label: "Calendario",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <rect x="3.5" y="4.5" width="17" height="16" rx="2.5" />
        <path d="M3.5 9.5h17" strokeLinecap="round" />
        <path d="M8 3v3M16 3v3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: "movimientos",
    href: "/movimientos",
    label: "Movimientos",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path d="M4 8h13.5M14 4.5 17.5 8 14 11.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M20 16H6.5M10 12.5 6.5 16 10 19.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: "reportes",
    href: "/reportes",
    label: "Reportes",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path d="M12 3.5 3.5 12l8.5 8.5 8.5-8.5z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 8v4l3 1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

const ITEM_PERSONAS: ItemRail = {
  key: "personas",
  href: "/personas",
  label: "Personas",
  icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="9" cy="9" r="3.2" />
      <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" strokeLinecap="round" />
      <circle cx="17.5" cy="8.5" r="2.4" />
      <path d="M15.5 12.3c2.3.3 4 2 4 4.4" strokeLinecap="round" />
    </svg>
  ),
};

const ITEM_ADMIN: ItemRail = {
  key: "admin",
  href: "/admin",
  label: "Admin",
  icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M4 4.5h16M4 12h16M4 19.5h10" strokeLinecap="round" />
      <circle cx="17" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  ),
};

function IconoSol() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6" />
    </svg>
  );
}
function IconoLuna() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
    </svg>
  );
}
function IconoAuto() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4.5" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16.5V20" />
    </svg>
  );
}

const ORDEN_TEMA: PreferenciaTema[] = ["light", "dark", "system"];
const ICONO_TEMA: Record<PreferenciaTema, ReactNode> = { light: <IconoSol />, dark: <IconoLuna />, system: <IconoAuto /> };
const LABEL_TEMA: Record<PreferenciaTema, string> = { light: "Claro", dark: "Oscuro", system: "Automático" };

export function DesktopSidebar() {
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);
  const [personaSelf, setPersonaSelf] = useState<Persona | null>(null);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { preferencia, setPreferencia } = useTheme();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    supabase
      .from("personas")
      .select("*")
      .eq("es_self", true)
      .maybeSingle()
      .then(({ data }) => setPersonaSelf((data as Persona) ?? null));
  }, [session]);

  useEffect(() => {
    if (!menuAbierto) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuAbierto(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuAbierto]);

  const esAdmin = checkEsAdmin(session?.user?.email);
  const itemUltimo = esAdmin ? ITEM_ADMIN : ITEM_PERSONAS;
  const todosLosItems = [...ITEMS, itemUltimo];

  function ciclarTema() {
    const i = ORDEN_TEMA.indexOf(preferencia);
    setPreferencia(ORDEN_TEMA[(i + 1) % ORDEN_TEMA.length]);
  }

  async function cerrarSesion() {
    await supabase.auth.signOut();
  }

  const iniciales = personaSelf?.nombre
    ? personaSelf.nombre
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p.charAt(0).toUpperCase())
        .join("")
    : "?";

  return (
    <aside className="sticky top-0 flex h-screen w-[84px] shrink-0 flex-col items-center gap-1.5 border-r border-gray-100 bg-white py-6 dark:border-white/10 dark:bg-black">
      <Link
        href="/"
        className="mb-4 flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl bg-brand-gradient text-white"
        aria-label="Gastos del Hogar"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
          <path d="M3 11.5 12 4l9 7.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5.5 10v9a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1v-9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>

      {/* No está dibujado en el mockup (el rail del mockup no tiene "+"), pero
          hace falta un punto de entrada para agregar movimientos en
          escritorio — se agrega acá, junto al logo, en vez de quitar la
          función. Abre la misma hoja "Nuevo movimiento" que el celular. */}
      <div className="mb-1">
        <MovimientoFab variante="rail" />
      </div>

      {todosLosItems.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.key}
            href={item.href}
            title={item.label}
            aria-label={item.label}
            className={`flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-2xl transition ${
              active
                ? "bg-brand-gradient text-white"
                : "text-gray-400 hover:bg-gray-50 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-white/5 dark:hover:text-gray-300"
            }`}
          >
            {item.icon}
          </Link>
        );
      })}

      <div className="flex-1" />

      <button
        type="button"
        title={`Tema: ${LABEL_TEMA[preferencia]} (clic para cambiar)`}
        aria-label="Cambiar tema"
        onClick={ciclarTema}
        className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-2xl text-gray-400 transition hover:bg-gray-50 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-white/5 dark:hover:text-gray-300"
      >
        {ICONO_TEMA[preferencia]}
      </button>

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuAbierto((v) => !v)}
          aria-label="Cuenta"
          className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-gray-800 text-[12.5px] font-bold text-white dark:bg-white dark:text-black"
        >
          {iniciales}
        </button>
        {menuAbierto && (
          <div className="absolute bottom-0 left-full z-30 ml-2 w-56 rounded-2xl border border-gray-100 bg-white p-3 shadow-xl dark:border-white/10 dark:bg-gray-900">
            <p className="truncate px-1 text-xs font-semibold text-gray-700 dark:text-gray-200">{session?.user?.email ?? "Cuenta"}</p>
            <button
              onClick={cerrarSesion}
              className="mt-3 w-full rounded-lg border border-gray-200 py-1.5 text-[11px] font-medium text-gray-500 hover:border-red-200 hover:text-red-400 dark:border-white/10 dark:text-gray-400 dark:hover:border-red-400/40 dark:hover:text-red-400"
            >
              Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
