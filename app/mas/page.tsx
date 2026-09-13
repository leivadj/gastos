"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { adminNavItem, esAdmin as checkEsAdmin, navItems } from "@/components/navItems";
import { PerfilPropioCard } from "@/components/PerfilPropioCard";

// Todo lo que no entra en la barra inferior (Metas, Auto, Salud, Ingresos,
// Grupos, Personas, Sugerencias, Admin, Gastos, Calendario, Movimientos,
// Reportes) vive acá agrupado. Esto NO es la app anterior al rediseño —
// son pantallas actuales del rediseño v2, así que la etiqueta ya no dice
// "versión anterior" (Felipe reportó no encontrar varias de estas — el
// nombre daba a entender que eran herramientas viejas/descartables) y el
// acordeón arranca abierto en vez de colapsado. "Auto" y "Salud" son
// pantallas nuevas de gastos sueltos (ver navItems.tsx).
const HREFS_HERRAMIENTAS_ANTERIORES = [
  "/metas-ahorro",
  "/auto",
  "/salud",
  "/ingresos",
  "/grupos",
  "/personas",
  "/sugerencias",
  "/gastos",
  "/calendario-pagos",
  "/movimientos",
  "/reportes",
];

export default function MasPage() {
  const [esAdminUsuario, setEsAdminUsuario] = useState(false);
  const [herramientasAbiertas, setHerramientasAbiertas] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEsAdminUsuario(checkEsAdmin(data.session?.user?.email)));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setEsAdminUsuario(checkEsAdmin(s?.user?.email)));
    return () => sub.subscription.unsubscribe();
  }, []);

  const itemsAnteriores = [
    ...navItems.filter((item) => HREFS_HERRAMIENTAS_ANTERIORES.includes(item.href)),
    ...(esAdminUsuario ? [adminNavItem] : []),
  ];

  return (
    <div className="space-y-6 pb-10 pt-2">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Más</h1>
        <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">Tu perfil y el resto de las secciones.</p>
      </div>

      <PerfilPropioCard />

      <div className="overflow-hidden rounded-3xl border border-dashed border-gray-200 bg-white dark:border-white/15 dark:bg-gray-900">
        <button
          type="button"
          onClick={() => setHerramientasAbiertas((v) => !v)}
          className="flex w-full items-center gap-3 px-5 py-4"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gray-50 text-gray-400 dark:bg-white/10 dark:text-gray-400">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3.5 5 6.5v5c0 4.5 3 7.5 7 8.5 4-1 7-4 7-8.5v-5L12 3.5Z" />
            </svg>
          </span>
          <span className="flex-1 text-left text-[15px] font-medium text-gray-500 dark:text-gray-400">
            Todas las secciones
          </span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`shrink-0 text-gray-300 transition-transform dark:text-gray-600 ${herramientasAbiertas ? "rotate-180" : ""}`}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        {herramientasAbiertas && (
          <div className="border-t border-gray-50 dark:border-white/10">
            <p className="px-5 pt-3 text-[11px] text-gray-400 dark:text-gray-500">
              Metas, auto, salud, ingresos, grupos, personas, sugerencias, gastos, calendario de pagos, movimientos y
              reportes{esAdminUsuario ? " y ajustes" : ""}.
            </p>
            {itemsAnteriores.map((item, i) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-4 px-5 py-4 transition-colors active:bg-gray-50 dark:active:bg-white/5 ${
                  i !== itemsAnteriores.length - 1 ? "border-b border-gray-50 dark:border-white/10" : ""
                }`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gray-50 text-gray-400 dark:bg-white/10 dark:text-gray-400">
                  {item.icon(true)}
                </span>
                <span className="flex-1 text-[15px] font-medium text-gray-700 dark:text-gray-200">{item.label}</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="shrink-0 text-gray-300 dark:text-gray-600">
                  <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
