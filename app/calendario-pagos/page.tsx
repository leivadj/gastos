"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/Card";
import { EntidadAvatar } from "@/components/EntidadAvatar";
import { TarjetasCarousel } from "@/components/TarjetasCarousel";
import { diaDelMes, formatCLP, mesActualISO, nombreMes, nombreMesCorto } from "@/lib/format";
import { promedioMovil } from "@/lib/promedioMovil";
import { resolverMarca } from "@/lib/resolverMarca";
import { mensajeError } from "@/lib/supabaseError";
import { CompraVigente, Entidad, GastoFijo, Marca, Pago, Transferencia } from "@/lib/types";

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
  // Solo id + entidad_id (no hace falta el resto de `compras` acá) — a
  // diferencia de `cuotas` (vista_cuotas_mes_actual, solo el mes en curso),
  // esto trae TODAS las compras sin importar el mes, para poder saber a qué
  // cuenta pertenece un pago de un mes anterior en la pestaña "Intensidad".
  const [comprasEntidad, setComprasEntidad] = useState<{ id: string; entidad_id: string | null }[]>([]);
  const [transferencias, setTransferencias] = useState<Transferencia[]>([]);
  const [cargando, setCargando] = useState(true);
  // Pestaña "Intensidad" — filtro de "Movimientos internos" (mockup PDF
  // pág. 8): abonos de tarjeta ("Pago TC", transferencia hacia una tarjeta
  // de crédito) vs. traspasos entre cuentas propias que no son tarjeta.
  const [filtroInterno, setFiltroInterno] = useState<"pago_tc" | "entre_cuentas">("pago_tc");
  const [marcandoKey, setMarcandoKey] = useState<string | null>(null);
  const [montoIngresado, setMontoIngresado] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  // Solo para la pestaña "Intensidad" — 0 = mes actual, -1 = mes anterior…
  // "Pagos" sigue mostrando siempre el mes en curso (son vencimientos, no
  // tiene sentido navegarlos hacia atrás).
  const [mesOffset, setMesOffset] = useState(0);
  const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(null);
  // Cuenta seleccionada en el carrusel "Por tarjeta" de la pestaña
  // "Intensidad" (mockup Calendario.dc.html) — el gasto/ingreso diario que se
  // muestra abajo es el de ESTA cuenta, no el total de todas.
  const [cuentaActivaId, setCuentaActivaId] = useState<string | null>(null);

  const mesActual = mesActualISO();

  async function cargarTodo() {
    const [{ data: gf }, { data: c }, { data: e }, { data: m }, { data: pg }, { data: cp }, { data: tr }] = await Promise.all([
      supabase.from("gastos_fijos").select("*").eq("activo", true),
      supabase.from("vista_cuotas_mes_actual").select("*"),
      supabase.from("entidades").select("*"),
      supabase.from("marcas").select("*"),
      supabase.from("pagos").select("*"),
      supabase.from("compras").select("id, entidad_id"),
      supabase.from("transferencias").select("*"),
    ]);
    const listaEntidades = (e as Entidad[]) ?? [];
    setGastosFijos((gf as GastoFijo[]) ?? []);
    setCuotas((c as CompraVigente[]) ?? []);
    setEntidades(listaEntidades);
    setMarcas((m as Marca[]) ?? []);
    setPagos((pg as Pago[]) ?? []);
    setComprasEntidad((cp as { id: string; entidad_id: string | null }[]) ?? []);
    setTransferencias((tr as Transferencia[]) ?? []);
    setCargando(false);
    setCuentaActivaId((actual) => {
      if (actual && listaEntidades.some((x) => x.id === actual)) return actual;
      return listaEntidades[0]?.id ?? null;
    });
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

  // A qué cuenta pertenece un pago (mirando el gasto_fijo o la compra que le
  // dio origen — `pagos` no guarda entidad_id directo). gastos_diarios queda
  // afuera a propósito: son gastos sueltos "sin tarjeta ni cuenta" (ver
  // /gastos, pestaña Normal), no tienen entidad_id y por lo tanto no pueden
  // atribuirse a ninguna cuenta puntual — por eso la intensidad diaria ahora
  // es SIEMPRE por cuenta (mockup Calendario.dc.html), y ya no existe un
  // total "de todas las cuentas" que los mezclaría de forma engañosa.
  function entidadDePago(p: Pago): string | null {
    if (p.origen === "gasto_fijo") return gastosFijos.find((g) => g.id === p.origen_id)?.entidad_id ?? null;
    return comprasEntidad.find((c) => c.id === p.origen_id)?.entidad_id ?? null;
  }

  // Gasto por día DE LA CUENTA SELECCIONADA: pagos (gastos fijos/cuotas) ya
  // marcados como pagados ese día en esa cuenta, más las transferencias que
  // SALIERON de ella ese día (mismo criterio que /tarjetas →
  // gastosCuentaActivaMes/ingresosCuentaActivaMes).
  const gastoPorDia = useMemo(() => {
    const mapa: Record<string, number> = {};
    if (!cuentaActivaId) return mapa;
    pagos.forEach((p) => {
      if (!p.pagado || !p.fecha_pago || p.monto_real == null) return;
      if (p.fecha_pago < inicioMesI || p.fecha_pago >= inicioMesSiguienteI) return;
      if (entidadDePago(p) !== cuentaActivaId) return;
      mapa[p.fecha_pago] = (mapa[p.fecha_pago] ?? 0) + Number(p.monto_real);
    });
    transferencias.forEach((t) => {
      if (t.cuenta_origen_id !== cuentaActivaId) return;
      if (t.fecha < inicioMesI || t.fecha >= inicioMesSiguienteI) return;
      mapa[t.fecha] = (mapa[t.fecha] ?? 0) + Number(t.monto);
    });
    return mapa;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagos, gastosFijos, comprasEntidad, transferencias, cuentaActivaId, inicioMesI, inicioMesSiguienteI]);

  // Día con ingreso (punto verde, mockup Calendario.dc.html): transferencias
  // que ENTRARON a la cuenta seleccionada ese día — a diferencia de
  // `ingresos` (sueldo de una persona, sin fecha exacta), una transferencia
  // sí tiene fecha exacta, así que acá SÍ se puede marcar el día real.
  const ingresoPorDia = useMemo(() => {
    const mapa: Record<string, number> = {};
    if (!cuentaActivaId) return mapa;
    transferencias.forEach((t) => {
      if (t.cuenta_destino_id !== cuentaActivaId) return;
      if (t.fecha < inicioMesI || t.fecha >= inicioMesSiguienteI) return;
      mapa[t.fecha] = (mapa[t.fecha] ?? 0) + Number(t.monto);
    });
    return mapa;
  }, [transferencias, cuentaActivaId, inicioMesI, inicioMesSiguienteI]);

  const maxDelMes = Math.max(0, ...Object.values(gastoPorDia));

  // "Gastado este mes" por cuenta, para el carrusel "Por tarjeta" de esta
  // pestaña (mismo cálculo que gastoPorEntidad en app/tarjetas/page.tsx).
  const gastoPorEntidadCarrusel = useMemo(() => {
    const acc: Record<string, number> = {};
    cuotas.forEach((c) => {
      if (!c.entidad_id) return;
      acc[c.entidad_id] = (acc[c.entidad_id] ?? 0) + Number(c.monto_cuota);
    });
    gastosFijos.forEach((g) => {
      if (!g.entidad_id) return;
      acc[g.entidad_id] = (acc[g.entidad_id] ?? 0) + Number(g.monto_estimado);
    });
    return acc;
  }, [cuotas, gastosFijos]);

  // "Movimientos internos" (mockup pág. 8) — traspasos entre cuentas propias
  // del mes que se está mirando en Intensidad, usando la misma tabla
  // `transferencias` que ya alimenta /tarjetas: no son gasto ni ingreso, por
  // eso van aparte de "Vencimientos" y no suman al gasto del día.
  const transferenciasDelMesI = useMemo(
    () => transferencias.filter((t) => t.fecha >= inicioMesI && t.fecha < inicioMesSiguienteI),
    [transferencias, inicioMesI, inicioMesSiguienteI]
  );
  const esPagoTC = (t: Transferencia) => entidadDe(t.cuenta_destino_id)?.tipo === "tarjeta_credito";
  const movimientosInternos = transferenciasDelMesI
    .filter((t) => (filtroInterno === "pago_tc" ? esPagoTC(t) : !esPagoTC(t)))
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));

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

  const nombreEntidad = (id: string | null) => entidades.find((e) => e.id === id)?.nombre ?? "otra cuenta";

  // Movimientos del día seleccionado, de la cuenta activa: pagos hechos ahí
  // ese día (gasto) + transferencias que entraron o salieron de ella ese
  // mismo día (ingreso/gasto según el sentido) — ya no incluye
  // gastos_diarios (no tienen cuenta asociada, ver comentario en
  // gastoPorDia más arriba).
  const movimientosDelDia = diaSeleccionado && cuentaActivaId
    ? [
        ...pagos
          .filter((p) => p.pagado && p.fecha_pago === diaSeleccionado && p.monto_real != null && entidadDePago(p) === cuentaActivaId)
          .map((p) => ({ key: `pg-${p.id}`, descripcion: descripcionPago(p), monto: Number(p.monto_real), signo: -1 as const })),
        ...transferencias
          .filter((t) => t.fecha === diaSeleccionado && (t.cuenta_origen_id === cuentaActivaId || t.cuenta_destino_id === cuentaActivaId))
          .map((t) => {
            const esSalida = t.cuenta_origen_id === cuentaActivaId;
            return {
              key: `t-${t.id}`,
              descripcion: t.notas || (esSalida ? `Transferencia hacia ${nombreEntidad(t.cuenta_destino_id)}` : `Transferencia desde ${nombreEntidad(t.cuenta_origen_id)}`),
              monto: Number(t.monto),
              signo: (esSalida ? -1 : 1) as -1 | 1,
            };
          }),
      ]
    : [];
  const gastoDiaSeleccionado = movimientosDelDia.filter((m) => m.signo === -1).reduce((acc, m) => acc + m.monto, 0);
  const ingresoDiaSeleccionado = movimientosDelDia.filter((m) => m.signo === 1).reduce((acc, m) => acc + m.monto, 0);

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
          {entidades.length === 0 ? (
            <Card>
              <p className="text-sm text-gray-400 dark:text-gray-500">
                Todavía no tienes cuentas creadas — agrega una en{" "}
                <a href="/tarjetas" className="font-semibold text-brand-from dark:text-white">
                  Cuentas
                </a>{" "}
                para ver su intensidad diaria de gasto.
              </p>
            </Card>
          ) : (
            <>
              {/* "Por tarjeta" (mockup Calendario.dc.html): la intensidad
                  diaria de acá abajo es SIEMPRE de una cuenta puntual, elegida
                  en este mismo carrusel que ya se usa en /tarjetas. */}
              <div>
                <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">Por tarjeta</p>
                <TarjetasCarousel
                  entidades={entidades}
                  marcas={marcas}
                  gastoPorEntidad={gastoPorEntidadCarrusel}
                  activaId={cuentaActivaId}
                  onCambiarActiva={(id) => {
                    setCuentaActivaId(id);
                    setDiaSeleccionado(null);
                  }}
                />
              </div>

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
                const tieneIngreso = celda.delMes && fechaISO ? (ingresoPorDia[fechaISO] ?? 0) > 0 : false;
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={!celda.delMes}
                    onClick={() => fechaISO && setDiaSeleccionado(fechaISO === diaSeleccionado ? null : fechaISO)}
                    className={`relative flex h-10 w-10 items-center justify-center rounded-xl text-[13px] font-semibold transition ${
                      celda.delMes ? "text-gray-700 dark:text-gray-200" : "text-gray-300 dark:text-gray-600"
                    } ${esHoy ? "ring-[1.5px] ring-brand-from dark:ring-white" : ""} ${
                      seleccionada ? "ring-2 ring-brand-from dark:ring-white" : ""
                    }`}
                    style={celda.delMes ? estiloNivel(nivel) : undefined}
                  >
                    {celda.numero}
                    {tieneIngreso && (
                      <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-white bg-ingreso dark:border-gray-900" />
                    )}
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
            <div className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500">
              <span className="h-2 w-2 rounded-full bg-ingreso" />
              día con ingreso
            </div>
          </Card>

          <Card>
            <p className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-200">Movimientos internos</p>
            <div className="mb-3 inline-flex gap-1 rounded-2xl bg-gray-100 p-1 text-xs dark:bg-white/5">
              {(
                [
                  { v: "pago_tc", label: "Pago TC" },
                  { v: "entre_cuentas", label: "Entre cuentas" },
                ] as { v: "pago_tc" | "entre_cuentas"; label: string }[]
              ).map((f) => (
                <button
                  key={f.v}
                  type="button"
                  onClick={() => setFiltroInterno(f.v)}
                  className={`rounded-xl px-3 py-1.5 font-semibold transition-colors ${
                    filtroInterno === f.v
                      ? "bg-white text-brand-from shadow-sm dark:bg-gray-800 dark:text-white dark:shadow-none"
                      : "text-gray-500 dark:text-gray-500"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {movimientosInternos.length === 0 ? (
              <p className="py-1 text-sm text-gray-400 dark:text-gray-500">
                Sin {filtroInterno === "pago_tc" ? "pagos de tarjeta" : "traspasos entre cuentas"} este mes.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-white/10">
                {movimientosInternos.map((t) => {
                  const origen = entidadDe(t.cuenta_origen_id);
                  const destino = entidadDe(t.cuenta_destino_id);
                  const fechaCorta = `${diaDelMes(t.fecha)} ${nombreMesCorto(t.fecha)}`;
                  return (
                    <li key={t.id} className="flex items-center gap-3 py-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-sm dark:bg-white/10">
                        ↔
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-700 dark:text-gray-200">
                          {filtroInterno === "pago_tc" ? `Pago tarjeta ${destino?.nombre ?? "—"}` : `${origen?.nombre ?? "—"} → ${destino?.nombre ?? "—"}`}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          {filtroInterno === "pago_tc" ? `Desde ${origen?.nombre ?? "—"}` : "Transferencia interna"} · {fechaCorta}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold text-gray-800 dark:text-white">{formatCLP(t.monto)}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {diaSeleccionado && (
            // Rediseño v2 — el detalle del día pasa de tarjeta en línea a
            // hoja inferior (bottom sheet), calcado de Calendario.dc.html
            // ("Domingo 13 de septiembre" + resumen +ingreso/-gasto + lista).
            <div
              className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
              onClick={() => setDiaSeleccionado(null)}
            >
              <div
                className="max-h-[85vh] w-full overflow-y-auto rounded-t-3xl bg-[#111113] p-5 pb-7 text-white sm:max-w-md sm:rounded-3xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-3 flex justify-center sm:hidden">
                  <div className="h-1 w-9 rounded-full bg-white/20" />
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-base font-bold capitalize">
                    {new Intl.DateTimeFormat("es-CL", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${diaSeleccionado}T12:00:00`))}
                  </p>
                  <button onClick={() => setDiaSeleccionado(null)} aria-label="Cerrar" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
                    ✕
                  </button>
                </div>
                {/* Ahora sí se muestran ambas cifras (mockup: "+$2.850.000 ·
                    -$86.750"): al ser por cuenta, el ingreso sale de
                    transferencias que entraron a ESTA cuenta ese día, que sí
                    tienen fecha exacta (a diferencia de `ingresos`, el sueldo
                    de una persona, que solo guarda el mes). */}
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  {ingresoDiaSeleccionado > 0 && <span className="font-bold text-ingreso">+{formatCLP(ingresoDiaSeleccionado)}</span>}
                  {gastoDiaSeleccionado > 0 && <span className="font-bold text-gasto">-{formatCLP(gastoDiaSeleccionado)}</span>}
                  <span className="text-white/40">· {movimientosDelDia.length} movimiento{movimientosDelDia.length === 1 ? "" : "s"}</span>
                </div>

                {movimientosDelDia.length === 0 ? (
                  <p className="mt-4 text-sm text-white/40">Sin movimientos registrados este día en esta cuenta.</p>
                ) : (
                  <ul className="mt-3 divide-y divide-white/10">
                    {movimientosDelDia.map((m) => (
                      <li key={m.key} className="flex items-center gap-3 py-2.5">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm">
                          {m.signo === 1 ? "↙️" : "💸"}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{m.descripcion}</span>
                        <span className={`shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold ${m.signo === 1 ? "text-ingreso" : "text-gasto"}`}>
                          {m.signo === 1 ? "+" : "-"}
                          {formatCLP(m.monto)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
            </>
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
