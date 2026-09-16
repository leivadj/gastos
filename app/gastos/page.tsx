"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { CuotasLista } from "@/components/gastos/CuotasLista";
import { DiariosLista } from "@/components/gastos/DiariosLista";
import { GastosFijosLista } from "@/components/gastos/GastosFijosLista";
import { GastosFiltrados } from "@/components/gastos/GastosFiltrados";
import { Categoria, Entidad, Persona } from "@/lib/types";

type Tab = "normal" | "recurrente" | "cuotas";

const TABS: { id: Tab; label: string }[] = [
  { id: "normal", label: "Normal" },
  { id: "recurrente", label: "Recurrente" },
  { id: "cuotas", label: "Cuotas" },
];

const TABS_VALIDOS = new Set(TABS.map((t) => t.id));

// Pantalla "Gastos", que agrupa lo que antes eran dos pantallas aparte
// (/gastos-fijos y /compras, ambas con redirect acá ahora). Antes tenía 4
// pestañas (Fijos/Variables/Cuotas/Diarios); Felipe pidió que /gastos use
// las mismas 3 categorías que ya usa "Nuevo movimiento" en toda la app
// (Normal/Recurrente/Cuotas, ver MovimientoRapido.tsx y el desglose "Por
// tipo de pago" de PresupuestoContenido.tsx), para no tener dos taxonomías
// distintas conviviendo:
//   - "Normal" (pago único): compras de una sola vez con tarjeta/cuenta
//     (CuotasLista con modo="una-vez", filtrando `compras` a n_cuotas === 1)
//     + los gastos diarios de carga rápida (DiariosLista, sin medio de pago
//     ni reparto) — ambos son "un solo pago", solo cambia si se registró
//     con una cuenta o no.
//   - "Recurrente": gastos_fijos, fusionando lo que antes eran las pestañas
//     "Fijos" y "Variables" (GastosFijosLista ahora sin filtrar por
//     tipo_monto — cada ítem sigue diciendo si es de monto fijo o
//     variable, solo dejó de ser el criterio que separa pestañas).
//   - "Cuotas": compras en cuotas reales (CuotasLista con modo="cuotas",
//     filtrando a n_cuotas > 1 — una sola cuota ya no cuenta como "cuotas",
//     eso ahora es "Normal").
// Acepta ?tab=... para entrar directo a una pestaña (ver /presupuesto,
// /servicios-basicos, /compras, /gastos-fijos y el sidebar).
//
// Antes esto se leía una sola vez de window.location en un efecto sin
// dependencias, para no forzar un límite de Suspense en la página (bug #17,
// ver el resumen del proyecto). El problema: si ya estabas en /gastos (ej.
// pestaña Recurrente) y navegabas con un <Link> a /gastos?tab=cuotas —
// como el del ítem "Compras en cuotas" del sidebar —, Next.js reutiliza la
// misma instancia del componente (misma ruta) en vez de remontarla, así que
// ese efecto de una sola vez nunca se volvía a ejecutar: la URL cambiaba
// pero la pestaña se quedaba pegada en la que estaba. Ahora se usa
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
  const [tab, setTab] = useState<Tab>("normal");

  // Ronda 8: filtros por persona/categoría/cuenta, pedidos por Felipe para
  // ver de un vistazo "todo lo de Marian" o "todo lo de la tarjeta Paris"
  // sin importar si quedó cargado como Normal, Recurrente o Cuotas. Apenas
  // hay al menos un filtro activo, las 3 pestañas de siempre se reemplazan
  // por GastosFiltrados (ver ese componente), que junta las 3 fuentes en un
  // solo listado editable. Catálogos livianos, cargados acá una sola vez
  // para no duplicar la consulta en cada pestaña.
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [entidades, setEntidades] = useState<Entidad[]>([]);
  const [filtroPersona, setFiltroPersona] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroEntidad, setFiltroEntidad] = useState("");
  const hayFiltros = !!(filtroPersona || filtroCategoria || filtroEntidad);

  useEffect(() => {
    const deLaUrl = searchParams.get("tab");
    if (deLaUrl && TABS_VALIDOS.has(deLaUrl as Tab)) setTab(deLaUrl as Tab);
  }, [searchParams]);

  useEffect(() => {
    async function cargarCatalogos() {
      const [{ data: p }, { data: cat }, { data: e }] = await Promise.all([
        supabase.from("personas").select("*").eq("activo", true).order("nombre"),
        supabase.from("categorias").select("*").order("nombre"),
        supabase.from("entidades").select("*").order("nombre"),
      ]);
      setPersonas((p as Persona[]) ?? []);
      setCategorias((cat as Categoria[]) ?? []);
      setEntidades((e as Entidad[]) ?? []);
    }
    cargarCatalogos();
  }, []);

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-800 dark:text-white">Gastos</h1>
          <p className="text-xs text-gray-400 dark:text-gray-500">Normal, recurrente y cuotas — todos los gastos del hogar.</p>
        </div>
        {/* Felipe: "necesito el menu generar reporte en la web" — /reportes ya
            existe y está en el rail de escritorio, pero ese rail es solo
            íconos (sin texto), así que era fácil no encontrarlo. Este acceso
            directo con etiqueta queda visible en las 3 pestañas. */}
        <Link
          href="/reportes"
          className="hidden shrink-0 items-center gap-1.5 rounded-full border border-gray-200 px-3.5 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5 md:flex"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3.5 3.5 12l8.5 8.5 8.5-8.5z" />
            <path d="M12 8v4l3 1.5" />
          </svg>
          Generar reporte
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-gray-100 bg-white p-3 dark:border-white/10 dark:bg-white/5 md:flex-nowrap">
        <select
          value={filtroPersona}
          onChange={(e) => setFiltroPersona(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-gray-200 px-2.5 py-2 text-xs dark:border-white/10 dark:bg-white/5 dark:text-white"
        >
          <option value="">Persona: todas</option>
          {personas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
        <select
          value={filtroCategoria}
          onChange={(e) => setFiltroCategoria(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-gray-200 px-2.5 py-2 text-xs dark:border-white/10 dark:bg-white/5 dark:text-white"
        >
          <option value="">Categoría: todas</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icono ? `${c.icono} ` : ""}
              {c.nombre}
            </option>
          ))}
        </select>
        <select
          value={filtroEntidad}
          onChange={(e) => setFiltroEntidad(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-gray-200 px-2.5 py-2 text-xs dark:border-white/10 dark:bg-white/5 dark:text-white"
        >
          <option value="">Cuenta o tarjeta: todas</option>
          {entidades.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre}
            </option>
          ))}
        </select>
        {hayFiltros && (
          <button
            type="button"
            onClick={() => {
              setFiltroPersona("");
              setFiltroCategoria("");
              setFiltroEntidad("");
            }}
            className="shrink-0 rounded-lg bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-500 dark:bg-white/10 dark:text-gray-300"
          >
            Quitar filtros
          </button>
        )}
      </div>

      {hayFiltros ? (
        <GastosFiltrados personaId={filtroPersona} categoriaId={filtroCategoria} entidadId={filtroEntidad} />
      ) : (
        <>
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

          {(tab === "recurrente" || tab === "cuotas") && (
            <Link
              href="/calendario-pagos"
              className="flex items-center justify-between rounded-2xl bg-gray-50 px-4 py-3 text-sm font-semibold text-brand-from dark:bg-white/10 dark:text-white"
            >
              Ver calendario de pagos
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 6 6 6-6 6" />
              </svg>
            </Link>
          )}

          {tab === "normal" && (
            <div className="space-y-6">
              <CuotasLista modo="una-vez" />
              <div className="border-t border-gray-100 pt-5 dark:border-white/10">
                <p className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  Gastos diarios (sin tarjeta ni cuenta)
                </p>
                <DiariosLista
                  textoAyuda='Compras chicas o improvisadas del día a día (pan, feria, colegio…). Elige la categoría y, si corresponde, el grupo con el que se reparte.'
                  categoriasElegibles={["Hogar", "Feria", "Panadería", "Educación (colegio, cursos)"]}
                />
              </div>
            </div>
          )}
          {tab === "recurrente" && <GastosFijosLista />}
          {tab === "cuotas" && <CuotasLista modo="cuotas" />}
        </>
      )}
    </div>
  );
}
