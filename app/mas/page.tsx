"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { adminNavItem, esAdmin as checkEsAdmin, navItems } from "@/components/navItems";
import { PerfilPropioCard } from "@/components/PerfilPropioCard";

// Los destinos que antes estaban sueltos en la barra inferior y ahora se
// agrupan acá, para no amontonar la barra (ver BottomNav — Inicio, Cuentas
// y Presupuesto quedaron como destinos principales ahí, junto con el botón
// "+"). "Gastos" reemplaza a las antiguas /compras y /gastos-fijos, ahora
// fusionadas en una sola pantalla con pestañas. "Auto" y "Salud" son
// pantallas nuevas de gastos sueltos (ver navItems.tsx).
const HREFS_AGRUPADOS = [
  "/gastos",
  "/calendario-pagos",
  "/movimientos",
  "/reportes",
  "/metas-ahorro",
  "/auto",
  "/salud",
  "/ingresos",
  "/grupos",
  "/personas",
];

export default function MasPage() {
  const [esAdminUsuario, setEsAdminUsuario] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEsAdminUsuario(checkEsAdmin(data.session?.user?.email)));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setEsAdminUsuario(checkEsAdmin(s?.user?.email)));
    return () => sub.subscription.unsubscribe();
  }, []);

  const items = [
    ...navItems.filter((item) => HREFS_AGRUPADOS.includes(item.href)),
    ...(esAdminUsuario ? [adminNavItem] : []),
  ];

  return (
    <div className="space-y-6 pb-10 pt-2">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Más</h1>
        <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
          Gastos, calendario de pagos, movimientos, reportes, metas de ahorro, auto, salud, ingresos, grupos, personas
          {esAdminUsuario ? " y ajustes" : ""}.
        </p>
      </div>

      <PerfilPropioCard />

      <div className="overflow-hidden rounded-3xl border border-gray-100 dark:border-white/10 bg-white dark:bg-gray-900">
        {items.map((item, i) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-4 px-5 py-4 transition-colors active:bg-gray-50 dark:active:bg-white/5 ${
              i !== items.length - 1 ? "border-b border-gray-50 dark:border-white/10" : ""
            }`}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-purple-50 text-brand-from dark:bg-white/10 dark:text-white">
              {item.icon(true)}
            </span>
            <span className="flex-1 text-[15px] font-medium text-gray-700 dark:text-gray-200">{item.label}</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="shrink-0 text-gray-300 dark:text-gray-600">
              <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        ))}
      </div>
    </div>
  );
}
