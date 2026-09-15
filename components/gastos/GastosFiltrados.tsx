"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/Card";
import { EntidadAvatar } from "@/components/EntidadAvatar";
import { VentanaModal } from "@/components/VentanaModal";
import { formatCLP, mesActualISO, primerDiaMesSiguiente } from "@/lib/format";
import { mensajeError } from "@/lib/supabaseError";
import { resolverMarca } from "@/lib/resolverMarca";
import {
  Categoria,
  CompraVigente,
  Entidad,
  GastoDiario,
  GastoFijo,
  Grupo,
  GrupoParticipante,
  ItemParticipante,
  Marca,
  Persona,
} from "@/lib/types";

// Ronda 8: Felipe pidió, en /gastos, "un filtro por personas, categorías y
// filtro por cuentas y tarjetas, que al seleccionar una, me muestre el
// listado, incluido si ese gasto se asocio a cierta persona o varias. y que
// se pueda editar desde el mismo listado en una ventana popup". Las 3
// pestañas de siempre (Normal/Recurrente/Cuotas) siguen igual — este
// componente es la vista alternativa que reemplaza esas pestañas apenas hay
// al menos un filtro activo, juntando compras/gastos fijos/diarios en UN
// solo listado (algo que ninguna pestaña hace sola), cada fila con quién
// participa y un botón para editar sin salir de la lista.
//
// La edición acá es deliberadamente más chica que los formularios completos
// de cada pestaña (que dejan cambiar marca, N° de cuotas, etc.): cubre lo
// que este pedido necesita — descripción, categoría, cuenta, grupo/reparto y
// el monto cuando corresponde — para no duplicar 3 formularios completos
// dentro de un popup. Cambios más profundos (ej. N° de cuotas de una
// compra) se siguen haciendo desde su pestaña de siempre.

type Origen = "compra" | "gasto_fijo" | "gasto_diario";

type GastoUnificado = {
  key: string;
  origen: Origen;
  origenId: string;
  descripcion: string;
  monto: number;
  categoriaId: string | null;
  entidadId: string | null;
  grupoId: string | null;
  detalle: string;
  fecha: string | null;
  icono: string | null;
  marcaId: string | null;
};

