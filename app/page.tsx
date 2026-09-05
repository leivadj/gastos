"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
import { Card } from "@/components/Card";
import { EntidadAvatar } from "@/components/EntidadAvatar";
import { PersonaBreakdown } from "@/components/PersonaBreakdown";
import { EVENTO_MOVIMIENTO_GUARDADO } from "@/components/MovimientoRapido";
import { AvatarGroupHover } from "@/components/AvatarGroupHover";
import { ContadorOdometro } from "@/components/ContadorOdometro";
import { diaDelMes, formatCLP, mesActualISO, nombreMes, primerDiaMesSiguiente } from "@/lib/format";
import { promedioMovil } from "@/lib/promedioMovil";
import { resolverMarca } from "@/lib/resolverMarca";
import { resumenGastosMes } from "@/lib/resumenGastos";
import {
  Categoria,
  CompraVigente,
  Entidad,
  GastoDiario,
  GastoFijo,
  Marca,
  MetaAhorroProgreso,
  Pago,
  Persona,
  RepartoCuota,
  RepartoGastoDiario,
  RepartoGastoFijo,
  ResumenPersonaMes,
} from "@/lib/types";
import { useDeviceType } from "@/lib/useDeviceType";

const COLORES = ["#7C3AED", "#EC4899", "#F97316", "#10B981", "#3B82F6", "#F43F5E", "#8B5CF6", "#14B8A6"];
const AVATAR_COLORES = ["#F59E0B", "#10B981", "#3B82F6", "#EC4899", "#8B5CF6"];

function formatCompacto(valor: number): string {
  return new Intl.NumberFormat("es-CL", { notation: "compact", maximumFractionDigits: 1 }).format(valor);
}

function IconoDisponible({ className = "" }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="6" width="18" height="13" rx="2.5" />
      <path d="M3 10h18" />
      <path d="M16.5 15h1" />
    </svg>
  );
}

function IconoIngresos({ className = "" }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 16 10 10l4 4 6-7" />
      <path d="M15 8h5v5" />
    </svg>
  );
}

function IconoGastos({ className = "" }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 8 10 14l4-4 6 7" />
      <path d="M15 16h5v-5" />
    </svg>
  );
}

function IconoComprometido({ className = "" }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 7.5v5l3.2 1.8" />
    </svg>
  );
}

function IconoCuentas({ className = "" }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 8.5 12 3l9 5.5" />
      <path d="M4.5 8v10.5a1 1 0 0 0 1 1H18a1 1 0 0 0 1-1V8" />
      <path d="M9.5 19.5v-6h5v6" />
    </svg>
  );
}

function IconoPromedio({ className = "" }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3.5 17.5 9 11l4 4 7.5-8.5" />
      <path d="M3.5 20.5h17" />
    </svg>
  );
}

function IconoProximosPagos({ className = "" }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3.5" y="4.5" width="17" height="16" rx="2" />
      <path d="M3.5 9.5h17" />
      <path d="M8 3v3M16 3v3" />
    </svg>
  );
}

function IconoMetas({ className = "" }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" />
    </svg>
  );
}

