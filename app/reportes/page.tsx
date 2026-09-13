"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/Card";
import {
  cuotaActualEn,
  esMismoMes,
  isoDelMes,
  mesAnterior,
  mesRefActual,
  mesSiguiente,
  MesRef,
} from "@/lib/cuotasHistoricas";
import { formatCLP, mesActualISO, nombreMesCorto } from "@/lib/format";
import { promedioMovil } from "@/lib/promedioMovil";
import {
  Categoria,
  Compra,
  GastoDiario,
  GastoFijo,
  Grupo,
  GrupoParticipante,
  Ingreso,
  ItemParticipante,
  OrigenItem,
  Pago,
  Persona,
} from "@/lib/types";

const N_MESES = 6;
// Reservados v2 (ver tailwind.config.ts: colors.gasto/ingreso) — el gráfico
// muestra montos reales de gasto/ingreso, así que usa esos mismos tokens.
// El mes actual se resalta con el rojo "gasto" a toda intensidad; los meses
// anteriores usan una versión clara del mismo tono en vez de un color
// distinto, para no perder el significado "esto es gasto".
const COLOR_GASTO = "#F3B7AC"; // gasto (#E2584B), versión clara — meses anteriores
const COLOR_GASTO_ACTUAL = "#E2584B"; // gasto — mes actual
const COLOR_INGRESO = "#5DCB86"; // ingreso

type MesRefLabel = { iso: string; year: number; month: number; label: string; labelLargo: string };

