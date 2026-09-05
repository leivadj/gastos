"use client";

import { useEffect, useState } from "react";
import { Bar, CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/Card";
import { formatCLP, mesActualISO } from "@/lib/format";
import { promedioMovil } from "@/lib/promedioMovil";
import { Compra, GastoDiario, GastoFijo, Ingreso, Pago } from "@/lib/types";

const N_MESES = 6;
const COLOR_GASTO = "#DDD6FE"; // violet-200, mismo tono que el mockup
const COLOR_GASTO_ACTUAL = "#7C3AED"; // brand-from
const COLOR_INGRESO = "#10B981"; // emerald-500, mismo verde que "pagado"/"ingreso" en el resto de la app

type MesRef = { iso: string; year: number; month: number; label: string; labelLargo: string };

function ultimosMeses(n: number): MesRef[] {
  const hoy = new Date();
  const meses: MesRef[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    const corto = new Intl.DateTimeFormat("es-CL", { month: "short" }).format(d).replace(".", "");
    const largo = new Intl.DateTimeFormat("es-CL", { month: "long" }).format(d);
    meses.push({
      iso,
      year: d.getFullYear(),
      month: d.getMonth(),
      label: corto.charAt(0).toUpperCase() + corto.slice(1),
      labelLargo: largo.charAt(0).toUpperCase() + largo.slice(1),
    });
  }
  return meses;
}

// Misma matemática que la vista SQL vista_cuotas_vigentes, pero evaluada en
// un mes de referencia arbitrario (no necesariamente el actual) — así se
// puede reconstruir qué cuota estaba vigente en cualquier mes pasado sin
// necesitar una vista nueva: la fecha de inicio y el N° de cuotas ya son
// suficientes para saberlo con certeza matemática.
function cuotaActualEn(fechaPrimeraCuota: string, ref: MesRef): number {
  const [y, m] = fechaPrimeraCuota.slice(0, 7).split("-").map(Number); // m: 1-12
  const diffMeses = (ref.year - y) * 12 + (ref.month - (m - 1));
  return diffMeses + 1;
}

export default function ReportesPage() {
  const [compras, setCompras] = useState<Compra[]>([]);
  const [gastosFijos, setGastosFijos] = useState<GastoFijo[]>([]);
  const [gastosDiarios, setGastosDiarios] = useState<GastoDiario[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [ingresos, setIngresos] = useState<Ingreso[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function cargar() {
      const [{ data: c }, { data: gf }, { data: gd }, { data: pg }, { data: ing }] = await Promise.all([
        supabase.from("compras").select("*"),
        supabase.from("gastos_fijos").select("*").eq("activo", true),
        supabase.from("gastos_diarios").select("*"),
        supabase.from("pagos").select("*"),
        supabase.from("ingresos").select("*"),
      ]);
      setCompras((c as Compra[]) ?? []);
      setGastosFijos((gf as GastoFijo[]) ?? []);
      setGastosDiarios((gd as GastoDiario[]) ?? []);
      setPagos((pg as Pago[]) ?? []);
      setIngresos((ing as Ingreso[]) ?? []);
      setCargando(false);
    }
    cargar();
  }, []);

  if (cargando) {
    return <p className="py-10 text-center text-gray-400 dark:text-gray-500">Cargando…</p>;
  }

  const hoyISO = mesActualISO();
  const meses = ultimosMeses(N_MESES);

  function pagoReal(origen: "compra" | "gasto_fijo", origenId: string, mesIso: string) {
    return pagos.find((p) => p.origen === origen && p.origen_id === origenId && p.mes === mesIso && p.monto_real != null)
      ?.monto_real;
  }

  // Gasto total del mes de referencia: cuotas vigentes ESE mes (con su
  // matemática de fecha, exacta para cualquier mes pasado o futuro) + los
  // gastos fijos que están activos HOY (la base no guarda de cuándo a
  // cuándo estuvo activo cada uno, así que se toma la lista actual como
  // aproximación para meses pasados) + gastos diarios de ESE mes (exactos
  // siempre — cada uno ya tiene su fecha real, sin necesidad de estimar).
  // Donde exista un pago real registrado para ese mes (ver Calendario de
  // pagos), se usa ese monto en vez de la estimación — así los reportes se
  // vuelven exactos a medida que se van registrando pagos.
  function gastosDelMes(ref: MesRef): number {
    let total = 0;
    compras.forEach((c) => {
      const cuotaActual = cuotaActualEn(c.fecha_primera_cuota, ref);
      if (cuotaActual < 1 || cuotaActual > c.n_cuotas) return;
      const real = pagoReal("compra", c.id, ref.iso);
      total += real != null ? Number(real) : Math.round(c.monto_total / c.n_cuotas);
    });
    gastosFijos.forEach((g) => {
      const real = pagoReal("gasto_fijo", g.id, ref.iso);
      if (real != null) {
        total += Number(real);
        return;
      }
      if (g.tipo_monto === "variable") {
        total += promedioMovil(pagos, g.id, hoyISO, Number(g.monto_estimado)).promedio;
      } else {
        total += Number(g.monto_estimado);
      }
    });
    gastosDiarios.forEach((d) => {
      if (d.fecha.slice(0, 7) === ref.iso.slice(0, 7)) total += Number(d.monto);
    });
    return total;
  }

  function ingresosDelMes(mesIso: string): number {
    return ingresos.filter((i) => i.mes === mesIso).reduce((acc, i) => acc + Number(i.monto), 0);
  }

  const datos = meses.map((ref) => {
    const gastos = gastosDelMes(ref);
    const ingresosMes = ingresosDelMes(ref.iso);
    return { ...ref, gastos, ingresos: ingresosMes, ahorro: ingresosMes - gastos, esActual: ref.iso === hoyISO };
  });

  const ahorroPromedio = Math.round(datos.reduce((acc, d) => acc + d.ahorro, 0) / datos.length);
  const mesMasGasto = datos.reduce((max, d) => (d.gastos > max.gastos ? d : max), datos[0]);

  return (
    <div className="space-y-4 pb-10">
      <div>
        <h1 className="text-lg font-bold text-gray-800 dark:text-white">Reportes</h1>
        <p className="text-xs text-gray-400 dark:text-gray-500">Ingresos vs. gastos, últimos {N_MESES} meses.</p>
      </div>

      <Card>
        <div style={{ height: 190 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={datos} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#F3F4F6" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10.5, fontWeight: 600, fill: "#9CA3AF" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide />
              <Tooltip
                formatter={(v: number, name: string) => [formatCLP(v), name === "gastos" ? "Gastos" : "Ingresos"]}
                labelFormatter={(label: string) => label}
              />
              <Bar dataKey="gastos" radius={[6, 6, 0, 0]} maxBarSize={28}>
                {datos.map((d, i) => (
                  <Cell key={i} fill={d.esActual ? COLOR_GASTO_ACTUAL : COLOR_GASTO} />
                ))}
              </Bar>
              <Line
                type="monotone"
                dataKey="ingresos"
                stroke={COLOR_INGRESO}
                strokeWidth={2.4}
                dot={{ r: 3.2, fill: COLOR_INGRESO, strokeWidth: 0 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-1 flex gap-4 text-[11.5px] font-semibold text-gray-500 dark:text-gray-300">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: COLOR_GASTO }} />
            Gastos
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLOR_INGRESO }} />
            Ingresos
          </span>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500">Ahorro promedio</p>
          <p className={`mt-1.5 text-lg font-extrabold ${ahorroPromedio < 0 ? "text-red-500 dark:text-red-400" : "text-gray-800 dark:text-white"}`}>
            {formatCLP(ahorroPromedio)}
          </p>
          <p className="mt-0.5 text-[10.5px] text-gray-400 dark:text-gray-500">por mes, {N_MESES} meses</p>
        </Card>
        <Card>
          <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500">Mes con más gasto</p>
          <p className="mt-1.5 text-lg font-extrabold text-gray-800 dark:text-white">{mesMasGasto.labelLargo}</p>
          <p className="mt-0.5 text-[10.5px] text-gray-400 dark:text-gray-500">{formatCLP(mesMasGasto.gastos)}</p>
        </Card>
      </div>

      <Card>
        <p className="mb-2 text-sm font-semibold text-gray-600 dark:text-gray-300">Detalle por mes</p>
        <div className="flex items-center justify-between gap-2 border-b border-gray-50 dark:border-white/10 pb-2 text-[10.5px] font-semibold uppercase tracking-wide text-gray-300 dark:text-gray-600">
          <span className="w-9 shrink-0">Mes</span>
          <span className="flex-1 text-right">Gastos</span>
          <span className="flex-1 text-right">Ingresos</span>
          <span className="w-24 shrink-0 text-right">Ahorro</span>
        </div>
        <div className="mt-2 space-y-2 text-sm">
          {datos.map((d) => (
            <div key={d.iso} className="flex items-center justify-between gap-2">
              <span className={`w-9 shrink-0 font-medium ${d.esActual ? "text-brand-from dark:text-pink-400" : "text-gray-500 dark:text-gray-300"}`}>
                {d.label}
              </span>
              <span className="flex-1 text-right text-gray-400 dark:text-gray-500">{formatCLP(d.gastos)}</span>
              <span className="flex-1 text-right text-emerald-600">{formatCLP(d.ingresos)}</span>
              <span className={`w-24 shrink-0 text-right font-semibold ${d.ahorro < 0 ? "text-red-500 dark:text-red-400" : "text-gray-800 dark:text-white"}`}>
                {formatCLP(d.ahorro)}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <p className="px-1 text-[11px] text-gray-400 dark:text-gray-500">
        Los meses sin pagos reales registrados usan una estimación (gastos fijos activos hoy + cuotas vigentes ese mes).
        A medida que registres pagos en el Calendario de pagos, esos meses se vuelven exactos.
      </p>
    </div>
  );
}
