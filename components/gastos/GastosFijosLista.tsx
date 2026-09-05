"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/Card";
import { EntidadAvatar } from "@/components/EntidadAvatar";
import { EntidadPicker } from "@/components/EntidadPicker";
import { IconoPicker } from "@/components/IconoPicker";
import { ItemDesplegable } from "@/components/ItemDesplegable";
import { MarcaSugeridaPicker } from "@/components/MarcaSugeridaPicker";
import { ParticipantesPicker } from "@/components/ParticipantesPicker";
import { EVENTO_MOVIMIENTO_GUARDADO } from "@/components/MovimientoRapido";
import { formatCLP, mesActualISO } from "@/lib/format";
import { promedioMovil } from "@/lib/promedioMovil";
import { resolverMarca } from "@/lib/resolverMarca";
import { mensajeError } from "@/lib/supabaseError";
import { Categoria, CategoriaGrupoPreferido, Entidad, GastoFijo, Grupo, ItemParticipante, Marca, Pago, Participante, Persona } from "@/lib/types";

// Pestañas "Fijos" y "Variables" de /gastos: misma tabla (gastos_fijos),
// filtradas por tipo_monto — antes eran dos secciones de una sola pantalla
// (/gastos-fijos), ahora dos pestañas separadas que comparten este mismo
// componente. El formulario de alta arranca con el tipo de la pestaña
// actual, pero se puede cambiar (por si un ítem cambia de "cobra siempre lo
// mismo" a "vencimiento fijo, monto variable" o viceversa).
export function GastosFijosLista({ tipoMonto: tabTipoMonto }: { tipoMonto: "fijo" | "variable" }) {
  const [gastos, setGastos] = useState<GastoFijo[]>([]);
  const [entidades, setEntidades] = useState<Entidad[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  // "Esta categoría usa este grupo por defecto" (ver Grupos y
  // migration_26_reparto_por_categoria.sql) — categoria_id -> grupo_id.
  const [preferidoPorCategoria, setPreferidoPorCategoria] = useState<Record<string, string>>({});
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [participantesPorItem, setParticipantesPorItem] = useState<Record<string, ItemParticipante[]>>({});
  const [mostrarForm, setMostrarForm] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [diaMes, setDiaMes] = useState("1");
  const [tipoMonto, setTipoMonto] = useState<"fijo" | "variable">(tabTipoMonto);
  const [entidadId, setEntidadId] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [grupoId, setGrupoId] = useState("");
  const [marcaId, setMarcaId] = useState("");
  const [icono, setIcono] = useState("");
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  // true mientras el grupo elegido venga del auto-aplicado por categoría
  // (no de una elección manual) — así, si el usuario cambia la categoría de
  // nuevo, se puede reemplazar sin pisar una elección manual previa.
  const [grupoEsAutomatico, setGrupoEsAutomatico] = useState(false);

  // Si en la cuenta solo hay una persona activa (el caso normal de una sola
  // persona usando la app), no tiene sentido preguntar "¿quiénes
  // participan?" — se asigna sola, sin mostrar el selector. Apenas se
  // agregue una segunda persona, el selector vuelve a aparecer.
  const unicaPersona = personas.length === 1 ? personas[0] : null;

  async function cargarTodo() {
    const [{ data: g }, { data: e }, { data: m }, { data: cat }, { data: p }, { data: gr }, { data: cgp }, { data: ip }, { data: pg }] =
      await Promise.all([
        supabase.from("gastos_fijos").select("*").eq("activo", true).order("descripcion"),
        supabase.from("entidades").select("*").order("nombre"),
        supabase.from("marcas").select("*").order("nombre"),
        supabase.from("categorias").select("*").order("nombre"),
        supabase.from("personas").select("*").eq("activo", true).order("nombre"),
        supabase.from("grupos").select("*").order("nombre"),
        supabase.from("categoria_grupo_preferido").select("*"),
        supabase.from("item_participantes").select("*").eq("origen", "gasto_fijo"),
        supabase.from("pagos").select("*").eq("origen", "gasto_fijo"),
      ]);
    setGastos((g as GastoFijo[]) ?? []);
    setEntidades((e as Entidad[]) ?? []);
    setMarcas((m as Marca[]) ?? []);
    setCategorias((cat as Categoria[]) ?? []);
    setPersonas((p as Persona[]) ?? []);
    setGrupos((gr as Grupo[]) ?? []);
    const mapaPreferido: Record<string, string> = {};
    ((cgp as CategoriaGrupoPreferido[]) ?? []).forEach((row) => {
      mapaPreferido[row.categoria_id] = row.grupo_id;
    });
    setPreferidoPorCategoria(mapaPreferido);
    setPagos((pg as Pago[]) ?? []);
    const agrupado: Record<string, ItemParticipante[]> = {};
    ((ip as ItemParticipante[]) ?? []).forEach((row) => {
      if (!agrupado[row.origen_id]) agrupado[row.origen_id] = [];
      agrupado[row.origen_id].push(row);
    });
    setParticipantesPorItem(agrupado);
  }

  useEffect(() => {
    cargarTodo();
    window.addEventListener(EVENTO_MOVIMIENTO_GUARDADO, cargarTodo);
    return () => window.removeEventListener(EVENTO_MOVIMIENTO_GUARDADO, cargarTodo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cancelarForm() {
    setMostrarForm(false);
    setEditandoId(null);
    setDescripcion("");
    setMonto("");
    setDiaMes("1");
    setTipoMonto(tabTipoMonto);
    setEntidadId("");
    setCategoriaId("");
    setGrupoId("");
    setMarcaId("");
    setIcono("");
    setParticipantes([]);
    setGrupoEsAutomatico(false);
    setError("");
  }

  function abrirFormNuevo() {
    setTipoMonto(tabTipoMonto);
    if (unicaPersona) setParticipantes([{ persona_id: unicaPersona.id, porcentaje: null }]);
    setMostrarForm(true);
  }

  function iniciarEdicion(g: GastoFijo) {
    setEditandoId(g.id);
    setDescripcion(g.descripcion);
    setMonto(String(g.monto_estimado));
    setDiaMes(String(g.dia_mes_pago ?? 1));
    setTipoMonto(g.tipo_monto);
    setEntidadId(g.entidad_id ?? "");
    setCategoriaId(g.categoria_id ?? "");
    setGrupoId(g.grupo_id ?? "");
    setGrupoEsAutomatico(false);
    setMarcaId(g.marca_id ?? "");
    setIcono(g.icono ?? "");
    const participantesExistentes = (participantesPorItem[g.id] ?? []).map((row) => ({
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

  async function guardarParticipantes(gastoId: string) {
    const { error: delError } = await supabase
      .from("item_participantes")
      .delete()
      .eq("origen", "gasto_fijo")
      .eq("origen_id", gastoId);
    if (delError) throw delError;
    if (!grupoId && participantes.length > 0) {
      const { error: insError } = await supabase.from("item_participantes").insert(
        participantes.map((p) => ({ origen: "gasto_fijo", origen_id: gastoId, persona_id: p.persona_id, porcentaje: p.porcentaje }))
      );
      if (insError) throw insError;
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!grupoId && participantes.length === 0) {
      setError("Elige al menos una persona, o asocia el gasto a un grupo.");
      return;
    }
    setGuardando(true);
    try {
      const payload = {
        descripcion,
        monto_estimado: Number(monto),
        dia_mes_pago: Number(diaMes),
        tipo_monto: tipoMonto,
        entidad_id: entidadId || null,
        categoria_id: categoriaId || null,
        grupo_id: grupoId || null,
        marca_id: marcaId || null,
        icono: icono || null,
        activo: true,
      };
      let gastoId = editandoId;
      if (editandoId) {
        const { error: updError } = await supabase.from("gastos_fijos").update(payload).eq("id", editandoId);
        if (updError) throw updError;
      } else {
        const { data, error: insError } = await supabase.from("gastos_fijos").insert(payload).select().single();
        if (insError) throw insError;
        gastoId = data.id;
      }
      if (gastoId) await guardarParticipantes(gastoId);
      cancelarForm();
      cargarTodo();
    } catch (err) {
      setError(mensajeError(err) || "No se pudo guardar. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  async function desactivar(id: string) {
    const { error: dbError } = await supabase.from("gastos_fijos").update({ activo: false }).eq("id", id);
    if (dbError) {
      setError(dbError.message || "No se pudo quitar.");
      return;
    }
    cargarTodo();
  }

  const entidadDe = (id: string | null) => entidades.find((e) => e.id === id) ?? null;
  const marcaDeEntidad = (id: string | null) => resolverMarca(entidadDe(id), marcas);
  const marcaDe = (id: string | null) => marcas.find((m) => m.id === id) ?? null;
  const nombreEntidad = (id: string | null) => entidadDe(id)?.nombre ?? null;
  const categoriaDe = (id: string | null) => categorias.find((c) => c.id === id) ?? null;
  const nombreCategoria = (id: string | null) => categoriaDe(id)?.nombre ?? "—";
  const grupoDe = (id: string | null) => grupos.find((g) => g.id === id) ?? null;
  const categoriaSeleccionada = categoriaDe(categoriaId || null);

  // Para un gasto de monto variable (luz, agua, gas...) el "monto vigente"
  // es el promedio móvil de sus últimos pagos reales, no monto_estimado
  // (que solo se usa como estimación inicial hasta que exista historial).
  function montoVigente(g: GastoFijo) {
    if (g.tipo_monto !== "variable") return { monto: Number(g.monto_estimado), esPromedio: false };
    const { promedio, meses } = promedioMovil(pagos, g.id, mesActualISO(), Number(g.monto_estimado));
    return { monto: promedio, esPromedio: meses > 0 };
  }

  function resumenReparto(g: GastoFijo) {
    if (g.grupo_id) return `Grupo: ${grupoDe(g.grupo_id)?.nombre ?? "—"}`;
    const filas = participantesPorItem[g.id] ?? [];
    if (filas.length === 0) return "Sin personas asignadas";
    const nombres = filas.map((f) => personas.find((p) => p.id === f.persona_id)?.nombre ?? "?");
    return nombres.join(", ");
  }

  const lista = gastos.filter((g) => g.tipo_monto === tabTipoMonto);
  const total = lista.reduce((acc, g) => acc + montoVigente(g).monto, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <button
          onClick={() => (mostrarForm ? cancelarForm() : abrirFormNuevo())}
          className="rounded-full bg-brand-gradient px-4 py-2 text-sm font-semibold text-white"
        >
          {mostrarForm ? "Cancelar" : "+ Nuevo"}
        </button>
      </div>

      {mostrarForm && (
        <Card>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400">Descripción</label>
              <input
                required
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-white/10 px-3 py-2 text-sm dark:bg-white/5 dark:text-white"
                placeholder="Ej: Luz"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400">
                  {tipoMonto === "variable" ? "Monto estimado (inicial)" : "Monto"}
                </label>
                <input
                  required
                  type="number"
                  min={0}
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-white/10 px-3 py-2 text-sm dark:bg-white/5 dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400">Día de pago</label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={diaMes}
                  onChange={(e) => setDiaMes(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-white/10 px-3 py-2 text-sm dark:bg-white/5 dark:text-white"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400">¿Cobra siempre lo mismo?</label>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTipoMonto("fijo")}
                  className={`rounded-lg border px-3 py-2 text-left text-xs font-medium ${
                    tipoMonto === "fijo"
                      ? "border-brand-from bg-purple-50 text-brand-from dark:bg-white/10 dark:text-white"
                      : "border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400"
                  }`}
                >
                  Monto fijo
                  <span className="block text-[10.5px] font-normal opacity-80">Ej: arriendo, suscripción</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTipoMonto("variable")}
                  className={`rounded-lg border px-3 py-2 text-left text-xs font-medium ${
                    tipoMonto === "variable"
                      ? "border-brand-from bg-purple-50 text-brand-from dark:bg-white/10 dark:text-white"
                      : "border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400"
                  }`}
                >
                  Monto variable
                  <span className="block text-[10.5px] font-normal opacity-80">Ej: luz, agua, gas</span>
                </button>
              </div>
              {tipoMonto === "variable" && (
                <p className="mt-1.5 rounded-lg bg-purple-50 px-3 py-2 text-[11px] text-brand-from dark:bg-white/10 dark:text-white">
                  Vence siempre el mismo día, pero el monto cambia cada mes. Una vez que registres pagos reales en el
                  Calendario de pagos, acá se va a mostrar el promedio móvil en vez del monto estimado.
                </p>
              )}
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400">Medio de pago</label>
              <div className="mt-1">
                <EntidadPicker
                  entidades={entidades}
                  marcas={marcas}
                  value={entidadId}
                  onChange={setEntidadId}
                  onCatalogoActualizado={cargarTodo}
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400">Categoría</label>
              <select
                value={categoriaId}
                onChange={(e) => {
                  const nuevaCategoria = categorias.find((c) => c.id === e.target.value) ?? null;
                  if (nuevaCategoria?.tipo_marca_sugerido !== categoriaSeleccionada?.tipo_marca_sugerido) {
                    setMarcaId("");
                  }
                  setCategoriaId(e.target.value);
                  // Si todavía no eligieron un grupo a mano (o el que hay
                  // vino de este mismo auto-aplicado), precarga el grupo
                  // que esta categoría tiene por defecto (ver Grupos).
                  if (!grupoId || grupoEsAutomatico) {
                    const sugerido = preferidoPorCategoria[e.target.value] ?? "";
                    setGrupoId(sugerido);
                    setGrupoEsAutomatico(!!sugerido);
                  }
                }}
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
            {categoriaSeleccionada?.tipo_marca_sugerido && (
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400">
                  ¿Cuál {categoriaSeleccionada.nombre.toLowerCase()}? (opcional)
                </label>
                <div className="mt-1">
                  <MarcaSugeridaPicker
                    marcas={marcas}
                    tipo={categoriaSeleccionada.tipo_marca_sugerido}
                    value={marcaId}
                    onChange={setMarcaId}
                    onCatalogoActualizado={cargarTodo}
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
            {grupoId ? (
              <p className="rounded-lg bg-purple-50 px-3 py-2 text-xs text-brand-from dark:bg-white/10 dark:text-white">
                El reparto lo define el grupo &quot;{grupoDe(grupoId)?.nombre}&quot;. Para cambiarlo, ve a Grupos.
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
                  montoTotal={monto ? Number(monto) : undefined}
                />
              </div>
            )}
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400">Ícono del item (opcional)</label>
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

      {lista.length > 0 && (
        <Card>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">
              {tabTipoMonto === "fijo" ? "Total monto fijo / mes" : "Total variable (promedio móvil) / mes"}
            </span>
            <span className="font-semibold text-gray-800 dark:text-white">{formatCLP(total)}</span>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {lista.map((g) => {
          const marcaItem = marcaDe(g.marca_id);
          const filasReparto = participantesPorItem[g.id] ?? [];
          const { monto: montoActual, esPromedio } = montoVigente(g);
          return (
            <Card key={g.id}>
              <ItemDesplegable
                resumen={({ onClick }) => (
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <button type="button" onClick={onClick} className="flex flex-1 items-start gap-3 text-left">
                        <EntidadAvatar
                          entidad={entidadDe(g.entidad_id)}
                          marca={marcaItem ?? marcaDeEntidad(g.entidad_id)}
                          icono={g.icono}
                          className="h-9 w-9"
                        />
                        <div>
                          <p className="font-semibold text-gray-800 dark:text-white">{g.descripcion}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            {nombreEntidad(g.entidad_id) ? `${nombreEntidad(g.entidad_id)} · ` : ""}
                            {nombreCategoria(g.categoria_id)}
                            {marcaItem ? ` (${marcaItem.nombre})` : ""} · día {g.dia_mes_pago ?? "—"} · {resumenReparto(g)}
                          </p>
                        </div>
                      </button>
                      <div className="flex shrink-0 items-center gap-3 pt-0.5">
                        <button onClick={() => iniciarEdicion(g)} className="text-xs text-brand-from dark:text-pink-400">
                          editar
                        </button>
                        <button onClick={() => desactivar(g.id)} className="text-xs text-gray-300 dark:text-gray-600 hover:text-red-400">
                          quitar
                        </button>
                      </div>
                    </div>
                    <p className="mt-2 text-right font-semibold text-gray-800 dark:text-white">
                      {esPromedio && <span className="mr-1 text-xs font-normal text-gray-400 dark:text-gray-500">~</span>}
                      {formatCLP(montoActual)}
                    </p>
                    {esPromedio && <p className="text-right text-[10.5px] text-gray-400 dark:text-gray-500">promedio móvil</p>}
                  </div>
                )}
                detalle={({ onClick }) => (
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3">
                        <EntidadAvatar
                          entidad={entidadDe(g.entidad_id)}
                          marca={marcaItem ?? marcaDeEntidad(g.entidad_id)}
                          icono={g.icono}
                          className="h-9 w-9"
                        />
                        <p className="pt-1.5 font-semibold text-gray-800 dark:text-white">{g.descripcion}</p>
                      </div>
                      <button type="button" onClick={onClick} className="shrink-0 pt-1.5 text-xs text-gray-400 dark:text-gray-500">
                        cerrar ✕
                      </button>
                    </div>
                    <dl className="mt-3 space-y-1.5 text-xs">
                      <div className="flex justify-between gap-3">
                        <dt className="text-gray-400 dark:text-gray-500">{esPromedio ? "Promedio móvil" : g.tipo_monto === "variable" ? "Monto estimado" : "Monto"}</dt>
                        <dd className="font-medium text-gray-700 dark:text-gray-200">{formatCLP(montoActual)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-gray-400 dark:text-gray-500">Día de pago</dt>
                        <dd className="font-medium text-gray-700 dark:text-gray-200">{g.dia_mes_pago ?? "—"}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-gray-400 dark:text-gray-500">Medio de pago</dt>
                        <dd className="font-medium text-gray-700 dark:text-gray-200">{nombreEntidad(g.entidad_id) ?? "—"}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="shrink-0 text-gray-400 dark:text-gray-500">Categoría</dt>
                        <dd className="text-right font-medium text-gray-700 dark:text-gray-200">
                          {nombreCategoria(g.categoria_id)}
                          {marcaItem ? ` (${marcaItem.nombre})` : ""}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="shrink-0 text-gray-400 dark:text-gray-500">Reparto</dt>
                        <dd className="text-right font-medium text-gray-700 dark:text-gray-200">
                          {g.grupo_id
                            ? `Grupo: ${grupoDe(g.grupo_id)?.nombre ?? "—"}`
                            : filasReparto.length === 0
                              ? "Sin personas asignadas"
                              : filasReparto
                                  .map((f) => {
                                    const nombre = personas.find((p) => p.id === f.persona_id)?.nombre ?? "?";
                                    return f.porcentaje != null ? `${nombre} (${f.porcentaje}%)` : nombre;
                                  })
                                  .join(", ")}
                        </dd>
                      </div>
                    </dl>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => iniciarEdicion(g)}
                        className="flex-1 rounded-lg bg-purple-50 py-2 text-xs font-semibold text-brand-from dark:bg-white/10 dark:text-white"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => desactivar(g.id)}
                        className="flex-1 rounded-lg bg-gray-50 dark:bg-white/5 py-2 text-xs font-semibold text-gray-400 dark:text-gray-500 hover:text-red-400"
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                )}
              />
            </Card>
          );
        })}
        {lista.length === 0 && !mostrarForm && (
          <p className="text-center text-sm text-gray-400 dark:text-gray-500">
            {tabTipoMonto === "fijo" ? "Aún no hay gastos de monto fijo." : "Aún no hay gastos de monto variable."}
          </p>
        )}
      </div>
    </div>
  );
}
