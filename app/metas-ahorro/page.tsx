"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/Card";
import { EntidadAvatar } from "@/components/EntidadAvatar";
import { IconoPicker } from "@/components/IconoPicker";
import { ItemDesplegable } from "@/components/ItemDesplegable";
import { formatCLP } from "@/lib/format";
import { mensajeError } from "@/lib/supabaseError";
import { MetaAhorroAporte, MetaAhorroProgreso } from "@/lib/types";

function diasHasta(fechaISO: string): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const obj = new Date(`${fechaISO}T00:00:00`);
  return Math.round((obj.getTime() - hoy.getTime()) / 86400000);
}

function fechaHoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function MetasAhorroPage() {
  const [metas, setMetas] = useState<MetaAhorroProgreso[]>([]);
  const [aportes, setAportes] = useState<MetaAhorroAporte[]>([]);
  const [cargando, setCargando] = useState(true);

  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const [nombre, setNombre] = useState("");
  const [montoObjetivo, setMontoObjetivo] = useState("");
  const [fechaObjetivo, setFechaObjetivo] = useState("");
  const [icono, setIcono] = useState("");

  const [aportandoId, setAportandoId] = useState<string | null>(null);
  const [montoAporte, setMontoAporte] = useState("");
  const [fechaAporte, setFechaAporte] = useState(fechaHoyISO());
  const [notasAporte, setNotasAporte] = useState("");
  const [guardandoAporte, setGuardandoAporte] = useState(false);

  async function cargarTodo() {
    const [{ data: m }, { data: ap }] = await Promise.all([
      supabase.from("vista_metas_ahorro_progreso").select("*").eq("activa", true).order("nombre"),
      supabase.from("metas_ahorro_aportes").select("*").order("fecha", { ascending: false }),
    ]);
    setMetas((m as MetaAhorroProgreso[]) ?? []);
    setAportes((ap as MetaAhorroAporte[]) ?? []);
    setCargando(false);
  }

  useEffect(() => {
    cargarTodo();
  }, []);

  function cancelarForm() {
    setMostrarForm(false);
    setEditandoId(null);
    setNombre("");
    setMontoObjetivo("");
    setFechaObjetivo("");
    setIcono("");
    setError("");
  }

  function iniciarEdicion(m: MetaAhorroProgreso) {
    setEditandoId(m.meta_id);
    setNombre(m.nombre);
    setMontoObjetivo(String(m.monto_objetivo));
    setFechaObjetivo(m.fecha_objetivo ?? "");
    setIcono(m.icono ?? "");
    setMostrarForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setGuardando(true);
    try {
      const payload = {
        nombre,
        monto_objetivo: Number(montoObjetivo),
        fecha_objetivo: fechaObjetivo || null,
        icono: icono || null,
        activa: true,
      };
      if (editandoId) {
        const { error: updError } = await supabase.from("metas_ahorro").update(payload).eq("id", editandoId);
        if (updError) throw updError;
      } else {
        const { error: insError } = await supabase.from("metas_ahorro").insert(payload);
        if (insError) throw insError;
      }
      cancelarForm();
      cargarTodo();
    } catch (err) {
      setError(mensajeError(err) || "No se pudo guardar. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  async function archivar(id: string) {
    const { error: dbError } = await supabase.from("metas_ahorro").update({ activa: false }).eq("id", id);
    if (dbError) {
      setError(dbError.message || "No se pudo archivar.");
      return;
    }
    cargarTodo();
  }

  function abrirAporte(metaId: string) {
    setError("");
    setAportandoId(metaId);
    setMontoAporte("");
    setFechaAporte(fechaHoyISO());
    setNotasAporte("");
  }

  async function confirmarAporte(metaId: string) {
    if (!montoAporte) return;
    setGuardandoAporte(true);
    setError("");
    try {
      const { error: insError } = await supabase.from("metas_ahorro_aportes").insert({
        meta_id: metaId,
        monto: Number(montoAporte),
        fecha: fechaAporte,
        notas: notasAporte || null,
      });
      if (insError) throw insError;
      setAportandoId(null);
      await cargarTodo();
    } catch (err) {
      setError(mensajeError(err) || "No se pudo guardar el aporte. Intenta de nuevo.");
    } finally {
      setGuardandoAporte(false);
    }
  }

  async function borrarAporte(id: string) {
    const { error: delError } = await supabase.from("metas_ahorro_aportes").delete().eq("id", id);
    if (delError) {
      setError(delError.message || "No se pudo borrar el aporte.");
      return;
    }
    cargarTodo();
  }

  if (cargando) {
    return <p className="py-10 text-center text-gray-400">Cargando…</p>;
  }

  const enProgreso = metas.filter((m) => m.monto_actual < m.monto_objetivo);
  const cumplidas = metas.filter((m) => m.monto_actual >= m.monto_objetivo);

  function renderMeta(m: MetaAhorroProgreso) {
    const pct = Math.min(100, Math.max(0, (m.monto_actual / m.monto_objetivo) * 100));
    const cumplida = m.monto_actual >= m.monto_objetivo;
    const aportesMeta = aportes.filter((a) => a.meta_id === m.meta_id);
    const plazo = m.fecha_objetivo ? diasHasta(m.fecha_objetivo) : null;

    return (
      <Card key={m.meta_id}>
        <ItemDesplegable
          resumen={({ onClick }) => (
            <div>
              <button type="button" onClick={onClick} className="flex w-full items-start gap-3 text-left">
                <EntidadAvatar entidad={null} icono={m.icono} nombreFallback={m.nombre} className="h-9 w-9" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-semibold text-gray-800">{m.nombre}</p>
                    {cumplida && (
                      <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-500">
                        Cumplida
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">
                    {formatCLP(m.monto_actual)} de {formatCLP(m.monto_objetivo)}
                    {plazo != null && !cumplida && (plazo >= 0 ? ` · faltan ${plazo} días` : ` · venció hace ${-plazo} días`)}
                  </p>
                </div>
              </button>
              <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-pink-100">
                <div
                  className={`h-full ${cumplida ? "bg-emerald-400" : "bg-brand-gradient"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}
          detalle={({ onClick }) => (
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3">
                  <EntidadAvatar entidad={null} icono={m.icono} nombreFallback={m.nombre} className="h-9 w-9" />
                  <div>
                    <p className="pt-1 font-semibold text-gray-800">{m.nombre}</p>
                    <p className="text-xs text-gray-400">
                      {formatCLP(m.monto_actual)} de {formatCLP(m.monto_objetivo)}
                    </p>
                  </div>
                </div>
                <button type="button" onClick={onClick} className="shrink-0 pt-1.5 text-xs text-gray-400">
                  cerrar ✕
                </button>
              </div>

              <div className="mt-3 space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Aportes</p>
                {aportesMeta.length === 0 ? (
                  <p className="text-xs text-gray-400">Todavía no hay aportes registrados.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {aportesMeta.map((a) => (
                      <li key={a.id} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-gray-400">
                          {a.fecha}
                          {a.notas ? ` · ${a.notas}` : ""}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className={`font-semibold ${a.monto < 0 ? "text-red-400" : "text-emerald-600"}`}>
                            {a.monto < 0 ? "" : "+"}
                            {formatCLP(a.monto)}
                          </span>
                          <button onClick={() => borrarAporte(a.id)} className="text-gray-300 hover:text-red-400">
                            ✕
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {aportandoId === m.meta_id ? (
                <div className="mt-3 space-y-2 rounded-lg bg-purple-50 p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      autoFocus
                      placeholder="Monto"
                      value={montoAporte}
                      onChange={(e) => setMontoAporte(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
                    />
                    <input
                      type="date"
                      value={fechaAporte}
                      onChange={(e) => setFechaAporte(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
                    />
                  </div>
                  <input
                    placeholder="Nota (opcional)"
                    value={notasAporte}
                    onChange={(e) => setNotasAporte(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
                  />
                  <p className="text-[10.5px] text-gray-400">Usa un monto negativo para registrar un retiro.</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => confirmarAporte(m.meta_id)}
                      disabled={guardandoAporte || !montoAporte}
                      className="flex-1 rounded-lg bg-brand-gradient py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      Confirmar
                    </button>
                    <button
                      onClick={() => setAportandoId(null)}
                      className="flex-1 rounded-lg bg-white py-1.5 text-xs font-semibold text-gray-400"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => abrirAporte(m.meta_id)}
                  className="mt-3 w-full rounded-lg bg-purple-50 py-2 text-xs font-semibold text-brand-from"
                >
                  + Agregar aporte
                </button>
              )}

              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => iniciarEdicion(m)}
                  className="flex-1 rounded-lg bg-gray-50 py-2 text-xs font-semibold text-gray-500"
                >
                  Editar
                </button>
                <button
                  onClick={() => archivar(m.meta_id)}
                  className="flex-1 rounded-lg bg-gray-50 py-2 text-xs font-semibold text-gray-400 hover:text-red-400"
                >
                  Archivar
                </button>
              </div>
            </div>
          )}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-800">Metas de ahorro</h1>
          <p className="text-xs text-gray-400">Objetivos puntuales, no afectan tu disponible del mes.</p>
        </div>
        <button
          onClick={() => (mostrarForm ? cancelarForm() : setMostrarForm(true))}
          className="rounded-full bg-brand-gradient px-4 py-2 text-sm font-semibold text-white"
        >
          {mostrarForm ? "Cancelar" : "+ Nueva"}
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
                placeholder="Ej: Viaje a Cancún"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500">Monto objetivo</label>
                <input
                  required
                  type="number"
                  min={0}
                  value={montoObjetivo}
                  onChange={(e) => setMontoObjetivo(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Fecha objetivo (opcional)</label>
                <input
                  type="date"
                  value={fechaObjetivo}
                  onChange={(e) => setFechaObjetivo(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500">Ícono (opcional)</label>
              <div className="mt-1">
                <IconoPicker value={icono} onChange={setIcono} />
              </div>
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

      {enProgreso.length > 0 && (
        <div className="space-y-3">
          <p className="px-1 text-xs font-bold uppercase tracking-wide text-gray-400">En progreso</p>
          {enProgreso.map(renderMeta)}
        </div>
      )}

      {cumplidas.length > 0 && (
        <div className="space-y-3">
          <p className="px-1 text-xs font-bold uppercase tracking-wide text-gray-400">Cumplidas</p>
          {cumplidas.map(renderMeta)}
        </div>
      )}

      {metas.length === 0 && !mostrarForm && (
        <p className="text-center text-sm text-gray-400">Todavía no tienes metas de ahorro.</p>
      )}

      {error && !mostrarForm && <p className="text-center text-xs text-red-500">{error}</p>}
    </div>
  );
}
