"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { IngresosContenido } from "@/components/IngresosContenido";
import { PresupuestoContenido } from "@/components/PresupuestoContenido";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  LineChart,
  Line,
} from "recharts";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/Card";
import { EntidadAvatar } from "@/components/EntidadAvatar";
import { PersonaAvatar } from "@/components/PersonaAvatar";
import { PersonaBreakdown } from "@/components/PersonaBreakdown";
import { EVENTO_MOVIMIENTO_GUARDADO } from "@/components/MovimientoRapido";
import { AvatarGroupHover } from "@/components/AvatarGroupHover";
import { ContadorOdometro } from "@/components/ContadorOdometro";
import {
  diaDelMes,
  fechaLargaHoy,
  formatCLP,
  mesAbreviadoMayus,
  mesActualISO,
  nombreMes,
  primerDiaMesSiguiente,
  saludoHora,
} from "@/lib/format";
import { promedioMovil } from "@/lib/promedioMovil";
import { resolverMarca } from "@/lib/resolverMarca";
import { resumenGastosMes } from "@/lib/resumenGastos";
import {
  Categoria,
  CompraVigente,
  Entidad,
  GastoDiario,
  GastoFijo,
  Grupo,
  Ingreso,
  Marca,
  MetaAhorroProgreso,
  Pago,
  Persona,
  RepartoCuota,
  RepartoGastoDiario,
  RepartoGastoFijo,
  ResumenPersonaMes,
  Transferencia,
} from "@/lib/types";
import { useDeviceType } from "@/lib/useDeviceType";

// Rediseño v2: mismos tonos grises + reservados que la dona de
// "Gastos por categoría" de PresupuestoContenido.tsx (esta es la versión de
// escritorio del mismo gráfico) — ver también lib/avatarColor.ts.
const COLORES = ["#111112", "#3A3A3D", "#6E6E72", "#9B9995", "#C9C7C2", "#E2584B", "#5DCB86", "#8A8A8D"];
const AVATAR_COLORES = ["#111112", "#3A3A3D", "#54585C", "#6E6E72", "#8A8A8D"];

