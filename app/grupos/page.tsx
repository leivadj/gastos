"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/Card";
import { EntidadAvatar } from "@/components/EntidadAvatar";
import { IconoPicker } from "@/components/IconoPicker";
import { ParticipantesPicker } from "@/components/ParticipantesPicker";
import { mensajeError } from "@/lib/supabaseError";
import { Categoria, CategoriaGrupoPreferido, Grupo, GrupoParticipante, Participante, Persona } from "@/lib/types";

// "grupos_nombre_key" es una restricción vieja (de antes de separar los
// datos por cuenta) que exige nombre único en TODAS las cuentas — ver
// migration_17_elimina_unico_nombre_global_personas_grupos.sql.
function traducirErrorGrupo(err: unknown): string {
  const msg = mensajeError(err);
  if (msg.includes("grupos_nombre_key")) {
    return "Todavía falta correr la migración de Supabase migration_17_elimina_unico_nombre_global_personas_grupos.sql — hay una restricción vieja que exige que el nombre sea único entre TODAS las cuentas (no solo la tuya). Corre esa migración y vuelve a intentar.";
  }
  if (msg.includes("grupos_owner_id_nombre_key")) {
    return "Ya tienes un grupo con ese nombre.";
  }
  return msg || "No se pudo guardar el grupo.";
}

