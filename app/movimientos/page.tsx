"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/Card";
import { DividirGastoSheet, ItemADividir } from "@/components/DividirGastoSheet";
import { EntidadAvatar } from "@/components/EntidadAvatar";
import { EVENTO_MOVIMIENTO_GUARDADO } from "@/components/MovimientoRapido";
import {
  cuotaActualEn,
  esMismoMes,
  isoDelMes,
  mesAnterior,
  mesRefActual,
  mesSiguiente,
  MesRef,
} from "@/lib/cuotasHistoricas";
import { diaDelMes, formatCLP, mesActualISO, nombreMes, nombreMesCorto } from "@/lib/format";
import { promedioMovil } from "@/lib/promedioMovil";
import { resolverMarca } from "@/lib/resolverMarca";
import { mensajeError } from "@/lib/supabaseError";
import { Categoria, Compra, Entidad, GastoDiario, GastoFijo, Grupo, Ingreso, ItemParticipante, Marca, OrigenItem, Pago, Persona, Transferencia } from "@/lib/types";

type TipoMovimiento = "fijo" | "variable" | "cuota" | "diario" | "ingreso" | "transferencia";

// Rediseño v2: el mockup (Movimientos.dc.html) simplifica el filtro a 3
// pestañas de selección única — Todo / Ingresos / Gastos — en vez de los 5
// chips de selección múltiple (Fijos/Variables/Cuotas/Diarios/Ingresos) de
// la versión anterior. Fijos/Variables/Cuotas/Diarios siguen existiendo
// como conceptos internos (cada uno con su propia lógica de cálculo más
// abajo) pero ahora todos caen bajo la pestaña "Gastos".
type Vista = "todo" | "ingresos" | "gastos";
const VISTAS: { id: Vista; label: string }[] = [
  { id: "todo", label: "Todo" },
  { id: "ingresos", label: "Ingresos" },
  { id: "gastos", label: "Gastos" },
];

type Movimiento = {
  key: string;
  tipo: TipoMovimiento;
  descripcion: string;
  detalle: string;
  dia: number | null;
  monto: number;
  esPromedio: boolean;
  pagado: boolean | null; // null = no aplica (diarios/ingresos, ya están realizados)
  entidadId: string | null;
  marcaId: string | null;
  icono: string | null;
  // Solo para tipo "cuota"/"fijo"/"variable" — las únicas con reparto real
  // (ver DividirGastoSheet.tsx). Ausentes (undefined) en "diario"/"ingreso".
  origen?: OrigenItem;
  origenId?: string;
  categoriaId?: string | null;
  grupoId?: string | null;
  // Solo para tipo "ingreso" (de quién) y "transferencia" (entre qué
  // cuentas) — el detalle al hacer clic en el movimiento (ver
  // MovimientoDetalleSheet más abajo) los usa para mostrar esa info.
  personaId?: string | null;
  cuentaOrigenId?: string | null;
  cuentaDestinoId?: string | null;
  notas?: string | null;
};