function formatCompacto(valor: number): string {
  return new Intl.NumberFormat("es-CL", { notation: "compact", maximumFractionDigits: 1 }).format(valor);
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

function IconoBuscar({ className = "" }: { className?: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="11" cy="11" r="7.5" />
      <path d="m20.5 20.5-4-4" />
    </svg>
  );
}

function IconoCampana({ className = "" }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M6 10a6 6 0 1 1 12 0c0 4.5 1.5 6 1.5 6h-15S6 14.5 6 10Z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
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
  const [ingresosLista, setIngresosLista] = useState<Ingreso[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [transferencias, setTransferencias] = useState<Transferencia[]>([]);
  const [ingresosMes, setIngresosMes] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [personaSeleccionada, setPersonaSeleccionada] = useState<string | null>(null);
  // Rediseño v2: en celular, Inicio/Ingresos/Presupuesto se fusionan en una
  // sola pantalla "Resumen" con pestañas (como en el mockup de Not Pato) en
  // vez de 3 pantallas sueltas — Felipe notó que "Presupuesto" ya
  // aparecía como pestaña arriba Y como destino propio en el nav inferior.
  // En escritorio se mantienen como páginas separadas del sidebar (hay
  // espacio de sobra ahí), así que esta pestaña solo aplica al layout
  // mobile de más abajo.
  const [tabResumen, setTabResumen] = useState<"resumen" | "ingresos" | "presupuesto">("resumen");

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
        { data: gr },
        { data: tr },
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
        supabase.from("ingresos").select("*").eq("mes", mesActualISO()),
        supabase.from("pagos").select("*"),
        supabase.from("vista_metas_ahorro_progreso").select("*").eq("activa", true).order("nombre"),
        supabase.from("grupos").select("*"),
        supabase.from("transferencias").select("*"),
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
      const ingresosDelMes = (ing as Ingreso[]) ?? [];
      setIngresosLista(ingresosDelMes);
      setIngresosMes(ingresosDelMes.reduce((acc, r) => acc + Number(r.monto), 0));
      setPagos((pg as Pago[]) ?? []);
      setMetas((mt as MetaAhorroProgreso[]) ?? []);
      setGrupos((gr as Grupo[]) ?? []);
      setTransferencias((tr as Transferencia[]) ?? []);
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

  // Cuentas próximas a vencer "esta semana" (dentro de los próximos 7 días
  // desde hoy) — para el badge de la tarjeta "Cuentas próximas" del
  // dashboard de escritorio.
  const cuentasEstaSemana = proximosPagos.filter((ev) => ev.dia != null && ev.dia - hoyDia >= 0 && ev.dia - hoyDia <= 7).length;

  // Tendencia diaria del "Balance del mes" (mini gráfico del hero de
  // escritorio): mismo criterio que gastosYaPagados/comprometido de más
  // arriba, pero recalculado día a día para dibujar la curva — no es un
  // dato nuevo, es el mismo cálculo cortado en cada día del mes.
  const tendenciaBalance = Array.from({ length: hoyDia }, (_, i) => {
    const dia = i + 1;
    let gastadoAlDia = gastosDiarios.filter((d) => diaDelMes(d.fecha) <= dia).reduce((acc, d) => acc + Number(d.monto), 0);
    cuotas.forEach((c) => {
      if (diaDelMes(c.fecha_primera_cuota) <= dia) gastadoAlDia += Number(c.monto_cuota);
    });
    gastosFijos.forEach((g) => {
      if (g.dia_mes_pago == null || g.dia_mes_pago <= dia) gastadoAlDia += Number(g.monto_estimado);
    });
    return { dia, balance: ingresosMes - gastadoAlDia };
  });

  // "Movimientos recientes" del dashboard de escritorio: junta pagos de
  // fijos/cuotas ya marcados como pagados (fecha exacta = fecha_pago) con
  // los gastos diarios (fecha exacta) y los ingresos del mes (sin día
  // exacto en la base — ver nota en calendario-pagos/page.tsx — así que se
  // muestran aparte, arriba, sin fecha inventada).
  const movimientosPagados = pagos
    .filter((p) => p.mes === mesActualStr && p.pagado && p.fecha_pago)
    .flatMap((p) => {
      const ev = eventosPagos.find((e) => e.origen === p.origen && e.origenId === p.origen_id);
      if (!ev) return [];
      return [
        {
          key: `pago-${p.id}`,
          descripcion: ev.descripcion,
          detalle: ev.detalle ?? "Pago",
          fecha: p.fecha_pago as string,
          monto: p.monto_real != null ? Number(p.monto_real) : ev.monto,
          esIngreso: false,
          entidadId: ev.entidadId,
          marcaId: ev.marcaId,
          icono: ev.icono,
        },
      ];
    });

  const movimientosDiarios = gastosDiarios.map((d) => ({
    key: `diario-${d.id}`,
    descripcion: d.descripcion,
    detalle: categoriaNombre(d.categoria_id),
    fecha: d.fecha,
    monto: Number(d.monto),
    esIngreso: false,
    entidadId: null as string | null,
    marcaId: d.marca_id,
    icono: categorias.find((c) => c.id === d.categoria_id)?.icono ?? null,
  }));

  const movimientosGasto = [...movimientosPagados, ...movimientosDiarios]
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .slice(0, 4);

  const movimientosIngreso = ingresosLista.slice(0, 1).map((i) => ({
    key: `ingreso-${i.id}`,
    descripcion: i.descripcion || "Ingreso",
    detalle: "Ingreso este mes",
    fecha: null as string | null,
    monto: Number(i.monto),
    esIngreso: true,
    entidadId: null as string | null,
    marcaId: null as string | null,
    icono: "💰",
  }));

  const movimientosRecientes = [...movimientosIngreso, ...movimientosGasto].slice(0, 5);

  // Meta destacada del hero de "Metas de ahorro" en escritorio: la primera
  // activa (mismo orden que /metas-ahorro). El resto sigue viviendo en esa
  // pantalla — acá solo se destaca una, como en el mockup.
  const metaDestacada = metas[0] ?? null;
  const pctMetaDestacada = metaDestacada && metaDestacada.monto_objetivo > 0
    ? Math.min(100, Math.round((metaDestacada.monto_actual / metaDestacada.monto_objetivo) * 100))
    : 0;

  // Reparto entre personas para la tarjeta "Grupo Hogar" de escritorio:
  // % real de lo gastado este mes que le toca a cada una (vista
  // vista_resumen_personas_mes, misma fuente que el gráfico de barras de
  // "Cuánto le toca a cada persona"). Se oculta cuando solo hay una
  // persona activa en la cuenta (mismo criterio "unicaPersona" que ya usan
  // CuotasLista.tsx y MovimientoRapido.tsx).
  const totalCompartido = dataPersonas.reduce((acc, p) => acc + p.total, 0);
  const gruposConParticipantes = dataPersonas.map((p) => ({
    ...p,
    pct: totalCompartido > 0 ? Math.round((p.total / totalCompartido) * 100) : 0,
  }));
  const nombreGrupoHogar = grupos[0]?.nombre ?? "Grupo compartido";

  // Datos para la tabla "Apertura del mes / Ingresos / Gastos / Pago de
  // tarjeta / Balance" de la pestaña "Resumen" móvil (mockup): "Pago de
  // tarjeta" = transferencias de este mes hacia una tarjeta de crédito
  // (mismo concepto que ya usa /tarjetas para "abonos"). "Apertura del
  // mes" no se guarda como una foto fija en la base (el saldo de
  // entidades.saldo es el saldo ACTUAL, no el de hace 13 días) — se
  // aproxima restándole al saldo actual el movimiento neto de este mes,
  // para no inventar un número sin relación con datos reales.
  const totalEnCuentas = entidades
    .filter((e) => e.tipo !== "tarjeta_credito" && e.saldo != null)
    .reduce((acc, e) => acc + Number(e.saldo), 0);
  const pagoTarjetaMes = transferencias
    .filter((t) => t.fecha.slice(0, 7) === mesActualStr.slice(0, 7))
    .filter((t) => entidades.find((e) => e.id === t.cuenta_destino_id)?.tipo === "tarjeta_credito")
    .reduce((acc, t) => acc + Number(t.monto), 0);
  const aperturaMes = totalEnCuentas - (ingresosMes - gastosYaPagados - pagoTarjetaMes);

  // Cuántas tarjetas entran en la fila "Cuentas próximas / Meta / Grupo
  // Hogar" del dashboard de escritorio — "Cuentas próximas" siempre va,
  // las otras dos son condicionales (sin metas activas, o una sola
  // persona en la cuenta) y el grid se acomoda solo.
  const numTarjetasSecundarias = 1 + (metas[0] ? 1 : 0) + (personas.length > 1 ? 1 : 0);

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
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10/50">
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
  );

  // ---- Layout mobile (app instalada / pantalla angosta) ----

  const tabsResumen: { id: typeof tabResumen; label: string }[] = [
    { id: "resumen", label: "Resumen" },
    { id: "ingresos", label: "Ingresos" },
    { id: "presupuesto", label: "Presupuestos" },
  ];

  const barraTabsResumen = (
    <div className="-mb-1 flex gap-2">
      {tabsResumen.map((t) => (
        <button
          key={t.id}
          onClick={() => setTabResumen(t.id)}
          className={`rounded-full px-4 py-2 text-[13px] font-semibold transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-95 ${
            tabResumen === t.id
              ? "bg-black text-white dark:bg-white dark:text-black"
              : "text-gray-400 dark:text-gray-500"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );

  // Calcado de la pestaña "Resumen" del mockup: ya no es un hero con
  // disponible/ingresos/gastos/comprometido — es una tarjeta tipo tabla
  // (Apertura del mes/Ingresos/Gastos/Pago de tarjeta/Balance) más la
  // misma dona de "Gastos por categoría" que ya existía. El desglose por
  // persona y la lista de cuotas activas se pueden seguir viendo en
  // /personas y /gastos — el mockup no los muestra acá.
  const vistaResumenTab = (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between py-1 text-sm">
          <span className="text-gray-400 dark:text-gray-500">Apertura del mes</span>
          <span className="font-semibold text-gray-800 dark:text-white">{formatCLP(aperturaMes)}</span>
        </div>
        <div className="flex items-center justify-between border-t border-gray-50 py-2 text-sm dark:border-white/10">
          <span className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
            <IconoIngresos className="text-ingreso" />
            Ingresos
          </span>
          <span className="font-semibold text-ingreso">+{formatCLP(ingresosMes)}</span>
        </div>
        <div className="flex items-center justify-between border-t border-gray-50 py-2 text-sm dark:border-white/10">
          <span className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
            <IconoGastos className="text-gasto" />
            Gastos
          </span>
          <span className="font-semibold text-gasto">-{formatCLP(gastosYaPagados)}</span>
        </div>
        {pagoTarjetaMes > 0 && (
          <div className="flex items-center justify-between border-t border-gray-50 py-2 text-sm dark:border-white/10">
            <span className="text-gray-400 dark:text-gray-500">Pago de tarjeta</span>
            <span className="font-semibold text-gasto">-{formatCLP(pagoTarjetaMes)}</span>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-gray-100 pt-2 text-sm dark:border-white/10">
          <span className="font-semibold text-gray-700 dark:text-gray-200">Balance</span>
          <span className="text-base font-bold text-gray-800 dark:text-white">{formatCLP(disponible)}</span>
        </div>
      </Card>

      {tarjetaCategoria}
    </div>
  );

  const contenido = esMobile ? (
    <div className="space-y-4 pb-10">
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="Notificaciones"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-300"
        >
          <IconoCampana />
        </button>
        <span className="rounded-full bg-gray-100 px-3 py-1.5 text-sm font-medium capitalize text-gray-700 dark:bg-white/10 dark:text-gray-200">
          {nombreMes()} ▾
        </span>
        <PersonaAvatar
          fotoUrl={personas.find((p) => p.es_self)?.foto_url}
          nombre={personas.find((p) => p.es_self)?.nombre ?? "?"}
          className="h-9 w-9 text-sm"
        />
      </div>
      {barraTabsResumen}
      {tabResumen === "resumen" && vistaResumenTab}
      {tabResumen === "ingresos" && <IngresosContenido ocultarTitulo />}
      {tabResumen === "presupuesto" && <PresupuestoContenido ocultarTitulo />}
    </div>
  ) : (
    // ---- Layout de escritorio: rediseño v2 completo (calcado del mockup
    // "Inicio" de escritorio, no solo un cambio de paleta — ver
    // claude/mockup-v2-decisiones.md). Las tarjetas de detalle que antes
    // vivían acá completas (categoría, fijo/variable, promedio diario,
    // cuotas activas, lista de metas, barra por persona) siguen
    // disponibles en sus propias pantallas (/reportes, /metas-ahorro,
    // /movimientos, /grupos): Inicio ahora es solo el vistazo rápido, tal
    // como lo muestra el mockup.
    <div className="space-y-6 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-gray-400 dark:text-gray-500">{fechaLargaHoy()}</p>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Inicio</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/movimientos"
            className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-400 dark:border-white/10 dark:bg-gray-900 dark:text-gray-500"
          >
            <IconoBuscar />
            Buscar movimiento
          </Link>
          <button
            type="button"
            aria-label="Notificaciones"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 dark:border-white/10 dark:bg-gray-900 dark:text-gray-500"
          >
            <IconoCampana />
          </button>
        </div>
      </div>

      {/* Hero a sangre completa: saludo + credencial de fecha, mes actual,
          y el balance del mes junto a ingresos/gastos/comprometido + una
          curva chica de cómo bajó el balance en lo que va del mes (mismo
          cálculo día a día que gastosYaPagados/comprometido, no es un dato
          nuevo). */}
      <div className="rounded-3xl bg-brand-gradient p-6 text-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-white/15">
              <span className="text-lg font-bold leading-none">{new Date().getDate()}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{mesAbreviadoMayus()}</span>
            </div>
            <div>
              <p className="text-lg font-bold">
                {saludoHora()}, {personas.find((p) => p.es_self)?.nombre.split(" ")[0] ?? "de vuelta"}
              </p>
              <p className="text-sm opacity-70">
                Llevas gastado el {ingresosMes > 0 ? Math.min(999, Math.round((totalGastos / ingresosMes) * 100)) : 0}% de tus
                ingresos de <span className="capitalize">{nombreMes()}</span>.
              </p>
            </div>
          </div>
          <span className="rounded-full bg-white/15 px-3 py-1.5 text-sm font-medium capitalize">{nombreMes()}</span>
        </div>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-4 border-t border-white/10 pt-5">
          <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
            <div>
              <p className="text-sm opacity-70">Balance del mes</p>
              <p className="text-3xl font-bold tracking-tight">
                <ContadorOdometro texto={formatCLP(disponible)} />
              </p>
            </div>
            <div>
              <p className="flex items-center gap-1 text-xs opacity-70">
                <IconoIngresos className="text-white" />
                Ingresos
              </p>
              <p className="text-base font-semibold">+{formatCLP(ingresosMes)}</p>
            </div>
            <div>
              <p className="flex items-center gap-1 text-xs opacity-70">
                <IconoGastos className="text-white" />
                Gastos
              </p>
              <p className="text-base font-semibold">-{formatCLP(gastosYaPagados)}</p>
            </div>
            <div>
              <p className="flex items-center gap-1 text-xs opacity-70">
                <IconoComprometido className="text-white" />
                Comprometido cuotas
              </p>
              <p className="text-base font-semibold">{formatCLP(comprometido)}</p>
            </div>
          </div>
          {tendenciaBalance.length > 1 && (
            <div className="h-12 w-32 shrink-0 opacity-90">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={tendenciaBalance}>
                  <Line type="monotone" dataKey="balance" stroke="#ffffff" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div
        className={`grid grid-cols-1 gap-4 ${
          numTarjetasSecundarias === 3 ? "md:grid-cols-3" : numTarjetasSecundarias === 2 ? "md:grid-cols-2" : ""
        }`}
      >
        <Card>
          <div className="mb-1 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">Cuentas próximas</p>
            {cuentasEstaSemana > 0 && (
              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-500 dark:bg-white/10 dark:text-gray-300">
                {cuentasEstaSemana} esta semana
              </span>
            )}
          </div>
          {proximosPagos.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">No hay pagos pendientes este mes.</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-white/10">
              {proximosPagos.slice(0, 3).map((ev) => (
                <li key={`${ev.origen}:${ev.origenId}`} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-gray-700 dark:text-gray-200">{ev.descripcion}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {ev.dia != null ? `Vence el ${ev.dia}` : "Sin día definido"}
                    </p>
                  </div>
                  <p className="shrink-0 font-semibold text-gray-800 dark:text-gray-100">{formatCLP(ev.monto)}</p>
                </li>
              ))}
            </ul>
          )}
          <Link href="/calendario-pagos" className="mt-2 inline-block text-xs font-semibold text-brand-from dark:text-white">
            Ver todas →
          </Link>
        </Card>

        {metaDestacada && (
          <Card className="flex flex-col items-center text-center">
            <p className="mb-3 self-start text-sm font-semibold text-gray-600 dark:text-gray-300">
              Meta: {metaDestacada.icono ? `${metaDestacada.icono} ` : ""}
              {metaDestacada.nombre}
            </p>
            <div className="relative flex h-28 w-28 items-center justify-center">
              <svg viewBox="0 0 100 100" className="h-28 w-28 -rotate-90">
                <circle cx="50" cy="50" r="42" fill="none" strokeWidth="9" className="stroke-gray-100 dark:stroke-white/10" />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  strokeWidth="9"
                  strokeLinecap="round"
                  className="stroke-gray-800 dark:stroke-white"
                  strokeDasharray={2 * Math.PI * 42}
                  strokeDashoffset={2 * Math.PI * 42 * (1 - pctMetaDestacada / 100)}
                />
              </svg>
              <span className="absolute text-xl font-bold text-gray-800 dark:text-white">{pctMetaDestacada}%</span>
            </div>
            <div className="mt-3 flex w-full items-center justify-between text-xs">
              <div className="text-left">
                <p className="text-gray-400 dark:text-gray-500">Ahorrado</p>
                <p className="font-semibold text-gray-800 dark:text-white">{formatCLP(metaDestacada.monto_actual)}</p>
              </div>
              <div className="text-right">
                <p className="text-gray-400 dark:text-gray-500">Meta</p>
                <p className="font-semibold text-gray-800 dark:text-white">{formatCLP(metaDestacada.monto_objetivo)}</p>
              </div>
            </div>
            {metas.length > 1 && (
              <Link href="/metas-ahorro" className="mt-2 self-start text-xs font-semibold text-brand-from dark:text-white">
                Ver todas →
              </Link>
            )}
          </Card>
        )}

        {personas.length > 1 && (
          <Card>
            <p className="mb-2 text-sm font-semibold text-gray-600 dark:text-gray-300">{nombreGrupoHogar}</p>
            <AvatarGroupHover className="flex -space-x-2">
              {personas.slice(0, 4).map((p, i) => (
                <span
                  key={p.id}
                  title={p.nombre}
                  onClick={() => setPersonaSeleccionada(p.id)}
                  className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white dark:border-gray-900"
                  style={{ background: AVATAR_COLORES[i % AVATAR_COLORES.length] }}
                >
                  {p.nombre.charAt(0).toUpperCase()}
                </span>
              ))}
            </AvatarGroupHover>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {gruposConParticipantes.length > 0
                ? gruposConParticipantes.map((p) => `${p.name} ${p.pct}%`).join(" · ")
                : "Sin gastos compartidos todavía."}
            </p>
            <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">Gasto compartido este mes</p>
            <p className="text-lg font-bold text-gray-800 dark:text-white">{formatCLP(totalCompartido)}</p>
            <div className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
              {gruposConParticipantes.map((p, i) => (
                <div key={p.persona_id} style={{ width: `${p.pct}%`, background: AVATAR_COLORES[i % AVATAR_COLORES.length] }} />
              ))}
            </div>
          </Card>
        )}
      </div>

      <Card>
        <div className="mb-1 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">Movimientos recientes</p>
          <Link href="/movimientos" className="text-xs font-semibold text-brand-from dark:text-white">
            Ver todos →
          </Link>
        </div>
        {movimientosRecientes.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">Todavía no hay movimientos este mes.</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-white/10">
            {movimientosRecientes.map((m) => {
              const entidad = entidades.find((e) => e.id === m.entidadId) ?? null;
              const marca = marcas.find((mm) => mm.id === m.marcaId) ?? resolverMarca(entidad, marcas);
              return (
                <li key={m.key} className="flex items-center gap-3 py-2.5 text-sm">
                  <EntidadAvatar
                    entidad={entidad}
                    marca={marca}
                    icono={m.icono}
                    nombreFallback={m.descripcion}
                    className="h-9 w-9 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-gray-700 dark:text-gray-200">{m.descripcion}</p>
                    <p className="truncate text-xs text-gray-400 dark:text-gray-500">
                      {m.detalle}
                      {m.fecha ? ` · ${diaDelMes(m.fecha)} ${mesAbreviadoMayus().toLowerCase()}` : ""}
                    </p>
                  </div>
                  <p className={`shrink-0 font-semibold ${m.esIngreso ? "text-ingreso" : "text-gasto"}`}>
                    {m.esIngreso ? "+" : "-"}
                    {formatCLP(m.monto)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
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