export default function DashboardPage() {
  const deviceType = useDeviceType();
  const esMobile = deviceType === "mobile";

  const [cuotas, setCuotas] = useState<CompraVigente[]>([]);
  const [gastosFijos, setGastosFijos] = useState<GastoFijo[]>([]);
  const [gastosDiarios, setGastosDiarios] = useState<GastoDiario[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [entidades, setEntidades] = useState<Entidad[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [resumenPersonas, setResumenPersonas] = useState<ResumenPersonaMes[]>([]);
  const [repartoCuotas, setRepartoCuotas] = useState<RepartoCuota[]>([]);
  const [repartoGastos, setRepartoGastos] = useState<RepartoGastoFijo[]>([]);
  const [repartoDiarios, setRepartoDiarios] = useState<RepartoGastoDiario[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [metas, setMetas] = useState<MetaAhorroProgreso[]>([]);
  const [ingresosMes, setIngresosMes] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [personaSeleccionada, setPersonaSeleccionada] = useState<string | null>(null);

  useEffect(() => {
    async function cargar() {
      const [
        { data: c },
        { data: gf },
        { data: gd },
        { data: cat },
        { data: per },
        { data: ent },
        { data: mar },
        { data: rp },
        { data: rc },
        { data: rg },
        { data: rd },
        { data: ing },
        { data: pg },
        { data: mt },
      ] = await Promise.all([
        supabase.from("vista_cuotas_mes_actual").select("*"),
        supabase.from("gastos_fijos").select("*").eq("activo", true),
        supabase.from("gastos_diarios").select("*").gte("fecha", mesActualISO()).lt("fecha", primerDiaMesSiguiente()),
        supabase.from("categorias").select("*"),
        supabase.from("personas").select("*").eq("activo", true).order("nombre"),
        supabase.from("entidades").select("*"),
        supabase.from("marcas").select("*"),
        supabase.from("vista_resumen_personas_mes").select("*"),
        supabase.from("vista_reparto_cuotas_mes").select("*"),
        supabase.from("vista_reparto_gastos_fijos").select("*"),
        supabase.from("vista_reparto_gastos_diarios").select("*"),
        supabase.from("ingresos").select("monto").eq("mes", mesActualISO()),
        supabase.from("pagos").select("*"),
        supabase.from("vista_metas_ahorro_progreso").select("*").eq("activa", true).order("nombre"),
      ]);
      setCuotas((c as CompraVigente[]) ?? []);
      setGastosFijos((gf as GastoFijo[]) ?? []);
      setGastosDiarios((gd as GastoDiario[]) ?? []);
      setCategorias((cat as Categoria[]) ?? []);
      setPersonas((per as Persona[]) ?? []);
      setEntidades((ent as Entidad[]) ?? []);
      setMarcas((mar as Marca[]) ?? []);
      setResumenPersonas((rp as ResumenPersonaMes[]) ?? []);
      setRepartoCuotas((rc as RepartoCuota[]) ?? []);
      setRepartoGastos((rg as RepartoGastoFijo[]) ?? []);
      setRepartoDiarios((rd as RepartoGastoDiario[]) ?? []);
      setIngresosMes((ing ?? []).reduce((acc, r: any) => acc + Number(r.monto), 0));
      setPagos((pg as Pago[]) ?? []);
      setMetas((mt as MetaAhorroProgreso[]) ?? []);
      setCargando(false);
    }
    cargar();
    // Cuando se guarda un "+ Movimiento" rápido (gasto/ingreso/transferencia)
    // desde cualquier pantalla, refresca estos números sin recargar la página.
    window.addEventListener(EVENTO_MOVIMIENTO_GUARDADO, cargar);
    return () => window.removeEventListener(EVENTO_MOVIMIENTO_GUARDADO, cargar);
  }, []);

  const categoriaNombre = (id: string | null) =>
    categorias.find((c) => c.id === id)?.nombre ?? "Sin categoría";

  const totalCuotas = cuotas.reduce((acc, c) => acc + Number(c.monto_cuota), 0);
  const totalFijosMonto = gastosFijos.reduce((acc, g) => acc + Number(g.monto_estimado), 0);
  const totalDiarios = gastosDiarios.reduce((acc, d) => acc + Number(d.monto), 0);
  const totalGastos = totalCuotas + totalFijosMonto + totalDiarios;
  const disponible = ingresosMes - totalGastos;

  // "Gastos" = ya venció su día de pago este mes (ya salió/sale de la
  // cuenta). "Comprometido" = ya sabes que viene, pero su día de pago este
  // mes todavía no llega — sigue restando del disponible, pero por
  // separado, para no confundir "ya gastado" con "ya sé que se va a ir". Los
  // gastos diarios no tienen "vencimiento" — ya se hicieron, así que siempre
  // suman a "ya pagados", nunca a "comprometido".
  const hoyDia = new Date().getDate();
  let gastosYaPagados = totalDiarios;
  let comprometido = 0;
  cuotas.forEach((c) => {
    const monto = Number(c.monto_cuota);
    if (diaDelMes(c.fecha_primera_cuota) <= hoyDia) gastosYaPagados += monto;
    else comprometido += monto;
  });
  gastosFijos.forEach((g) => {
    const monto = Number(g.monto_estimado);
    if (g.dia_mes_pago == null || g.dia_mes_pago <= hoyDia) gastosYaPagados += monto;
    else comprometido += monto;
  });

  const { dataCategoria, totalTipoFijo, totalTipoVariable, pctFijo } = resumenGastosMes(
    cuotas,
    gastosFijos,
    categorias,
    gastosDiarios
  );
  const legendPrincipal = dataCategoria.slice(0, 3);
  const restoCategorias = dataCategoria.slice(3);
  const restoTotal = restoCategorias.reduce((acc, d) => acc + d.value, 0);

  const dataPersonas = resumenPersonas
    .map((p) => ({ name: p.persona_nombre, total: Number(p.total), persona_id: p.persona_id }))
    .sort((a, b) => b.total - a.total);

  // Saldo manual de las cuentas (ver Entidad.saldo) — se excluyen las
  // tarjetas de crédito porque su "saldo" es deuda, no un activo.
  const totalEnCuentas = entidades
    .filter((e) => e.tipo !== "tarjeta_credito" && e.saldo != null)
    .reduce((acc, e) => acc + Number(e.saldo), 0);

  const gastoPromedioDiario = totalGastos / Math.max(1, hoyDia);

  // Mismo cálculo de "eventos" de vencimiento que /calendario-pagos (gasto
  // fijo con su día de pago + promedio móvil si es de monto variable, cuota
  // vigente con el día de su primera cuota), filtrado a los que todavía no
  // se marcaron como pagados este mes, para una vista rápida en el dashboard.
  const mesActualStr = mesActualISO();
  const eventosPagos = [
    ...gastosFijos.map((g) => {
      const esVariable = g.tipo_monto === "variable";
      const { promedio } = esVariable
        ? promedioMovil(pagos, g.id, mesActualStr, Number(g.monto_estimado))
        : { promedio: Number(g.monto_estimado) };
      return {
        origen: "gasto_fijo" as const,
        origenId: g.id,
        descripcion: g.descripcion,
        detalle: undefined as string | undefined,
        dia: g.dia_mes_pago,
        monto: promedio,
        entidadId: g.entidad_id,
        marcaId: g.marca_id,
        icono: g.icono,
      };
    }),
    ...cuotas.map((c) => ({
      origen: "compra" as const,
      origenId: c.compra_id,
      descripcion: c.descripcion,
      detalle: `Cuota ${c.cuota_actual}/${c.n_cuotas}` as string | undefined,
      dia: diaDelMes(c.fecha_primera_cuota),
      monto: Number(c.monto_cuota),
      entidadId: c.entidad_id,
      marcaId: c.marca_id,
      icono: c.icono,
    })),
  ];

  const proximosPagos = eventosPagos
    .filter((ev) => {
      const pago = pagos.find((p) => p.origen === ev.origen && p.origen_id === ev.origenId && p.mes === mesActualStr);
      return !(pago?.pagado ?? false);
    })
    .sort((a, b) => {
      if (a.dia == null && b.dia == null) return 0;
      if (a.dia == null) return 1;
      if (b.dia == null) return -1;
      return a.dia - b.dia;
    })
    .slice(0, 5);

  if (cargando) {
    return <p className="py-10 text-center text-gray-400 dark:text-gray-500">Cargando…</p>;
  }

  // ---- Piezas reutilizadas entre el layout mobile y el de escritorio ----

  const tarjetaCategoria = (
    <Card>
      <p className="mb-3 text-sm font-semibold text-gray-600 dark:text-gray-300">Gastos por categoría</p>
      {dataCategoria.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">Sin datos este mes todavía.</p>
      ) : (
        <div className="flex items-center gap-4">
          <div className="relative h-36 w-36 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={dataCategoria} dataKey="value" nameKey="name" innerRadius={44} outerRadius={68} paddingAngle={2}>
                  {dataCategoria.map((_, i) => (
                    <Cell key={i} fill={COLORES[i % COLORES.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatCLP(v)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-base font-bold text-gray-800 dark:text-white">${formatCompacto(totalGastos)}</span>
              <span className="text-[10px] text-gray-400 dark:text-gray-500">este mes</span>
            </div>
          </div>
          <div className="min-w-0 flex-1 space-y-2 text-sm">
            {legendPrincipal.map((d, i) => (
              <div key={d.name} className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5 text-gray-600 dark:text-gray-400">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: COLORES[i % COLORES.length] }} />
                  <span className="truncate">{d.name}</span>
                </span>
                <span className="shrink-0 whitespace-nowrap font-medium text-gray-800 dark:text-gray-100">${formatCompacto(d.value)}</span>
              </div>
            ))}
            {restoCategorias.length > 0 && (
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5 text-gray-400 dark:text-gray-500">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-gray-300 dark:bg-gray-600" />
                  <span className="truncate">+{restoCategorias.length} más</span>
                </span>
                <span className="shrink-0 whitespace-nowrap font-medium text-gray-400 dark:text-gray-500">${formatCompacto(restoTotal)}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );

  const tarjetaFijoVariable = totalGastos > 0 && (
    <Card>
      <p className="mb-2 text-sm font-semibold text-gray-600 dark:text-gray-300">Fijo vs. variable</p>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-pink-100 dark:bg-pink-950/50">
        <div className="h-full bg-brand-gradient" style={{ width: `${pctFijo}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-brand-gradient" />
          Fijo · {formatCLP(totalTipoFijo)}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-pink-200 dark:bg-pink-800" />
          Variable · {formatCLP(totalTipoVariable)}
        </span>
      </div>
    </Card>
  );

  const tarjetaPersonas = (
    <Card>
      <p className="mb-2 text-sm font-semibold text-gray-600 dark:text-gray-300">Cuánto le toca a cada persona</p>
      {dataPersonas.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">Sin datos este mes todavía.</p>
      ) : (
        <>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataPersonas}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis hide />
                <Tooltip formatter={(v: number) => formatCLP(v)} />
                <Bar
                  dataKey="total"
                  radius={[6, 6, 0, 0]}
                  fill="#7C3AED"
                  style={{ cursor: "pointer" }}
                  onClick={(d: any) => setPersonaSeleccionada(d?.persona_id ?? d?.payload?.persona_id ?? null)}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 text-center text-[11px] text-gray-400 dark:text-gray-500">Toca una barra para ver el detalle</p>
        </>
      )}
    </Card>
  );

  const tarjetaCuotas = (
    <Card>
      <p className="mb-3 text-sm font-semibold text-gray-600 dark:text-gray-300">Cuotas activas este mes</p>
      {cuotas.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">No hay compras en cuotas vigentes.</p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-white/10">
          {cuotas.map((c) => (
            <li key={c.compra_id} className="flex items-center justify-between py-2.5 text-sm">
              <div>
                <p className="font-medium text-gray-700 dark:text-gray-200">{c.descripcion}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Cuota {c.cuota_actual} de {c.n_cuotas} · {categoriaNombre(c.categoria_id)}
                </p>
              </div>
              <p className="font-semibold text-gray-800 dark:text-gray-100">{formatCLP(c.monto_cuota)}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );

  const tarjetaPromedioDiario = (
    <Card>
      <p className="flex items-center gap-1 text-xs font-medium text-gray-400 dark:text-gray-500">
        <IconoPromedio className="text-gray-400 dark:text-gray-500" />
        Gasto promedio diario
      </p>
      <p className="mt-1 text-2xl font-bold text-gray-800 dark:text-white">{formatCLP(gastoPromedioDiario)}</p>
      <p className="text-[11px] capitalize text-gray-400 dark:text-gray-500">en lo que va de {nombreMes()}</p>
    </Card>
  );

  const tarjetaProximosPagos = (
    <Card>
      <div className="mb-1 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-600 dark:text-gray-300">
          <IconoProximosPagos className="text-gray-400 dark:text-gray-500" />
          Próximos pagos
        </p>
        <Link href="/calendario-pagos" className="text-xs font-semibold text-brand-from dark:text-pink-400">
          Ver todos
        </Link>
      </div>
      {proximosPagos.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">No hay pagos pendientes este mes.</p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-white/10">
          {proximosPagos.map((ev) => {
            const entidad = entidades.find((e) => e.id === ev.entidadId) ?? null;
            const marca = marcas.find((m) => m.id === ev.marcaId) ?? resolverMarca(entidad, marcas);
            return (
              <li key={`${ev.origen}:${ev.origenId}`} className="flex items-center gap-3 py-2.5 text-sm">
                <EntidadAvatar entidad={entidad} marca={marca} icono={ev.icono} className="h-8 w-8 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-gray-700 dark:text-gray-200">{ev.descripcion}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {ev.dia != null ? `Vence el ${ev.dia}` : "Sin día definido"}
                    {ev.detalle ? ` · ${ev.detalle}` : ""}
                  </p>
                </div>
                <p className="shrink-0 font-semibold text-gray-800 dark:text-gray-100">{formatCLP(ev.monto)}</p>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );

  const tarjetaMetas = (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-600 dark:text-gray-300">
          <IconoMetas className="text-gray-400 dark:text-gray-500" />
          Metas de ahorro
        </p>
        <Link href="/metas-ahorro" className="text-xs font-semibold text-brand-from dark:text-pink-400">
          Ver todas
        </Link>
      </div>
      {metas.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">Todavía no tienes metas de ahorro activas.</p>
      ) : (
        <ul className="space-y-3">
          {metas.slice(0, 3).map((m) => {
            const pct = m.monto_objetivo > 0 ? Math.min(100, Math.round((m.monto_actual / m.monto_objetivo) * 100)) : 0;
            return (
              <li key={m.meta_id}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-gray-700 dark:text-gray-200">
                    {m.icono ? `${m.icono} ` : ""}
                    {m.nombre}
                  </span>
                  <span className="text-gray-400 dark:text-gray-500">{pct}%</span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                  <div className="h-full bg-brand-gradient" style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );

  // ---- Layout mobile (app instalada / pantalla angosta) ----

  const contenido = esMobile ? (
      <div className="space-y-5 pb-10">
        {/* Hero a sangre, fuera del padding del layout */}
        <div className="-mx-4 -mt-4 rounded-b-[2rem] bg-brand-gradient px-5 pb-6 pt-6 text-white">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-white/15 px-3 py-1 text-sm font-medium capitalize">
              {nombreMes()} ▾
            </span>
            <AvatarGroupHover className="flex -space-x-2">
              {personas.slice(0, 4).map((p, i) => (
                <span
                  key={p.id}
                  title={p.nombre}
                  className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white"
                  style={{ background: AVATAR_COLORES[i % AVATAR_COLORES.length] }}
                >
                  {p.nombre.charAt(0).toUpperCase()}
                </span>
              ))}
            </AvatarGroupHover>
          </div>

          <p className="mt-5 flex items-center gap-1.5 text-sm opacity-85">
            <IconoDisponible className="text-white" />
            Disponible este mes
          </p>
          <p className="text-4xl font-bold tracking-tight">
            <ContadorOdometro texto={formatCLP(disponible)} />
          </p>

          <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
            <div className="rounded-xl bg-white/15 p-3">
              <p className="flex items-center gap-1 text-[11px] opacity-85">
                <IconoIngresos className="text-white" />
                Ingresos
              </p>
              <p className="text-sm font-semibold">
                <ContadorOdometro texto={formatCLP(ingresosMes)} />
              </p>
            </div>
            <div className="rounded-xl bg-white/15 p-3">
              <p className="flex items-center gap-1 text-[11px] opacity-85">
                <IconoGastos className="text-white" />
                Gastos
              </p>
              <p className="text-sm font-semibold">
                <ContadorOdometro texto={formatCLP(gastosYaPagados)} />
              </p>
            </div>
            <div className="rounded-xl bg-white/15 p-3">
              <p className="flex items-center gap-1 text-[11px] opacity-85">
                <IconoComprometido className="text-white" />
                Comprometido
              </p>
              <p className="text-sm font-semibold">
                <ContadorOdometro texto={formatCLP(comprometido)} />
              </p>
            </div>
          </div>
        </div>

        {tarjetaCategoria}
        {tarjetaFijoVariable}
        {tarjetaPersonas}
        {tarjetaCuotas}
      </div>
  ) : (
    // ---- Layout de escritorio (navegador en PC/tablet) ----
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">Resumen general</h1>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Así van tus finanzas en <span className="capitalize">{nombreMes()}</span> 👋
          </p>
        </div>
        <AvatarGroupHover className="flex -space-x-2">
          {personas.slice(0, 6).map((p, i) => (
            <span
              key={p.id}
              title={p.nombre}
              className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white shadow-sm"
              style={{ background: AVATAR_COLORES[i % AVATAR_COLORES.length] }}
            >
              {p.nombre.charAt(0).toUpperCase()}
            </span>
          ))}
        </AvatarGroupHover>
      </div>

      {/* Fila de KPIs: "Disponible" queda como tarjeta grande (mismo
          contenido que el hero mobile: ingresos/gastos/comprometido
          adentro) para que siga siendo el número principal, y las otras 3
          quedan como tarjetas simples de un dato cada una. */}
      <div className="grid grid-cols-5 gap-4">
        <div className="col-span-2 rounded-2xl bg-brand-gradient p-5 text-white">
          <p className="flex items-center gap-1.5 text-sm opacity-85">
            <IconoDisponible className="text-white" />
            Disponible este mes
          </p>
          <p className="mt-1 text-3xl font-bold tracking-tight">
            <ContadorOdometro texto={formatCLP(disponible)} />
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
            <div className="rounded-xl bg-white/15 p-2.5">
              <p className="flex items-center gap-1 text-[11px] opacity-85">
                <IconoIngresos className="text-white" />
                Ingresos
              </p>
              <p className="text-sm font-semibold">
                <ContadorOdometro texto={formatCLP(ingresosMes)} />
              </p>
            </div>
            <div className="rounded-xl bg-white/15 p-2.5">
              <p className="flex items-center gap-1 text-[11px] opacity-85">
                <IconoGastos className="text-white" />
                Gastos
              </p>
              <p className="text-sm font-semibold">
                <ContadorOdometro texto={formatCLP(gastosYaPagados)} />
              </p>
            </div>
            <div className="rounded-xl bg-white/15 p-2.5">
              <p className="flex items-center gap-1 text-[11px] opacity-85">
                <IconoComprometido className="text-white" />
                Comprometido
              </p>
              <p className="text-sm font-semibold">
                <ContadorOdometro texto={formatCLP(comprometido)} />
              </p>
            </div>
          </div>
        </div>

        <Card>
          <p className="flex items-center gap-1 text-xs font-medium text-gray-400 dark:text-gray-500">
            <IconoCuentas className="text-gray-400 dark:text-gray-500" />
            Total en cuentas
          </p>
          <p className="mt-1 text-2xl font-bold text-gray-800 dark:text-white">
            <ContadorOdometro texto={formatCLP(totalEnCuentas)} />
          </p>
          <p className="text-[11px] text-gray-400 dark:text-gray-500">saldo de tus cuentas</p>
        </Card>

        <Card>
          <p className="flex items-center gap-1 text-xs font-medium text-gray-400 dark:text-gray-500">
            <IconoGastos className="text-gray-400 dark:text-gray-500" />
            Gastos este mes
          </p>
          <p className="mt-1 text-2xl font-bold text-gray-800 dark:text-white">
            <ContadorOdometro texto={formatCLP(gastosYaPagados)} />
          </p>
        </Card>

        <Card>
          <p className="flex items-center gap-1 text-xs font-medium text-gray-400 dark:text-gray-500">
            <IconoComprometido className="text-gray-400 dark:text-gray-500" />
            Comprometido
          </p>
          <p className="mt-1 text-2xl font-bold text-gray-800 dark:text-white">
            <ContadorOdometro texto={formatCLP(comprometido)} />
          </p>
          <p className="text-[11px] text-gray-400 dark:text-gray-500">vence más adelante este mes</p>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {tarjetaCategoria}
        {tarjetaFijoVariable}
        {tarjetaPromedioDiario}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {tarjetaProximosPagos}
        {tarjetaCuotas}
        {tarjetaMetas}
      </div>

      {tarjetaPersonas}
    </div>
  );

  const persona = personas.find((p) => p.id === personaSeleccionada);

  return (
    <>
      {contenido}
      {persona && (
        <PersonaBreakdown
          personaNombre={persona.nombre}
          mesLabel={nombreMes()}
          total={dataPersonas.find((d) => d.persona_id === persona.id)?.total ?? 0}
          cuotasPersona={repartoCuotas.filter((r) => r.persona_id === persona.id)}
          gastosPersona={repartoGastos.filter((r) => r.persona_id === persona.id)}
          diariosPersona={repartoDiarios.filter((r) => r.persona_id === persona.id)}
          categorias={categorias}
          entidades={entidades}
          marcas={marcas}
          onClose={() => setPersonaSeleccionada(null)}
        />
      )}
    </>
  );
}
