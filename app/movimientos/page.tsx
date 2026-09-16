"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/Card";
import { DividirGastoSheet, ItemADividir } from "@/components/DividirGastoSheet";
import { EntidadAvatar } from "@/components/EntidadAvatar";
import { EntidadPicker } from "@/components/EntidadPicker";
import { MarcaSugeridaPicker } from "@/components/MarcaSugeridaPicker";
import { EVENTO_MOVIMIENTO_GUARDADO } from "@/components/MovimientoRapido";
import { fechaPrimeraCuotaDesde } from "@/lib/cuotas";
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
import { colorAnilloPresupuesto } from "@/lib/colorPresupuesto";
import { Categoria, Compra, Entidad, GastoDiario, GastoFijo, Grupo, Ingreso, ItemParticipante, Marca, OrigenItem, Pago, Persona, PresupuestoCategoria, Transferencia } from "@/lib/types";

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
  // Ronda 12: id de la fila real detrás de este movimiento (compras.id,
  // gastos_fijos.id, gastos_diarios.id, ingresos.id o transferencias.id) —
  // antes solo cuota/fijo lo tenían (como `origenId`, para "Dividir"). Ahora
  // TODOS los tipos lo necesitan para poder editar/eliminar directo desde
  // acá (ver Feature "Editar movimiento" más abajo).
  id: string;
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
  const [presupuestos, setPresupuestos] = useState<PresupuestoCategoria[]>([]);
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
  // Movimiento en el que se hizo clic para ver su detalle — ver Feature I.
  // Ronda 12: Felipe pidió poder "editar los movimientos, para confirmar o
  // eliminar por repetido o error" (varios gastos diarios cargados dos
  // veces por error, ej. transferencias a una persona) — esta hoja, que
  // antes era de solo lectura, ahora tiene un modo edición (mismos campos
  // que cada pestaña de Gastos/Ingresos ya deja tocar, pero sin salir de
  // Movimientos) y un botón Eliminar, para los 5 tipos de movimiento.
  const [detalleAbierto, setDetalleAbierto] = useState<Movimiento | null>(null);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [errorEdicion, setErrorEdicion] = useState("");
  const [fDescripcion, setFDescripcion] = useState("");
  const [fMonto, setFMonto] = useState(""); // cuota: valor de LA CUOTA (no el total)
  const [fNCuotas, setFNCuotas] = useState("2");
  const [fCuotaActual, setFCuotaActual] = useState("1");
  const [fFecha, setFFecha] = useState(""); // diario / ingreso (mes) / transferencia
  const [fEntidadId, setFEntidadId] = useState("");
  const [fCategoriaId, setFCategoriaId] = useState("");
  const [fMarcaId, setFMarcaId] = useState("");
  const [fTipoMonto, setFTipoMonto] = useState<"fijo" | "variable">("fijo");
  const [fPersonaId, setFPersonaId] = useState("");
  const [fCuentaOrigenId, setFCuentaOrigenId] = useState("");
  const [fCuentaDestinoId, setFCuentaDestinoId] = useState("");
  const [fNotas, setFNotas] = useState("");

  async function cargarTodo() {
    try {
      const [{ data: c }, { data: gf }, { data: gd }, { data: ing }, { data: tr }, { data: pg }, { data: cat }, { data: e }, { data: m }, { data: p }, { data: gr }, { data: ipCompra }, { data: ipFijo }, { data: pc }] =
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
          supabase.from("presupuestos_categoria").select("*"),
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
      setPresupuestos((pc as PresupuestoCategoria[]) ?? []);
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

  // Ronda 12 — abrir el detalle de un movimiento: precarga TODOS los campos
  // editables de una vez (sin importar si el usuario termina tocando
  // "Editar" o no), así ese botón solo cambia de vista, sin ir a buscar
  // datos de nuevo. Cada tipo lee sus propios campos extra desde su tabla
  // de origen (compras/gastosFijos, ya cargadas en esta pantalla).
  function abrirDetalle(m: Movimiento) {
    setDetalleAbierto(m);
    setModoEdicion(false);
    setErrorEdicion("");
    setFDescripcion(m.descripcion);
    setFEntidadId(m.entidadId ?? "");
    setFCategoriaId(m.categoriaId ?? "");
    setFMarcaId(m.marcaId ?? "");
    setFPersonaId(m.personaId ?? "");
    setFCuentaOrigenId(m.cuentaOrigenId ?? "");
    setFCuentaDestinoId(m.cuentaDestinoId ?? "");
    setFNotas(m.notas ?? "");
    if (m.tipo === "cuota") {
      const c = compras.find((x) => x.id === m.id);
      setFMonto(String(m.monto));
      setFNCuotas(String(c?.n_cuotas ?? 1));
      setFCuotaActual(String(cuotaActualEn(c?.fecha_primera_cuota ?? refIso, ref)));
    } else if (m.tipo === "fijo" || m.tipo === "variable") {
      const g = gastosFijos.find((x) => x.id === m.id);
      setFMonto(String(g?.monto_estimado ?? m.monto));
      setFTipoMonto(g?.tipo_monto ?? "fijo");
      setFFecha(String(g?.dia_mes_pago ?? 1));
    } else if (m.tipo === "diario") {
      const d = gastosDiarios.find((x) => x.id === m.id);
      setFMonto(String(m.monto));
      setFFecha(d?.fecha ?? refIso);
    } else if (m.tipo === "ingreso") {
      const i = ingresos.find((x) => x.id === m.id);
      setFMonto(String(m.monto));
      setFFecha(i?.mes ?? refIso);
    } else if (m.tipo === "transferencia") {
      const t = transferencias.find((x) => x.id === m.id);
      setFMonto(String(m.monto));
      setFFecha(t?.fecha ?? refIso);
    }
  }

  async function guardarEdicion() {
    if (!detalleAbierto) return;
    const m = detalleAbierto;
    setErrorEdicion("");
    setGuardandoEdicion(true);
    try {
      if (m.tipo === "cuota") {
        const nCuotasNum = Math.max(1, Number(fNCuotas) || 1);
        const cuotaActualNum = Math.min(Math.max(1, Number(fCuotaActual) || 1), nCuotasNum);
        const c = compras.find((x) => x.id === m.id);
        const diaVencimiento = diaDelMes(c?.fecha_primera_cuota ?? refIso);
        const { error: err } = await supabase
          .from("compras")
          .update({
            descripcion: fDescripcion,
            monto_total: Math.round(Number(fMonto) * nCuotasNum),
            n_cuotas: nCuotasNum,
            fecha_primera_cuota: fechaPrimeraCuotaDesde(cuotaActualNum, diaVencimiento, refIso),
            entidad_id: fEntidadId || null,
            categoria_id: fCategoriaId || null,
            marca_id: fMarcaId || null,
          })
          .eq("id", m.id);
        if (err) throw err;
      } else if (m.tipo === "fijo" || m.tipo === "variable") {
        const { error: err } = await supabase
          .from("gastos_fijos")
          .update({
            descripcion: fDescripcion,
            monto_estimado: Number(fMonto),
            dia_mes_pago: Number(fFecha) || 1,
            tipo_monto: fTipoMonto,
            entidad_id: fEntidadId || null,
            categoria_id: fCategoriaId || null,
            marca_id: fMarcaId || null,
          })
          .eq("id", m.id);
        if (err) throw err;
      } else if (m.tipo === "diario") {
        const { error: err } = await supabase
          .from("gastos_diarios")
          .update({
            descripcion: fDescripcion,
            monto: Number(fMonto),
            fecha: fFecha,
            entidad_id: fEntidadId || null,
            categoria_id: fCategoriaId || null,
            marca_id: fMarcaId || null,
          })
          .eq("id", m.id);
        if (err) throw err;
      } else if (m.tipo === "ingreso") {
        const { error: err } = await supabase
          .from("ingresos")
          .update({
            descripcion: fDescripcion || null,
            monto: Number(fMonto),
            mes: fFecha,
            persona_id: fPersonaId || null,
          })
          .eq("id", m.id);
        if (err) throw err;
      } else if (m.tipo === "transferencia") {
        const { error: err } = await supabase
          .from("transferencias")
          .update({
            monto: Number(fMonto),
            fecha: fFecha,
            cuenta_origen_id: fCuentaOrigenId || null,
            cuenta_destino_id: fCuentaDestinoId || null,
            notas: fNotas || null,
          })
          .eq("id", m.id);
        if (err) throw err;
      }
      setDetalleAbierto(null);
      await cargarTodo();
    } catch (err) {
      setErrorEdicion(mensajeError(err) || "No se pudo guardar. Intenta de nuevo.");
    } finally {
      setGuardandoEdicion(false);
    }
  }

  // "Eliminar" borra el registro completo (todos los meses, si es un
  // recurrente/cuota) — sin diálogo de confirmación, mismo criterio sin
  // confirmación que ya usan "eliminar"/"borrar" en Cuotas, Diarios e
  // Ingresos. Los gastos fijos/variables se "quitan" (activo=false, no un
  // borrado real) porque meses anteriores ya pagados siguen apuntando a su
  // id desde `pagos` — mismo criterio que ya usa Gastos > Recurrente.
  async function eliminarMovimiento() {
    if (!detalleAbierto) return;
    const m = detalleAbierto;
    setErrorEdicion("");
    setGuardandoEdicion(true);
    try {
      let err = null;
      if (m.tipo === "cuota") {
        ({ error: err } = await supabase.from("compras").delete().eq("id", m.id));
        if (!err) await supabase.from("item_participantes").delete().eq("origen", "compra").eq("origen_id", m.id);
      } else if (m.tipo === "fijo" || m.tipo === "variable") {
        ({ error: err } = await supabase.from("gastos_fijos").update({ activo: false }).eq("id", m.id));
      } else if (m.tipo === "diario") {
        ({ error: err } = await supabase.from("gastos_diarios").delete().eq("id", m.id));
      } else if (m.tipo === "ingreso") {
        ({ error: err } = await supabase.from("ingresos").delete().eq("id", m.id));
      } else if (m.tipo === "transferencia") {
        ({ error: err } = await supabase.from("transferencias").delete().eq("id", m.id));
      }
      if (err) throw err;
      setDetalleAbierto(null);
      await cargarTodo();
    } catch (err) {
      setErrorEdicion(mensajeError(err) || "No se pudo eliminar. Intenta de nuevo.");
    } finally {
      setGuardandoEdicion(false);
    }
  }

  const movCuotas: Movimiento[] = compras.flatMap((c) => {
    const cuotaActual = cuotaActualEn(c.fecha_primera_cuota, ref);
    if (cuotaActual < 1 || cuotaActual > c.n_cuotas) return [];
    const pago = pagoDe("compra", c.id);
    const monto = pago?.monto_real != null ? Number(pago.monto_real) : Math.round(c.monto_total / c.n_cuotas);
    return [
      {
        key: `cuota-${c.id}`,
        id: c.id,
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
      id: g.id,
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
        id: d.id,
        tipo: "diario" as const,
        descripcion: d.descripcion,
        detalle: `Diario · ${categoria?.nombre ?? "Sin categoría"}`,
        dia: diaDelMes(d.fecha),
        monto: Number(d.monto),
        esPromedio: false,
        pagado: null,
        entidadId: d.entidad_id,
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
        id: i.id,
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
      id: t.id,
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

  // Franja de presupuesto por categoría (ronda 7 del rediseño) — Felipe
  // pidió ver, en el mismo listado de Movimientos, cuánto presupuesto le
  // queda por categoría, coloreado verde/amarillo/naranjo/rojo. Se muestran
  // TODAS las categorías con presupuesto asignado (sin filtro), calculadas
  // sobre el mes que se esté mirando (`ref`) — mismas 3 fuentes que
  // gastoPorCategoriaId de Inicio/Presupuesto (cuotas + fijos + diarios, sin
  // ingresos ni transferencias, que no son gasto real).
  const gastoPorCategoriaId: Record<string, number> = {};
  [...movCuotas, ...movFijos, ...movDiarios].forEach((m) => {
    if (!m.categoriaId) return;
    gastoPorCategoriaId[m.categoriaId] = (gastoPorCategoriaId[m.categoriaId] ?? 0) + m.monto;
  });
  const categoriasConPresupuesto = presupuestos
    .map((p) => ({ presupuesto: p, categoria: categoriaDe(p.categoria_id) }))
    .filter((x): x is { presupuesto: PresupuestoCategoria; categoria: Categoria } => x.categoria != null)
    .sort((a, b) => a.categoria.nombre.localeCompare(b.categoria.nombre));

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

      <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2.5 dark:border-white/10 dark:bg-neutral-900">
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

      {categoriasConPresupuesto.length > 0 && (
        // Franja horizontal con el presupuesto restante de cada categoría
        // (ver cálculo de categoriasConPresupuesto/gastoPorCategoriaId más
        // arriba) — mismo esquema de color por umbral que los anillos de
        // /presupuesto (lib/colorPresupuesto.ts), pero en formato barra para
        // que quepan varias categorías de un vistazo en un scroll horizontal.
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="flex gap-2.5" style={{ width: "max-content" }}>
            {categoriasConPresupuesto.map(({ presupuesto, categoria }) => {
              const gastado = gastoPorCategoriaId[categoria.id] ?? 0;
              const monto = Number(presupuesto.monto_mensual);
              const sobrepasado = gastado > monto;
              const pct = monto > 0 ? Math.min(100, (gastado / monto) * 100) : 0;
              const color = colorAnilloPresupuesto(gastado, monto);
              const restante = sobrepasado ? gastado - monto : Math.max(0, monto - gastado);
              return (
                <div key={categoria.id} className="w-36 shrink-0 rounded-2xl border border-gray-100 bg-white p-3 dark:border-white/10 dark:bg-neutral-900">
                  <p className="flex items-center gap-1.5 truncate text-xs font-semibold text-gray-700 dark:text-gray-200">
                    <span>{categoria.icono || "🏷️"}</span>
                    <span className="truncate">{categoria.nombre}</span>
                  </p>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                    <div className="h-full rounded-full transition-[width]" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                  <p className="mt-1.5 text-[10.5px] text-gray-400 dark:text-gray-500">
                    <span className="font-semibold" style={{ color }}>
                      {formatCLP(restante)}
                    </span>{" "}
                    {sobrepasado ? "excedido" : "disponible"}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
                        onClick={() => abrirDetalle(m)}
                        className="flex w-full items-center gap-3 py-2.5 text-left first:pt-0 last:pb-0"
                      >
                        {esTransferencia ? (
                          // Ícono fijo (no el color hash-por-nombre de
                          // EntidadAvatar, que variaría según qué 2 cuentas
                          // se movió la plata) — Felipe pidió que las
                          // transferencias entre sus propias cuentas se
                          // reconozcan de un vistazo con una flecha, siempre
                          // igual, en vez de mezclarse con el resto de íconos.
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-300">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                              <path d="M7 7h11l-3-3" />
                              <path d="M17 17H6l3 3" />
                            </svg>
                          </span>
                        ) : (
                          <EntidadAvatar
                            entidad={entidadDe(m.entidadId)}
                            marca={marcaItem ?? marcaDeEntidad(m.entidadId)}
                            icono={m.icono}
                            nombreFallback={m.descripcion}
                            className="h-9 w-9"
                          />
                        )}
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
        const esCuota = m.tipo === "cuota";
        const esFijo = m.tipo === "fijo" || m.tipo === "variable";
        const metodoPago = esTransferencia
          ? null
          : m.entidadId
          ? entidadDe(m.entidadId)?.nombre ?? "Efectivo"
          : "Efectivo";
        const participantes = m.origenId ? participantesPorItem[m.origenId] ?? [] : [];
        const categoriaSelEdicion = categoriaDe(fCategoriaId || null);
        // createPortal: este detalle se renderiza como hijo directo de
        // <body>, no del listado de movimientos — así, sin importar en qué
        // parte del scroll de la página esté montado este componente (el
        // botón "Ver todas"/las filas viven adentro del <Card> con el
        // listado), la hoja SIEMPRE se dibuja fija sobre el viewport actual
        // en vez de aparecer en el punto del documento donde React la
        // insertó (lo que antes obligaba a bajar el scroll de toda la
        // página hasta el final para verla). "dvh" en vez de "vh" evita que
        // la barra de direcciones del celular la deje más alta de lo que
        // realmente se ve.
        return createPortal(
          <div
            className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 px-0 backdrop-blur-sm sm:items-center sm:px-4"
            onClick={() => setDetalleAbierto(null)}
          >
            <div
              // Ronda 8: sm:max-w-md → sm:max-w-xl (auditoría de UX de
              // escritorio, mismo motivo que el detalle de /tarjetas).
              className="max-h-[85dvh] w-full overflow-y-auto rounded-t-3xl bg-white text-gray-800 shadow-2xl dark:bg-[#111113] dark:text-white sm:max-w-xl sm:rounded-3xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 z-10 flex items-start justify-between gap-2 rounded-t-3xl bg-white p-5 pb-3 dark:bg-[#111113]">
                <div className="min-w-0">
                  <p className="truncate text-base font-bold">{modoEdicion ? "Editar movimiento" : m.descripcion}</p>
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

              {!modoEdicion ? (
                <div className="space-y-3 p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-0">
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

                  {errorEdicion && <p className="text-xs text-red-500 dark:text-red-400">{errorEdicion}</p>}

                  {/* Ronda 12: "editar/eliminar por repetido o error" — Dividir
                      (reparto entre personas) sigue siendo un botón aparte en
                      cada fila del listado, no se duplica acá. */}
                  <div className="flex gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setModoEdicion(true)}
                      className="flex-1 rounded-2xl bg-gray-100 py-3 text-sm font-semibold text-gray-700 dark:bg-white/10 dark:text-gray-200"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={eliminarMovimiento}
                      disabled={guardandoEdicion}
                      className="rounded-2xl bg-gray-100 px-5 py-3 text-sm font-semibold text-gray-400 disabled:opacity-60 dark:bg-white/10 dark:text-gray-500 hover:text-red-400"
                    >
                      {guardandoEdicion ? "Eliminando…" : "Eliminar"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-0">
                  <div>
                    <label className="text-[11px] font-medium text-gray-400 dark:text-gray-500">Descripción</label>
                    <input
                      value={fDescripcion}
                      onChange={(e) => setFDescripcion(e.target.value)}
                      disabled={esTransferencia}
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-medium text-gray-400 dark:text-gray-500">
                        {esCuota ? "Valor de la cuota" : "Monto"}
                      </label>
                      <input
                        type="number"
                        value={fMonto}
                        onChange={(e) => setFMonto(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
                      />
                    </div>
                    {esCuota && (
                      <div>
                        <label className="text-[11px] font-medium text-gray-400 dark:text-gray-500">N° de cuotas</label>
                        <input
                          type="number"
                          min={1}
                          value={fNCuotas}
                          onChange={(e) => setFNCuotas(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
                        />
                      </div>
                    )}
                    {(m.tipo === "diario" || esIngreso || esTransferencia) && (
                      <div>
                        <label className="text-[11px] font-medium text-gray-400 dark:text-gray-500">Fecha</label>
                        <input
                          type="date"
                          value={fFecha.slice(0, 10)}
                          onChange={(e) => setFFecha(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
                        />
                      </div>
                    )}
                    {esFijo && (
                      <div>
                        <label className="text-[11px] font-medium text-gray-400 dark:text-gray-500">Día de pago</label>
                        <input
                          type="number"
                          min={1}
                          max={31}
                          value={fFecha}
                          onChange={(e) => setFFecha(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
                        />
                      </div>
                    )}
                  </div>

                  {esCuota && (
                    <div>
                      <label className="text-[11px] font-medium text-gray-400 dark:text-gray-500">¿En qué cuota vas?</label>
                      <input
                        type="number"
                        min={1}
                        max={Number(fNCuotas) || undefined}
                        value={fCuotaActual}
                        onChange={(e) => setFCuotaActual(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
                      />
                    </div>
                  )}

                  {esFijo && (
                    <div>
                      <label className="text-[11px] font-medium text-gray-400 dark:text-gray-500">¿Cobra siempre lo mismo?</label>
                      <div className="mt-1 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setFTipoMonto("fijo")}
                          className={`rounded-lg border px-3 py-2 text-left text-xs font-medium ${
                            fTipoMonto === "fijo"
                              ? "border-brand-from bg-gray-50 text-brand-from dark:bg-white/10 dark:text-white"
                              : "border-gray-200 text-gray-500 dark:border-white/10 dark:text-gray-400"
                          }`}
                        >
                          Monto fijo
                        </button>
                        <button
                          type="button"
                          onClick={() => setFTipoMonto("variable")}
                          className={`rounded-lg border px-3 py-2 text-left text-xs font-medium ${
                            fTipoMonto === "variable"
                              ? "border-brand-from bg-gray-50 text-brand-from dark:bg-white/10 dark:text-white"
                              : "border-gray-200 text-gray-500 dark:border-white/10 dark:text-gray-400"
                          }`}
                        >
                          Monto variable
                        </button>
                      </div>
                    </div>
                  )}

                  {esIngreso && (
                    <div>
                      <label className="text-[11px] font-medium text-gray-400 dark:text-gray-500">Persona</label>
                      <select
                        value={fPersonaId}
                        onChange={(e) => setFPersonaId(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
                      >
                        <option value="">—</option>
                        {personas.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {esTransferencia && (
                    <>
                      <div>
                        <label className="text-[11px] font-medium text-gray-400 dark:text-gray-500">Desde</label>
                        <select
                          value={fCuentaOrigenId}
                          onChange={(e) => setFCuentaOrigenId(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
                        >
                          <option value="">Efectivo</option>
                          {entidades.map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.nombre}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-gray-400 dark:text-gray-500">Hacia</label>
                        <select
                          value={fCuentaDestinoId}
                          onChange={(e) => setFCuentaDestinoId(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
                        >
                          <option value="">Efectivo</option>
                          {entidades.map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.nombre}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-gray-400 dark:text-gray-500">Notas (opcional)</label>
                        <input
                          value={fNotas}
                          onChange={(e) => setFNotas(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
                        />
                      </div>
                    </>
                  )}

                  {!esTransferencia && !esIngreso && (
                    <div>
                      <label className="text-[11px] font-medium text-gray-400 dark:text-gray-500">Cuenta o tarjeta</label>
                      <div className="mt-1">
                        <EntidadPicker
                          entidades={entidades}
                          marcas={marcas}
                          value={fEntidadId}
                          onChange={setFEntidadId}
                          onCatalogoActualizado={cargarTodo}
                        />
                      </div>
                    </div>
                  )}

                  {!esTransferencia && !esIngreso && (
                    <div>
                      <label className="text-[11px] font-medium text-gray-400 dark:text-gray-500">Categoría</label>
                      <select
                        value={fCategoriaId}
                        onChange={(e) => {
                          const nuevaCategoria = categoriaDe(e.target.value || null);
                          if (nuevaCategoria?.tipo_marca_sugerido !== categoriaSelEdicion?.tipo_marca_sugerido) setFMarcaId("");
                          setFCategoriaId(e.target.value);
                        }}
                        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
                      >
                        <option value="">Sin categoría</option>
                        {categorias.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.icono ? `${c.icono} ` : ""}
                            {c.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {!esTransferencia && !esIngreso && categoriaSelEdicion?.tipo_marca_sugerido && (
                    <div>
                      <label className="text-[11px] font-medium text-gray-400 dark:text-gray-500">
                        ¿Cuál {categoriaSelEdicion.nombre.toLowerCase()}? (opcional)
                      </label>
                      <div className="mt-1">
                        <MarcaSugeridaPicker
                          marcas={marcas}
                          tipo={categoriaSelEdicion.tipo_marca_sugerido}
                          value={fMarcaId}
                          onChange={setFMarcaId}
                          onCatalogoActualizado={cargarTodo}
                        />
                      </div>
                    </div>
                  )}

                  {errorEdicion && <p className="text-xs text-red-500 dark:text-red-400">{errorEdicion}</p>}

                  <div className="flex gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={guardarEdicion}
                      disabled={guardandoEdicion || !fDescripcion.trim()}
                      className="flex-1 rounded-2xl bg-brand-gradient py-3 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {guardandoEdicion ? "Guardando…" : "Guardar cambios"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setModoEdicion(false)}
                      className="rounded-2xl bg-gray-100 px-5 py-3 text-sm font-semibold text-gray-500 dark:bg-white/10 dark:text-gray-300"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>,
          document.body
        );
      })()}
    </div>
  );
}