function ultimosMeses(n: number): MesRefLabel[] {
  const hoy = new Date();
  const meses: MesRefLabel[] = [];
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

// ---- "Generar reporte" (escritorio, mockup PDF pág. 14, "ReportesWeb") ----
// Ledger filtrable por mes/categoría/persona, con el reparto real de cada
// gasto compartido. Solo GASTOS (cuotas, fijos, diarios) — igual que el
// mockup ("Reporte por gastos propios y % asignado en gastos compartidos"),
// los ingresos no entran acá. El rango de fechas se restringe a UN mes
// calendario (a diferencia del mockup, que en teoría permite cualquier
// rango): repartir cuotas/fijos parciales de un rango arbitrario exigiría
// prorratear días dentro del mes, que no es como se registran en el
// esquema real — un mes completo es exacto y cubre el caso de uso real
// (cerrar el mes). Se puede ampliar más adelante si hace falta.
type FilaReporte = {
  key: string;
  diaOrden: number;
  fechaLabel: string;
  descripcion: string;
  categoriaId: string | null;
  monto: number;
  reparto: { persona_id: string; persona_nombre: string; pct: number; monto: number }[];
};

export default function ReportesPage() {
  const [compras, setCompras] = useState<Compra[]>([]);
  const [gastosFijos, setGastosFijos] = useState<GastoFijo[]>([]);
  const [gastosDiarios, setGastosDiarios] = useState<GastoDiario[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [ingresos, setIngresos] = useState<Ingreso[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [grupoParticipantes, setGrupoParticipantes] = useState<GrupoParticipante[]>([]);
  const [itemParticipantes, setItemParticipantes] = useState<ItemParticipante[]>([]);
  const [cargando, setCargando] = useState(true);

  // Filtros del reporte de escritorio.
  const [rangoRef, setRangoRef] = useState<MesRef>(mesRefActual());
  const [categoriaFiltro, setCategoriaFiltro] = useState("");
  const [personaFiltro, setPersonaFiltro] = useState("");

  useEffect(() => {
    async function cargar() {
      const [{ data: c }, { data: gf }, { data: gd }, { data: pg }, { data: ing }, { data: cat }, { data: p }, { data: gr }, { data: gp }, { data: ipC }, { data: ipG }] =
        await Promise.all([
          supabase.from("compras").select("*"),
          supabase.from("gastos_fijos").select("*").eq("activo", true),
          supabase.from("gastos_diarios").select("*"),
          supabase.from("pagos").select("*"),
          supabase.from("ingresos").select("*"),
          supabase.from("categorias").select("*"),
          supabase.from("personas").select("*").eq("activo", true),
          supabase.from("grupos").select("*").order("nombre"),
          supabase.from("grupo_participantes").select("*"),
          supabase.from("item_participantes").select("*").eq("origen", "compra"),
          supabase.from("item_participantes").select("*").eq("origen", "gasto_fijo"),
        ]);
      setCompras((c as Compra[]) ?? []);
      setGastosFijos((gf as GastoFijo[]) ?? []);
      setGastosDiarios((gd as GastoDiario[]) ?? []);
      setPagos((pg as Pago[]) ?? []);
      setIngresos((ing as Ingreso[]) ?? []);
      setCategorias((cat as Categoria[]) ?? []);
      setPersonas((p as Persona[]) ?? []);
      setGrupos((gr as Grupo[]) ?? []);
      setGrupoParticipantes((gp as GrupoParticipante[]) ?? []);
      setItemParticipantes([...((ipC as ItemParticipante[]) ?? []), ...((ipG as ItemParticipante[]) ?? [])]);
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
  function gastosDelMes(ref: MesRefLabel): number {
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

  // ---- Reparto real (mismo criterio que las vistas SQL vista_grupo_reparto
  // / vista_item_reparto, evaluado del lado del cliente para poder hacerlo
  // para CUALQUIER mes, no solo el actual — las vistas están fijas al mes en
  // curso). % fijo respeta lo cargado; el resto se reparte en partes
  // iguales entre quienes quedaron sin %. ----
  const activas = personas.filter((p) => p.activo);
  const personaSelf = personas.find((p) => p.es_self) ?? null;

  function repartoEfectivo(filas: { persona_id: string; porcentaje: number | null }[]) {
    const filasActivas = filas.filter((f) => activas.some((p) => p.id === f.persona_id));
    const sumaFija = filasActivas.filter((f) => f.porcentaje != null).reduce((acc, f) => acc + Number(f.porcentaje), 0);
    const sinFijar = filasActivas.filter((f) => f.porcentaje == null);
    return filasActivas.map((f) => {
      const pct = f.porcentaje != null ? Number(f.porcentaje) : sinFijar.length > 0 ? Math.max(0, 100 - sumaFija) / sinFijar.length : 0;
      return { persona_id: f.persona_id, persona_nombre: personas.find((p) => p.id === f.persona_id)?.nombre ?? "?", pct };
    });
  }

  function repartoDeGrupo(grupoId: string) {
    return repartoEfectivo(grupoParticipantes.filter((gp) => gp.grupo_id === grupoId));
  }

  function repartoDeItem(origen: OrigenItem, origenId: string) {
    return repartoEfectivo(itemParticipantes.filter((ip) => ip.origen === origen && ip.origen_id === origenId));
  }

  // Reparto final de un ítem: grupo si tiene, si no su propio reparto, si no
  // 100% para quien es dueño de la cuenta (gasto personal, sin compartir).
  function repartoFinal(grupoId: string | null, origen: OrigenItem | null, origenId: string): { persona_id: string; persona_nombre: string; pct: number }[] {
    if (grupoId) {
      const r = repartoDeGrupo(grupoId);
      if (r.length > 0) return r;
    }
    if (origen) {
      const r = repartoDeItem(origen, origenId);
      if (r.length > 0) return r;
    }
    return personaSelf ? [{ persona_id: personaSelf.id, persona_nombre: personaSelf.nombre, pct: 100 }] : [];
  }

  const refIso = isoDelMes(rangoRef);
  const refMesTexto = refIso.slice(0, 7);
  const ultimoDiaMes = new Date(rangoRef.year, rangoRef.month + 1, 0).getDate();
  const nombreMesLargo = new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric" }).format(new Date(rangoRef.year, rangoRef.month, 1));
  const nombreMesLargoCap = nombreMesLargo.charAt(0).toUpperCase() + nombreMesLargo.slice(1);

  const filasReporte: FilaReporte[] = useMemo(() => {
    const filas: FilaReporte[] = [];
    compras.forEach((c) => {
      const cuotaActual = cuotaActualEn(c.fecha_primera_cuota, rangoRef);
      if (cuotaActual < 1 || cuotaActual > c.n_cuotas) return;
      const real = pagoReal("compra", c.id, refIso);
      const monto = real != null ? Number(real) : Math.round(c.monto_total / c.n_cuotas);
      const dia = Number(c.fecha_primera_cuota.slice(0, 10).split("-")[2]);
      const reparto = repartoFinal(c.grupo_id, "compra", c.id);
      filas.push({
        key: `c-${c.id}`,
        diaOrden: dia,
        fechaLabel: `${dia} ${nombreMesCorto(refIso)}`,
        descripcion: c.descripcion,
        categoriaId: c.categoria_id,
        monto,
        reparto: reparto.map((r) => ({ ...r, monto: Math.round((monto * r.pct) / 100) })),
      });
    });
    gastosFijos.forEach((g) => {
      const real = pagoReal("gasto_fijo", g.id, refIso);
      let monto: number;
      if (real != null) monto = Number(real);
      else if (g.tipo_monto === "variable") monto = promedioMovil(pagos, g.id, refIso, Number(g.monto_estimado)).promedio;
      else monto = Number(g.monto_estimado);
      const dia = g.dia_mes_pago ?? 1;
      const reparto = repartoFinal(g.grupo_id, "gasto_fijo", g.id);
      filas.push({
        key: `g-${g.id}`,
        diaOrden: dia,
        fechaLabel: `${dia} ${nombreMesCorto(refIso)}`,
        descripcion: g.descripcion,
        categoriaId: g.categoria_id,
        monto,
        reparto: reparto.map((r) => ({ ...r, monto: Math.round((monto * r.pct) / 100) })),
      });
    });
    gastosDiarios
      .filter((d) => d.fecha.slice(0, 7) === refMesTexto)
      .forEach((d) => {
        const dia = Number(d.fecha.slice(8, 10));
        const reparto = repartoFinal(d.grupo_id, null, d.id);
        filas.push({
          key: `d-${d.id}`,
          diaOrden: dia,
          fechaLabel: `${dia} ${nombreMesCorto(refIso)}`,
          descripcion: d.descripcion,
          categoriaId: d.categoria_id,
          monto: Number(d.monto),
          reparto: reparto.map((r) => ({ ...r, monto: Math.round((Number(d.monto) * r.pct) / 100) })),
        });
      });
    return filas.sort((a, b) => b.diaOrden - a.diaOrden);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compras, gastosFijos, gastosDiarios, pagos, grupoParticipantes, itemParticipantes, personas, rangoRef, refIso, refMesTexto]);

  const categoriaDe = (id: string | null) => categorias.find((c) => c.id === id) ?? null;
  const personaDe = (id: string) => personas.find((p) => p.id === id) ?? null;

  const filasFiltradas = filasReporte.filter((f) => {
    if (categoriaFiltro && f.categoriaId !== categoriaFiltro) return false;
    if (personaFiltro && !f.reparto.some((r) => r.persona_id === personaFiltro && r.monto > 0)) return false;
    return true;
  });

  function montoMostrado(f: FilaReporte): number {
    if (!personaFiltro) return f.monto;
    return f.reparto.find((r) => r.persona_id === personaFiltro)?.monto ?? 0;
  }

  const totalFiltrado = filasFiltradas.reduce((acc, f) => acc + montoMostrado(f), 0);

  // "Reparto de X" — el ítem compartido (más de una persona en su reparto)
  // dentro de lo filtrado; si hay más de uno, se muestra el primero (más
  // reciente) — mismo criterio que el mockup, que asume un único gasto
  // compartido en el filtro de ejemplo.
  const itemCompartido = filasFiltradas.find((f) => f.reparto.length > 1) ?? null;

  function exportarExcel() {
    const filas = [
      ["Fecha", "Descripción", "Categoría", "Persona", "Monto"],
      ...filasFiltradas.map((f) => [
        f.fechaLabel,
        f.reparto.length > 1 ? `${f.descripcion} · ${Math.round(f.reparto.find((r) => r.persona_id === personaFiltro)?.pct ?? 0)}% de ${formatCLP(f.monto)}` : f.descripcion,
        categoriaDe(f.categoriaId)?.nombre ?? "Sin categoría",
        personaFiltro ? personaDe(personaFiltro)?.nombre ?? "" : f.reparto.map((r) => r.persona_nombre).join(" / "),
        String(montoMostrado(f)),
      ]),
    ];
    const csv = filas.map((f) => f.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte-${refMesTexto}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportarPDF() {
    const ventana = window.open("", "_blank", "width=800,height=1000");
    if (!ventana) return;
    const filasHtml = filasFiltradas
      .map((f) => {
        const desc =
          f.reparto.length > 1
            ? `${f.descripcion} <span style="color:#999">· ${Math.round(f.reparto.find((r) => r.persona_id === personaFiltro)?.pct ?? 0)}% de ${formatCLP(f.monto)}</span>`
            : f.descripcion;
        const persona = personaFiltro ? personaDe(personaFiltro)?.nombre ?? "" : f.reparto.map((r) => r.persona_nombre).join(" / ");
        return `<tr><td>${f.fechaLabel}</td><td>${desc}</td><td>${categoriaDe(f.categoriaId)?.nombre ?? "Sin categoría"}</td><td>${persona}</td><td style="text-align:right">${formatCLP(montoMostrado(f))}</td></tr>`;
      })
      .join("");
    ventana.document.write(`<!doctype html><html><head><title>Reporte ${nombreMesLargoCap}</title><meta charset="utf-8"/><style>
      body{font-family:-apple-system,Helvetica,Arial,sans-serif;padding:28px;color:#111}
      h1{font-size:18px;margin-bottom:2px}
      p{color:#888;font-size:12px;margin-top:0}
      table{width:100%;border-collapse:collapse;font-size:13px;margin-top:16px}
      th,td{padding:7px 8px;border-bottom:1px solid #eee;text-align:left}
      th{color:#999;text-transform:uppercase;font-size:10px;letter-spacing:.03em}
      tfoot td{font-weight:700;border-top:2px solid #111;border-bottom:none}
    </style></head><body>
      <h1>Generar reporte</h1>
      <p>${nombreMesLargoCap}${personaFiltro ? " · Persona: " + (personaDe(personaFiltro)?.nombre ?? "") : ""}${categoriaFiltro ? " · " + (categoriaDe(categoriaFiltro)?.nombre ?? "") : ""}</p>
      <table>
        <thead><tr><th>Fecha</th><th>Descripción</th><th>Categoría</th><th>Persona</th><th style="text-align:right">Monto</th></tr></thead>
        <tbody>${filasHtml}</tbody>
        <tfoot><tr><td colspan="4">Total filtrado</td><td style="text-align:right">${formatCLP(totalFiltrado)}</td></tr></tfoot>
      </table>
    </body></html>`);
    ventana.document.close();
    ventana.focus();
    ventana.print();
  }

  return (
    <div className="space-y-4 pb-10">
      {/* ---- Móvil: resumen de tendencia (no está en el mockup, que solo
          documenta la versión de escritorio "ReportesWeb" — se conserva tal
          cual porque ya es útil y no hay una versión móvil que calzar). ---- */}
      <div className="space-y-4 md:hidden">
        <div>
          <h1 className="text-lg font-bold text-gray-800 dark:text-white">Reportes</h1>
          <p className="text-xs text-gray-400 dark:text-gray-500">Ingresos vs. gastos, últimos {N_MESES} meses.</p>
        </div>

        <Card>
          <div style={{ height: 190 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={datos} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#F3F4F6" />
                <XAxis dataKey="label" tick={{ fontSize: 10.5, fontWeight: 600, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
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
                <Line type="monotone" dataKey="ingresos" stroke={COLOR_INGRESO} strokeWidth={2.4} dot={{ r: 3.2, fill: COLOR_INGRESO, strokeWidth: 0 }} />
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
            <p className={`mt-1.5 text-lg font-extrabold ${ahorroPromedio < 0 ? "text-gasto" : "text-gray-800 dark:text-white"}`}>
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
                <span className={`w-9 shrink-0 font-medium ${d.esActual ? "text-brand-from dark:text-white" : "text-gray-500 dark:text-gray-300"}`}>
                  {d.label}
                </span>
                <span className="flex-1 text-right text-gray-400 dark:text-gray-500">{formatCLP(d.gastos)}</span>
                <span className="flex-1 text-right text-ingreso">{formatCLP(d.ingresos)}</span>
                <span className={`w-24 shrink-0 text-right font-semibold ${d.ahorro < 0 ? "text-gasto" : "text-gray-800 dark:text-white"}`}>
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

      {/* ---- Escritorio: "Generar reporte" — tabla filtrable (mockup PDF
          pág. 14, "ReportesWeb.dc.html"). ---- */}
      <div className="hidden space-y-4 md:block">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Reportes</p>
            <h1 className="text-lg font-bold text-gray-800 dark:text-white">Generar reporte</h1>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              onClick={exportarPDF}
              className="rounded-full bg-brand-gradient px-3.5 py-2 text-xs font-semibold text-white"
            >
              Exportar PDF
            </button>
            <button
              onClick={exportarExcel}
              className="rounded-full border border-gray-200 px-3.5 py-2 text-xs font-semibold text-gray-600 dark:border-white/10 dark:text-gray-300"
            >
              Exportar Excel
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-full border border-gray-200 px-2 py-1.5 text-xs font-medium text-gray-600 dark:border-white/10 dark:text-gray-300">
            <button
              onClick={() => setRangoRef((r) => mesAnterior(r))}
              aria-label="Mes anterior"
              className="rounded-full px-1.5 text-gray-400 hover:bg-gray-50 dark:text-gray-500 dark:hover:bg-white/5"
            >
              ‹
            </button>
            <span>
              1 – {ultimoDiaMes} {nombreMesCorto(refIso)} {rangoRef.year}
            </span>
            <button
              onClick={() => setRangoRef((r) => (esMismoMes(r, mesRefActual()) ? r : mesSiguiente(r)))}
              disabled={esMismoMes(rangoRef, mesRefActual())}
              aria-label="Mes siguiente"
              className="rounded-full px-1.5 text-gray-400 hover:bg-gray-50 disabled:opacity-30 dark:text-gray-500 dark:hover:bg-white/5"
            >
              ›
            </button>
          </div>

          <select
            value={categoriaFiltro}
            onChange={(e) => setCategoriaFiltro(e.target.value)}
            className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 dark:border-white/10 dark:bg-transparent dark:text-gray-300"
          >
            <option value="">Todas las categorías</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>

          {personaFiltro ? (
            <span className="flex items-center gap-1.5 rounded-full bg-gray-800 px-3 py-1.5 text-xs font-medium text-white dark:bg-white dark:text-black">
              Persona: {personaDe(personaFiltro)?.nombre}
              <button onClick={() => setPersonaFiltro("")} aria-label="Quitar filtro de persona" className="opacity-70 hover:opacity-100">
                ✕
              </button>
            </span>
          ) : (
            activas.length > 0 && (
              <select
                value=""
                onChange={(e) => setPersonaFiltro(e.target.value)}
                className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 dark:border-white/10 dark:bg-transparent dark:text-gray-300"
              >
                <option value="">+ Filtrar por persona</option>
                {activas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            )
          )}

          <span className="ml-auto text-[11px] text-gray-400 dark:text-gray-500">
            Reporte por gastos propios y % asignado en gastos compartidos
          </span>
        </div>

        <Card className="!p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-[10.5px] font-semibold uppercase tracking-wide text-gray-400 dark:border-white/10 dark:text-gray-500">
                <th className="px-4 py-2.5">Fecha</th>
                <th className="px-4 py-2.5">Descripción</th>
                <th className="px-4 py-2.5">Categoría</th>
                <th className="px-4 py-2.5">Persona</th>
                <th className="px-4 py-2.5 text-right">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-white/10">
              {filasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
                    Sin movimientos para este filtro.
                  </td>
                </tr>
              ) : (
                filasFiltradas.map((f) => (
                  <tr key={f.key} className="text-gray-700 dark:text-gray-200">
                    <td className="whitespace-nowrap px-4 py-2.5 text-gray-400 dark:text-gray-500">{f.fechaLabel}</td>
                    <td className="px-4 py-2.5">
                      {f.descripcion}
                      {f.reparto.length > 1 && (
                        <span className="text-gray-400 dark:text-gray-500">
                          {" "}
                          · {Math.round(f.reparto.find((r) => r.persona_id === personaFiltro)?.pct ?? f.reparto[0].pct)}% de {formatCLP(f.monto)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">{categoriaDe(f.categoriaId)?.nombre ?? "Sin categoría"}</td>
                    <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">
                      {personaFiltro ? personaDe(personaFiltro)?.nombre : f.reparto.map((r) => r.persona_nombre).join(" / ")}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-gray-800 dark:text-white">{formatCLP(montoMostrado(f))}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>

        <div className="grid gap-3 md:grid-cols-2">
          {itemCompartido && (
            <Card>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Reparto de &quot;{itemCompartido.descripcion}&quot;</p>
              <p className="mb-3 text-[11px] text-gray-400 dark:text-gray-500">
                {filasFiltradas.filter((f) => f.reparto.length > 1).length === 1 ? "Único gasto compartido dentro de este filtro" : "Gasto compartido dentro de este filtro"} ·{" "}
                {formatCLP(itemCompartido.monto)} total
              </p>
              <div className="flex h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                {itemCompartido.reparto.map((r, i) => (
                  <div
                    key={r.persona_id}
                    style={{ width: `${r.pct}%`, backgroundColor: i === 0 ? "#111113" : "#D1D5DB" }}
                    className="h-full first:rounded-l-full last:rounded-r-full dark:[&:nth-child(1)]:bg-white"
                  />
                ))}
              </div>
              <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
                {itemCompartido.reparto.map((r) => (
                  <span key={r.persona_id}>
                    {r.persona_nombre} · {Math.round(r.pct)}% · {formatCLP(r.monto)}
                  </span>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              Total filtrado{personaFiltro ? ` (${personaDe(personaFiltro)?.nombre})` : ""}
            </p>
            <p className="mt-1.5 text-2xl font-extrabold text-gray-800 dark:text-white">{formatCLP(totalFiltrado)}</p>
            <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
              {filasFiltradas.length} movimiento{filasFiltradas.length === 1 ? "" : "s"} · {nombreMesLargoCap}
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
