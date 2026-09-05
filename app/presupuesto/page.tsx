"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/Card";
import { formatCLP, mesActualISO, nombreMes, primerDiaMesSiguiente } from "@/lib/format";
import { promedioMovil } from "@/lib/promedioMovil";
import { resumenGastosMes } from "@/lib/resumenGastos";
import { Categoria, CompraVigente, GastoDiario, GastoFijo, MetaAhorroProgreso, Pago } from "@/lib/types";

const COLORES = ["#7C3AED", "#EC4899", "#F97316", "#10B981", "#3B82F6", "#F43F5E", "#8B5CF6", "#14B8A6"];

function IconoFlecha({ className = "shrink-0 text-gray-300 dark:text-gray-600" }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export default function PresupuestoPage() {
  const [cuotas, setCuotas] = useState<CompraVigente[]>([]);
  const [gastosFijos, setGastosFijos] = useState<GastoFijo[]>([]);
  const [gastosDiarios, setGastosDiarios] = useState<GastoDiario[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [metas, setMetas] = useState<MetaAhorroProgreso[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function cargar() {
      const [{ data: c }, { data: gf }, { data: gd }, { data: cat }, { data: p }, { data: m }] = await Promise.all([
        supabase.from("vista_cuotas_mes_actual").select("*"),
        supabase.from("gastos_fijos").select("*").eq("activo", true),
        supabase.from("gastos_diarios").select("*").gte("fecha", mesActualISO()).lt("fecha", primerDiaMesSiguiente()),
        supabase.from("categorias").select("*"),
        supabase.from("pagos").select("*").eq("origen", "gasto_fijo"),
        supabase.from("vista_metas_ahorro_progreso").select("*").eq("activa", true).order("nombre"),
      ]);
      setCuotas((c as CompraVigente[]) ?? []);
      setGastosFijos((gf as GastoFijo[]) ?? []);
      setGastosDiarios((gd as GastoDiario[]) ?? []);
      setCategorias((cat as Categoria[]) ?? []);
      setPagos((p as Pago[]) ?? []);
      setMetas((m as MetaAhorroProgreso[]) ?? []);
      setCargando(false);
    }
    cargar();
  }, []);

  if (cargando) {
    return <p className="py-10 text-center text-gray-400 dark:text-gray-500">Cargando…</p>;
  }

  const { dataCategoria, totalGastos, totalTipoFijo, totalTipoVariable, pctFijo } = resumenGastosMes(
    cuotas,
    gastosFijos,
    categorias,
    gastosDiarios
  );
  const legendPrincipal = dataCategoria.slice(0, 4);
  const restoCategorias = dataCategoria.slice(4);
  const restoTotal = restoCategorias.reduce((acc, d) => acc + d.value, 0);
  const pct = (valor: number) => (totalGastos > 0 ? `${Math.round((valor / totalGastos) * 1000) / 10}%` : "0%");

  const gastosVariables = gastosFijos.filter((g) => g.tipo_monto === "variable");
  const metasEnProgreso = metas.filter((m) => m.monto_actual < m.monto_objetivo).slice(0, 2);

  return (
    <div className="space-y-4 pb-10">
      <div>
        <h1 className="text-lg font-bold text-gray-800 dark:text-white">Presupuesto</h1>
        <p className="text-xs capitalize text-gray-400 dark:text-gray-500">{nombreMes()} · cómo se reparte cada peso.</p>
      </div>

      <Card>
        <p className="mb-3 text-sm font-semibold text-gray-600 dark:text-gray-300">Gastos por categoría</p>
        {dataCategoria.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">Sin datos este mes todavía.</p>
        ) : (
          <div className="flex items-center gap-4">
            <div className="h-32 w-32 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={dataCategoria} dataKey="value" nameKey="name" innerRadius={40} outerRadius={62} paddingAngle={2}>
                    {dataCategoria.map((_, i) => (
                      <Cell key={i} fill={COLORES[i % COLORES.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCLP(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2 text-sm">
              {legendPrincipal.map((d, i) => (
                <div key={d.name} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: COLORES[i % COLORES.length] }} />
                    {d.name}
                  </span>
                  <span className="font-medium text-gray-800 dark:text-white">{pct(d.value)}</span>
                </div>
              ))}
              {restoCategorias.length > 0 && (
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-gray-300" />+{restoCategorias.length} más
                  </span>
                  <span className="font-medium text-gray-400 dark:text-gray-500">{pct(restoTotal)}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      {totalGastos > 0 && (
        <Card>
          <p className="mb-2 text-sm font-semibold text-gray-600 dark:text-gray-300">Fijo vs. variable</p>
          <div className="h-3.5 w-full overflow-hidden rounded-full bg-pink-100 dark:bg-pink-900/30">
            <div className="h-full bg-brand-gradient" style={{ width: `${pctFijo}%` }} />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-brand-gradient" />
              Fijo · {formatCLP(totalTipoFijo)}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-pink-200" />
              Variable · {formatCLP(totalTipoVariable)}
            </span>
          </div>
        </Card>
      )}

      {gastosVariables.length > 0 && (
        <Link href="/servicios-basicos">
          <Card className="active:bg-gray-50 dark:active:bg-white/5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">Fijos obligatorios de monto variable</p>
              <IconoFlecha />
            </div>
            <p className="mb-3 mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
              Vencimiento fijo, monto que cambia cada mes. El presupuesto es un promedio móvil.
            </p>
            <ul className="divide-y divide-gray-50 dark:divide-white/10">
              {gastosVariables.map((g) => {
                const { promedio, meses } = promedioMovil(pagos, g.id, mesActualISO(), Number(g.monto_estimado));
                return (
                  <li key={g.id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <p className="font-medium text-gray-700 dark:text-gray-200">{g.descripcion}</p>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500">
                        {meses > 0 ? "Promedio móvil" : "Estimado"} · vence el {g.dia_mes_pago ?? "—"}
                      </p>
                    </div>
                    <p className="font-semibold text-gray-800 dark:text-white">
                      {meses > 0 && <span className="mr-0.5 font-normal text-gray-400 dark:text-gray-500">~</span>}
                      {formatCLP(promedio)}
                    </p>
                  </li>
                );
              })}
            </ul>
          </Card>
        </Link>
      )}

      {metasEnProgreso.length > 0 && (
        <Link href="/metas-ahorro">
          <Card className="active:bg-gray-50 dark:active:bg-white/5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">Metas de ahorro</p>
              <IconoFlecha />
            </div>
            <div className="space-y-3">
              {metasEnProgreso.map((m) => {
                const progreso = Math.min(100, Math.max(0, (m.monto_actual / m.monto_objetivo) * 100));
                return (
                  <div key={m.meta_id}>
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="font-semibold text-gray-700 dark:text-gray-200">{m.nombre}</span>
                      <span className="font-medium text-gray-400 dark:text-gray-500">
                        {formatCLP(m.monto_actual)} / {formatCLP(m.monto_objetivo)}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-pink-100 dark:bg-pink-900/30">
                      <div className="h-full bg-brand-gradient" style={{ width: `${progreso}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </Link>
      )}

      <Link
        href="/gastos"
        className="flex items-center justify-between rounded-2xl bg-purple-50 px-4 py-3 text-sm font-semibold text-brand-from dark:bg-white/10 dark:text-white"
      >
        Gestionar gastos
        <IconoFlecha className="shrink-0" />
      </Link>
    </div>
  );
}