export function GastosFiltrados({
  personaId,
  categoriaId,
  entidadId,
}: {
  personaId: string;
  categoriaId: string;
  entidadId: string;
}) {
  const [cuotas, setCuotas] = useState<CompraVigente[]>([]);
  const [gastosFijos, setGastosFijos] = useState<GastoFijo[]>([]);
  const [gastosDiarios, setGastosDiarios] = useState<GastoDiario[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [entidades, setEntidades] = useState<Entidad[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [grupoParticipantes, setGrupoParticipantes] = useState<GrupoParticipante[]>([]);
  const [itemParticipantes, setItemParticipantes] = useState<ItemParticipante[]>([]);
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState<GastoUnificado | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  // Campos del popup de edición — se precargan al abrir (ver iniciarEdicion).
  const [fDescripcion, setFDescripcion] = useState("");
  const [fMonto, setFMonto] = useState("");
  const [fCategoriaId, setFCategoriaId] = useState("");
  const [fEntidadId, setFEntidadId] = useState("");
  const [fGrupoId, setFGrupoId] = useState("");
  const [fFecha, setFFecha] = useState("");

  async function cargarTodo() {
    setCargando(true);
    const [{ data: c }, { data: gf }, { data: gd }, { data: cat }, { data: e }, { data: m }, { data: p }, { data: gr }, { data: gp }, { data: ip }] =
      await Promise.all([
        supabase.from("vista_cuotas_vigentes").select("*"),
        supabase.from("gastos_fijos").select("*").eq("activo", true),
        supabase
          .from("gastos_diarios")
          .select("*")
          .gte("fecha", mesActualISO())
          .lt("fecha", primerDiaMesSiguiente()),
        supabase.from("categorias").select("*").order("nombre"),
        supabase.from("entidades").select("*").order("nombre"),
        supabase.from("marcas").select("*").order("nombre"),
        supabase.from("personas").select("*").eq("activo", true).order("nombre"),
        supabase.from("grupos").select("*").order("nombre"),
        supabase.from("grupo_participantes").select("*"),
        supabase.from("item_participantes").select("*"),
      ]);
    setCuotas((c as CompraVigente[]) ?? []);
    setGastosFijos((gf as GastoFijo[]) ?? []);
    setGastosDiarios((gd as GastoDiario[]) ?? []);
    setCategorias((cat as Categoria[]) ?? []);
    setEntidades((e as Entidad[]) ?? []);
    setMarcas((m as Marca[]) ?? []);
    setPersonas((p as Persona[]) ?? []);
    setGrupos((gr as Grupo[]) ?? []);
    setGrupoParticipantes((gp as GrupoParticipante[]) ?? []);
    setItemParticipantes((ip as ItemParticipante[]) ?? []);
    setCargando(false);
  }

  useEffect(() => {
    cargarTodo();
  }, []);

  const categoriaNombre = (id: string | null) => categorias.find((c) => c.id === id)?.nombre ?? "Sin categoría";
  const entidadNombre = (id: string | null) => entidades.find((e) => e.id === id)?.nombre ?? null;
  const personaNombre = (id: string) => personas.find((p) => p.id === id)?.nombre ?? "?";

  // Personas asociadas a un ítem: si tiene grupo, todos los participantes de
  // ese grupo (mismo criterio que el resto de la app); si no, los que tenga
  // en item_participantes (solo aplica a compra/gasto_fijo — los diarios no
  // usan reparto suelto, ver DiariosLista.tsx).
  function personasDe(item: GastoUnificado): string[] {
    if (item.grupoId) {
      return grupoParticipantes.filter((gp) => gp.grupo_id === item.grupoId).map((gp) => personaNombre(gp.persona_id));
    }
    return itemParticipantes
      .filter((ip) => ip.origen === item.origen && ip.origen_id === item.origenId)
      .map((ip) => personaNombre(ip.persona_id));
  }

  const todos: GastoUnificado[] = useMemo(() => {
    const deCuotas: GastoUnificado[] = cuotas.map((c) => ({
      key: `compra-${c.compra_id}`,
      origen: "compra",
      origenId: c.compra_id,
      descripcion: c.descripcion,
      monto: Number(c.monto_cuota),
      categoriaId: c.categoria_id,
      entidadId: c.entidad_id,
      grupoId: c.grupo_id,
      detalle: c.n_cuotas > 1 ? `Cuota ${c.cuota_actual} de ${c.n_cuotas}` : "Pago único",
      fecha: null,
      icono: c.icono,
      marcaId: c.marca_id,
    }));
    const deFijos: GastoUnificado[] = gastosFijos.map((g) => ({
      key: `gasto_fijo-${g.id}`,
      origen: "gasto_fijo",
      origenId: g.id,
      descripcion: g.descripcion,
      monto: Number(g.monto_estimado),
      categoriaId: g.categoria_id,
      entidadId: g.entidad_id,
      grupoId: g.grupo_id,
      detalle: "Recurrente",
      fecha: null,
      icono: g.icono,
      marcaId: g.marca_id,
    }));
    const deDiarios: GastoUnificado[] = gastosDiarios.map((d) => ({
      key: `gasto_diario-${d.id}`,
      origen: "gasto_diario",
      origenId: d.id,
      descripcion: d.descripcion,
      monto: Number(d.monto),
      categoriaId: d.categoria_id,
      entidadId: null,
      grupoId: d.grupo_id,
      detalle: "Diario",
      fecha: d.fecha,
      icono: null,
      marcaId: d.marca_id,
    }));
    return [...deCuotas, ...deFijos, ...deDiarios];
  }, [cuotas, gastosFijos, gastosDiarios]);

  const filtrados = todos.filter((item) => {
    if (categoriaId && item.categoriaId !== categoriaId) return false;
    if (entidadId && item.entidadId !== entidadId) return false;
    if (personaId) {
      const idsAsociados = item.grupoId
        ? grupoParticipantes.filter((gp) => gp.grupo_id === item.grupoId).map((gp) => gp.persona_id)
        : itemParticipantes.filter((ip) => ip.origen === item.origen && ip.origen_id === item.origenId).map((ip) => ip.persona_id);
      if (!idsAsociados.includes(personaId)) return false;
    }
    return true;
  });

  function iniciarEdicion(item: GastoUnificado) {
    setEditando(item);
    setError("");
    setFDescripcion(item.descripcion);
    setFMonto(String(item.monto));
    setFCategoriaId(item.categoriaId ?? "");
    setFEntidadId(item.entidadId ?? "");
    setFGrupoId(item.grupoId ?? "");
    setFFecha(item.fecha ?? "");
  }

  async function guardarEdicion() {
    if (!editando) return;
    setGuardando(true);
    setError("");
    try {
      const tabla = editando.origen === "compra" ? "compras" : editando.origen === "gasto_fijo" ? "gastos_fijos" : "gastos_diarios";
      const payload: Record<string, unknown> = {
        descripcion: fDescripcion,
        categoria_id: fCategoriaId || null,
        grupo_id: fGrupoId || null,
      };
      // El monto solo se edita directo en fijos y diarios — en una compra en
      // cuotas, "monto" acá es la cuota vigente de este mes (derivada de
      // monto_total/n_cuotas), no un campo propio; cambiar eso a fondo se
      // sigue haciendo desde la pestaña Cuotas (editar ahí sí toca
      // monto_total/n_cuotas). Acá una compra solo permite reasignar
      // categoría/cuenta/grupo, no su monto.
      if (editando.origen === "gasto_fijo") payload.monto_estimado = Number(fMonto);
      if (editando.origen === "gasto_diario") {
        payload.monto = Number(fMonto);
        payload.fecha = fFecha;
      }
      if (editando.origen !== "gasto_diario") payload.entidad_id = fEntidadId || null;
      const { error: updError } = await supabase.from(tabla).update(payload).eq("id", editando.origenId);
      if (updError) throw updError;
      setEditando(null);
      await cargarTodo();
    } catch (err) {
      setError(mensajeError(err) || "No se pudo guardar. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) {
    return <p className="py-10 text-center text-gray-400 dark:text-gray-500">Cargando…</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400 dark:text-gray-500">
        {filtrados.length} resultado{filtrados.length === 1 ? "" : "s"} · Normal, recurrente y cuotas juntos.
      </p>
      {filtrados.length === 0 ? (
        <Card>
          <p className="py-4 text-center text-sm text-gray-400 dark:text-gray-500">Ningún gasto coincide con estos filtros.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {filtrados.map((item) => {
            const marca = item.marcaId ? marcas.find((m) => m.id === item.marcaId) ?? null : resolverMarca(entidades.find((e) => e.id === item.entidadId) ?? null, marcas);
            const asociados = personasDe(item);
            const entidad = entidadNombre(item.entidadId);
            return (
              <Card key={item.key} className="!p-3.5">
                <button type="button" onClick={() => iniciarEdicion(item)} className="flex w-full items-center gap-3 text-left">
                  <EntidadAvatar marca={marca} icono={item.icono} nombreFallback={item.descripcion} className="h-9 w-9 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-700 dark:text-gray-200">{item.descripcion}</p>
                    <p className="truncate text-[11px] text-gray-400 dark:text-gray-500">
                      {categoriaNombre(item.categoriaId)} · {item.detalle}
                      {entidad ? ` · ${entidad}` : ""}
                      {asociados.length > 0 ? ` · ${asociados.join(", ")}` : ""}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-gray-800 dark:text-white">{formatCLP(item.monto)}</p>
                </button>
              </Card>
            );
          })}
        </div>
      )}

      {editando && (
        <VentanaModal titulo="Editar gasto" subtitulo={editando.detalle} onClose={() => setEditando(null)} ancho="md">
          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-medium text-gray-400 dark:text-gray-500">Descripción</label>
              <input
                value={fDescripcion}
                onChange={(e) => setFDescripcion(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
            </div>

            {editando.origen !== "compra" && (
              <div>
                <label className="text-[11px] font-medium text-gray-400 dark:text-gray-500">Monto</label>
                <input
                  type="number"
                  value={fMonto}
                  onChange={(e) => setFMonto(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
                />
              </div>
            )}

            {editando.origen === "gasto_diario" && (
              <div>
                <label className="text-[11px] font-medium text-gray-400 dark:text-gray-500">Fecha</label>
                <input
                  type="date"
                  value={fFecha}
                  onChange={(e) => setFFecha(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
                />
              </div>
            )}

            <div>
              <label className="text-[11px] font-medium text-gray-400 dark:text-gray-500">Categoría</label>
              <select
                value={fCategoriaId}
                onChange={(e) => setFCategoriaId(e.target.value)}
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

            {editando.origen !== "gasto_diario" && (
              <div>
                <label className="text-[11px] font-medium text-gray-400 dark:text-gray-500">Cuenta o tarjeta</label>
                <select
                  value={fEntidadId}
                  onChange={(e) => setFEntidadId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
                >
                  <option value="">Sin cuenta</option>
                  {entidades.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="text-[11px] font-medium text-gray-400 dark:text-gray-500">Grupo / a quién se reparte</label>
              <select
                value={fGrupoId}
                onChange={(e) => setFGrupoId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
              >
                <option value="">— Sin grupo (no se reparte) —</option>
                {grupos.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nombre}
                  </option>
                ))}
              </select>
              {!fGrupoId && itemParticipantes.some((ip) => ip.origen === editando.origen && ip.origen_id === editando.origenId) && (
                <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
                  Este ítem tiene un reparto propio (sin grupo) — para cambiar quién participa sin grupo, edítalo desde su pestaña de siempre.
                </p>
              )}
            </div>

            {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
          </div>
          <div className="mt-4 flex gap-2.5">
            <button
              type="button"
              onClick={guardarEdicion}
              disabled={guardando || !fDescripcion.trim()}
              className="flex-1 rounded-2xl bg-brand-gradient py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {guardando ? "Guardando…" : "Guardar cambios"}
            </button>
            <button
              type="button"
              onClick={() => setEditando(null)}
              className="rounded-2xl bg-gray-100 px-5 py-3 text-sm font-semibold text-gray-500 dark:bg-white/10 dark:text-gray-300"
            >
              Cancelar
            </button>
          </div>
        </VentanaModal>
      )}
    </div>
  );
}
