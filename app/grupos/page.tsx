"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/Card";
import { EntidadAvatar } from "@/components/EntidadAvatar";
import { IconoPicker } from "@/components/IconoPicker";
import { ParticipantesPicker } from "@/components/ParticipantesPicker";
import { Grupo, GrupoParticipante, Participante, Persona } from "@/lib/types";

export default function GruposPage() {
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [participantesPorGrupo, setParticipantesPorGrupo] = useState<Record<string, GrupoParticipante[]>>({});
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const [nombre, setNombre] = useState("");
  const [icono, setIcono] = useState("");
  const [participantes, setParticipantes] = useState<Participante[]>([]);

  async function cargarTodo() {
    const [{ data: g }, { data: gp }, { data: p }] = await Promise.all([
      supabase.from("grupos").select("*").order("nombre"),
      supabase.from("grupo_participantes").select("*"),
      supabase.from("personas").select("*").eq("activo", true).order("nombre"),
    ]);
    setGrupos((g as Grupo[]) ?? []);
    setPersonas((p as Persona[]) ?? []);
    const agrupado: Record<string, GrupoParticipante[]> = {};
    ((gp as GrupoParticipante[]) ?? []).forEach((row) => {
      if (!agrupado[row.grupo_id]) agrupado[row.grupo_id] = [];
      agrupado[row.grupo_id].push(row);
    });
    setParticipantesPorGrupo(agrupado);
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
    setError("");
  }

  function iniciarEdicion(g: Grupo) {
    setEditandoId(g.id);
    setNombre(g.nombre);
    setIcono(g.icono ?? "");
    setParticipantes(
      (participantesPorGrupo[g.id] ?? []).map((row) => ({ persona_id: row.persona_id, porcentaje: row.porcentaje }))
    );
    setMostrarForm(true);
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
      if (grupoId) await guardarParticipantes(grupoId);
      cancelarForm();
      cargarTodo();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el grupo.");
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

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-800">Grupos</h1>
          <p className="text-xs text-gray-400">
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
              <label className="text-xs text-gray-500">Nombre</label>
              <input
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                placeholder="Ej: Casa"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Ícono (opcional)</label>
              <div className="mt-1">
                <IconoPicker value={icono} onChange={setIcono} />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500">Personas que se hacen cargo</label>
              <p className="mb-1 text-[11px] text-gray-400">
                Deja el % en blanco para repartir en partes iguales el resto.
              </p>
              <ParticipantesPicker personas={personas} value={participantes} onChange={setParticipantes} />
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
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

      <div className="space-y-3">
        {grupos.map((g) => (
          <Card key={g.id}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-3">
                <EntidadAvatar icono={g.icono} nombreFallback={g.nombre} className="h-9 w-9" />
                <div>
                  <p className="font-semibold text-gray-800">{g.nombre}</p>
                  <p className="text-xs text-gray-400">{resumenReparto(g)}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <button onClick={() => iniciarEdicion(g)} className="text-xs text-brand-from">
                  editar
                </button>
                <button onClick={() => eliminar(g.id)} className="text-xs text-gray-300 hover:text-red-400">
                  eliminar
                </button>
              </div>
            </div>
          </Card>
        ))}
        {grupos.length === 0 && (
          <p className="text-center text-sm text-gray-400">
            Aún no tienes grupos. Crea uno para agrupar gastos como luz, agua y gas bajo un mismo reparto.
          </p>
        )}
      </div>
    </div>
  );
}
