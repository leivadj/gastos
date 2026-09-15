"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { NotificacionesBell } from "@/components/NotificacionesBell";
import { AvatarGroupHover } from "@/components/AvatarGroupHover";
import { ContadorOdometro } from "@/components/ContadorOdometro";
import {
  diaDelMes,
  fechaLargaHoy,
  formatCLP,
  mesAbreviadoMayus,
  nombreMes,
  saludoHora,
} from "@/lib/format";
import { promedioMovil } from "@/lib/promedioMovil";
import { resolverMarca } from "@/lib/resolverMarca";
import { resumenGastosMes } from "@/lib/resumenGastos";
import { cuotaActualEn, esMismoMes, isoDelMes, mesAnterior, mesRefActual, mesSiguiente, MesRef } from "@/lib/cuotasHistoricas";
import { NivelGasto, estiloNivelGasto, nivelDeGasto } from "@/lib/nivelGasto";
import { colorCategoria } from "@/lib/colorCategoria";
import {
  Categoria,
  Compra,
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
  PresupuestoCategoria,
  RepartoCuota,
  RepartoGastoDiario,
  RepartoGastoFijo,
  ResumenPersonaMes,
  Transferencia,
} from "@/lib/types";
import { useDeviceType } from "@/lib/useDeviceType";

// Reconstruye las cuotas vigentes de un mes de referencia arbitrario (pasado
// o actual) a partir de las compras crudas — mismo criterio que ya usan
// /movimientos y /calendario-pagos (ver lib/cuotasHistoricas.ts), en vez de
// vista_cuotas_mes_actual, que la base solo calcula para el mes de hoy y por
// eso no servía para navegar "los gastos de los meses anteriores" desde
// Inicio.
function cuotasDelMes(compras: Compra[], pagos: Pago[], ref: MesRef, refIso: string): CompraVigente[] {
  return compras.flatMap((c) => {
    const cuotaActual = cuotaActualEn(c.fecha_primera_cuota, ref);
    if (cuotaActual < 1 || cuotaActual > c.n_cuotas) return [];
    const pago = pagos.find((p) => p.origen === "compra" && p.origen_id === c.id && p.mes === refIso);
    const monto_cuota = pago?.monto_real != null ? Number(pago.monto_real) : Math.round(c.monto_total / c.n_cuotas);
    return [
      {
        descripcion: c.descripcion,
        monto_total: c.monto_total,
        n_cuotas: c.n_cuotas,
        fecha_primera_cuota: c.fecha_primera_cuota,
        entidad_id: c.entidad_id,
        categoria_id: c.categoria_id,
        grupo_id: c.grupo_id,
        marca_id: c.marca_id,
        icono: c.icono,
        notas: c.notas,
        compra_id: c.id,
        monto_cuota,
        cuota_actual: cuotaActual,
      },
    ];
  });
}

function IconoChevronIzq({ className = "" }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m15 6-6 6 6 6" />
    </svg>
  );
}