// Pantalla "Movimientos": une en un solo listado cronológico, mes a mes, lo
// que hoy vive repartido en 4 pantallas distintas (Gastos > Fijos/Variables/
// Cuotas/Diarios) más Ingresos — para ver de un vistazo todo lo que entró y
// salió en un mes, sin tener que ir pestaña por pestaña. No reemplaza esas
// pantallas (siguen siendo donde se cargan/editan los items): esto es una
// vista de solo lectura, tipo "cartola".
//
// Los gastos fijos y las cuotas no tienen una fecha real por mes (son
// recurrentes) — se reconstruyen con la misma matemática de fecha que ya
// usa /reportes (ver lib/cuotasHistoricas.ts) para poder navegar meses
// pasados con exactitud. Los gastos fijos activos hoy se usan como
// aproximación para meses pasados (la base no guarda desde cuándo estuvo
// activo cada uno, mismo criterio que /reportes). Los diarios e ingresos sí
// tienen fecha real, así que siempre son exactos. No se puede navegar a
// meses futuros: es un historial de lo que pasó, no un calendario de
// vencimientos (para eso está /calendario-pagos).
export default function MovimientosPage() {
  const [compras, setCompras] = useState<Compra[]>([]);
  const [gastosFijos, setGastosFijos] = useState<GastoFijo[]>([]);
  const [gastosDiarios, setGastosDiarios] = useState<GastoDiario[]>([]);
  const [ingresos, setIngresos] = useState<Ingreso[]>([]);
  const [transferencias, setTransferencias] = useState<Transferencia[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [entidades, setEntidades] = useState<Entidad[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [participantesPorItem, setParticipantesPorItem] = useState<Record<string, ItemParticipante[]>>({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const [ref, setRef] = useState<MesRef>(mesRefActual());
  const [vista, setVista] = useState<Vista>("todo");
  // Búsqueda por texto (mockup "Buscar movimiento" de Inicio, ver
  // app/page.tsx): se lee el parámetro ?buscar= así (en vez de
  // useSearchParams) para no forzar un límite de Suspense, mismo criterio
  // que ya se usa en /tarjetas para ?nueva=1.
  const [busqueda, setBusqueda] = useState("");
  // Movimiento en el que se abrió "Dividir gasto" (mockup PDF pág. 13) — ver
  // DividirGastoSheet.tsx. Solo cuotas/fijos/variables tienen esta opción.
  const [dividiendo, setDividiendo] = useState<Movimiento | null>(null);
  // Movimiento en el que se hizo clic para ver su detalle de solo lectura
  // (método de pago, categoría, cuotas, persona/reparto) — ver Feature I.
  const [detalleAbierto, setDetalleAbierto] = useState<Movimiento | null>(null);

  async function cargarTodo() {
    try {
      const [{ data: c }, { data: gf }, { data: gd }, { data: ing }, { data: tr }, { data: pg }, { data: cat }, { data: e }, { data: m }, { data: p }, { data: gr }, { data: ipCompra }, { data: ipFijo }] =
        await Promise.all([
          supabase.from("compras").select("*"),
          supabase.from("gastos_fijos").select("*").eq("activo", true),
          supabase.from("gastos_diarios").select("*"),
          supabase.from("ingresos").select("*"),
          supabase.from("transferencias").select("*"),
          supabase.from("pagos").select("*"),
          supabase.from("categorias").select("*"),
          supabase.from("entidades").select("*"),
          supabase.from("marcas").select("*"),
          supabase.from("personas").select("*").eq("activo", true),
          supabase.from("grupos").select("*").order("nombre"),
          supabase.from("item_participantes").select("*").eq("origen", "compra"),
          supabase.from("item_participantes").select("*").eq("origen", "gasto_fijo"),
        ]);
      setCompras((c as Compra[]) ?? []);
      setGastosFijos((gf as GastoFijo[]) ?? []);
      setGastosDiarios((gd as GastoDiario[]) ?? []);
      setIngresos((ing as Ingreso[]) ?? []);
      setTransferencias((tr as Transferencia[]) ?? []);
      setPagos((pg as Pago[]) ?? []);
      setCategorias((cat as Categoria[]) ?? []);
      setEntidades((e as Entidad[]) ?? []);
      setMarcas((m as Marca[]) ?? []);
      setPersonas((p as Persona[]) ?? []);
      setGrupos((gr as Grupo[]) ?? []);
      const agrupado: Record<string, ItemParticipante[]> = {};
      ((ipCompra as ItemParticipante[]) ?? []).forEach((row) => {
        if (!agrupado[row.origen_id]) agrupado[row.origen_id] = [];
        agrupado[row.origen_id].push(row);
      });
      ((ipFijo as ItemParticipante[]) ?? []).forEach((row) => {
        if (!agrupado[row.origen_id]) agrupado[row.origen_id] = [];
        agrupado[row.origen_id].push(row);
      });
      setParticipantesPorItem(agrupado);
    } catch (err) {
      setError(mensajeError(err) || "No se pudieron cargar los movimientos.");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarTodo();
    window.addEventListener(EVENTO_MOVIMIENTO_GUARDADO, cargarTodo);
    return () => window.removeEventListener(EVENTO_MOVIMIENTO_GUARDADO, cargarTodo);
  }, []);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("buscar");
    if (q) setBusqueda(q);
  }, []);

  if (cargando) {
    return <p className="py-10 text-center text-gray-400 dark:text-gray-500">Cargando…</p>;
  }

  const hoyISO = mesActualISO();
  const hoyRef = mesRefActual();
  const refIso = isoDelMes(ref);
  const refMesTexto = refIso.slice(0, 7);
  const enMesActual = esMismoMes(ref, hoyRef);

  const categoriaDe = (id: string | null) => categorias.find((cat) => cat.id === id) ?? null;
  const entidadDe = (id: string | null) => entidades.find((e) => e.id === id) ?? null;
  const marcaDe = (id: string | null) => marcas.find((m) => m.id === id) ?? null;
  const marcaDeEntidad = (id: string | null) => resolverMarca(entidadDe(id), marcas);
  const nombrePersona = (id: string | null) => personas.find((p) => p.id === id)?.nombre ?? null;
  const pagoDe = (origen: "compra" | "gasto_fijo", origenId: string) =>
    pagos.find((p) => p.origen === origen && p.origen_id === origenId && p.mes === refIso) ?? null;

  const movCuotas: Movimiento[] = compras.flatMap((c) => {
    const cuotaActual = cuotaActualEn(c.fecha_primera_cuota, ref);
    if (cuotaActual < 1 || cuotaActual > c.n_cuotas) return [];
    const pago = pagoDe("compra", c.id);
    const monto = pago?.monto_real != null ? Number(pago.monto_real) : Math.round(c.monto_total / c.n_cuotas);
    return [
      {
        key: `cuota-${c.id}`,
        tipo: "cuota" as const,
        descripcion: c.descripcion,
        detalle: `Cuota ${cuotaActual} de ${c.n_cuotas}`,
        dia: diaDelMes(c.fecha_primera_cuota),
        monto,
        esPromedio: false,
        pagado: pago?.pagado ?? false,
        entidadId: c.entidad_id,
        marcaId: c.marca_id,
        icono: c.icono,
        origen: "compra" as const,
        origenId: c.id,
        categoriaId: c.categoria_id,
        grupoId: c.grupo_id,
      },
    ];
  });

  const movFijos: Movimiento[] = gastosFijos.map((g) => {
    const variable = g.tipo_monto === "variable";
    const pago = pagoDe("gasto_fijo", g.id);
    let monto: number;
    let esPromedio = false;
    if (pago?.monto_real != null) {
      monto = Number(pago.monto_real);
    } else if (variable) {
      const { promedio, meses } = promedioMovil(pagos, g.id, hoyISO, Number(g.monto_estimado));
      monto = promedio;
      esPromedio = meses > 0;
    } else {
      monto = Number(g.monto_estimado);
    }
    const categoria = categoriaDe(g.categoria_id);
    return {
      key: `fijo-${g.id}`,
      tipo: variable ? ("variable" as const) : ("fijo" as const),
      descripcion: g.descripcion,
      detalle: variable ? "Fijo de monto variable" : categoria?.nombre ?? "Gasto fijo",
      dia: g.dia_mes_pago,
      monto,
      esPromedio,
      pagado: pago?.pagado ?? false,
      entidadId: g.entidad_id,
      marcaId: g.marca_id,
      icono: g.icono,
      origen: "gasto_fijo" as const,
      origenId: g.id,
      categoriaId: g.categoria_id,
      grupoId: g.grupo_id,
    };
  });

  const movDiarios: Movimiento[] = gastosDiarios
    .filter((d) => d.fecha.slice(0, 7) === refMesTexto)
    .map((d) => {
      const categoria = categoriaDe(d.categoria_id);
      return {
        key: `diario-${d.id}`,
        tipo: "diario" as const,
        descripcion: d.descripcion,
        detalle: `Diario · ${categoria?.nombre ?? "Sin categoría"}`,
        dia: diaDelMes(d.fecha),
        monto: Number(d.monto),
        esPromedio: false,
        pagado: null,
        entidadId: null,
        marcaId: null,
        icono: categoria?.icono ?? null,
        categoriaId: d.categoria_id,
      };
    });

  const movIngresos: Movimiento[] = ingresos
    .filter((i) => i.mes.slice(0, 7) === refMesTexto)
    .map((i) => {
      const persona = nombrePersona(i.persona_id);
      return {
        key: `ingreso-${i.id}`,
        tipo: "ingreso" as const,
        descripcion: i.descripcion || persona || "Ingreso",
        detalle: i.descripcion && persona ? persona : "Ingreso",
        dia: diaDelMes(i.mes),
        monto: Number(i.monto),
        esPromedio: false,
        pagado: null,
        entidadId: null,
        marcaId: null,
        icono: "💰",
        personaId: i.persona_id,
      };
    });

  // Transferencias entre tus propias cuentas (ej. BancoEstado → Mercado
  // Pago): no son gasto ni ingreso (no afectan el balance del mes, ver
  // lib/types.ts), pero Felipe pidió verlas en el listado con una flecha
  // que indique de dónde salió y hacia dónde fue la plata.
  const movTransferencias: Movimiento[] = transferencias
    .filter((t) => t.fecha.slice(0, 7) === refMesTexto)
    .map((t) => ({
      key: `transferencia-${t.id}`,
      tipo: "transferencia" as const,
      descripcion: `${entidadDe(t.cuenta_origen_id)?.nombre ?? "Efectivo"} → ${entidadDe(t.cuenta_destino_id)?.nombre ?? "Efectivo"}`,
      detalle: t.notas || "Transferencia entre tus cuentas",
      dia: diaDelMes(t.fecha),
      monto: Number(t.monto),
      esPromedio: false,
      pagado: null,
      entidadId: null,
      marcaId: null,
      icono: "⇄",
      cuentaOrigenId: t.cuenta_origen_id,
      cuentaDestinoId: t.cuenta_destino_id,
      notas: t.notas,
    }));

  const todos = [...movCuotas, ...movFijos, ...movDiarios, ...movIngresos, ...movTransferencias];

  const totalGastos = [...movCuotas, ...movFijos, ...movDiarios].reduce((acc, m) => acc + m.monto, 0);
  const totalIngresos = movIngresos.reduce((acc, m) => acc + m.monto, 0);
  const balance = totalIngresos - totalGastos;

  const busquedaNormalizada = busqueda.trim().toLowerCase();
  const visibles = (
    vista === "todo" ? todos : vista === "ingresos" ? movIngresos : [...movCuotas, ...movFijos, ...movDiarios]
  )
    .filter((m) => !busquedaNormalizada || m.descripcion.toLowerCase().includes(busquedaNormalizada) || m.detalle.toLowerCase().includes(busquedaNormalizada))
    .sort((a, b) => {
    if (a.dia == null && b.dia == null) return 0;
    if (a.dia == null) return 1;
    if (b.dia == null) return -1;
    return b.dia - a.dia;
  });

  // Agrupados por día ("HOY · 13 SEP", "AYER · 12 SEP", "11 SEP" — calcado
  // del mockup, que agrupa los movimientos por fecha en vez de mostrar un
  // numerito de día en cada fila).
  const hoyDiaNumero = new Date().getDate();
  function etiquetaDia(dia: number): string {
    const fechaDia = `${refIso.slice(0, 7)}-${String(dia).padStart(2, "0")}`;
    const mesCorto = nombreMesCorto(fechaDia).toUpperCase();
    if (enMesActual && dia === hoyDiaNumero) return `Hoy · ${dia} ${mesCorto}`;
    if (enMesActual && dia === hoyDiaNumero - 1) return `Ayer · ${dia} ${mesCorto}`;
    return `${dia} ${mesCorto}`;
  }
  function fechaCorta(dia: number): string {
    const fechaDia = `${refIso.slice(0, 7)}-${String(dia).padStart(2, "0")}`;
    return `${dia} ${nombreMesCorto(fechaDia)}`;
  }
  const gruposDia: { label: string; items: typeof visibles }[] = [];
  visibles.forEach((m) => {
    const label = m.dia == null ? "Sin fecha" : etiquetaDia(m.dia);
    const grupoDia = gruposDia.find((g) => g.label === label);
    if (grupoDia) grupoDia.items.push(m);
    else gruposDia.push({ label, items: [m] });
  });

  function pill(activo: boolean) {
    return `shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
      activo
        ? "bg-gray-800 text-white dark:bg-white dark:text-black"
        : "bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400"
    }`;
  }

  return (
    <div className="space-y-4 pb-10">
      <div>
        <h1 className="text-lg font-bold text-gray-800 dark:text-white">Movimientos</h1>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Fijos, variables, cuotas, diarios, ingresos y transferencias entre tus cuentas, en un solo listado por mes.
        </p>
      </div>

      <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2.5 dark:border-white/10 dark:bg-gray-900">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-gray-400 dark:text-gray-500">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar movimiento (ej: supermercado, estacionamiento…)"
          className="w-full bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400 dark:text-gray-200 dark:placeholder:text-gray-500"
        />
        {busqueda && (
          <button type="button" onClick={() => setBusqueda("")} aria-label="Limpiar búsqueda" className="shrink-0 text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400">
            ✕
          </button>
        )}
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <button
            onClick={() => setRef(mesAnterior(ref))}
            aria-label="Mes anterior"
            className="rounded-full p-2 text-gray-400 hover:bg-gray-50 dark:text-gray-500 dark:hover:bg-white/5"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 6-6 6 6 6" />
            </svg>
          </button>
          <p className="text-sm font-bold capitalize text-gray-800 dark:text-white">{nombreMes(refIso)}</p>
          <button
            onClick={() => setRef(mesSiguiente(ref))}
            disabled={enMesActual}
            aria-label="Mes siguiente"
            className="rounded-full p-2 text-gray-400 hover:bg-gray-50 disabled:opacity-30 disabled:hover:bg-transparent dark:text-gray-500 dark:hover:bg-white/5"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 6 6 6-6 6" />
            </svg>
          </button>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-gray-50 pt-3 text-center dark:border-white/10">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Ingresos</p>
            <p className="mt-0.5 text-sm font-bold text-ingreso">{formatCLP(totalIngresos)}</p>
          </div>
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Gastos</p>
            <p className="mt-0.5 text-sm font-bold text-gray-800 dark:text-white">{formatCLP(totalGastos)}</p>
          </div>
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Balance</p>
            <p className={`mt-0.5 text-sm font-bold ${balance < 0 ? "text-gasto" : "text-gray-800 dark:text-white"}`}>
              {formatCLP(balance)}
            </p>
          </div>
        </div>
      </Card>

      <div className="flex gap-2">
        {VISTAS.map((v) => (
          <button key={v.id} onClick={() => setVista(v.id)} className={pill(vista === v.id)}>
            {v.label}
          </button>
        ))}
      </div>

      <Card>
        {visibles.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">Sin movimientos para este filtro.</p>
        ) : (
          <div className="space-y-4">
            {gruposDia.map((grupoDia) => (
              <div key={grupoDia.label}>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  {grupoDia.label}
                </p>
                <div className="divide-y divide-gray-100 dark:divide-white/10">
                  {grupoDia.items.map((m) => {
                    const marcaItem = marcaDe(m.marcaId);
                    const esIngreso = m.tipo === "ingreso";
                    const esTransferencia = m.tipo === "transferencia";
                    const puedeDividirse = m.origen != null && m.origenId != null;
                    return (
                      <button
                        type="button"
                        key={m.key}
                        onClick={() => setDetalleAbierto(m)}
                        className="flex w-full items-center gap-3 py-2.5 text-left first:pt-0 last:pb-0"
                      >
                        <EntidadAvatar
                          entidad={entidadDe(m.entidadId)}
                          marca={marcaItem ?? marcaDeEntidad(m.entidadId)}
                          icono={m.icono}
                          nombreFallback={m.descripcion}
                          className="h-9 w-9"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-700 dark:text-gray-200">{m.descripcion}</p>
                          <p className="truncate text-xs text-gray-400 dark:text-gray-500">
                            {m.detalle}
                            {m.pagado === true && <span className="ml-1.5 font-semibold text-emerald-500">· Pagado</span>}
                            {m.pagado === false && <span className="ml-1.5 text-gray-300 dark:text-gray-600">· Pendiente</span>}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-0.5">
                          <p
                            className={`text-sm font-semibold ${
                              esTransferencia ? "text-gray-500 dark:text-gray-400" : esIngreso ? "text-ingreso" : "text-gasto"
                            }`}
                          >
                            {!esTransferencia && (esIngreso ? "+" : "-")}
                            {m.esPromedio && <span className="mr-0.5 font-normal text-gray-400 dark:text-gray-500">~</span>}
                            {formatCLP(m.monto)}
                          </p>
                          {puedeDividirse && (
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(e) => {
                                e.stopPropagation();
                                setDividiendo(m);
                              }}
                              className="text-[11px] font-semibold text-brand-from dark:text-white"
                            >
                              Dividir
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {error && <p className="text-center text-xs text-red-500 dark:text-red-400">{error}</p>}

      {dividiendo && dividiendo.origen && dividiendo.origenId && (
        <DividirGastoSheet
          item={{
            origen: dividiendo.origen,
            origenId: dividiendo.origenId,
            descripcion: dividiendo.descripcion,
            categoriaNombre: categoriaDe(dividiendo.categoriaId ?? null)?.nombre ?? "Sin categoría",
            fechaLabel: dividiendo.dia != null ? fechaCorta(dividiendo.dia) : "Sin fecha",
            monto: dividiendo.monto,
            grupoId: dividiendo.grupoId ?? null,
          }}
          grupos={grupos}
          personas={personas}
          participantesActuales={participantesPorItem[dividiendo.origenId] ?? []}
          onClose={() => setDividiendo(null)}
          onGuardado={cargarTodo}
        />
      )}

      {detalleAbierto && (() => {
        const m = detalleAbierto;
        const esIngreso = m.tipo === "ingreso";
        const esTransferencia = m.tipo === "transferencia";
        const metodoPago = esTransferencia
          ? null
          : m.entidadId
          ? entidadDe(m.entidadId)?.nombre ?? "Efectivo"
          : "Efectivo";
        const participantes = m.origenId ? participantesPorItem[m.origenId] ?? [] : [];
        return (
          <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center" onClick={() => setDetalleAbierto(null)}>
            <div
              className="max-h-[85vh] w-full overflow-y-auto rounded-t-3xl bg-white text-gray-800 dark:bg-[#111113] dark:text-white sm:max-w-md sm:rounded-3xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 z-10 flex items-start justify-between gap-2 rounded-t-3xl bg-white p-5 pb-3 dark:bg-[#111113]">
                <div className="min-w-0">
                  <p className="truncate text-base font-bold">{m.descripcion}</p>
                  <p className="text-xs text-gray-400 dark:text-white/50">{m.dia != null ? fechaCorta(m.dia) : "Sin fecha"}</p>
                </div>
                <button
                  onClick={() => setDetalleAbierto(null)}
                  aria-label="Cerrar"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-white/10"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 p-5 pt-0">
                <p
                  className={`text-3xl font-bold ${
                    esTransferencia ? "text-gray-700 dark:text-gray-200" : esIngreso ? "text-ingreso" : "text-gasto"
                  }`}
                >
                  {!esTransferencia && (esIngreso ? "+" : "-")}
                  {formatCLP(m.monto)}
                </p>

                <div className="divide-y divide-gray-100 rounded-2xl border border-gray-100 dark:divide-white/10 dark:border-white/10">
                  {!esTransferencia && (
                    <div className="flex items-center justify-between px-3.5 py-2.5 text-sm">
                      <span className="text-gray-400 dark:text-white/50">Pagado con</span>
                      <span className="font-semibold">{metodoPago}</span>
                    </div>
                  )}
                  {!esTransferencia && !esIngreso && (
                    <div className="flex items-center justify-between px-3.5 py-2.5 text-sm">
                      <span className="text-gray-400 dark:text-white/50">Categoría</span>
                      <span className="font-semibold">{categoriaDe(m.categoriaId ?? null)?.nombre ?? "Sin categoría"}</span>
                    </div>
                  )}
                  {m.tipo === "cuota" && (
                    <div className="flex items-center justify-between px-3.5 py-2.5 text-sm">
                      <span className="text-gray-400 dark:text-white/50">Cuotas</span>
                      <span className="font-semibold">{m.detalle}</span>
                    </div>
                  )}
                  {esIngreso && (
                    <div className="flex items-center justify-between px-3.5 py-2.5 text-sm">
                      <span className="text-gray-400 dark:text-white/50">De quién</span>
                      <span className="font-semibold">{nombrePersona(m.personaId ?? null) ?? "—"}</span>
                    </div>
                  )}
                  {esTransferencia && (
                    <>
                      <div className="flex items-center justify-between px-3.5 py-2.5 text-sm">
                        <span className="text-gray-400 dark:text-white/50">Desde</span>
                        <span className="font-semibold">{entidadDe(m.cuentaOrigenId ?? null)?.nombre ?? "Efectivo"}</span>
                      </div>
                      <div className="flex items-center justify-between px-3.5 py-2.5 text-sm">
                        <span className="text-gray-400 dark:text-white/50">Hacia</span>
                        <span className="font-semibold">{entidadDe(m.cuentaDestinoId ?? null)?.nombre ?? "Efectivo"}</span>
                      </div>
                    </>
                  )}
                  {!esTransferencia && !esIngreso && (
                    <div className="flex items-center justify-between px-3.5 py-2.5 text-sm">
                      <span className="text-gray-400 dark:text-white/50">Compartido</span>
                      <span className="font-semibold">
                        {participantes.length === 0
                          ? "No"
                          : participantes.length === 1
                          ? "No · asignado a " + (nombrePersona(participantes[0].persona_id) ?? "—")
                          : `Sí · ${participantes.map((p) => nombrePersona(p.persona_id) ?? "—").join(", ")}`}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
