"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/Card";
import { EntidadAvatar } from "@/components/EntidadAvatar";
import { EntidadPicker } from "@/components/EntidadPicker";
import { IconoPicker } from "@/components/IconoPicker";
import { MarcaSugeridaPicker } from "@/components/MarcaSugeridaPicker";
import { ParticipantesPicker } from "@/components/ParticipantesPicker";
import { fechaPrimeraCuotaDesde } from "@/lib/cuotas";
import { diaDelMes, formatCLP, mesActualISO, primerDiaMesSiguiente } from "@/lib/format";
import { mensajeError } from "@/lib/supabaseError";
import {
  Categoria,
  CategoriaGrupoPreferido,
  CompraVigente,
  Entidad,
  GastoDiario,
  GastoFijo,
  Grupo,
  ItemParticipante,
  Marca,
  Participante,
  Persona,
  RepartoCuota,
  RepartoGastoDiario,
  RepartoGastoFijo,
} from "@/lib/types";

type TipoItem = "cuota" | "fijo" | "diario";

type ItemFila = {
  key: string;
  tipo: TipoItem;
  id: string;
  descripcion: string;
  entidad: string;
  detalle: string;
  monto: number;
  marcaId: string | null;
  icono: string | null;
  reparto: { persona_nombre: string; monto_persona: number }[];
};

const hoyISO = () => new Date().toISOString().slice(0, 10);

