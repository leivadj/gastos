"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { ADMIN_EMAIL, adminNavItem, navItems } from "@/components/navItems";

export function DesktopNav() {
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const esAdmin = session?.user?.email === ADMIN_EMAIL;
  const visibles = esAdmin ? [...navItems, adminNavItem] : navItems;

  async function cerrarSesion() {
    await supabase.auth.signOut();
  }

  return (
    <header className="sticky top-0 z-20 border-b border-gray-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <div className="flex items-center gap-3">
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

        <button
          onClick={cerrarSesion}
          className="shrink-0 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 hover:border-red-200 hover:text-red-400"
        >
          Cerrar sesión
        </button>
      </div>
    </header>
  );
}
