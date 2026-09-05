"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/Card";
import { EntidadAvatar } from "@/components/EntidadAvatar";
import { formatCLP, mesActualISO, nombreMesCorto } from "@/lib/format";
import { historialUltimosMeses, promedioMovil } from "@/lib/promedioMovil";
import { resolverMarca } from "@/lib/resolverMarca";
import { Entidad, GastoFijo, Marca, Pago } from "@/lib/types";

// Pantalla de detalle ("Hogar > Servicios básicos"), a la que se llega
// desde la tarjeta "Fijos obligatorios de monto variable" de /presupuesto:
// mismo dato que ya se ve en /gastos-fijos y en esa tarjeta, pero acá con
// la tendencia de los últimos 3 meses por ítem (mini gráfico de barras), en
// vez de solo el número del promedio móvil.
export default function ServiciosBasicosPage() {
  const [gastos, setGastos] = useState<GastoFijo[]>([]);
  const [entidades, setEntidades] = useState<Entidad[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function cargar() {
      const [{ data: g }, { data: e }, { data: m }, { data: p }] = await Promise.all([
        supabase
          .from("gastos_fijos")
          .select("*")
          .eq("activo", true)
          .eq("tipo_monto", "variable")
          .order("descripcion"),
        supabase.from("entidades").select("*"),
        supabase.from("marcas").select("*"),
        supabase.from("pagos").select("*").eq("origen", "gasto_fijo"),
      ]);
      setGastos((g as GastoFijo[]) ?? []);
      setEntidades((e as Entidad[]) ?? []);
      setMarcas((m as Marca[]) ?? []);
      setPagos((p as Pago[]) ?? []);
      setCargando(false);
    }
    cargar();
  }, []);

  if (cargando) {
    return <p className="py-10 text-center text-gray-400 dark:text-gray-500">Cargando…</p>;
  }

  const entidadDe = (id: string | null) => entidades.find((e) => e.id === id) ?? null;
  const marcaDe = (id: string | null) => marcas.find((m) => m.id === id) ?? null;

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center gap-3">
        <Link
          href="/presupuesto"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-white/5"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 6-6 6 6 6" />
          </svg>
        </Link>
        <div>
          <h1 className="text-lg font-bold text-gray-800 dark:text-white">Hogar</h1>
          <p className="text-xs text-gray-400 dark:text-gray-500">Servicios básicos</p>
        </div>
      </div>

      <p className="px-1 text-xs leading-relaxed text-gray-400 dark:text-gray-500">
        Fecha de vencimiento fija, monto que cambia cada mes. El presupuesto usa el promedio móvil de los últimos 3
        meses.
      </p>

      {gastos.length === 0 ? (
        <Card>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Todavía no tienes gastos fijos marcados como &quot;monto variable&quot;. Puedes hacerlo en la pestaña{" "}
            <Link href="/gastos?tab=variables" className="font-semibold text-brand-from dark:text-pink-400">
              Variables
            </Link>{" "}
            de Gastos.
          </p>
        </Card>
      ) : (
        gastos.map((g) => {
          const marcaItem = marcaDe(g.marca_id);
          const { promedio, meses } = promedioMovil(pagos, g.id, mesActualISO(), Number(g.monto_estimado));
          const historial = historialUltimosMeses(pagos, g.id, mesActualISO(), 3);
          const maxMonto = Math.max(1, ...historial.map((h) => h.monto));

          return (
            <Card key={g.id}>
              <div className="flex items-center gap-3">
                <EntidadAvatar
                  entidad={entidadDe(g.entidad_id)}
                  marca={marcaItem ?? resolverMarca(entidadDe(g.entidad_id), marcas)}
                  icono={g.icono}
                  className="h-9 w-9"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-800 dark:text-white">{g.descripcion}</p>
                  <span className="mt-0.5 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                    Fijo obligatorio · monto variable
                  </span>
                </div>
              </div>

              <div className="mt-3.5 flex items-end justify-between gap-3">
                <div>
                  <p className="text-[10.5px] font-semibold text-gray-400 dark:text-gray-500">
                    {meses > 0 ? "Promedio móvil" : "Monto estimado"}
                  </p>
                  <p className="mt-0.5 text-[19px] font-extrabold text-gray-800 dark:text-white">
                    {meses > 0 && <span className="mr-0.5 font-normal text-gray-400 dark:text-gray-500">~</span>}
                    {formatCLP(promedio)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">Vence el {g.dia_mes_pago ?? "—"}</p>
                </div>

                {historial.length > 0 ? (
                  <div className="flex h-10 items-end gap-1.5">
                    {historial.map((h, i) => (
                      <div key={h.mes} className="flex flex-col items-center">
                        <div
                          className={`w-4 rounded ${i === historial.length - 1 ? "bg-amber-500" : "bg-amber-200"}`}
                          style={{ height: `${Math.max(6, (h.monto / maxMonto) * 40)}px` }}
                        />
                        <span className="mt-1 text-[9px] font-semibold capitalize text-gray-400 dark:text-gray-500">
                          {nombreMesCorto(h.mes)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Link href="/calendario-pagos" className="text-[11px] font-semibold text-brand-from dark:text-pink-400">
                    Registrar pago →
                  </Link>
                )}
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}
