"use client";

import { useEffect, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/lib/supabaseClient";
import { Card, GradientCard } from "@/components/Card";
import { formatCLP, mesActualISO, nombreMes } from "@/lib/format";
import { Categoria, CompraVigente, GastoFijo, ResumenPersonaMes } from "@/lib/types";

const COLORES = ["#7C3AED", "#EC4899", "#F97316", "#10B981", "#3B82F6", "#F43F5E", "#8B5CF6", "#14B8A6"];

export default function DashboardPage() {
  const [cuotas, setCuotas] = useState<CompraVigente[]>([]);
  const [gastosFijos, setGastosFijos] = useState<GastoFijo[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [resumenPersonas, setResumenPersonas] = useState<ResumenPersonaMes[]>([]);
  const [ingresosMes, setIngresosMes] = useState(0);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function cargar() {
      const [{ data: c }, { data: gf }, { data: cat }, { data: rp }, { data: ing }] = await Promise.all([
        supabase.from("vista_cuotas_mes_actual").select("*"),
        supabase.from("gastos_fijos").select("*").eq("activo", true),
        supabase.from("categorias").select("*"),
        supabase.from("vista_resumen_personas_mes").select("*"),
        supabase.from("ingresos").select("monto").eq("mes", mesActualISO()),
      ]);
      setCuotas((c as CompraVigente[]) ?? []);
      setGastosFijos((gf as GastoFijo[]) ?? []);
      setCategorias((cat as Categoria[]) ?? []);
      setResumenPersonas((rp as ResumenPersonaMes[]) ?? []);
      setIngresosMes((ing ?? []).reduce((acc, r: any) => acc + Number(r.monto), 0));
      setCargando(false);
    }
    cargar();
  }, []);

  const categoriaNombre = (id: string | null) =>
    categorias.find((c) => c.id === id)?.nombre ?? "Sin categoría";

  const totalCuotas = cuotas.reduce((acc, c) => acc + Number(c.monto_cuota), 0);
  const totalFijos = gastosFijos.reduce((acc, g) => acc + Number(g.monto_estimado), 0);
  const totalGastos = totalCuotas + totalFijos;
  const disponible = ingresosMes - totalGastos;

  const porCategoria: Record<string, number> = {};
  cuotas.forEach((c) => {
    const nombre = categoriaNombre(c.categoria_id);
    porCategoria[nombre] = (porCategoria[nombre] ?? 0) + Number(c.monto_cuota);
  });
  gastosFijos.forEach((g) => {
    const nombre = categoriaNombre(g.categoria_id);
    porCategoria[nombre] = (porCategoria[nombre] ?? 0) + Number(g.monto_estimado);
  });
  const dataCategoria = Object.entries(porCategoria).map(([name, value]) => ({ name, value }));

  const dataPersonas = resumenPersonas.map((p) => ({ name: p.persona_nombre, total: Number(p.total) }));

  if (cargando) {
    return <p className="py-10 text-center text-gray-400">Cargando…</p>;
  }

  return (
    <div className="space-y-5 pb-10">
      <GradientCard>
        <p className="text-sm capitalize opacity-90">{nombreMes()}</p>
        <p className="mt-1 text-3xl font-bold">{formatCLP(disponible)}</p>
        <p className="text-xs opacity-80">Disponible este mes</p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-white/15 p-3">
            <p className="opacity-80">Ingresos</p>
            <p className="text-lg font-semibold">{formatCLP(ingresosMes)}</p>
          </div>
          <div className="rounded-xl bg-white/15 p-3">
            <p className="opacity-80">Gastos</p>
            <p className="text-lg font-semibold">{formatCLP(totalGastos)}</p>
          </div>
        </div>
      </GradientCard>

      <Card>
        <p className="mb-2 text-sm font-semibold text-gray-600">Gastos por categoría</p>
        {dataCategoria.length === 0 ? (
          <p className="text-sm text-gray-400">Sin datos este mes todavía.</p>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={dataCategoria} dataKey="value" nameKey="name" innerRadius={55} outerRadius={80} paddingAngle={2}>
                  {dataCategoria.map((_, i) => (
                    <Cell key={i} fill={COLORES[i % COLORES.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatCLP(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
          {dataCategoria.map((d, i) => (
            <span key={d.name} className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ background: COLORES[i % COLORES.length] }} />
              {d.name}: {formatCLP(d.value)}
            </span>
          ))}
        </div>
      </Card>

      <Card>
        <p className="mb-2 text-sm font-semibold text-gray-600">Cuánto le toca a cada persona</p>
        {dataPersonas.length === 0 ? (
          <p className="text-sm text-gray-400">Sin datos este mes todavía.</p>
        ) : (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataPersonas}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis hide />
                <Tooltip formatter={(v: number) => formatCLP(v)} />
                <Bar dataKey="total" radius={[6, 6, 0, 0]} fill="#7C3AED" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card>
        <p className="mb-3 text-sm font-semibold text-gray-600">Cuotas activas este mes</p>
        {cuotas.length === 0 ? (
          <p className="text-sm text-gray-400">No hay compras en cuotas vigentes.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {cuotas.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <p className="font-medium text-gray-700">{c.descripcion}</p>
                  <p className="text-xs text-gray-400">
                    Cuota {c.cuota_actual} de {c.n_cuotas} · {categoriaNombre(c.categoria_id)}
                  </p>
                </div>
                <p className="font-semibold text-gray-800">{formatCLP(c.monto_cuota)}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
