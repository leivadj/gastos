"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/Card";
import { formatCLP, mesActualISO, nombreMes, primerDiaMesSiguiente } from "@/lib/format";
import { promedioMovil } from "@/lib/promedioMovil";
import { resumenGastosMes } from "@/lib/resumenGastos";
import { colorAnilloPresupuesto } from "@/lib/colorPresupuesto";
import { Categoria, CompraVigente, GastoDiario, GastoFijo, MetaAhorroProgreso, Pago, PresupuestoCategoria } from "@/lib/types";

// Anillo de progreso de presupuesto (Feature G, ronda 6 del rediseño): un
// círculo SVG alrededor del ícono de la categoría, calcado de una captura
// real de Not Pato (pestaña "Presupuestos") — el color cambia según cuánto
// llevas gastado (ver lib/colorPresupuesto.ts), no según la categoría.
function AnilloPresupuesto({ pct, color, size = 56, grosor = 4.5 }: { pct: number; color: string; size?: number; grosor?: number }) {
  const r = (size - grosor) / 2;
  const c = 2 * Math.PI * r;
  const pctClamped = Math.min(100, Math.max(0, pct));
  const dash = (pctClamped / 100) * c;
  return (
    <svg width={size} height={size} className="-rotate-90" viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={grosor} className="stroke-gray-100 dark:stroke-white/10" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={grosor}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${c}`}
        className="transition-[stroke-dasharray]"
      />
    </svg>
  );
}

const COLORES = ["#111112", "#3A3A3D", "#6E6E72", "#9B9995", "#C9C7C2", "#E2584B", "#5DCB86", "#8A8A8D"];

function IconoFlecha({ className = "shrink-0 text-gray-300 dark:text-gray-600" }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

// ocultarTitulo: igual que en IngresosContenido — se muestra sin título
// propio cuando vive como la pestaña "Presupuesto" del nuevo Resumen con
// pestañas (rediseño v2, ver app/page.tsx). La ruta /presupuesto standalone
// (todavía usada desde el sidebar de escritorio) sigue mostrándolo siempre.
//
// Vive en components/ (no en app/presupuesto/page.tsx) porque Next.js
// exige que el único export de un archivo page.tsx sea el default de la
// página, sin props propias.
export function PresupuestoContenido({ ocultarTitulo = false }: { ocultarTitulo?: boolean }) {
  const [cuotas, setCuotas] = useState<CompraVigente[]>([]);
  const [gastosFijos, setGastosFijos] = useState<GastoFijo[]>([]);
  const [gastosDiarios, setGastosDiarios] = useState<GastoDiario[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [metas, setMetas] = useState<MetaAhorroProgreso[]>([]);
  const [presupuestos, setPresupuestos] = useState<PresupuestoCategoria[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function cargar() {
      const [{ data: c }, { data: gf }, { data: gd }, { data: cat }, { data: p }, { data: m }, { data: pc }] = await Promise.all([
        supabase.from("vista_cuotas_mes_actual").select("*"),
        supabase.from("gastos_fijos").select("*").eq("activo", true),
        supabase.from("gastos_diarios").select("*").gte("fecha", mesActualISO()).lt("fecha", primerDiaMesSiguiente()),
        supabase.from("categorias").select("*"),
        supabase.from("pagos").select("*").eq("origen", "gasto_fijo"),
        supabase.from("vista_metas_ahorro_progreso").select("*").eq("activa", true).order("nombre"),
        supabase.from("presupuestos_categoria").select("*"),
      ]);
      setCuotas((c as CompraVigente[]) ?? []);
      setGastosFijos((gf as GastoFijo[]) ?? []);
      setGastosDiarios((gd as GastoDiario[]) ?? []);
      setCategorias((cat as Categoria[]) ?? []);
      setPagos((p as Pago[]) ?? []);
      setMetas((m as MetaAhorroProgreso[]) ?? []);
      setPresupuestos((pc as PresupuestoCategoria[]) ?? []);
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

  // Totales separados por tipo de pago (mismo criterio que el selector
  // "Normal / Recurrente / Cuotas" de "Nuevo movimiento" — ver
  // MovimientoRapido.tsx): "Normal" y "Cuotas" son compras (vista_cuotas_mes_
  // actual ya trae la cuota vigente de este mes de cada una, sea de 1 sola
  // cuota o de varias), separadas por su n_cuotas; "Recurrente" son los
  // gastos_fijos activos. gastosDiarios queda fuera (no es un tipo de pago
  // de "Nuevo movimiento", es la carga rápida de /gastos → Diarios).
  const totalPagoUnico = cuotas.filter((c) => c.n_cuotas === 1).reduce((acc, c) => acc + Number(c.monto_cuota), 0);
  const totalPagoCuotas = cuotas.filter((c) => c.n_cuotas > 1).reduce((acc, c) => acc + Number(c.monto_cuota), 0);
  const totalPagoRecurrente = gastosFijos.reduce((acc, g) => acc + Number(g.monto_estimado), 0);
  const totalPorTipoPago = totalPagoUnico + totalPagoCuotas + totalPagoRecurrente;

  const gastosVariables = gastosFijos.filter((g) => g.tipo_monto === "variable");
  const metasEnProgreso = metas.filter((m) => m.monto_actual < m.monto_objetivo).slice(0, 2);

  // Gasto por categoría (mismas 3 fuentes que gastoPorCategoriaId de
  // app/page.tsx: cuotas + gastos fijos + gastos diarios, sin
  // transferencias), para los anillos de progreso de presupuesto de abajo.
  const gastoPorCategoriaId: Record<string, number> = {};
  cuotas.forEach((c) => {
    if (!c.categoria_id) return;
    gastoPorCategoriaId[c.categoria_id] = (gastoPorCategoriaId[c.categoria_id] ?? 0) + Number(c.monto_cuota);
  });
  gastosFijos.forEach((g) => {
    if (!g.categoria_id) return;
    gastoPorCategoriaId[g.categoria_id] = (gastoPorCategoriaId[g.categoria_id] ?? 0) + Number(g.monto_estimado);
  });
  gastosDiarios.forEach((d) => {
    if (!d.categoria_id) return;
    gastoPorCategoriaId[d.categoria_id] = (gastoPorCategoriaId[d.categoria_id] ?? 0) + Number(d.monto);
  });
  const categoriasConPresupuesto = presupuestos
    .map((p) => ({ presupuesto: p, categoria: categorias.find((c) => c.id === p.categoria_id) ?? null }))
    .filter((x): x is { presupuesto: PresupuestoCategoria; categoria: Categoria } => x.categoria != null)
    .sort((a, b) => a.categoria.nombre.localeCompare(b.categoria.nombre));
  const totalPresupuestado = categoriasConPresupuesto.reduce((acc, { presupuesto }) => acc + Number(presupuesto.monto_mensual), 0);
  const totalGastadoPresupuestado = categoriasConPresupuesto.reduce(
    (acc, { categoria }) => acc + (gastoPorCategoriaId[categoria.id] ?? 0),
    0
  );
  const pctPresupuestoUsado = totalPresupuestado > 0 ? Math.min(100, Math.round((totalGastadoPresupuestado / totalPresupuestado) * 100)) : 0;

  return (
    <div className="space-y-4 pb-10">
      {!ocultarTitulo && (
        <div>
          <h1 className="text-lg font-bold text-gray-800 dark:text-white">Presupuesto</h1>
          <p className="text-xs capitalize text-gray-400 dark:text-gray-500">{nombreMes()} · cómo se reparte cada peso.</p>
        </div>
      )}

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

      {categoriasConPresupuesto.length > 0 && (
        // Presupuestos por categoría con anillo de progreso (Feature G,
        // ronda 6 del rediseño) — pedido explícito del usuario, calcado de
        // una captura real de Not Pato (pestaña "Presupuestos"): un anillo
        // alrededor del ícono de cada categoría que se llena y cambia de
        // color (verde → amarillo → naranjo → rojo al excederse) según
        // cuánto llevas gastado de lo presupuestado.
        <Card>
          <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">{formatCLP(totalPresupuestado)} presupuestado</p>
          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
            <div className="h-full bg-brand-gradient" style={{ width: `${pctPresupuestoUsado}%` }} />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-gray-400 dark:text-gray-500">
            <span>
              Gastado <span className="font-semibold text-gray-700 dark:text-gray-200">{formatCLP(totalGastadoPresupuestado)}</span>
            </span>
            <span>
              Disponible{" "}
              <span className="font-semibold text-gray-700 dark:text-gray-200">
                {formatCLP(Math.max(0, totalPresupuestado - totalGastadoPresupuestado))}
              </span>
            </span>
          </div>

          <div className="mt-4 flex flex-wrap justify-around gap-x-2 gap-y-4">
            {categoriasConPresupuesto.map(({ presupuesto, categoria }) => {
              const gastado = gastoPorCategoriaId[categoria.id] ?? 0;
              const sobrepasado = gastado > presupuesto.monto_mensual;
              const pct = presupuesto.monto_mensual > 0 ? (gastado / presupuesto.monto_mensual) * 100 : 0;
              const color = colorAnilloPresupuesto(gastado, presupuesto.monto_mensual);
              return (
                <div key={categoria.id} className="flex w-20 flex-col items-center gap-1 text-center">
                  <div className="relative h-14 w-14">
                    <AnilloPresupuesto pct={pct} color={color} />
                    <span className="absolute inset-0 flex items-center justify-center text-lg">{categoria.icono || "🏷️"}</span>
                  </div>
                  <p className="mt-0.5 truncate text-xs font-bold text-gray-800 dark:text-white">
                    {formatCLP(sobrepasado ? gastado - presupuesto.monto_mensual : Math.max(0, presupuesto.monto_mensual - gastado))}
                  </p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">
                    {sobrepasado ? "excedido" : "disponible"} de {formatCLP(presupuesto.monto_mensual)}
                  </p>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {totalGastos > 0 && (
        <Card>
          <p className="mb-2 text-sm font-semibold text-gray-600 dark:text-gray-300">Fijo vs. variable</p>
          <div className="h-3.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
            <div className="h-full bg-brand-gradient" style={{ width: `${pctFijo}%` }} />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-brand-gradient" />
              Fijo · {formatCLP(totalTipoFijo)}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-gray-300 dark:bg-gray-600" />
              Variable · {formatCLP(totalTipoVariable)}
            </span>
          </div>
        </Card>
      )}

      {totalPorTipoPago > 0 && (
        <Card>
          <p className="mb-3 text-sm font-semibold text-gray-600 dark:text-gray-300">Por tipo de pago</p>
          <div className="space-y-2.5 text-sm">
            {[
              { label: "Pago único (normal)", valor: totalPagoUnico },
              { label: "Pago recurrente", valor: totalPagoRecurrente },
              { label: "Pago en cuotas", valor: totalPagoCuotas },
            ].map((fila) => (
              <div key={fila.label}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-300">{fila.label}</span>
                  <span className="font-semibold text-gray-800 dark:text-white">{formatCLP(fila.valor)}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                  <div
                    className="h-full bg-brand-gradient"
                    style={{ width: `${totalPorTipoPago > 0 ? (fila.valor / totalPorTipoPago) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
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
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
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
        className="flex items-center justify-between rounded-2xl bg-gray-50 px-4 py-3 text-sm font-semibold text-black dark:bg-white/10 dark:text-white"
      >
        Gestionar gastos
        <IconoFlecha className="shrink-0" />
      </Link>
    </div>
  );
}
