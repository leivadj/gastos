"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
// /presupuesto, /servicios-basicos, /compras, /gastos-fijos y el sidebar,
// que tiene "Fijos" y "Compras en cuotas" como dos ítems separados que
// apuntan acá con distinto query string).
//
// Antes esto se leía una sola vez de window.location en un efecto sin
// dependencias, para no forzar un límite de Suspense en la página (bug #17,
// ver el resumen del proyecto). El problema: si ya estabas en /gastos (ej.
// pestaña Fijos) y navegabas con un <Link> a /gastos?tab=cuotas — como el
// del ítem "Compras en cuotas" del sidebar —, Next.js reutiliza la misma
// instancia del componente (misma ruta) en vez de remontarla, así que ese
// efecto de una sola vez nunca se volvía a ejecutar: la URL cambiaba pero
// la pestaña se quedaba pegada en la que estaba. Ahora se usa
// useSearchParams(), que sí es reactivo a la navegación — el efecto
// depende de él y se vuelve a ejecutar en cada cambio de query string, sea
// cual sea la pestaña en la que estabas antes.
export default function GastosPage() {
  return (
    <Suspense fallback={null}>
      <GastosContenido />
    </Suspense>
  );
}

function GastosContenido() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>("fijos");

  useEffect(() => {
    const deLaUrl = searchParams.get("tab");
    if (deLaUrl && TABS_VALIDOS.has(deLaUrl as Tab)) setTab(deLaUrl as Tab);
  }, [searchParams]);

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
      {tab === "diarios" && (
        <DiariosLista
          textoAyuda='Compras chicas o improvisadas del día a día (pan, feria, colegio…). Elige la categoría y, si corresponde, el grupo con el que se reparte.'
          categoriasElegibles={["Hogar", "Feria", "Panadería", "Educación (colegio, cursos)"]}
        />
      )}
    </div>
  );
}
