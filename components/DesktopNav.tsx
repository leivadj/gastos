"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { adminNavItem, esAdmin as checkEsAdmin, navItems } from "@/components/navItems";

export function DesktopNav() {
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const esAdmin = checkEsAdmin(session?.user?.email);
  const visibles = esAdmin ? [...navItems, adminNavItem] : navItems;

  async function cerrarSesion() {
    await supabase.auth.signOut();
  }

  return (
    <header className="sticky top-0 z-20 border-b border-gray-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
        {/* "Cuadro perfil" del escritorio: en el celular esto vive en /mas
            (PerfilPropioCard), pero ese destino es solo el menú "Más" de la
            barra inferior — en escritorio no hay "Más" (todo se muestra
            suelto, ver navItems.tsx), así que el mini-perfil vive acá,
            en el header, y "Cerrar sesión" va DENTRO de este mismo cuadro
            en vez de suelto aparte. */}
        <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-gray-100 py-1.5 pl-1.5 pr-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gradient text-white">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
              <path d="M3 11.5 12 4l9 7.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5.5 10v9a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1v-9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div>
            <p className="text-sm font-bold leading-tight text-gray-800">Gastos del Hogar</p>
            <p className="text-[11px] leading-tight text-gray-400">
              {session?.user?.email ?? "Panel"}
            </p>
          </div>
          <button
            onClick={cerrarSesion}
            className="ml-1 shrink-0 rounded-full border border-gray-200 px-2.5 py-1 text-[11px] font-medium text-gray-500 hover:border-red-200 hover:text-red-400"
          >
            Cerrar sesión
          </button>
        </div>

        <nav className="flex items-center gap-1">
          {visibles.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-sm transition ${
                  active ? "bg-purple-50 font-semibold text-brand-from" : "text-gray-500 hover:bg-gray-50"
                }`}
              >
                <span className={active ? "text-brand-from" : "text-gray-400"}>{item.icon(active)}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
