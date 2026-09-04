"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/Card";
import { EntidadAvatar } from "@/components/EntidadAvatar";
import { diaDelMes, formatCLP, mesActualISO, nombreMes } from "@/lib/format";
import { promedioMovil } from "@/lib/promedioMovil";
import { resolverMarca } from "@/lib/resolverMarca";
import { mensajeError } from "@/lib/supabaseError";
import { CompraVigente, Entidad, GastoFijo, Marca, Pago } from "@/lib/types";

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
  const [gastosFijos, setGastosFijos] = useState<GastoFijo[]>([]);
  const [cuotas, setCuotas] = useState<CompraVigente[]>([]);
  const [entidades, setEntidades] = useState<Entidad[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [cargando, setCargando] = useState(true);
  const [marcandoKey, setMarcandoKey] = useState<string | null>(null);
  const [montoIngresado, setMontoIngresado] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const mesActual = mesActualISO();

  async function cargarTodo() {
    const [{ data: gf }, { data: c }, { data: e }, { data: m }, { data: pg }] = await Promise.all([
      supabase.from("gastos_fijos").select("*").eq("activo", true),
      supabase.from("vista_cuotas_mes_actual").select("*"),
      supabase.from("entidades").select("*"),
      supabase.from("marcas").select("*"),
      supabase.from("pagos").select("*"),
    ]);
    setGastosFijos((gf as GastoFijo[]) ?? []);
    setCuotas((c as CompraVigente[]) ?? []);
    setEntidades((e as Entidad[]) ?? []);
    setMarcas((m as Marca[]) ?? []);
    setPagos((pg as Pago[]) ?? []);
    setCargando(false);
  }

  useEffect(() => {
    cargarTodo();
  }, []);

  if (cargando) {
    return <p className="py-10 text-center text-gray-400">Cargando…</p>;
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
        <h1 className="text-lg font-bold text-gray-800">Calendario de pagos</h1>
        <p className="text-xs text-gray-400">Servicios básicos, gastos fijos y cuotas de tarjeta, por fecha de vencimiento.</p>
      </div>

      <Card>
        <p className="mb-3 text-sm font-bold capitalize text-gray-800">{nombreMes()}</p>
        <div className="grid grid-cols-7 text-center text-[11px] font-bold text-gray-400">
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
                  celda.delMes ? "text-gray-700" : "text-gray-300"
                } ${esHoy ? "border-[1.5px] border-brand-from text-brand-from" : ""}`}
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
        <div className="mt-3 flex gap-4 px-1 text-[11.5px] font-semibold text-gray-500">
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
        <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-gray-400">Vencimientos de este mes</p>
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
                    <p className="font-semibold text-gray-800">
                      {ev.descripcion}
                      {ev.detalle ? ` · ${ev.detalle}` : ""}
                    </p>
                    <p className={`text-xs ${vencido ? "font-semibold text-red-400" : "text-gray-400"}`}>
                      {ev.dia != null ? `Vence el ${ev.dia}` : "Sin día definido"}
                      {vencido ? " · vencido" : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-800">
                      {ev.esPromedio && <span className="mr-0.5 font-normal text-gray-400">~</span>}
                      {formatCLP(ev.monto)}
                    </p>
                    {pagado ? (
                      <p className="text-[11px] font-semibold text-emerald-500">
                        Pagado{pago?.monto_real != null ? ` · ${formatCLP(pago.monto_real)}` : ""}
                      </p>
                    ) : (
                      <p className="text-[11px] text-gray-300">Pendiente</p>
                    )}
                  </div>
                </div>

                {marcandoKey === key ? (
                  <div className="mt-3 flex items-center gap-2 border-t border-gray-50 pt-3">
                    <input
                      type="number"
                      min={0}
                      autoFocus
                      value={montoIngresado}
                      onChange={(e) => setMontoIngresado(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
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
                      className="shrink-0 rounded-lg bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-400"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 flex justify-end border-t border-gray-50 pt-3">
                    {pagado ? (
                      <button
                        onClick={() => pago && deshacerPago(pago)}
                        disabled={guardando}
                        className="text-xs text-gray-300 hover:text-red-400"
                      >
                        deshacer
                      </button>
                    ) : (
                      <button onClick={() => abrirMarcarPagado(ev)} className="text-xs font-semibold text-brand-from">
                        Marcar como pagado
                      </button>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
          {eventos.length === 0 && (
            <p className="text-center text-sm text-gray-400">Todavía no hay gastos fijos ni cuotas vigentes.</p>
          )}
        </div>
      </div>

      {error && <p className="text-center text-xs text-red-500">{error}</p>}
    </div>
  );
}
