"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/Card";
import { EntidadAvatar } from "@/components/EntidadAvatar";
import { EntidadPicker } from "@/components/EntidadPicker";
import { IconoPicker } from "@/components/IconoPicker";
import { ParticipantesPicker } from "@/components/ParticipantesPicker";
import { fechaPrimeraCuotaDesde } from "@/lib/cuotas";
import { diaDelMes, formatCLP } from "@/lib/format";
import { mensajeError } from "@/lib/supabaseError";
import {
  Categoria,
  CategoriaGrupoPreferido,
  CompraVigente,
  Entidad,
  GastoFijo,
  Grupo,
  ItemParticipante,
  Marca,
  Participante,
  Persona,
  RepartoCuota,
  RepartoGastoFijo,
} from "@/lib/types";

type ItemFila = {
  key: string;
  tipo: TipoItem;
  id: string;
  descripcion: string;
  categoria: string;
  entidadId: string | null;
  entidad: string;
  detalle: string;
  monto: number;
  icono: string | null;
  reparto: { persona_nombre: string; monto_persona: number }[];
};

type TipoItem = "cuota" | "fijo";

const LABEL_TIPO_MARCA: Record<string, string> = {
  banco: "Banco",
  casa_comercial: "Casa comercial",
  caja_compensacion: "Caja de compensación",
  autopista: "Autopista / TAG",
  telecom: "Internet / Móvil",
  servicio_basico: "Servicio básico",
  supermercado: "Supermercado",
  transporte: "Pasajes",
  compras_online: "Compras online",
  delivery: "Delivery",
  suscripcion: "Suscripción",
  otro: "Marca",
};

