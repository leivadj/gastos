"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/Card";
import { EntidadAvatar } from "@/components/EntidadAvatar";
import { diaDelMes, formatCLP, mesActualISO, nombreMes } from "@/lib/format";
import { promedioMovil } from "@/lib/promedioMovil";
import { resolverMarca } from "@/lib/resolverMarca";
import { mensajeError } from "@/lib/supabaseError";
import { CompraVigente, Entidad, GastoDiario, GastoFijo, Marca, Pago } from "@/lib/types";

type Tab = "pagos" | "intensidad";
type Nivel = 0 | 1 | 2 | 3 | 4;

// Rediseño v2 — nueva pestaña "Intensidad": calendario de gasto diario por
// día (pedido del usuario, inspirado en una captura real de la app Not
// Pato). NO existía nada parecido en la app real (a diferencia del resto
// del rediseño, que solo cambia el aspecto visual de pantallas que ya
// existían) — se construye desde cero acá, como una segunda pestaña de esta
// misma pantalla "Calendario" en vez de una ruta nueva.
//
// El gasto del día se calcula sumando gastos_diarios.monto (gastos sueltos)
// + pagos.monto_real de los pagos ya marcados como pagados ese día
// (gastos_fijos/cuotas pagados desde esta misma pantalla) — son las únicas
// dos fuentes con FECHA exacta en el esquema real. Los ingresos NO tienen
// día exacto (ingresos.mes solo guarda el mes), así que a diferencia del
// mockup, esta versión no marca "día con ingreso" — mostrarlo con una fecha
// inventada sería engañoso.
//
// Los 5 niveles de color (gris → verde → amarillo → naranja → rojo) son la
// misma escala que el usuario aprobó en el mockup calcada de esa captura de
// Not Pato — una excepción a propósito a la regla "verde/rojo solo para
// montos de ingreso/gasto", documentada en mockup-v2-decisiones.md.
function estiloNivel(nivel: Nivel): { background: string; color?: string } {
  switch (nivel) {
    case 0:
      return { background: "rgba(120,120,120,0.08)" };
    case 1:
      return { background: "rgba(93,203,134,0.32)" };
    case 2:
      return { background: "rgba(224,197,74,0.4)" };
    case 3:
      return { background: "rgba(224,146,74,0.45)" };
    case 4:
      return { background: "rgba(226,88,75,0.55)" };
  }
}

type Evento = {
  origen: "gasto_fijo" | "compra";
  origenId: string;
  descripcion: string;
  detalle?: string;
  dia: number | null;
  monto: number;
  esPromedio: boolean;
  entidadId: string | null;
  marcaId: string | null;
  icono: string | null;
};