function IconoChevronDer({ className = "" }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

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

export default function DashboardPage() {
  const deviceType = useDeviceType();
  const esMobile = deviceType === "mobile";

  // "cuotas"/"gastosDiarios"/"ingresosDelMes" ya no son estado: se cargan
  // SIN filtrar por mes (comprasRaw/gastosDiariosRaw/ingresosLista, más
  // abajo) y se recortan al mes elegido (variable "ref") en cada render —
  // así se puede navegar a meses anteriores sin ir a buscar datos de nuevo
  // cada vez que se cambia de mes (mismo criterio que /movimientos).
  const [comprasRaw, setComprasRaw] = useState<Compra[]>([]);
  const [gastosFijos, setGastosFijos] = useState<GastoFijo[]>([]);
  const [gastosDiariosRaw, setGastosDiariosRaw] = useState<GastoDiario[]>([]);
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
  const [presupuestos, setPresupuestos] = useState<PresupuestoCategoria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [personaSeleccionada, setPersonaSeleccionada] = useState<string | null>(null);
  // Estado del bloque "Presupuesto por categoría" (ver más abajo, Feature G
  // del pedido de Felipe) — agregar/editar/quitar un objetivo mensual por
  // categoría (migration_31_presupuesto_categorias.sql).
  const [nuevoPresupuestoCategoriaId, setNuevoPresupuestoCategoriaId] = useState("");
  const [nuevoPresupuestoMonto, setNuevoPresupuestoMonto] = useState("");
  const [editandoPresupuestoId, setEditandoPresupuestoId] = useState<string | null>(null);
  const [editandoPresupuestoMonto, setEditandoPresupuestoMonto] = useState("");
  const [guardandoPresupuesto, setGuardandoPresupuesto] = useState(false);
  // Día seleccionado en "Actividad del mes" (Feature G-2, pedido de Felipe:
  // "me gustaría hacer clic en un día y me muestre los movimientos de ese
  // día") — abre una hoja con lo que ocurrió ese día. null = cerrada.
  const [diaSeleccionado, setDiaSeleccionado] = useState<number | null>(null);
  // Mes que se está viendo en Inicio — antes "Septiembre de 2026" era un
  // rótulo fijo sin forma de navegar a meses anteriores; ahora es un
  // MesRef con flechas ‹ › junto al nombre del mes (mobile y escritorio).
  // No se deja ir a futuro (el botón "siguiente" se deshabilita en el mes
  // actual), solo hacia atrás, como en /movimientos.
  const [ref, setRef] = useState<MesRef>(mesRefActual());
  // Rediseño v2: en celular, Inicio/Ingresos/Presupuesto se fusionan en una
  // sola pantalla "Resumen" con pestañas (como en el mockup de Not Pato) en
  // vez de 3 pantallas sueltas — Felipe notó que "Presupuesto" ya
  // aparecía como pestaña arriba Y como destino propio en el nav inferior.
  // En escritorio se mantienen como páginas separadas del sidebar (hay
  // espacio de sobra ahí), así que esta pestaña solo aplica al layout
  // mobile de más abajo.
  const [tabResumen, setTabResumen] = useState<"resumen" | "ingresos" | "presupuesto">("resumen");
  // Buscador de escritorio (mockup Inicio): antes era un <Link> decorativo
  // sin <input> real, no se podía escribir nada — ahora navega a
  // /movimientos?buscar=... al enviar, donde la búsqueda de verdad filtra
  // la lista.
  const [busquedaInicio, setBusquedaInicio] = useState("");
  const router = useRouter();

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
        { data: pc },
      ] = await Promise.all([
        supabase.from("compras").select("*"),
        supabase.from("gastos_fijos").select("*").eq("activo", true),
        supabase.from("gastos_diarios").select("*"),
        supabase.from("categorias").select("*"),
        supabase.from("personas").select("*").eq("activo", true).order("nombre"),
        supabase.from("entidades").select("*"),
        supabase.from("marcas").select("*"),
        supabase.from("vista_resumen_personas_mes").select("*"),
        supabase.from("vista_reparto_cuotas_mes").select("*"),
        supabase.from("vista_reparto_gastos_fijos").select("*"),
        supabase.from("vista_reparto_gastos_diarios").select("*"),
        supabase.from("ingresos").select("*"),
        supabase.from("pagos").select("*"),
        supabase.from("vista_metas_ahorro_progreso").select("*").eq("activa", true).order("nombre"),
        supabase.from("grupos").select("*"),
        supabase.from("transferencias").select("*"),
        supabase.from("presupuestos_categoria").select("*"),
      ]);
      setComprasRaw((c as Compra[]) ?? []);
      setGastosFijos((gf as GastoFijo[]) ?? []);
      setGastosDiariosRaw((gd as GastoDiario[]) ?? []);
      setCategorias((cat as Categoria[]) ?? []);
      setPersonas((per as Persona[]) ?? []);
      setEntidades((ent as Entidad[]) ?? []);
      setMarcas((mar as Marca[]) ?? []);
      setResumenPersonas((rp as ResumenPersonaMes[]) ?? []);
      setRepartoCuotas((rc as RepartoCuota[]) ?? []);
      setRepartoGastos((rg as RepartoGastoFijo[]) ?? []);
      setRepartoDiarios((rd as RepartoGastoDiario[]) ?? []);
      setIngresosLista((ing as Ingreso[]) ?? []);
      setPagos((pg as Pago[]) ?? []);
      setMetas((mt as MetaAhorroProgreso[]) ?? []);
      setGrupos((gr as Grupo[]) ?? []);
      setTransferencias((tr as Transferencia[]) ?? []);
      setPresupuestos((pc as PresupuestoCategoria[]) ?? []);
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

  // Recorte al mes elegido (ver comentario junto a "ref" más arriba).
  const refIso = isoDelMes(ref);
  const refMesTexto = refIso.slice(0, 7);
  const enMesActual = esMismoMes(ref, mesRefActual());
  const cuotas = cuotasDelMes(comprasRaw, pagos, ref, refIso);
  const gastosDiarios = gastosDiariosRaw.filter((d) => d.fecha.slice(0, 7) === refMesTexto);
  const ingresosDelMes = ingresosLista.filter((i) => i.mes.slice(0, 7) === refMesTexto);
  const ingresosMes = ingresosDelMes.reduce((acc, r) => acc + Number(r.monto), 0);

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
  // suman a "ya pagados", nunca a "comprometido". Al navegar a un mes
  // anterior ya completo no existe "comprometido" (todo ya pasó), así que
  // todo cae en "ya pagados".
  const hoyDia = new Date().getDate();
  let gastosYaPagados = totalDiarios;
  let comprometido = 0;
  cuotas.forEach((c) => {
    const monto = Number(c.monto_cuota);
    if (!enMesActual || diaDelMes(c.fecha_primera_cuota) <= hoyDia) gastosYaPagados += monto;
    else comprometido += monto;
  });
  gastosFijos.forEach((g) => {
    const monto = Number(g.monto_estimado);
    if (!enMesActual || g.dia_mes_pago == null || g.dia_mes_pago <= hoyDia) gastosYaPagados += monto;
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
  // "Próximos" solo tiene sentido en el mes actual — un mes anterior ya
  // completo no tiene pagos "por vencer" (ver guard de "proximosPagos" más
  // abajo), así que esta lista ni se usa cuando !enMesActual.
  const eventosPagos = [
    ...gastosFijos.map((g) => {
      const esVariable = g.tipo_monto === "variable";
      const { promedio } = esVariable
        ? promedioMovil(pagos, g.id, refIso, Number(g.monto_estimado))
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

  const proximosPagos = !enMesActual
    ? []
    : eventosPagos
        .filter((ev) => {
          const pago = pagos.find((p) => p.origen === ev.origen && p.origen_id === ev.origenId && p.mes === refIso);
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
  // dato nuevo, es el mismo cálculo cortado en cada día del mes. En el mes
  // actual llega solo hasta hoy; en un mes anterior ya completo, se dibuja
  // el mes entero.
  const diasParaTendencia = enMesActual ? hoyDia : new Date(ref.year, ref.month + 1, 0).getDate();
  const tendenciaBalance = Array.from({ length: diasParaTendencia }, (_, i) => {
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
    .filter((p) => p.mes === refIso && p.pagado && p.fecha_pago)
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

  const movimientosIngreso = ingresosDelMes.slice(0, 1).map((i) => ({
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
  // para no inventar un número sin relación con datos reales. Esa
  // aproximación solo es válida para el mes actual (el saldo de hoy menos
  // lo que pasó ESTE mes) — para un mes anterior haría falta reconstruir
  // el saldo de cada mes entre medio, así que esa fila se oculta cuando se
  // navega a un mes que no es el actual (ver "enMesActual" más abajo).
  const totalEnCuentas = entidades
    .filter((e) => e.tipo !== "tarjeta_credito" && e.saldo != null)
    .reduce((acc, e) => acc + Number(e.saldo), 0);
  const pagoTarjetaMes = transferencias
    .filter((t) => t.fecha.slice(0, 7) === refMesTexto)
    .filter((t) => entidades.find((e) => e.id === t.cuenta_destino_id)?.tipo === "tarjeta_credito")
    .reduce((acc, t) => acc + Number(t.monto), 0);
  const aperturaMes = totalEnCuentas - (ingresosMes - gastosYaPagados - pagoTarjetaMes);

  // Cuántas tarjetas entran en la fila "Cuentas próximas / Meta / Grupo
  // Hogar" del dashboard de escritorio — "Cuentas próximas" solo aplica en
  // el mes actual (no hay pagos "por vencer" en un mes anterior ya
  // completo), las otras dos son condicionales (sin metas activas, o una
  // sola persona en la cuenta) y el grid se acomoda solo.
  const numTarjetasSecundarias = (enMesActual ? 1 : 0) + (metas[0] ? 1 : 0) + (enMesActual && personas.length > 1 ? 1 : 0);

  // "Cuentas y tarjetas" (Ronda 8, escritorio): reemplaza a "Actividad del
  // mes" en el dashboard de escritorio — Felipe pidió un cuadro parecido a
  // "Movimientos recientes" pero con las cuentas/tarjetas, cada una con su
  // saldo/cupo restante y lo gastado este mes, para hacer clic y llegar a
  // su detalle (ver /tarjetas, que ahora acepta ?entidad=<id> para abrir
  // directo esa cuenta — ver app/tarjetas/page.tsx). Mismo cálculo de
  // "gastado"/"disponible" que ya usa /tarjetas (gastoPorEntidad /
  // disponiblePorEntidad ahí), recalculado acá con las cuotas/gastos fijos
  // del MES ACTUAL real (no el "ref" que se esté navegando en Inicio — el
  // saldo/cupo de una cuenta es un valor de hoy, no de un mes pasado).
  const refHoy = mesRefActual();
  const cuotasMesActualEntidades = cuotasDelMes(comprasRaw, pagos, refHoy, isoDelMes(refHoy));
  const gastoPorEntidadId: Record<string, number> = {};
  cuotasMesActualEntidades.forEach((c) => {
    if (!c.entidad_id) return;
    gastoPorEntidadId[c.entidad_id] = (gastoPorEntidadId[c.entidad_id] ?? 0) + Number(c.monto_cuota);
  });
  gastosFijos.forEach((g) => {
    if (!g.entidad_id) return;
    gastoPorEntidadId[g.entidad_id] = (gastoPorEntidadId[g.entidad_id] ?? 0) + Number(g.monto_estimado);
  });
  const disponiblePorEntidadId: Record<string, number> = {};
  {
    const deudaCuotas: Record<string, number> = {};
    cuotasMesActualEntidades.forEach((c) => {
      if (!c.entidad_id) return;
      const cuotasRestantes = c.n_cuotas - c.cuota_actual + 1;
      deudaCuotas[c.entidad_id] = (deudaCuotas[c.entidad_id] ?? 0) + Number(c.monto_cuota) * cuotasRestantes;
    });
    const deudaFijos: Record<string, number> = {};
    gastosFijos.forEach((g) => {
      if (!g.entidad_id) return;
      deudaFijos[g.entidad_id] = (deudaFijos[g.entidad_id] ?? 0) + Number(g.monto_estimado);
    });
    const abonos: Record<string, number> = {};
    transferencias.forEach((t) => {
      if (!t.cuenta_destino_id) return;
      abonos[t.cuenta_destino_id] = (abonos[t.cuenta_destino_id] ?? 0) + Number(t.monto);
    });
    entidades.forEach((e) => {
      if (e.tipo !== "tarjeta_credito" || e.cupo == null) return;
      const usado = Math.max(0, (deudaCuotas[e.id] ?? 0) + (deudaFijos[e.id] ?? 0) - (abonos[e.id] ?? 0));
      disponiblePorEntidadId[e.id] = Math.max(0, e.cupo - usado);
    });
  }

  // Presupuesto por categoría (Feature G del pedido de Felipe): un objetivo
  // mensual por categoría (migration_31_presupuesto_categorias.sql) contra
  // lo efectivamente gastado este mes, agrupado por categoria_id (a
  // diferencia de resumenGastosMes, que agrupa por NOMBRE para la dona —
  // acá hace falta el id para cruzar contra `presupuestos`).
  async function guardarPresupuesto(categoriaId: string, monto: number) {
    if (!categoriaId || !(monto > 0)) return;
    setGuardandoPresupuesto(true);
    const { error } = await supabase
      .from("presupuestos_categoria")
      .upsert({ categoria_id: categoriaId, monto_mensual: monto }, { onConflict: "owner_id,categoria_id" });
    if (!error) {
      setPresupuestos((actual) => [...actual.filter((p) => p.categoria_id !== categoriaId), { id: crypto.randomUUID(), categoria_id: categoriaId, monto_mensual: monto }]);
      setNuevoPresupuestoCategoriaId("");
      setNuevoPresupuestoMonto("");
      setEditandoPresupuestoId(null);
    }
    setGuardandoPresupuesto(false);
  }

  async function eliminarPresupuesto(categoriaId: string) {
    setPresupuestos((actual) => actual.filter((p) => p.categoria_id !== categoriaId));
    await supabase.from("presupuestos_categoria").delete().eq("categoria_id", categoriaId);
  }

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

  // Gasto total por día (ronda 5): mismas 3 fuentes que gastoPorCategoriaId
  // de arriba (cuotas + gastosFijos + gastosDiarios, sin transferencias —
  // un traspaso entre cuentas propias no es gasto real), pero agrupado por
  // día del mes en vez de por categoría, para colorear "Actividad del mes"
  // según cuánto se gastó cada día — con la misma escala/paleta que la
  // pestaña "Intensidad" de /calendario-pagos (ver lib/nivelGasto.ts), solo
  // que acá el máximo es de todas las cuentas/categorías juntas, porque esta
  // pantalla no tiene selector de cuenta.
  const gastoPorDiaTotal: Record<number, number> = {};
  cuotas.forEach((c) => {
    const dia = diaDelMes(c.fecha_primera_cuota);
    gastoPorDiaTotal[dia] = (gastoPorDiaTotal[dia] ?? 0) + Number(c.monto_cuota);
  });
  gastosFijos.forEach((g) => {
    if (g.dia_mes_pago == null) return;
    gastoPorDiaTotal[g.dia_mes_pago] = (gastoPorDiaTotal[g.dia_mes_pago] ?? 0) + Number(g.monto_estimado);
  });
  gastosDiarios.forEach((d) => {
    const dia = diaDelMes(d.fecha);
    gastoPorDiaTotal[dia] = (gastoPorDiaTotal[dia] ?? 0) + Number(d.monto);
  });
  const maxGastoDiaMes = Math.max(0, ...Object.values(gastoPorDiaTotal));

  const categoriasConPresupuesto = presupuestos
    .map((p) => ({ presupuesto: p, categoria: categorias.find((c) => c.id === p.categoria_id) ?? null }))
    .filter((x): x is { presupuesto: PresupuestoCategoria; categoria: Categoria } => x.categoria != null)
    .sort((a, b) => a.categoria.nombre.localeCompare(b.categoria.nombre));
  const categoriasDisponiblesParaPresupuesto = categorias.filter((c) => !presupuestos.some((p) => p.categoria_id === c.id));

  // Calendario de actividad (Feature G): días del mes que tuvieron algún
  // movimiento — cuotas y gastos fijos "ocurren" cada mes en su día de cargo
  // (fecha_primera_cuota/dia_mes_pago), gastos diarios y transferencias
  // tienen fecha real.
  const diasConMovimiento = new Set<number>();
  cuotas.forEach((c) => diasConMovimiento.add(diaDelMes(c.fecha_primera_cuota)));
  gastosFijos.forEach((g) => {
    if (g.dia_mes_pago != null) diasConMovimiento.add(g.dia_mes_pago);
  });
  gastosDiarios.forEach((d) => diasConMovimiento.add(diaDelMes(d.fecha)));
  transferencias.filter((t) => t.fecha.slice(0, 7) === refMesTexto).forEach((t) => diasConMovimiento.add(diaDelMes(t.fecha)));

  // Movimientos de un día puntual del calendario de actividad (Feature
  // G-2): mismo criterio que diasConMovimiento de arriba para decidir "qué
  // pasó ese día" — cuotas/fijos por su día de cargo, diarios/transferencias
  // por su fecha real.
  type MovimientoDia = {
    key: string;
    descripcion: string;
    detalle: string;
    monto: number;
    icono: string | null;
    marcaId: string | null;
    entidadId: string | null;
  };
  function movimientosDelDia(dia: number): MovimientoDia[] {
    const items: MovimientoDia[] = [];
    cuotas.forEach((c) => {
      if (diaDelMes(c.fecha_primera_cuota) === dia) {
        items.push({
          key: `cuota-${c.compra_id}`,
          descripcion: c.descripcion,
          detalle: `Cuota ${c.cuota_actual} de ${c.n_cuotas}`,
          monto: Number(c.monto_cuota),
          icono: c.icono,
          marcaId: c.marca_id,
          entidadId: c.entidad_id,
        });
      }
    });
    gastosFijos.forEach((g) => {
      if (g.dia_mes_pago === dia) {
        items.push({
          key: `fijo-${g.id}`,
          descripcion: g.descripcion,
          detalle: categoriaNombre(g.categoria_id),
          monto: Number(g.monto_estimado),
          icono: g.icono,
          marcaId: g.marca_id,
          entidadId: g.entidad_id,
        });
      }
    });
    gastosDiarios.forEach((d) => {
      if (diaDelMes(d.fecha) === dia) {
        items.push({
          key: `diario-${d.id}`,
          descripcion: d.descripcion,
          detalle: categoriaNombre(d.categoria_id),
          monto: Number(d.monto),
          icono: categorias.find((c) => c.id === d.categoria_id)?.icono ?? null,
          marcaId: d.marca_id,
          entidadId: null,
        });
      }
    });
    transferencias
      .filter((t) => t.fecha.slice(0, 7) === refMesTexto && diaDelMes(t.fecha) === dia)
      .forEach((t) => {
        items.push({
          key: `transferencia-${t.id}`,
          descripcion: `${entidades.find((e) => e.id === t.cuenta_origen_id)?.nombre ?? "Efectivo"} → ${
            entidades.find((e) => e.id === t.cuenta_destino_id)?.nombre ?? "Efectivo"
          }`,
          detalle: t.notas || "Transferencia entre tus cuentas",
          monto: Number(t.monto),
          icono: "⇄",
          marcaId: null,
          entidadId: null,
        });
      });
    return items;
  }

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

  // Tarjeta "Presupuesto por categoría" (Feature G, rediseñada rondas 5 y
  // 6): gráfico de barras verticales (una por categoría) con una línea
  // punteada marcando el presupuesto asignado — pedido explícito del
  // usuario, calcado de una captura real de Not Pato. Cada barra se escala
  // en su PROPIO contenedor (denom = máximo entre gastado y presupuesto,
  // +15% de aire) porque los presupuestos de distintas categorías pueden ser
  // de montos muy distintos (ej. $40.000 en Comida vs. $550.000 en Hogar) y
  // no tendría sentido compararlos en una sola escala común.
  //
  // Ronda 6: el color de la barra ahora es el color PROPIO de la categoría
  // (colorCategoria(), ver lib/colorCategoria.ts) en vez de un color binario
  // gastado/excedido — y si te pasas del presupuesto, ya NO se recolorea la
  // barra completa: solo el tramo que queda POR ENCIMA de la línea punteada
  // (el excedente) cambia a rojo (bg-gasto), el resto sigue con el color de
  // la categoría. Debajo del gráfico se mantiene la lista compacta con los
  // montos exactos y los mismos controles de editar/quitar de siempre, y el
  // mini form de agregar no cambia.
  const tarjetaPresupuestoCategorias = (
    <Card>
      <p className="mb-3 text-sm font-semibold text-gray-600 dark:text-gray-300">Presupuesto por categoría</p>
      {categoriasConPresupuesto.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">
          Todavía no defines un presupuesto por categoría — agrega uno abajo para ver cuánto llevas gastado.
        </p>
      ) : (
        <>
          <div className="flex items-end gap-3 overflow-x-auto pb-1">
            {categoriasConPresupuesto.map(({ presupuesto, categoria }) => {
              const gastado = gastoPorCategoriaId[categoria.id] ?? 0;
              const sobrepasado = gastado > presupuesto.monto_mensual;
              const denom = Math.max(gastado, presupuesto.monto_mensual) * 1.15;
              const barPct = denom > 0 ? Math.min(100, (gastado / denom) * 100) : 0;
              const lineaPct = denom > 0 ? Math.min(100, (presupuesto.monto_mensual / denom) * 100) : 0;
              // Tramo base (hasta la línea de presupuesto, o hasta lo
              // gastado si todavía no la alcanza) con el color propio de la
              // categoría, y tramo de excedente (si sobrepasado) desde la
              // línea hasta el tope de la barra, en rojo.
              const colorBase = colorCategoria(categoria);
              const alturaBase = Math.min(barPct, lineaPct);
              const alturaExcedente = sobrepasado ? barPct - lineaPct : 0;
              return (
                <div
                  key={categoria.id}
                  className="flex w-14 shrink-0 flex-col items-center gap-1.5"
                  title={`${categoria.nombre}: ${formatCLP(gastado)} de ${formatCLP(presupuesto.monto_mensual)}`}
                >
                  <div className="relative h-32 w-6 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                    <div
                      className="absolute inset-x-0 border-t-2 border-dashed border-gray-400 dark:border-gray-400/60"
                      style={{ bottom: `${lineaPct}%` }}
                    />
                    <div
                      className="absolute inset-x-0 bottom-0 rounded-full transition-[height]"
                      style={{ height: `${alturaBase}%`, backgroundColor: colorBase }}
                    />
                    {sobrepasado && (
                      <div
                        className="absolute inset-x-0 bg-gasto transition-[height]"
                        style={{ height: `${alturaExcedente}%`, bottom: `${lineaPct}%` }}
                      />
                    )}
                  </div>
                  <span className="max-w-full truncate text-sm leading-none">{categoria.icono || "🏷️"}</span>
                  <span className="max-w-full truncate text-[10px] font-semibold text-gray-500 dark:text-gray-400">
                    {categoria.nombre}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-gray-400 dark:text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-gray-300 dark:bg-gray-600" /> Color propio por categoría
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-0 w-3 border-t-2 border-dashed border-gray-400 dark:border-gray-400/60" /> Presupuesto
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-gasto" /> Excedido
            </span>
          </div>

          <div className="mt-4 space-y-2 border-t border-gray-50 pt-3 dark:border-white/10">
            {categoriasConPresupuesto.map(({ presupuesto, categoria }) => {
              const gastado = gastoPorCategoriaId[categoria.id] ?? 0;
              const editando = editandoPresupuestoId === categoria.id;
              return (
                <div key={categoria.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex min-w-0 items-center gap-1.5 truncate font-semibold text-gray-700 dark:text-gray-200">
                    {categoria.icono ? `${categoria.icono} ` : ""}
                    {categoria.nombre}
                  </span>
                  {editando ? (
                    <span className="flex shrink-0 items-center gap-1">
                      <input
                        type="number"
                        autoFocus
                        value={editandoPresupuestoMonto}
                        onChange={(e) => setEditandoPresupuestoMonto(e.target.value)}
                        className="w-24 rounded-lg border border-gray-200 px-2 py-1 text-right text-xs dark:border-white/10 dark:bg-white/5 dark:text-white"
                      />
                      <button
                        type="button"
                        disabled={guardandoPresupuesto}
                        onClick={() => guardarPresupuesto(categoria.id, Number(editandoPresupuestoMonto))}
                        className="text-[11px] font-semibold text-brand-from dark:text-white"
                      >
                        Guardar
                      </button>
                    </span>
                  ) : (
                    <span className="flex shrink-0 items-center gap-2 whitespace-nowrap text-gray-400 dark:text-gray-500">
                      {formatCLP(gastado)} / {formatCLP(presupuesto.monto_mensual)}
                      <button
                        type="button"
                        onClick={() => {
                          setEditandoPresupuestoId(categoria.id);
                          setEditandoPresupuestoMonto(String(presupuesto.monto_mensual));
                        }}
                        aria-label={`Editar presupuesto de ${categoria.nombre}`}
                        className="text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400"
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        onClick={() => eliminarPresupuesto(categoria.id)}
                        aria-label={`Quitar presupuesto de ${categoria.nombre}`}
                        className="text-gray-300 hover:text-red-400 dark:text-gray-600"
                      >
                        ✕
                      </button>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-50 pt-3 dark:border-white/10">
        <select
          value={nuevoPresupuestoCategoriaId}
          onChange={(e) => setNuevoPresupuestoCategoriaId(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs dark:border-white/10 dark:bg-white/5 dark:text-white"
        >
          <option value="">+ Agregar categoría…</option>
          {categoriasDisponiblesParaPresupuesto.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        <input
          type="number"
          value={nuevoPresupuestoMonto}
          onChange={(e) => setNuevoPresupuestoMonto(e.target.value)}
          placeholder="$ mensual"
          className="w-24 rounded-lg border border-gray-200 px-2 py-1.5 text-xs dark:border-white/10 dark:bg-white/5 dark:text-white"
        />
        <button
          type="button"
          disabled={!nuevoPresupuestoCategoriaId || !nuevoPresupuestoMonto || guardandoPresupuesto}
          onClick={() => guardarPresupuesto(nuevoPresupuestoCategoriaId, Number(nuevoPresupuestoMonto))}
          className="shrink-0 rounded-lg bg-gray-800 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-black"
        >
          Agregar
        </button>
      </div>
    </Card>
  );

  // Tarjeta "Actividad del mes" (Feature G): calendario simple con los días
  // que tuvieron algún movimiento marcados.
  const NOMBRES_DIA_SEMANA = ["D", "L", "M", "M", "J", "V", "S"];
  const diasEnMesRef = new Date(ref.year, ref.month + 1, 0).getDate();
  const primerDiaSemanaRef = new Date(ref.year, ref.month, 1).getDay();
  const celdasCalendario: (number | null)[] = [
    ...Array.from({ length: primerDiaSemanaRef }, () => null),
    ...Array.from({ length: diasEnMesRef }, (_, i) => i + 1),
  ];

  const tarjetaCalendarioActividad = (
    <Card>
      <p className="mb-3 text-sm font-semibold text-gray-600 dark:text-gray-300">Actividad del mes</p>
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {NOMBRES_DIA_SEMANA.map((d, i) => (
          <span key={i} className="text-[10px] font-semibold uppercase text-gray-300 dark:text-gray-600">
            {d}
          </span>
        ))}
        {celdasCalendario.map((dia, i) => {
          const esHoy = enMesActual && dia === hoyDia;
          const tieneMovimiento = dia != null && diasConMovimiento.has(dia);
          // Ronda 5: el color de fondo ahora indica cuánto se gastó ese día
          // (misma paleta/umbrales que la pestaña "Intensidad" de
          // /calendario-pagos, ver lib/nivelGasto.ts), en vez del tinte fijo
          // de antes. "Hoy" pasa de relleno sólido a un anillo superpuesto
          // sobre ese color, para no taparlo (mismo patrón que Intensidad).
          const nivel: NivelGasto = dia != null ? nivelDeGasto(gastoPorDiaTotal[dia] ?? 0, maxGastoDiaMes) : 0;
          return (
            <div key={i} className="flex items-center justify-center py-0.5">
              <button
                type="button"
                disabled={dia == null || !tieneMovimiento}
                onClick={() => dia != null && setDiaSeleccionado(dia)}
                style={dia != null && tieneMovimiento ? estiloNivelGasto(nivel) : undefined}
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs transition ${
                  dia == null
                    ? "cursor-default"
                    : tieneMovimiento
                    ? "font-semibold text-gray-800 active:scale-90 dark:text-white"
                    : "cursor-default text-gray-300 dark:text-gray-600"
                } ${esHoy ? "ring-[1.5px] ring-brand-from dark:ring-white" : ""}`}
              >
                {dia ?? ""}
              </button>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500">
        menos
        {([0, 1, 2, 3, 4] as NivelGasto[]).map((n) => (
          <span key={n} className="h-3.5 w-3.5 rounded-[4px]" style={estiloNivelGasto(n)} />
        ))}
        más
      </div>
      <p className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">Los días marcados tuvieron algún movimiento — el color indica cuánto se gastó.</p>
    </Card>
  );

  // "Cuentas y tarjetas" (Ronda 8, solo escritorio): reemplaza a "Actividad
  // del mes" — mismo formato de lista que "Movimientos recientes" de acá
  // arriba, una fila por cada cuenta/tarjeta con lo gastado este mes y lo
  // que le queda (cupo disponible en tarjetas de crédito, saldo en el
  // resto). Clic en una fila navega a /tarjetas?entidad=<id>, que abre
  // directo el detalle de esa cuenta (ver app/tarjetas/page.tsx).
  const tarjetaCuentasResumen = (
    <Card>
      <div className="mb-1 flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">Cuentas y tarjetas</p>
        <Link href="/tarjetas" className="text-xs font-semibold text-brand-from dark:text-white">
          Ver todas →
        </Link>
      </div>
      {entidades.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">Todavía no agregas cuentas ni tarjetas.</p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-white/10">
          {entidades.map((e) => {
            const marca = marcas.find((m) => m.id === e.marca_id) ?? resolverMarca(e, marcas);
            const gastado = gastoPorEntidadId[e.id] ?? 0;
            const esTarjetaCredito = e.tipo === "tarjeta_credito" && e.cupo != null;
            const restante = esTarjetaCredito ? disponiblePorEntidadId[e.id] ?? e.cupo ?? 0 : e.saldo;
            return (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => router.push(`/tarjetas?entidad=${e.id}`)}
                  className="flex w-full items-center gap-3 py-2.5 text-left text-sm transition hover:opacity-80"
                >
                  <EntidadAvatar entidad={e} marca={marca} nombreFallback={e.nombre} className="h-9 w-9 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-gray-700 dark:text-gray-200">{e.nombre}</p>
                    <p className="truncate text-xs text-gray-400 dark:text-gray-500">Gastado este mes · {formatCLP(gastado)}</p>
                  </div>
                  {restante != null && (
                    <div className="shrink-0 text-right">
                      <p className="font-semibold text-gray-800 dark:text-gray-100">{formatCLP(restante)}</p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500">{esTarjetaCredito ? "cupo disp." : "saldo"}</p>
                    </div>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );

  // Hoja "Movimientos de ese día" (Feature G-2): se abre al hacer clic en un
  // día marcado del calendario de arriba. createPortal para que quede fija
  // sobre el viewport sin importar dónde esté montada en el árbol (mismo
  // motivo que en /tarjetas y /movimientos, ver esos archivos).
  const hojaDiaSeleccionado =
    diaSeleccionado != null &&
    typeof document !== "undefined" &&
    createPortal(
      (() => {
        const items = movimientosDelDia(diaSeleccionado);
        const totalDia = items.reduce((acc, it) => acc + it.monto, 0);
        const fechaDia = `${refIso.slice(0, 7)}-${String(diaSeleccionado).padStart(2, "0")}`;
        return (
          <div
            className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 px-0 backdrop-blur-sm sm:items-center sm:px-4"
            onClick={() => setDiaSeleccionado(null)}
          >
            <div
              className="max-h-[85dvh] w-full overflow-y-auto rounded-t-3xl bg-white text-gray-800 shadow-2xl dark:bg-[#111113] dark:text-white sm:max-w-md sm:rounded-3xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 z-10 flex items-start justify-between gap-2 rounded-t-3xl bg-white p-5 pb-3 dark:bg-[#111113]">
                <div className="min-w-0">
                  <p className="truncate text-base font-bold capitalize">
                    Día {diaSeleccionado} de {nombreMes(fechaDia)}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-white/50">
                    {items.length} movimiento{items.length === 1 ? "" : "s"} · {formatCLP(totalDia)}
                  </p>
                </div>
                <button
                  onClick={() => setDiaSeleccionado(null)}
                  aria-label="Cerrar"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-white/10"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-1 p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-0">
                {items.length === 0 ? (
                  <p className="py-2 text-sm text-gray-400 dark:text-white/40">Sin movimientos este día.</p>
                ) : (
                  <ul className="divide-y divide-gray-100 dark:divide-white/10">
                    {items.map((it) => {
                      const entidad = entidades.find((e) => e.id === it.entidadId) ?? null;
                      const marca = marcas.find((m) => m.id === it.marcaId) ?? resolverMarca(entidad, marcas);
                      return (
                        <li key={it.key} className="flex items-center gap-3 py-2.5">
                          <EntidadAvatar entidad={entidad} marca={marca} icono={it.icono} nombreFallback={it.descripcion} className="h-9 w-9" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{it.descripcion}</p>
                            <p className="truncate text-xs text-gray-400 dark:text-white/50">{it.detalle}</p>
                          </div>
                          <p className="shrink-0 text-sm font-semibold text-gasto">-{formatCLP(it.monto)}</p>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
        );
      })(),
      document.body
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
        {enMesActual && (
          <div className="flex items-center justify-between py-1 text-sm">
            <span className="text-gray-400 dark:text-gray-500">Apertura del mes</span>
            <span className="font-semibold text-gray-800 dark:text-white">{formatCLP(aperturaMes)}</span>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-gray-50 py-2 text-sm first:border-t-0 dark:border-white/10">
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
      {tarjetaPresupuestoCategorias}
      {tarjetaCalendarioActividad}
    </div>
  );

  const contenido = esMobile ? (
    <div className="space-y-4 pb-10">
      <div className="flex items-center justify-between">
        <NotificacionesBell
          buttonClassName="h-10 w-10 rounded-full bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-300"
          alinear="izquierda"
        />
        <div className="flex items-center gap-0.5 rounded-full bg-gray-100 pl-1 pr-1 dark:bg-white/10">
          <button
            type="button"
            onClick={() => setRef(mesAnterior(ref))}
            aria-label="Mes anterior"
            className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 active:bg-gray-200 dark:text-gray-300 dark:active:bg-white/15"
          >
            <IconoChevronIzq />
          </button>
          <span className="px-0.5 text-sm font-medium capitalize text-gray-700 dark:text-gray-200">{nombreMes(refIso)}</span>
          <button
            type="button"
            onClick={() => setRef(mesSiguiente(ref))}
            disabled={enMesActual}
            aria-label="Mes siguiente"
            className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 active:bg-gray-200 disabled:opacity-30 disabled:active:bg-transparent dark:text-gray-300 dark:active:bg-white/15"
          >
            <IconoChevronDer />
          </button>
        </div>
        {/* BUG reportado por Felipe: esto llevaba a /personas (gestión de
            "otras personas" para repartos) en vez de a su propio perfil.
            "Tu perfil" (PerfilPropioCard) vive en /mas — ver
            components/PerfilPropioCard.tsx. */}
        <Link href="/mas" aria-label="Ir a tu perfil">
          <PersonaAvatar
            fotoUrl={personas.find((p) => p.es_self)?.foto_url}
            nombre={personas.find((p) => p.es_self)?.nombre ?? "?"}
            className="h-9 w-9 text-sm"
          />
        </Link>
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
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const q = busquedaInicio.trim();
              router.push(q ? `/movimientos?buscar=${encodeURIComponent(q)}` : "/movimientos");
            }}
            className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-400 dark:border-white/10 dark:bg-neutral-900 dark:text-gray-500"
          >
            <IconoBuscar />
            <input
              value={busquedaInicio}
              onChange={(e) => setBusquedaInicio(e.target.value)}
              placeholder="Buscar movimiento"
              className="w-40 bg-transparent text-gray-700 outline-none placeholder:text-gray-400 dark:text-gray-200 dark:placeholder:text-gray-500"
            />
          </form>
          <NotificacionesBell buttonClassName="h-10 w-10 shrink-0 rounded-full border border-gray-200 bg-white text-gray-400 dark:border-white/10 dark:bg-neutral-900 dark:text-gray-500" />
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
                ingresos de <span className="capitalize">{nombreMes(refIso)}</span>.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-0.5 rounded-full bg-white/15 pl-1 pr-1">
            <button
              type="button"
              onClick={() => setRef(mesAnterior(ref))}
              aria-label="Mes anterior"
              className="flex h-7 w-7 items-center justify-center rounded-full text-white/80 hover:bg-white/10"
            >
              <IconoChevronIzq />
            </button>
            <span className="px-1 text-sm font-medium capitalize">{nombreMes(refIso)}</span>
            <button
              type="button"
              onClick={() => setRef(mesSiguiente(ref))}
              disabled={enMesActual}
              aria-label="Mes siguiente"
              className="flex h-7 w-7 items-center justify-center rounded-full text-white/80 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <IconoChevronDer />
            </button>
          </div>
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
              <p className="text-base font-semibold text-ingreso">+{formatCLP(ingresosMes)}</p>
            </div>
            <div>
              <p className="flex items-center gap-1 text-xs opacity-70">
                <IconoGastos className="text-white" />
                Gastos
              </p>
              <p className="text-base font-semibold text-gasto">-{formatCLP(gastosYaPagados)}</p>
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
        {/* "Cuentas próximas" solo tiene sentido mirando el mes actual — un
            mes anterior ya completo no tiene pagos "por vencer". */}
        {enMesActual && (
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
        )}

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

        {/* El reparto por persona viene de vista_resumen_personas_mes, una
            vista que la base solo calcula para el mes de hoy — se oculta al
            navegar a un mes anterior en vez de mostrar (por error) el
            reparto del mes actual con el rótulo de otro mes. */}
        {enMesActual && personas.length > 1 && (
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {tarjetaPresupuestoCategorias}
        {tarjetaCuentasResumen}
      </div>
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
      {hojaDiaSeleccionado}
    </>
  );
}