export default function GruposPage() {
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [participantesPorGrupo, setParticipantesPorGrupo] = useState<Record<string, GrupoParticipante[]>>({});
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  // categoria_id -> grupo_id, para TODOS los grupos de la cuenta — sirve
  // para saber qué categorías ya están asignadas a otro grupo (y avisar que
  // se van a reasignar) y para armar el resumen de cada tarjeta.
  const [preferenciaPorCategoria, setPreferenciaPorCategoria] = useState<Record<string, string>>({});
  const [mostrarForm, setMostrarForm] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const [nombre, setNombre] = useState("");
  const [icono, setIcono] = useState("");
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  // Categorías que usan el reparto de ESTE grupo por defecto (ver
  // migration_26_reparto_por_categoria.sql) — el formulario de gastos
  // precarga este grupo apenas se elige una de estas categorías.
  const [categoriasElegidas, setCategoriasElegidas] = useState<string[]>([]);

  async function cargarTodo() {
    const [{ data: g }, { data: gp }, { data: p }, { data: cat }, { data: cgp }] = await Promise.all([
      supabase.from("grupos").select("*").order("nombre"),
      supabase.from("grupo_participantes").select("*"),
      supabase.from("personas").select("*").eq("activo", true).order("nombre"),
      supabase.from("categorias").select("*").order("nombre"),
      supabase.from("categoria_grupo_preferido").select("*"),
    ]);
    setGrupos((g as Grupo[]) ?? []);
    setPersonas((p as Persona[]) ?? []);
    setCategorias((cat as Categoria[]) ?? []);
    const agrupado: Record<string, GrupoParticipante[]> = {};
    ((gp as GrupoParticipante[]) ?? []).forEach((row) => {
      if (!agrupado[row.grupo_id]) agrupado[row.grupo_id] = [];
      agrupado[row.grupo_id].push(row);
    });
    setParticipantesPorGrupo(agrupado);
    const mapaPreferencia: Record<string, string> = {};
    ((cgp as CategoriaGrupoPreferido[]) ?? []).forEach((row) => {
      mapaPreferencia[row.categoria_id] = row.grupo_id;
    });
    setPreferenciaPorCategoria(mapaPreferencia);
  }

  useEffect(() => {
    cargarTodo();
  }, []);

  function cancelarForm() {
    setMostrarForm(false);
    setEditandoId(null);
    setNombre("");
    setIcono("");
    setParticipantes([]);
    setCategoriasElegidas([]);
    setError("");
  }

  function iniciarEdicion(g: Grupo) {
    setEditandoId(g.id);
    setNombre(g.nombre);
    setIcono(g.icono ?? "");
    setParticipantes(
      (participantesPorGrupo[g.id] ?? []).map((row) => ({ persona_id: row.persona_id, porcentaje: row.porcentaje }))
    );
    setCategoriasElegidas(
      Object.entries(preferenciaPorCategoria)
        .filter(([, grupoId]) => grupoId === g.id)
        .map(([categoriaId]) => categoriaId)
    );
    setMostrarForm(true);
  }

  function alternarCategoria(categoriaId: string) {
    setCategoriasElegidas((actual) =>
      actual.includes(categoriaId) ? actual.filter((id) => id !== categoriaId) : [...actual, categoriaId]
    );
  }

  // Guarda qué categorías usan el reparto de este grupo por defecto.
  // Primero borra la preferencia de las categorías tocadas (las que se
  // acaban de sacar de este grupo, y las que se acaban de elegir — estas
  // últimas pueden venir apuntando a OTRO grupo, ya que cada categoría solo
  // puede tener un grupo por defecto a la vez) y después inserta las
  // elegidas apuntando a este grupo.
  async function guardarCategoriasPreferidas(grupoId: string) {
    const previamenteEnEsteGrupo = Object.entries(preferenciaPorCategoria)
      .filter(([, gid]) => gid === grupoId)
      .map(([categoriaId]) => categoriaId);
    const aTocar = Array.from(new Set([...previamenteEnEsteGrupo, ...categoriasElegidas]));
    if (aTocar.length > 0) {
      const { error: delError } = await supabase.from("categoria_grupo_preferido").delete().in("categoria_id", aTocar);
      if (delError) throw delError;
    }
    if (categoriasElegidas.length > 0) {
      const { error: insError } = await supabase
        .from("categoria_grupo_preferido")
        .insert(categoriasElegidas.map((categoriaId) => ({ categoria_id: categoriaId, grupo_id: grupoId })));
      if (insError) throw insError;
    }
  }

  async function guardarParticipantes(grupoId: string) {
    const { error: delError } = await supabase.from("grupo_participantes").delete().eq("grupo_id", grupoId);
    if (delError) throw delError;
    if (participantes.length > 0) {
      const { error: insError } = await supabase.from("grupo_participantes").insert(
        participantes.map((p) => ({ grupo_id: grupoId, persona_id: p.persona_id, porcentaje: p.porcentaje }))
      );
      if (insError) throw insError;
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setGuardando(true);
    try {
      const payload = { nombre, icono: icono || null };
      let grupoId = editandoId;
      if (editandoId) {
        const { error: updError } = await supabase.from("grupos").update(payload).eq("id", editandoId);
        if (updError) throw updError;
      } else {
        const { data, error: insError } = await supabase.from("grupos").insert(payload).select().single();
        if (insError) throw insError;
        grupoId = data.id;
      }
      if (grupoId) {
        await guardarParticipantes(grupoId);
        await guardarCategoriasPreferidas(grupoId);
      }
      cancelarForm();
      cargarTodo();
    } catch (err) {
      setError(traducirErrorGrupo(err));
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(id: string) {
    const { error: dbError } = await supabase.from("grupos").delete().eq("id", id);
    if (dbError) {
      setError(dbError.message || "No se pudo eliminar el grupo.");
      return;
    }
    cargarTodo();
  }

  function resumenReparto(g: Grupo) {
    const filas = participantesPorGrupo[g.id] ?? [];
    if (filas.length === 0) return "Sin personas asignadas todavía";
    const sumaFija = filas.filter((f) => f.porcentaje != null).reduce((acc, f) => acc + Number(f.porcentaje), 0);
    const sinFijar = filas.filter((f) => f.porcentaje == null).length;
    return filas
      .map((f) => {
        const nombrePersona = personas.find((p) => p.id === f.persona_id)?.nombre ?? "?";
        const pct = f.porcentaje != null ? f.porcentaje : sinFijar > 0 ? Math.max(0, 100 - sumaFija) / sinFijar : 0;
        return `${nombrePersona} ${Math.round(pct)}%`;
      })
      .join(" · ");
  }

  function categoriasDeGrupo(g: Grupo) {
    return Object.entries(preferenciaPorCategoria)
      .filter(([, grupoId]) => grupoId === g.id)
      .map(([categoriaId]) => categorias.find((c) => c.id === categoriaId)?.nombre ?? "?");
  }

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-800 dark:text-white">Grupos</h1>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Agrupa gastos (ej: &quot;Casa&quot;) y define el reparto una sola vez para todos.
          </p>
        </div>
        <button
          onClick={() => (mostrarForm ? cancelarForm() : setMostrarForm(true))}
          className="rounded-full bg-brand-gradient px-4 py-2 text-sm font-semibold text-white"
        >
          {mostrarForm ? "Cancelar" : "+ Nuevo"}
        </button>
      </div>

      {mostrarForm && (
        <Card>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400">Nombre</label>
              <input
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
                placeholder="Ej: Casa"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400">Ícono (opcional)</label>
              <div className="mt-1">
                <IconoPicker value={icono} onChange={setIcono} />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400">Personas que se hacen cargo</label>
              <p className="mb-1 text-[11px] text-gray-400 dark:text-gray-500">
                Deja el % en blanco para repartir en partes iguales el resto.
              </p>
              <ParticipantesPicker personas={personas} value={participantes} onChange={setParticipantes} />
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400">Categorías con este reparto por defecto (opcional)</label>
              <p className="mb-1.5 text-[11px] text-gray-400 dark:text-gray-500">
                Al crear un gasto en una de estas categorías, este grupo se precarga solo — igual se puede cambiar en
                ese momento. Cada categoría solo puede tener un grupo por defecto a la vez.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {categorias.map((c) => {
                  const elegida = categoriasElegidas.includes(c.id);
                  const otroGrupoId = preferenciaPorCategoria[c.id];
                  const otroGrupo = otroGrupoId && otroGrupoId !== editandoId ? grupos.find((g) => g.id === otroGrupoId) : null;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => alternarCategoria(c.id)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                        elegida
                          ? "bg-brand-gradient text-white"
                          : "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300"
                      }`}
                    >
                      {c.icono ? `${c.icono} ` : ""}
                      {c.nombre}
                      {!elegida && otroGrupo && <span className="opacity-70"> · hoy: {otroGrupo.nombre}</span>}
                    </button>
                  );
                })}
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {grupos.map((g) => (
          <Card key={g.id}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-start gap-3">
                <EntidadAvatar icono={g.icono} nombreFallback={g.nombre} className="h-9 w-9" />
                <div className="min-w-0">
                  <p className="truncate font-semibold text-gray-800 dark:text-white">{g.nombre}</p>
                  <p className="truncate text-xs text-gray-400 dark:text-gray-500">{resumenReparto(g)}</p>
                  {categoriasDeGrupo(g).length > 0 && (
                    <p className="truncate text-[11px] text-gray-400 dark:text-gray-500">
                      Por defecto en: {categoriasDeGrupo(g).join(", ")}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <button onClick={() => iniciarEdicion(g)} className="text-xs text-brand-from dark:text-pink-400">
                  editar
                </button>
                <button onClick={() => eliminar(g.id)} className="text-xs text-gray-300 dark:text-gray-600 hover:text-red-400">
                  eliminar
                </button>
              </div>
            </div>
          </Card>
        ))}
        {grupos.length === 0 && (
          <p className="text-center text-sm text-gray-400 dark:text-gray-500">
            Aún no tienes grupos. Crea uno para agrupar gastos como luz, agua y gas bajo un mismo reparto.
          </p>
        )}
      </div>
    </div>
  );
}