export default function CalendarioPagosPage() {
  const [tab, setTab] = useState<Tab>("pagos");
  const [gastosFijos, setGastosFijos] = useState<GastoFijo[]>([]);
  const [cuotas, setCuotas] = useState<CompraVigente[]>([]);
  const [entidades, setEntidades] = useState<Entidad[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [gastosDiarios, setGastosDiarios] = useState<GastoDiario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [marcandoKey, setMarcandoKey] = useState<string | null>(null);
  const [montoIngresado, setMontoIngresado] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  // Solo para la pestaña "Intensidad" — 0 = mes actual, -1 = mes anterior…
  // "Pagos" sigue mostrando siempre el mes en curso (son vencimientos, no
  // tiene sentido navegarlos hacia atrás).
  const [mesOffset, setMesOffset] = useState(0);
  const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(null);

  const mesActual = mesActualISO();

  async function cargarTodo() {
    const [{ data: gf }, { data: c }, { data: e }, { data: m }, { data: pg }, { data: gd }] = await Promise.all([
      supabase.from("gastos_fijos").select("*").eq("activo", true),
      supabase.from("vista_cuotas_mes_actual").select("*"),
      supabase.from("entidades").select("*"),
      supabase.from("marcas").select("*"),
      supabase.from("pagos").select("*"),
      supabase.from("gastos_diarios").select("*"),
    ]);
    setGastosFijos((gf as GastoFijo[]) ?? []);
    setCuotas((c as CompraVigente[]) ?? []);
    setEntidades((e as Entidad[]) ?? []);
    setMarcas((m as Marca[]) ?? []);
    setPagos((pg as Pago[]) ?? []);
    setGastosDiarios((gd as GastoDiario[]) ?? []);
    setCargando(false);
  }

  useEffect(() => {
    cargarTodo();
  }, []);

  if (cargando) {
    return <p className="py-10 text-center text-gray-400 dark:text-gray-500">Cargando…</p>;
  }

  const entidadDe = (id: string | null) => entidades.find((e) => e.id === id) ?? null;
  const marcaDe = (id: string | null) => marcas.find((m) => m.id === id) ?? null;
  const marcaDeEntidad = (id: string | null) => resolverMarca(entidadDe(id), marcas);

  // Un evento por gasto fijo activo (usa el promedio móvil si es de monto
  // variable) y uno por cada cuota vigente este mes (el día de vencimiento
  // es el mismo día del mes que su primera cuota, porque las cuotas
  // recurren siempre el mismo día).
  const eventos: Evento[] = [
    ...gastosFijos.map((g) => {
      const esVariable = g.tipo_monto === "variable";
      const { promedio, meses } = esVariable
        ? promedioMovil(pagos, g.id, mesActual, Number(g.monto_estimado))
        : { promedio: Number(g.monto_estimado), meses: 0 };
      return {
        origen: "gasto_fijo" as const,
        origenId: g.id,
        descripcion: g.descripcion,
        dia: g.dia_mes_pago,
        monto: promedio,
        esPromedio: esVariable && meses > 0,
        entidadId: g.entidad_id,
        marcaId: g.marca_id,
        icono: g.icono,
      };
    }),
    ...cuotas.map((c) => ({
      origen: "compra" as const,
      origenId: c.compra_id,
      descripcion: c.descripcion,
      detalle: `Cuota ${c.cuota_actual}/${c.n_cuotas}`,
      dia: diaDelMes(c.fecha_primera_cuota),
      monto: Number(c.monto_cuota),
      esPromedio: false,
      entidadId: c.entidad_id,
      marcaId: c.marca_id,
      icono: c.icono,
    })),
  ].sort((a, b) => {
    if (a.dia == null && b.dia == null) return 0;
    if (a.dia == null) return 1;
    if (b.dia == null) return -1;
    return a.dia - b.dia;
  });

  const pagoDe = (ev: Evento) =>
    pagos.find((p) => p.origen === ev.origen && p.origen_id === ev.origenId && p.mes === mesActual) ?? null;

  const hoyDia = new Date().getDate();

  // ---- Calendario del mes (grilla lunes a domingo) ----
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mesIdx = hoy.getMonth();
  const primerDiaSemana = (new Date(anio, mesIdx, 1).getDay() + 6) % 7; // 0 = lunes
  const diasEnMes = new Date(anio, mesIdx + 1, 0).getDate();
  const diasMesAnterior = new Date(anio, mesIdx, 0).getDate();

  const diasConGastoFijo = new Set(gastosFijos.filter((g) => g.dia_mes_pago != null).map((g) => g.dia_mes_pago as number));
  const diasConCuota = new Set(cuotas.map((c) => diaDelMes(c.fecha_primera_cuota)));

  type Celda = { numero: number; delMes: boolean };
  const celdas: Celda[] = [];
  for (let i = primerDiaSemana - 1; i >= 0; i--) celdas.push({ numero: diasMesAnterior - i, delMes: false });
  for (let d = 1; d <= diasEnMes; d++) celdas.push({ numero: d, delMes: true });
  while (celdas.length % 7 !== 0) celdas.push({ numero: celdas.length - (primerDiaSemana + diasEnMes) + 1, delMes: false });

  // ---- Pestaña "Intensidad" — su propio mes, navegable con mesOffset ----
  const baseIntensidad = new Date(anio, mesIdx + mesOffset, 1);
  const anioI = baseIntensidad.getFullYear();
  const mesIdxI = baseIntensidad.getMonth();
  const primerDiaSemanaI = (new Date(anioI, mesIdxI, 1).getDay() + 6) % 7;
  const diasEnMesI = new Date(anioI, mesIdxI + 1, 0).getDate();
  const diasMesAnteriorI = new Date(anioI, mesIdxI, 0).getDate();
  const inicioMesI = `${anioI}-${String(mesIdxI + 1).padStart(2, "0")}-01`;
  const inicioMesSiguienteI = (() => {
    const sig = new Date(anioI, mesIdxI + 1, 1);
    return `${sig.getFullYear()}-${String(sig.getMonth() + 1).padStart(2, "0")}-01`;
  })();
  const nombreMesI = new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric" }).format(baseIntensidad);

  const celdasI: Celda[] = [];
  for (let i = primerDiaSemanaI - 1; i >= 0; i--) celdasI.push({ numero: diasMesAnteriorI - i, delMes: false });
  for (let d = 1; d <= diasEnMesI; d++) celdasI.push({ numero: d, delMes: true });
  while (celdasI.length % 7 !== 0) celdasI.push({ numero: celdasI.length - (primerDiaSemanaI + diasEnMesI) + 1, delMes: false });

  // Gasto por día: gastos_diarios (gastos sueltos) + pagos ya marcados como
  // pagados ese día — las únicas dos fuentes con fecha exacta (ver comentario
  // arriba). Se filtra en el cliente en vez de volver a pedirle a Supabase
  // cada vez que se cambia de mes, ya que ambas tablas ya están cargadas
  // completas para el resto de la pantalla.
  const gastoPorDia = useMemo(() => {
    const mapa: Record<string, number> = {};
    gastosDiarios.forEach((g) => {
      if (g.fecha >= inicioMesI && g.fecha < inicioMesSiguienteI) {
        mapa[g.fecha] = (mapa[g.fecha] ?? 0) + Number(g.monto);
      }
    });
    pagos.forEach((p) => {
      if (p.pagado && p.fecha_pago && p.fecha_pago >= inicioMesI && p.fecha_pago < inicioMesSiguienteI && p.monto_real != null) {
        mapa[p.fecha_pago] = (mapa[p.fecha_pago] ?? 0) + Number(p.monto_real);
      }
    });
    return mapa;
  }, [gastosDiarios, pagos, inicioMesI, inicioMesSiguienteI]);

  const maxDelMes = Math.max(0, ...Object.values(gastoPorDia));

  function nivelDe(fechaISO: string): Nivel {
    const monto = gastoPorDia[fechaISO] ?? 0;
    if (monto <= 0 || maxDelMes <= 0) return 0;
    const pct = monto / maxDelMes;
    if (pct > 0.75) return 4;
    if (pct > 0.5) return 3;
    if (pct > 0.25) return 2;
    return 1;
  }

  const descripcionPago = (p: Pago) => {
    if (p.origen === "gasto_fijo") return gastosFijos.find((g) => g.id === p.origen_id)?.descripcion ?? "Gasto fijo";
    return cuotas.find((c) => c.compra_id === p.origen_id)?.descripcion ?? "Cuota de tarjeta";
  };

  const movimientosDelDia = diaSeleccionado
    ? [
        ...gastosDiarios.filter((g) => g.fecha === diaSeleccionado).map((g) => ({ key: `gd-${g.id}`, descripcion: g.descripcion, monto: Number(g.monto) })),
        ...pagos
          .filter((p) => p.pagado && p.fecha_pago === diaSeleccionado && p.monto_real != null)
          .map((p) => ({ key: `pg-${p.id}`, descripcion: descripcionPago(p), monto: Number(p.monto_real) })),
      ]
    : [];
  const totalDiaSeleccionado = movimientosDelDia.reduce((acc, m) => acc + m.monto, 0);

  function abrirMarcarPagado(ev: Evento) {
    setError("");
    setMarcandoKey(`${ev.origen}:${ev.origenId}`);
    setMontoIngresado(String(ev.monto));
  }

  async function confirmarPago(ev: Evento) {
    setGuardando(true);
    setError("");
    try {
      const { error: upError } = await supabase.from("pagos").upsert(
        {
          origen: ev.origen,
          origen_id: ev.origenId,
          mes: mesActual,
          monto_real: Number(montoIngresado),
          pagado: true,
          fecha_pago: new Date().toISOString().slice(0, 10),
        },
        { onConflict: "origen,origen_id,mes" }
      );
      if (upError) throw upError;
      setMarcandoKey(null);
      await cargarTodo();
    } catch (err) {
      setError(mensajeError(err) || "No se pudo guardar el pago. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  async function deshacerPago(pago: Pago) {
    setGuardando(true);
    setError("");
    const { error: delError } = await supabase.from("pagos").delete().eq("id", pago.id);
    setGuardando(false);
    if (delError) {
      setError(delError.message || "No se pudo deshacer.");
      return;
    }
    cargarTodo();
  }

  return (
    <div className="space-y-4 pb-10">
      <div>
        <h1 className="text-lg font-bold text-gray-800 dark:text-white">Calendario</h1>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          {tab === "pagos"
            ? "Servicios básicos, gastos fijos y cuotas de tarjeta, por fecha de vencimiento."
            : "Cuánto gastaste cada día — más oscuro/rojo, más gasto ese día."}
        </p>
      </div>

      <div className="flex gap-1 rounded-2xl bg-gray-100 p-1 text-sm dark:bg-white/5">
        {(
          [
            { v: "pagos", label: "Pagos" },
            { v: "intensidad", label: "Intensidad" },
          ] as { v: Tab; label: string }[]
        ).map((t) => (
          <button
            key={t.v}
            type="button"
            onClick={() => setTab(t.v)}
            className={`flex-1 rounded-xl py-2 font-semibold transition-colors ${
              tab === t.v
                ? "bg-white text-brand-from shadow-sm dark:bg-gray-800 dark:text-white dark:shadow-none"
                : "text-gray-500 dark:text-gray-500"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "intensidad" && (
        <div className="space-y-4">
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <button
                onClick={() => {
                  setMesOffset((v) => v - 1);
                  setDiaSeleccionado(null);
                }}
                className="rounded-full p-1.5 text-gray-400 hover:bg-gray-50 dark:text-gray-500 dark:hover:bg-white/5"
                aria-label="Mes anterior"
              >
                ‹
              </button>
              <p className="text-sm font-bold capitalize text-gray-800 dark:text-white">{nombreMesI}</p>
              <button
                onClick={() => {
                  setMesOffset((v) => Math.min(0, v + 1));
                  setDiaSeleccionado(null);
                }}
                disabled={mesOffset >= 0}
                className="rounded-full p-1.5 text-gray-400 hover:bg-gray-50 disabled:opacity-30 dark:text-gray-500 dark:hover:bg-white/5"
                aria-label="Mes siguiente"
              >
                ›
              </button>
            </div>
            <div className="grid grid-cols-7 text-center text-[11px] font-bold text-gray-400 dark:text-gray-500">
              {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
                <span key={i}>{d}</span>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 justify-items-center gap-y-1">
              {celdasI.map((celda, i) => {
                const fechaISO = celda.delMes ? `${anioI}-${String(mesIdxI + 1).padStart(2, "0")}-${String(celda.numero).padStart(2, "0")}` : null;
                const nivel = celda.delMes && fechaISO ? nivelDe(fechaISO) : 0;
                const esHoy = celda.delMes && mesOffset === 0 && celda.numero === hoyDia;
                const seleccionada = fechaISO === diaSeleccionado;
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={!celda.delMes}
                    onClick={() => fechaISO && setDiaSeleccionado(fechaISO === diaSeleccionado ? null : fechaISO)}
                    className={`flex h-10 w-10 items-center justify-center rounded-xl text-[13px] font-semibold transition ${
                      celda.delMes ? "text-gray-700 dark:text-gray-200" : "text-gray-300 dark:text-gray-600"
                    } ${esHoy ? "ring-[1.5px] ring-brand-from dark:ring-white" : ""} ${
                      seleccionada ? "ring-2 ring-brand-from dark:ring-white" : ""
                    }`}
                    style={celda.delMes ? estiloNivel(nivel) : undefined}
                  >
                    {celda.numero}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500">
              menos
              {([0, 1, 2, 3, 4] as Nivel[]).map((n) => (
                <span key={n} className="h-3.5 w-3.5 rounded-[4px]" style={estiloNivel(n)} />
              ))}
              más
            </div>
          </Card>

          {diaSeleccionado && (
            <Card>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold capitalize text-gray-800 dark:text-white">
                  {new Intl.DateTimeFormat("es-CL", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${diaSeleccionado}T12:00:00`))}
                </p>
                <button onClick={() => setDiaSeleccionado(null)} className="text-xs text-gray-400 dark:text-gray-500">
                  cerrar ✕
                </button>
              </div>
              {movimientosDelDia.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500">Sin gastos registrados este día.</p>
              ) : (
                <>
                  <ul className="divide-y divide-gray-100 dark:divide-white/10">
                    {movimientosDelDia.map((m) => (
                      <li key={m.key} className="flex items-center justify-between gap-2 py-2 text-sm">
                        <span className="text-gray-600 dark:text-gray-300">{m.descripcion}</span>
                        <span className="font-semibold text-gasto">{formatCLP(m.monto)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-1 flex items-center justify-between border-t border-gray-100 pt-2 text-sm dark:border-white/10">
                    <span className="font-semibold text-gray-500 dark:text-gray-400">Total del día</span>
                    <span className="font-bold text-gasto">{formatCLP(totalDiaSeleccionado)}</span>
                  </div>
                </>
              )}
            </Card>
          )}
        </div>
      )}

      {tab === "pagos" && (
      <>
      <Card>
        <p className="mb-3 text-sm font-bold capitalize text-gray-800 dark:text-white">{nombreMes()}</p>
        <div className="grid grid-cols-7 text-center text-[11px] font-bold text-gray-400 dark:text-gray-500">
          {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 justify-items-center gap-y-1">
          {celdas.map((celda, i) => {
            const esHoy = celda.delMes && celda.numero === hoyDia;
            const tieneFijo = celda.delMes && diasConGastoFijo.has(celda.numero);
            const tieneCuota = celda.delMes && diasConCuota.has(celda.numero);
            return (
              <div
                key={i}
                className={`flex h-11 w-11 flex-col items-center justify-center rounded-xl text-[13px] font-semibold ${
                  celda.delMes ? "text-gray-700 dark:text-gray-200" : "text-gray-300 dark:text-gray-600"
                } ${esHoy ? "border-[1.5px] border-brand-from text-brand-from dark:text-white" : ""}`}
              >
                {celda.numero}
                {(tieneFijo || tieneCuota) && (
                  <span className="mt-0.5 flex gap-0.5">
                    {tieneFijo && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
                    {tieneCuota && <span className="h-1.5 w-1.5 rounded-full bg-brand-from" />}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex gap-4 px-1 text-[11.5px] font-semibold text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            Gastos fijos
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-brand-from" />
            Cuotas de tarjeta
          </span>
        </div>
      </Card>

      <div>
        <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">Vencimientos de este mes</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {eventos.map((ev) => {
            const key = `${ev.origen}:${ev.origenId}`;
            const pago = pagoDe(ev);
            const pagado = pago?.pagado ?? false;
            const vencido = !pagado && ev.dia != null && ev.dia < hoyDia;
            const marca = marcaDe(ev.marcaId) ?? marcaDeEntidad(ev.entidadId);
            return (
              <Card key={key}>
                <div className="flex items-start gap-3">
                  <EntidadAvatar entidad={entidadDe(ev.entidadId)} marca={marca} icono={ev.icono} className="h-9 w-9" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-800 dark:text-white">
                      {ev.descripcion}
                      {ev.detalle ? ` · ${ev.detalle}` : ""}
                    </p>
                    <p className={`text-xs ${vencido ? "font-semibold text-red-400" : "text-gray-400 dark:text-gray-500"}`}>
                      {ev.dia != null ? `Vence el ${ev.dia}` : "Sin día definido"}
                      {vencido ? " · vencido" : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-800 dark:text-white">
                      {ev.esPromedio && <span className="mr-0.5 font-normal text-gray-400 dark:text-gray-500">~</span>}
                      {formatCLP(ev.monto)}
                    </p>
                    {pagado ? (
                      <p className="text-[11px] font-semibold text-emerald-500">
                        Pagado{pago?.monto_real != null ? ` · ${formatCLP(pago.monto_real)}` : ""}
                      </p>
                    ) : (
                      <p className="text-[11px] text-gray-300 dark:text-gray-600">Pendiente</p>
                    )}
                  </div>
                </div>

                {marcandoKey === key ? (
                  <div className="mt-3 flex items-center gap-2 border-t border-gray-50 dark:border-white/10 pt-3">
                    <input
                      type="number"
                      min={0}
                      autoFocus
                      value={montoIngresado}
                      onChange={(e) => setMontoIngresado(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 dark:border-white/10 dark:bg-white/5 dark:text-white px-3 py-1.5 text-sm"
                    />
                    <button
                      onClick={() => confirmarPago(ev)}
                      disabled={guardando}
                      className="shrink-0 rounded-lg bg-brand-gradient px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      Confirmar
                    </button>
                    <button
                      onClick={() => setMarcandoKey(null)}
                      className="shrink-0 rounded-lg bg-gray-50 dark:bg-white/5 px-3 py-1.5 text-xs font-semibold text-gray-400 dark:text-gray-500"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 flex justify-end border-t border-gray-50 dark:border-white/10 pt-3">
                    {pagado ? (
                      <button
                        onClick={() => pago && deshacerPago(pago)}
                        disabled={guardando}
                        className="text-xs text-gray-300 dark:text-gray-600 hover:text-red-400"
                      >
                        deshacer
                      </button>
                    ) : (
                      <button onClick={() => abrirMarcarPagado(ev)} className="text-xs font-semibold text-brand-from dark:text-white">
                        Marcar como pagado
                      </button>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
          {eventos.length === 0 && (
            <p className="text-center text-sm text-gray-400 dark:text-gray-500">Todavía no hay gastos fijos ni cuotas vigentes.</p>
          )}
        </div>
      </div>
      </>
      )}

      {error && <p className="text-center text-xs text-red-500 dark:text-red-400">{error}</p>}
    </div>
  );
}