// Pantalla de detalle de UNA categoría del catálogo compartido (ej.
// "Educación (colegio, cursos)", "Feria") — se llega acá desde "Personalizar
// menú" del sidebar de escritorio (ver DesktopSidebar.tsx), a pedido del
// usuario ("un ícono de educación"). Es la cuarta dimensión de anclaje del
// menú lateral, junto a /entidad/[id] (medio de pago), /marca/[id] (marca
// del producto) y /grupo/[id] (reparto): esta filtra por categoria_id, sin
// importar quién lo paga, con qué marca, ni con quién se reparte.
//
// A diferencia de /entidad/[id] y /marca/[id] (que fijan entidad_id o
// marca_id), acá el que queda fijo es categoria_id — el resto de los campos
// (medio de pago, marca del producto, grupo o personas) quedan libres, igual
// que en el resto de la app, incluido el auto-completado del grupo por
// defecto de esta categoría (ver Grupos y migration_26_reparto_por_categoria.sql).
// Incluye Diarios además de Cuotas/Gastos fijos (a diferencia de /entidad y
// /marca) porque un gasto diario SIEMPRE tiene una categoría — es la
// dimensión más natural para ese tipo de ítem.
export default function CategoriaDetallePage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const [categoria, setCategoria] = useState<Categoria | null>(null);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [entidades, setEntidades] = useState<Entidad[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [grupoPorDefecto, setGrupoPorDefecto] = useState("");
  const [cuotas, setCuotas] = useState<CompraVigente[]>([]);
  const [gastosFijos, setGastosFijos] = useState<GastoFijo[]>([]);
  const [diarios, setDiarios] = useState<GastoDiario[]>([]);
  const [repartoCuotas, setRepartoCuotas] = useState<RepartoCuota[]>([]);
  const [repartoGastos, setRepartoGastos] = useState<RepartoGastoFijo[]>([]);
  const [repartoDiarios, setRepartoDiarios] = useState<RepartoGastoDiario[]>([]);
  const [participantesPorItem, setParticipantesPorItem] = useState<Record<string, ItemParticipante[]>>({});
  const [cargando, setCargando] = useState(true);
  const [noEncontrada, setNoEncontrada] = useState(false);

  const [mostrarForm, setMostrarForm] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editandoTipo, setEditandoTipo] = useState<TipoItem | null>(null);

  const [tipoItem, setTipoItem] = useState<TipoItem>("cuota");
  const [descripcion, setDescripcion] = useState("");
  const [montoCuota, setMontoCuota] = useState("");
  const [nCuotas, setNCuotas] = useState("1");
  const [cuotaActual, setCuotaActual] = useState("1");
  const [diaVencimiento, setDiaVencimiento] = useState<number>(() => new Date().getDate());
  const [montoEstimado, setMontoEstimado] = useState("");
  const [diaMesPago, setDiaMesPago] = useState<number>(() => new Date().getDate());
  const [montoDiario, setMontoDiario] = useState("");
  const [fecha, setFecha] = useState(hoyISO());
  const [entidadId, setEntidadId] = useState("");
  const [grupoId, setGrupoId] = useState("");
  const [marcaId, setMarcaId] = useState("");
  const [icono, setIcono] = useState("");
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [grupoEsAutomatico, setGrupoEsAutomatico] = useState(false);

  const unicaPersona = personas.length === 1 ? personas[0] : null;

  async function cargar() {
    setCargando(true);
    setNoEncontrada(false);
    const [
      { data: cat },
      { data: m },
      { data: ent },
      { data: gr },
      { data: p },
      { data: cgp },
      { data: c },
      { data: gf },
      { data: d },
      { data: rc },
      { data: rg },
      { data: rd },
      { data: ipCompra },
      { data: ipFijo },
    ] = await Promise.all([
      supabase.from("categorias").select("*").eq("id", id).maybeSingle(),
      supabase.from("marcas").select("*"),
      supabase.from("entidades").select("*").order("nombre"),
      supabase.from("grupos").select("*").order("nombre"),
      supabase.from("personas").select("*").eq("activo", true).order("nombre"),
      supabase.from("categoria_grupo_preferido").select("*").eq("categoria_id", id).maybeSingle(),
      supabase.from("vista_cuotas_mes_actual").select("*").eq("categoria_id", id),
      supabase.from("gastos_fijos").select("*").eq("categoria_id", id).eq("activo", true),
      supabase
        .from("gastos_diarios")
        .select("*")
        .eq("categoria_id", id)
        .gte("fecha", mesActualISO())
        .lt("fecha", primerDiaMesSiguiente()),
      supabase.from("vista_reparto_cuotas_mes").select("*").eq("categoria_id", id),
      supabase.from("vista_reparto_gastos_fijos").select("*").eq("categoria_id", id),
      supabase.from("vista_reparto_gastos_diarios").select("*").eq("categoria_id", id),
      supabase.from("item_participantes").select("*").eq("origen", "compra"),
      supabase.from("item_participantes").select("*").eq("origen", "gasto_fijo"),
    ]);
    if (!cat) {
      setNoEncontrada(true);
      setCategoria(null);
      setCargando(false);
      return;
    }
    setCategoria(cat as Categoria);
    setMarcas((m as Marca[]) ?? []);
    setEntidades((ent as Entidad[]) ?? []);
    setGrupos((gr as Grupo[]) ?? []);
    setPersonas((p as Persona[]) ?? []);
    setGrupoPorDefecto((cgp as CategoriaGrupoPreferido | null)?.grupo_id ?? "");
    setCuotas((c as CompraVigente[]) ?? []);
    setGastosFijos((gf as GastoFijo[]) ?? []);
    setDiarios((d as GastoDiario[]) ?? []);
    setRepartoCuotas((rc as RepartoCuota[]) ?? []);
    setRepartoGastos((rg as RepartoGastoFijo[]) ?? []);
    setRepartoDiarios((rd as RepartoGastoDiario[]) ?? []);
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
    setCargando(false);
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const items = useMemo<ItemFila[]>(() => {
    const entidadNombre = (entId: string | null) => entidades.find((x) => x.id === entId)?.nombre ?? "Sin cuenta";
    return [
      ...cuotas.map((x) => ({
        key: `c-${x.compra_id}`,
        tipo: "cuota" as TipoItem,
        id: x.compra_id,
        descripcion: x.descripcion,
        entidad: entidadNombre(x.entidad_id),
        detalle: `Cuota ${x.cuota_actual} de ${x.n_cuotas}`,
        monto: Number(x.monto_cuota),
        marcaId: x.marca_id,
        icono: x.icono,
        reparto: repartoCuotas
          .filter((r) => r.compra_id === x.compra_id)
          .map((r) => ({ persona_nombre: r.persona_nombre, monto_persona: r.monto_persona })),
      })),
      ...gastosFijos.map((x) => ({
        key: `g-${x.id}`,
        tipo: "fijo" as TipoItem,
        id: x.id,
        descripcion: x.descripcion,
        entidad: entidadNombre(x.entidad_id),
        detalle: "Gasto fijo",
        monto: Number(x.monto_estimado),
        marcaId: x.marca_id,
        icono: x.icono,
        reparto: repartoGastos
          .filter((r) => r.gasto_fijo_id === x.id)
          .map((r) => ({ persona_nombre: r.persona_nombre, monto_persona: r.monto_persona })),
      })),
      ...diarios.map((x) => ({
        key: `d-${x.id}`,
        tipo: "diario" as TipoItem,
        id: x.id,
        descripcion: x.descripcion,
        entidad: "Diario",
        detalle: "Diario",
        monto: Number(x.monto),
        marcaId: x.marca_id,
        icono: null as string | null,
        reparto: repartoDiarios
          .filter((r) => r.gasto_diario_id === x.id)
          .map((r) => ({ persona_nombre: r.persona_nombre, monto_persona: r.monto_persona })),
      })),
    ].sort((a, b) => b.monto - a.monto);
  }, [cuotas, gastosFijos, diarios, repartoCuotas, repartoGastos, repartoDiarios, entidades]);

  function cancelarForm() {
    setMostrarForm(false);
    setEditandoId(null);
    setEditandoTipo(null);
    setTipoItem("cuota");
    setDescripcion("");
    setMontoCuota("");
    setNCuotas("1");
    setCuotaActual("1");
    setDiaVencimiento(new Date().getDate());
    setMontoEstimado("");
    setDiaMesPago(new Date().getDate());
    setMontoDiario("");
    setFecha(hoyISO());
    setEntidadId("");
    setGrupoId("");
    setMarcaId("");
    setIcono("");
    setParticipantes([]);
    setGrupoEsAutomatico(false);
    setError("");
  }

  function abrirFormNuevo() {
    if (grupoPorDefecto) {
      setGrupoId(grupoPorDefecto);
      setGrupoEsAutomatico(true);
    } else if (unicaPersona) {
      setParticipantes([{ persona_id: unicaPersona.id, porcentaje: null }]);
    }
    setMostrarForm(true);
  }

  // Ver la nota gemela en /entidad/[id]/page.tsx, /marca/[id]/page.tsx y
  // /grupo/[id]/page.tsx: precarga el formulario con un ítem ya cargado para
  // editarlo. Acá la categoría queda fija (es la de esta pantalla); el resto
  // de los campos se restauran tal cual estaban guardados.
  function iniciarEdicion(it: ItemFila) {
    setEditandoId(it.id);
    setEditandoTipo(it.tipo);
    setDescripcion(it.descripcion);
    setMarcaId(it.marcaId ?? "");
    setGrupoEsAutomatico(false);
    if (it.tipo === "cuota") {
      const c = cuotas.find((x) => x.compra_id === it.id);
      if (!c) return;
      setTipoItem("cuota");
      setMontoCuota(String(c.monto_cuota));
      setNCuotas(String(c.n_cuotas));
      setCuotaActual(String(c.cuota_actual));
      setDiaVencimiento(diaDelMes(c.fecha_primera_cuota));
      setEntidadId(c.entidad_id ?? "");
      setGrupoId(c.grupo_id ?? "");
      setIcono(c.icono ?? "");
    } else if (it.tipo === "fijo") {
      const g = gastosFijos.find((x) => x.id === it.id);
      if (!g) return;
      setTipoItem("fijo");
      setMontoEstimado(String(g.monto_estimado));
      setDiaMesPago(g.dia_mes_pago ?? new Date().getDate());
      setEntidadId(g.entidad_id ?? "");
      setGrupoId(g.grupo_id ?? "");
      setIcono(g.icono ?? "");
    } else {
      const d = diarios.find((x) => x.id === it.id);
      if (!d) return;
      setTipoItem("diario");
      setMontoDiario(String(d.monto));
      setFecha(d.fecha.slice(0, 10));
      setEntidadId("");
      setGrupoId(d.grupo_id ?? "");
      setIcono("");
    }
    const participantesExistentes = (participantesPorItem[it.id] ?? []).map((row) => ({
      persona_id: row.persona_id,
      porcentaje: row.porcentaje,
    }));
    setParticipantes(
      participantesExistentes.length > 0
        ? participantesExistentes
        : unicaPersona
          ? [{ persona_id: unicaPersona.id, porcentaje: null }]
          : []
    );
    setMostrarForm(true);
  }

  async function guardarParticipantes(origen: "compra" | "gasto_fijo", origenId: string) {
    const { error: delError } = await supabase.from("item_participantes").delete().eq("origen", origen).eq("origen_id", origenId);
    if (delError) throw delError;
    if (!grupoId && participantes.length > 0) {
      const { error: insError } = await supabase
        .from("item_participantes")
        .insert(participantes.map((p) => ({ origen, origen_id: origenId, persona_id: p.persona_id, porcentaje: p.porcentaje })));
      if (insError) throw insError;
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (tipoItem !== "diario" && !grupoId && participantes.length === 0) {
      setError("Elige al menos una persona, o asocia el ítem a un grupo.");
      return;
    }
    setGuardando(true);
    try {
      if (tipoItem === "cuota") {
        const nCuotasNum = Math.max(1, Number(nCuotas) || 1);
        const montoCuotaNum = Number(montoCuota);
        const cuotaActualNum = Math.min(Math.max(1, Number(cuotaActual) || 1), nCuotasNum);
        const payload = {
          descripcion,
          monto_total: Math.round(montoCuotaNum * nCuotasNum),
          n_cuotas: nCuotasNum,
          fecha_primera_cuota: fechaPrimeraCuotaDesde(cuotaActualNum, diaVencimiento),
          entidad_id: entidadId || null,
          categoria_id: id,
          grupo_id: grupoId || null,
          marca_id: marcaId || null,
          icono: icono || null,
        };
        let compraId = editandoTipo === "cuota" ? editandoId : null;
        if (compraId) {
          const { error: updError } = await supabase.from("compras").update(payload).eq("id", compraId);
          if (updError) throw updError;
        } else {
          const { data, error: insError } = await supabase.from("compras").insert(payload).select().single();
          if (insError) throw insError;
          compraId = data.id;
        }
        await guardarParticipantes("compra", compraId!);
      } else if (tipoItem === "fijo") {
        const payload = {
          descripcion,
          categoria_id: id,
          entidad_id: entidadId || null,
          grupo_id: grupoId || null,
          marca_id: marcaId || null,
          icono: icono || null,
          monto_estimado: Number(montoEstimado) || 0,
          dia_mes_pago: diaMesPago,
          tipo_monto: "fijo" as const,
          activo: true,
        };
        let gastoId = editandoTipo === "fijo" ? editandoId : null;
        if (gastoId) {
          const { error: updError } = await supabase.from("gastos_fijos").update(payload).eq("id", gastoId);
          if (updError) throw updError;
        } else {
          const { data, error: insError } = await supabase.from("gastos_fijos").insert(payload).select().single();
          if (insError) throw insError;
          gastoId = data.id;
        }
        await guardarParticipantes("gasto_fijo", gastoId!);
      } else {
        const payload = {
          descripcion,
          monto: Number(montoDiario) || 0,
          fecha,
          categoria_id: id,
          marca_id: marcaId || null,
          grupo_id: grupoId || null,
        };
        let diarioId = editandoTipo === "diario" ? editandoId : null;
        if (diarioId) {
          const { error: updError } = await supabase.from("gastos_diarios").update(payload).eq("id", diarioId);
          if (updError) throw updError;
        } else {
          const { error: insError } = await supabase.from("gastos_diarios").insert(payload);
          if (insError) throw insError;
        }
      }
      cancelarForm();
      await cargar();
    } catch (err) {
      setError(mensajeError(err) || "No se pudo guardar. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarItem(it: ItemFila) {
    if (it.tipo === "cuota") {
      const { error: dbError } = await supabase.from("compras").delete().eq("id", it.id);
      if (dbError) {
        setError(dbError.message || "No se pudo eliminar.");
        return;
      }
      await supabase.from("item_participantes").delete().eq("origen", "compra").eq("origen_id", it.id);
    } else if (it.tipo === "fijo") {
      const { error: dbError } = await supabase.from("gastos_fijos").update({ activo: false }).eq("id", it.id);
      if (dbError) {
        setError(dbError.message || "No se pudo quitar.");
        return;
      }
    } else {
      const { error: dbError } = await supabase.from("gastos_diarios").delete().eq("id", it.id);
      if (dbError) {
        setError(dbError.message || "No se pudo eliminar.");
        return;
      }
    }
    if (editandoId === it.id) cancelarForm();
    await cargar();
  }

  const marcaDe = (marcaId: string | null) => marcas.find((m) => m.id === marcaId) ?? null;
  const grupoDe = (grupoIdBuscado: string) => grupos.find((g) => g.id === grupoIdBuscado) ?? null;
  const totalMensual = useMemo(() => items.reduce((acc, it) => acc + it.monto, 0), [items]);
  const resumenPersonas = useMemo(() => {
    const acc: Record<string, number> = {};
    items.forEach((it) => it.reparto.forEach((r) => (acc[r.persona_nombre] = (acc[r.persona_nombre] ?? 0) + r.monto_persona)));
    return Object.entries(acc)
      .map(([persona_nombre, total]) => ({ persona_nombre, total }))
      .sort((a, b) => b.total - a.total);
  }, [items]);

  if (cargando) {
    return <p className="py-10 text-center text-gray-400 dark:text-gray-500">Cargando…</p>;
  }

  if (noEncontrada || !categoria) {
    return (
      <div className="space-y-3 pb-10">
        <button onClick={() => router.back()} className="text-xs text-brand-from dark:text-pink-400">
          ‹ Volver
        </button>
        <p className="text-center text-sm text-gray-400 dark:text-gray-500">No se encontró esta categoría.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-10">
      <button onClick={() => router.back()} className="text-xs text-brand-from dark:text-pink-400">
        ‹ Volver
      </button>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <EntidadAvatar icono={categoria.icono} nombreFallback={categoria.nombre} className="h-11 w-11" />
          <div>
            <h1 className="text-lg font-bold text-gray-800 dark:text-white">{categoria.nombre}</h1>
            <p className="text-xs text-gray-400 dark:text-gray-500">{categoria.tipo === "fijo" ? "Categoría fija" : "Categoría variable"}</p>
          </div>
        </div>
        <button
          onClick={() => (mostrarForm ? cancelarForm() : abrirFormNuevo())}
          className="shrink-0 rounded-full bg-brand-gradient px-4 py-2 text-sm font-semibold text-white"
        >
          {mostrarForm ? "Cancelar" : "+ Agregar"}
        </button>
      </div>

      {mostrarForm && (
        <Card>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-3 gap-1 rounded-2xl bg-gray-100 p-1 text-sm dark:bg-white/5">
              {(
                [
                  { v: "cuota", label: "Cuota" },
                  { v: "fijo", label: "Fijo" },
                  { v: "diario", label: "Diario" },
                ] as { v: TipoItem; label: string }[]
              ).map((t) => (
                <button
                  key={t.v}
                  type="button"
                  disabled={!!editandoId}
                  onClick={() => {
                    if (!editandoId) setTipoItem(t.v);
                  }}
                  className={`rounded-xl py-2 font-semibold transition-colors ${
                    tipoItem === t.v
                      ? "bg-white text-brand-from shadow-sm dark:bg-gray-800 dark:text-white dark:shadow-none"
                      : "text-gray-500 dark:text-gray-500"
                  } ${editandoId ? "opacity-60" : ""}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {editandoId && (
              <p className="text-[11px] text-gray-400 dark:text-gray-500">
                Editando ítem — el tipo (Cuota/Fijo/Diario) no se puede cambiar acá.
              </p>
            )}

            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400">Descripción</label>
              <input
                required
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder={`Ej: Gasto de ${categoria.nombre.toLowerCase()}`}
                className="w-full rounded-lg border border-gray-200 dark:border-white/10 px-3 py-2 text-sm dark:bg-white/5 dark:text-white"
              />
            </div>

            {tipoItem === "cuota" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400">N° de cuotas</label>
                    <input
                      required
                      type="number"
                      min={1}
                      value={nCuotas}
                      onChange={(e) => setNCuotas(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 dark:border-white/10 px-3 py-2 text-sm dark:bg-white/5 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400">Valor de la cuota</label>
                    <input
                      required
                      type="number"
                      min={1}
                      value={montoCuota}
                      onChange={(e) => setMontoCuota(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 dark:border-white/10 px-3 py-2 text-sm dark:bg-white/5 dark:text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400">¿En qué cuota va?</label>
                  <input
                    required
                    type="number"
                    min={1}
                    max={nCuotas || undefined}
                    value={cuotaActual}
                    onChange={(e) => setCuotaActual(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 dark:border-white/10 px-3 py-2 text-sm dark:bg-white/5 dark:text-white"
                  />
                  <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
                    Si es una compra nueva, deja &quot;1&quot;. No hace falta calcular la fecha de la primera cuota.
                  </p>
                </div>
                {nCuotas && montoCuota && (
                  <p className="rounded-lg bg-purple-50 px-3 py-2 text-xs text-brand-from dark:bg-white/10 dark:text-white">
                    Total aproximado: {formatCLP(Number(nCuotas) * Number(montoCuota))}
                  </p>
                )}
              </>
            )}

            {tipoItem === "fijo" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400">Monto estimado</label>
                  <input
                    required
                    type="number"
                    min={0}
                    value={montoEstimado}
                    onChange={(e) => setMontoEstimado(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 dark:border-white/10 px-3 py-2 text-sm dark:bg-white/5 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400">Día de pago</label>
                  <input
                    required
                    type="number"
                    min={1}
                    max={31}
                    value={diaMesPago}
                    onChange={(e) => setDiaMesPago(Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-200 dark:border-white/10 px-3 py-2 text-sm dark:bg-white/5 dark:text-white"
                  />
                </div>
              </div>
            )}

            {tipoItem === "diario" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400">Monto</label>
                  <input
                    required
                    type="number"
                    min={1}
                    value={montoDiario}
                    onChange={(e) => setMontoDiario(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 dark:border-white/10 px-3 py-2 text-sm dark:bg-white/5 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400">Fecha</label>
                  <input
                    required
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 dark:border-white/10 px-3 py-2 text-sm text-gray-500 dark:text-gray-400 dark:bg-white/5"
                  />
                </div>
              </div>
            )}

            {tipoItem !== "diario" && (
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400">Tarjeta / medio de pago (opcional)</label>
                <div className="mt-1">
                  <EntidadPicker entidades={entidades} marcas={marcas} value={entidadId} onChange={setEntidadId} onCatalogoActualizado={cargar} />
                </div>
              </div>
            )}

            {categoria.tipo_marca_sugerido && (
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400">
                  ¿Cuál {categoria.nombre.toLowerCase()}? (opcional)
                </label>
                <div className="mt-1">
                  <MarcaSugeridaPicker
                    marcas={marcas}
                    tipo={categoria.tipo_marca_sugerido}
                    value={marcaId}
                    onChange={setMarcaId}
                    onCatalogoActualizado={cargar}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400">Grupo (opcional)</label>
              <select
                value={grupoId}
                onChange={(e) => {
                  setGrupoId(e.target.value);
                  setGrupoEsAutomatico(false);
                }}
                className="w-full rounded-lg border border-gray-200 dark:border-white/10 px-3 py-2 text-sm dark:bg-white/5 dark:text-white"
              >
                <option value="">— Sin grupo —</option>
                {grupos.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nombre}
                  </option>
                ))}
              </select>
              {grupoEsAutomatico && (
                <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
                  Aplicado automáticamente porque es el reparto por defecto de esta categoría. Podés cambiarlo.
                </p>
              )}
            </div>

            {tipoItem !== "diario" &&
              (grupoId ? (
                <p className="rounded-lg bg-purple-50 px-3 py-2 text-xs text-brand-from dark:bg-white/10 dark:text-white">
                  El reparto lo define el grupo &quot;{grupoDe(grupoId)?.nombre}&quot;.
                </p>
              ) : unicaPersona ? null : (
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400">¿Quiénes participan?</label>
                  <p className="mb-1 text-[11px] text-gray-400 dark:text-gray-500">
                    Deja el % en blanco para repartir en partes iguales el resto.
                  </p>
                  <ParticipantesPicker
                    personas={personas}
                    value={participantes}
                    onChange={setParticipantes}
                    montoTotal={tipoItem === "cuota" ? (montoCuota ? Number(montoCuota) : undefined) : Number(montoEstimado) || undefined}
                  />
                </div>
              ))}

            {tipoItem !== "diario" && (
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400">Ícono del ítem (opcional)</label>
                <div className="mt-1">
                  <IconoPicker value={icono} onChange={setIcono} />
                </div>
              </div>
            )}

            {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={guardando}
              className="w-full rounded-lg bg-brand-gradient py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {guardando ? "Guardando…" : editandoId ? "Guardar cambios" : "Guardar"}
            </button>
          </form>
        </Card>
      )}

      <Card className="!py-3">
        <p className="text-xs text-gray-400 dark:text-gray-500">Total vigente</p>
        <p className="text-2xl font-bold text-gray-800 dark:text-white">{formatCLP(totalMensual)}</p>
        <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
          Cuotas activas, gastos fijos y diarios de este mes categorizados como {categoria.nombre}, sin importar quién los paga.
        </p>
      </Card>

      {resumenPersonas.length > 0 && (
        <Card>
          <p className="mb-2 text-sm font-semibold text-gray-600 dark:text-gray-300">Le corresponde a cada uno</p>
          <ul className="divide-y divide-gray-100 dark:divide-white/10">
            {resumenPersonas.map((r) => (
              <li key={r.persona_nombre} className="flex items-center justify-between py-2 text-sm">
                <span className="text-gray-600 dark:text-gray-300">{r.persona_nombre}</span>
                <span className="font-semibold text-gray-800 dark:text-white">{formatCLP(r.total)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <p className="mb-1 text-sm font-semibold text-gray-600 dark:text-gray-300">Detalle</p>
        <p className="mb-3 text-xs text-gray-400 dark:text-gray-500">
          Todo lo activo categorizado como {categoria.nombre}, con las cuotas que quedan y quién debe pagar cada ítem.
        </p>
        {items.length === 0 ? (
          <p className="py-2 text-sm text-gray-400 dark:text-gray-500">Nada cargado en esta categoría por ahora.</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-white/10">
            {items.map((it) => (
              <li key={it.key} className="flex items-start gap-3 py-2.5">
                <EntidadAvatar marca={marcaDe(it.marcaId)} icono={it.icono} nombreFallback={it.descripcion} className="h-8 w-8" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-700 dark:text-gray-200">{it.descripcion}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {it.detalle} · {it.entidad}
                  </p>
                  <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
                    {it.reparto.length > 0
                      ? it.reparto.map((r) => `${r.persona_nombre} ${formatCLP(r.monto_persona)}`).join(" · ")
                      : "Sin repartir"}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <p className="text-sm font-semibold text-gray-800 dark:text-white">{formatCLP(it.monto)}</p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => iniciarEdicion(it)} className="text-[11px] text-brand-from dark:text-pink-400">
                      editar
                    </button>
                    <button onClick={() => eliminarItem(it)} className="text-[11px] text-gray-300 dark:text-gray-600 hover:text-red-400">
                      {it.tipo === "fijo" ? "quitar" : "eliminar"}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
