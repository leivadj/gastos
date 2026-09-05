"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CuotasLista } from "@/components/gastos/CuotasLista";
import { DiariosLista } from "@/components/gastos/DiariosLista";
import { GastosFijosLista } from "@/components/gastos/GastosFijosLista";

type Tab = "fijos" | "variables" | "cuotas" | "diarios";

const TABS: { id: Tab; label: string }[] = [
  { id: "fijos", label: "Fijos" },
  { id: "variables", label: "Variables" },
  { id: "cuotas", label: "Cuotas" },
  { id: "diarios", label: "Diarios" },
];

const TABS_VALIDOS = new Set(TABS.map((t) => t.id));

// Pantalla "Gastos", que agrupa lo que antes eran dos pantallas aparte
// (/gastos-fijos y /compras, ambas con redirect acá ahora) en 4 pestañas:
// Fijos y Variables filtran la misma tabla gastos_fijos por tipo_monto (ver
// GastosFijosLista), Cuotas es el ex-/compras (CuotasLista) y Diarios es
// nuevo: compras chicas/improvisadas sin medio de pago ni reparto
// (DiariosLista). Acepta ?tab=... para entrar directo a una pestaña (ver
// /presupuesto y /servicios-basicos) — se lee de window.location en vez de
// useSearchParams para no forzar un límite de Suspense en la página (mismo
// patrón que /tarjetas?nueva=1).
export default function GastosPage() {
  const [tab, setTab] = useState<Tab>("fijos");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const deLaUrl = new URLSearchParams(window.location.search).get("tab");
    if (deLaUrl && TABS_VALIDOS.has(deLaUrl as Tab)) setTab(deLaUrl as Tab);
  }, []);

  return (
    <div className="space-y-4 pb-10">
      <div>
        <h1 className="text-lg font-bold text-gray-800 dark:text-white">Gastos</h1>
        <p className="text-xs text-gray-400 dark:text-gray-500">Fijos, variables, cuotas y gastos diarios del hogar.</p>
      </div>

      <div className="flex gap-1 rounded-2xl bg-gray-100 p-1 text-sm dark:bg-white/5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-xl py-2 font-semibold transition-colors ${
              tab === t.id
                ? "bg-white text-brand-from shadow-sm dark:bg-gray-800 dark:text-white dark:shadow-none"
                : "text-gray-500 dark:text-gray-500"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab !== "diarios" && (
        <Link
          href="/calendario-pagos"
          className="flex items-center justify-between rounded-2xl bg-purple-50 px-4 py-3 text-sm font-semibold text-brand-from dark:bg-white/10 dark:text-white"
        >
          Ver calendario de pagos
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 6 6 6-6 6" />
          </svg>
        </Link>
      )}

      {tab === "fijos" && <GastosFijosLista tipoMonto="fijo" />}
      {tab === "variables" && <GastosFijosLista tipoMonto="variable" />}
      {tab === "cuotas" && <CuotasLista />}
      {tab === "diarios" && <DiariosLista />}
    </div>
  );
}