// Pantalla de detalle de UNA marca del catálogo compartido (ej. "Falabella",
// "Ripley", "Banco Estado") — se llega acá desde "Personalizar menú" del
// sidebar de escritorio (ver DesktopSidebar.tsx), que ahora también ofrece
// anclar CUALQUIER marca de tipo "Casa comercial" o "Banco" del catálogo, no
// solo las que ya se convirtieron en una cuenta/tarjeta propia (ver
// /entidad/[id] para esa otra vista, filtrada por MEDIO DE PAGO en vez de
// por marca del ítem — son dos cosas distintas: un mismo ítem puede estar
// pagado con la tarjeta "Falabella" pero ser, como marca, "Ripley").
//
// Junta todo lo activo (cuotas vigentes + gastos fijos) cuyo `marca_id` sea
// esta marca, sin importar con qué cuenta se pagó, y permite cargar,
// editar o eliminar un ítem con esa marca ya fija (eligiendo con qué cuenta
// se paga, si corresponde) — antes solo se podía agregar, ver Novedades
// 2026-09-06.
export default function MarcaDetallePage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const [marca, setMarca] = useState<Marca | null>(null);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [entidades, setEntidades] = useState<Entidad[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [preferidoPorCategoria, setPreferidoPorCategoria] = useState<Record<string, string>>({});
  const [cuotas, setCuotas] = useState<CompraVigente[]>([]);
  const [gastosFijos, setGastosFijos] = useState<GastoFijo[]>([]);
  const [repartoCuotas, setRepartoCuotas] = useState<RepartoCuota[]>([]);
  const [repartoGastos, setRepartoGastos] = useState<RepartoGastoFijo[]>([]);
  const [participantesPorItem, setParticipantesPorItem] = useState<Record<string, ItemParticipante[]>>({});
  const [cargando, setCargando] = useState(true);
  const [noEncontrada, setNoEncontrada] = useState(false);

  const [mostrarForm, setMostrarForm] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  // Distinto de null mientras se edita un ítem ya existente — ver la misma
  // nota en /entidad/[id]/page.tsx.
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
  const [entidadId, setEntidadId] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [grupoId, setGrupoId] = useState("");
  const [icono, setIcono] = useState("");
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [grupoEsAutomatico, setGrupoEsAutomatico] = useState(false);

  const unicaPersona = personas.length === 1 ? personas[0] : null;

  async function cargar() {
    setCargando(true);
    setNoEncontrada(false);
    const [
      { data: mc },
      { data: m },
      { data: ent },
      { data: cat },
      { data: gr },
      { data: p },
      { data: cgp },
      { data: c },
      { data: gf },
      { data: rc },
      { data: rg },
      { data: ipCompra },
      { data: ipFijo },
    ] = await Promise.all([
      supabase.from("marcas").select("*").eq("id", id).maybeSingle(),
      supabase.from("marcas").select("*"),
      supabase.from("entidades").select("*").order("nombre"),
      supabase.from("categorias").select("*").order("nombre"),
      supabase.from("grupos").select("*").order("nombre"),
      supabase.from("personas").select("*").eq("activo", true).order("nombre"),
      supabase.from("categoria_grupo_preferido").select("*"),
      supabase.from("vista_cuotas_mes_actual").select("*").eq("marca_id", id),
      supabase.from("gastos_fijos").select("*").eq("marca_id", id).eq("activo", true),
      supabase.from("vista_reparto_cuotas_mes").select("*").eq("marca_id", id),
      supabase.from("vista_reparto_gastos_fijos").select("*").eq("marca_id", id),
      supabase.from("item_participantes").select("*").eq("origen", "compra"),
      supabase.from("item_participantes").select("*").eq("origen", "gasto_fijo"),
    ]);
    if (!mc) {
      setNoEncontrada(true);
      setMarca(null);
      setCargando(false);
      return;
    }
    setMarca(mc as Marca);
    setMarcas((m as Marca[]) ?? []);
    setEntidades((ent as Entidad[]) ?? []);
    setCategorias((cat as Categoria[]) ?? []);
    setGrupos((gr as Grupo[]) ?? []);
    setPersonas((p as Persona[]) ?? []);
    const mapaPreferido: Record<string, string> = {};
    ((cgp as CategoriaGrupoPreferido[]) ?? []).forEach((row) => {
      mapaPreferido[row.categoria_id] = row.grupo_id;
    });
    setPreferidoPorCategoria(mapaPreferido);
    setCuotas((c as CompraVigente[]) ?? []);
    setGastosFijos((gf as GastoFijo[]) ?? []);
    setRepartoCuotas((rc as RepartoCuota[]) ?? []);
    setRepartoGastos((rg as RepartoGastoFijo[]) ?? []);
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
    const categoriaNombre = (catId: string | null) => categorias.find((x) => x.id === catId)?.nombre ?? "Sin categoría";
    const entidadNombre = (entId: string | null) => entidades.find((x) => x.id === entId)?.nombre ?? "Sin cuenta";
    return [
      ...cuotas.map((x) => ({
        key: `c-${x.compra_id}`,
        tipo: "cuota" as TipoItem,
        id: x.compra_id,
        descripcion: x.descripcion,
        categoria: categoriaNombre(x.categoria_id),
        entidadId: x.entidad_id,
        entidad: entidadNombre(x.entidad_id),
        detalle: `Cuota ${x.cuota_actual} de ${x.n_cuotas}`,
        monto: Number(x.monto_cuota),
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
        categoria: categoriaNombre(x.categoria_id),
        entidadId: x.entidad_id,
        entidad: entidadNombre(x.entidad_id),
        detalle: "Gasto fijo",
        monto: Number(x.monto_estimado),
        icono: x.icono,
        reparto: repartoGastos
          .filter((r) => r.gasto_fijo_id === x.id)
          .map((r) => ({ persona_nombre: r.persona_nombre, monto_persona: r.monto_persona })),
      })),
    ].sort((a, b) => b.monto - a.monto);
  }, [cuotas, gastosFijos, repartoCuotas, repartoGastos, categorias, entidades]);

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
    setEntidadId("");
    setCategoriaId("");
    setGrupoId("");
    setIcono("");
    setParticipantes([]);
    setGrupoEsAutomatico(false);
    setError("");
  }

  function abrirFormNuevo() {
    if (unicaPersona) setParticipantes([{ persona_id: unicaPersona.id, porcentaje: null }]);
    setMostrarForm(true);
  }

  // Ver la nota gemela en /entidad/[id]/page.tsx: precarga el formulario con
  // un ítem ya cargado para editarlo. Acá además hay que restaurar
  // `entidadId` (el medio de pago, que en esta pantalla es un campo más del
  // formulario, no algo fijo por la URL).
  function iniciarEdicion(it: ItemFila) {
    setEditandoId(it.id);
    setEditandoTipo(it.tipo);
    setDescripcion(it.descripcion);
    setEntidadId(it.entidadId ?? "");
    setIcono(it.icono ?? "");
    setGrupoEsAutomatico(false);
    if (it.tipo === "cuota") {
      const c = cuotas.find((x) => x.compra_id === it.id);
      if (!c) return;
      setTipoItem("cuota");
      setMontoCuota(String(c.monto_cuota));
      setNCuotas(String(c.n_cuotas));
      setCuotaActual(String(c.cuota_actual));
      setDiaVencimiento(diaDelMes(c.fecha_primera_cuota));
      setCategoriaId(c.categoria_id ?? "");
      setGrupoId(c.grupo_id ?? "");
    } else {
      const g = gastosFijos.find((x) => x.id === it.id);
      if (!g) return;
      setTipoItem("fijo");
      setMontoEstimado(String(g.monto_estimado));
      setDiaMesPago(g.dia_mes_pago ?? new Date().getDate());
      setCategoriaId(g.categoria_id ?? "");
      setGrupoId(g.grupo_id ?? "");
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

  function elegirCategoria(nuevaCategoriaId: string) {
    setCategoriaId(nuevaCategoriaId);
    if (!grupoId || grupoEsAutomatico) {
      const sugerido = preferidoPorCategoria[nuevaCategoriaId] ?? "";
      setGrupoId(sugerido);
      setGrupoEsAutomatico(!!sugerido);
    }
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
    if (!grupoId && participantes.length === 0) {
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
          categoria_id: categoriaId || null,
          grupo_id: grupoId || null,
          marca_id: id,
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
      } else {
        const payload = {
          descripcion,
          categoria_id: categoriaId || null,
          entidad_id: entidadId || null,
          grupo_id: grupoId || null,
          marca_id: id,
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
    } else {
      // Los gastos fijos no se borran, se desactivan (mismo criterio que
      // GastosFijosLista.tsx) — conserva el historial de pagos ya
      // registrados en el Calendario de pagos.
      const { error: dbError } = await supabase.from("gastos_fijos").update({ activo: false }).eq("id", it.id);
      if (dbError) {
        setError(dbError.message || "No se pudo quitar.");
        return;
      }
    }
    if (editandoId === it.id) cancelarForm();
    await cargar();
  }

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

  if (noEncontrada || !marca) {
    return (
      <div className="space-y-3 pb-10">
        <button onClick={() => router.back()} className="text-xs text-brand-from dark:text-pink-400">
          ‹ Volver
        </button>
        <p className="text-center text-sm text-gray-400 dark:text-gray-500">No se encontró esta marca.</p>
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
          <EntidadAvatar marca={marca} className="h-11 w-11" />
          <div>
            <h1 className="text-lg font-bold text-gray-800 dark:text-white">{marca.nombre}</h1>
            <p className="text-xs text-gray-400 dark:text-gray-500">{LABEL_TIPO_MARCA[marca.tipo] ?? "Marca"}</p>
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
            <div className="flex gap-1 rounded-2xl bg-gray-100 p-1 text-sm dark:bg-white/5">
              {(
                [
                  { v: "cuota", label: "Cuota" },
                  { v: "fijo", label: "Gasto fijo" },
                ] as { v: TipoItem; label: string }[]
              ).map((t) => (
                <button
                  key={t.v}
                  type="button"
                  disabled={!!editandoId}
                  onClick={() => {
                    if (!editandoId) setTipoItem(t.v);
                  }}
                  className={`flex-1 rounded-xl py-2 font-semibold transition-colors ${
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
                Editando ítem — el tipo (cuota/gasto fijo) no se puede cambiar acá.
              </p>
            )}

            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400">Descripción</label>
              <input
                required
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder={`Ej: Compra en ${marca.nombre}`}
                className="w-full rounded-lg border border-gray-200 dark:border-white/10 px-3 py-2 text-sm dark:bg-white/5 dark:text-white"
              />
            </div>

            {tipoItem === "cuota" ? (
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
            ) : (
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

            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400">Tarjeta / medio de pago (opcional)</label>
              <div className="mt-1">
                <EntidadPicker entidades={entidades} marcas={marcas} value={entidadId} onChange={setEntidadId} onCatalogoActualizado={cargar} />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400">Categoría</label>
              <select
                value={categoriaId}
                onChange={(e) => elegirCategoria(e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-white/10 px-3 py-2 text-sm dark:bg-white/5 dark:text-white"
              >
                <option value="">—</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>

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

            {grupoId ? (
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
            )}

            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400">Ícono del ítem (opcional)</label>
              <div className="mt-1">
                <IconoPicker value={icono} onChange={setIcono} />
              </div>
            </div>

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
          Cuotas activas y gastos fijos con esta marca, sin importar con qué cuenta se pagaron.
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
          Todo lo activo con marca {marca.nombre}, con las cuotas que quedan y quién debe pagar cada ítem.
        </p>
        {items.length === 0 ? (
          <p className="py-2 text-sm text-gray-400 dark:text-gray-500">Nada cargado con esta marca por ahora.</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-white/10">
            {items.map((it) => (
              <li key={it.key} className="flex items-start gap-3 py-2.5">
                <EntidadAvatar marca={marca} icono={it.icono} nombreFallback={it.descripcion} className="h-8 w-8" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-700 dark:text-gray-200">{it.descripcion}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {it.categoria} · {it.detalle} · {it.entidad}
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
                      {it.tipo === "cuota" ? "eliminar" : "quitar"}
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
