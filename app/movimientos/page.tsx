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
import { Categoria, Compra, Entidad, GastoDiario, GastoFijo, Grupo, Ingreso, ItemParticipante, Marca, OrigenItem, Pago, Persona } from "@/lib/types";

type TipoMovimiento = "fijo" | "variable" | "cuota" | "diario" | "ingreso";

const TIPOS: { id: TipoMovimiento; label: string }[] = [
  { id: "fijo", label: "Fijos" },
  { id: "variable", label: "Variables" },
  { id: "cuota", label: "Cuotas" },
  { id: "diario", label: "Diarios" },
  { id: "ingreso", label: "Ingresos" },
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
  const [filtros, setFiltros] = useState<TipoMovimiento[]>([]);
  // Movimiento en el que se abrió "Dividir gasto" (mockup PDF pág. 13) — ver
  // DividirGastoSheet.tsx. Solo cuotas/fijos/variables tienen esta opción.
  const [dividiendo, setDividiendo] = useState<Movimiento | null>(null);

  async function cargarTodo() {
    try {
      const [{ data: c }, { data: gf }, { data: gd }, { data: ing }, { data: pg }, { data: cat }, { data: e }, { data: m }, { data: p }, { data: gr }, { data: ipCompra }, { data: ipFijo }] =
        await Promise.all([
          supabase.from("compras").select("*"),
          supabase.from("gastos_fijos").select("*").eq("activo", true),
          supabase.from("gastos_diarios").select("*"),
          supabase.from("ingresos").select("*"),
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
      };
    });

  const todos = [...movCuotas, ...movFijos, ...movDiarios, ...movIngresos];

  const totalGastos = [...movCuotas, ...movFijos, ...movDiarios].reduce((acc, m) => acc + m.monto, 0);
  const totalIngresos = movIngresos.reduce((acc, m) => acc + m.monto, 0);
  const balance = totalIngresos - totalGastos;

  const visibles = (filtros.length === 0 ? todos : todos.filter((m) => filtros.includes(m.tipo))).sort((a, b) => {
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

  function toggleFiltro(tipo: TipoMovimiento) {
    setFiltros((actual) => (actual.includes(tipo) ? actual.filter((t) => t !== tipo) : [...actual, tipo]));
  }

  function pill(activo: boolean) {
    return `shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
      activo
        ? "bg-gray-50 text-brand-from dark:bg-white/10 dark:text-white"
        : "bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400"
    }`;
  }

  return (
    <div className="space-y-4 pb-10">
      <div>
        <h1 className="text-lg font-bold text-gray-800 dark:text-white">Movimientos</h1>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Fijos, variables, cuotas, diarios e ingresos, en un solo listado por mes.
        </p>
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

      <div className="flex gap-2 overflow-x-auto pb-1">
        <button onClick={() => setFiltros([])} className={pill(filtros.length === 0)}>
          Todos
        </button>
        {TIPOS.map((t) => (
          <button key={t.id} onClick={() => toggleFiltro(t.id)} className={pill(filtros.includes(t.id))}>
            {t.label}
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
                    const puedeDividirse = m.origen != null && m.origenId != null;
                    return (
                      <div key={m.key} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
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
                          <p className={`text-sm font-semibold ${esIngreso ? "text-ingreso" : "text-gasto"}`}>
                            {esIngreso ? "+" : "-"}
                            {m.esPromedio && <span className="mr-0.5 font-normal text-gray-400 dark:text-gray-500">~</span>}
                            {formatCLP(m.monto)}
                          </p>
                          {puedeDividirse && (
                            <button onClick={() => setDividiendo(m)} className="text-[11px] font-semibold text-brand-from dark:text-white">
                              Dividir
                            </button>
                          )}
                        </div>
                      </div>
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
    </div>
  );
}
