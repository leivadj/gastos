"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/Card";
import { formatCLP } from "@/lib/format";
import { Categoria, Entidad, GastoFijo, ModoReparto, Persona } from "@/lib/types";

export default function GastosFijosPage() {
  const [gastos, setGastos] = useState<GastoFijo[]>([]);
  const [entidades, setEntidades] = useState<Entidad[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [diaMes, setDiaMes] = useState("1");
  const [entidadId, setEntidadId] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [modoReparto, setModoReparto] = useState<ModoReparto>("automatico");
  const [personaId, setPersonaId] = useState("");

  async function cargarTodo() {
    const [{ data: g }, { data: e }, { data: cat }, { data: p }] = await Promise.all([
      supabase.from("gastos_fijos").select("*").eq("activo", true).order("descripcion"),
      supabase.from("entidades").select("*").order("nombre"),
      supabase.from("categorias").select("*").order("nombre"),
      supabase.from("personas").select("*").eq("activo", true).order("nombre"),
    ]);
    setGastos((g as GastoFijo[]) ?? []);
    setEntidades((e as Entidad[]) ?? []);
    setCategorias((cat as Categoria[]) ?? []);
    setPersonas((p as Persona[]) ?? []);
  }

  useEffect(() => {
    cargarTodo();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setGuardando(true);
    await supabase.from("gastos_fijos").insert({
      descripcion,
      monto_estimado: Number(monto),
      dia_mes_pago: Number(diaMes),
      entidad_id: entidadId || null,
      categoria_id: categoriaId || null,
      modo_reparto: modoReparto,
      persona_id: modoReparto === "manual" ? personaId || null : null,
      activo: true,
    });
    setGuardando(false);
    setMostrarForm(false);
    setDescripcion("");
    setMonto("");
    cargarTodo();
  }

  async function desactivar(id: string) {
    await supabase.from("gastos_fijos").update({ activo: false }).eq("id", id);
    cargarTodo();
  }

  const nombreCategoria = (id: string | null) => categorias.find((c) => c.id === id)?.nombre ?? "—";
  const nombrePersona = (id: string | null) => personas.find((p) => p.id === id)?.nombre ?? "—";
  const total = gastos.reduce((acc, g) => acc + Number(g.monto_estimado), 0);

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-800">Gastos fijos</h1>
          <p className="text-xs text-gray-400">Se repiten todos los meses (luz, agua, gas, arriendo…)</p>
        </div>
        <button
          onClick={() => setMostrarForm((v) => !v)}
          className="rounded-full bg-brand-gradient px-4 py-2 text-sm font-semibold text-white"
        >
          {mostrarForm ? "Cancelar" : "+ Nuevo"}
        </button>
      </div>

      {mostrarForm && (
        <Card>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-xs text-gray-500">Descripción</label>
              <input
                required
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                placeholder="Ej: Luz"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500">Monto estimado</label>
                <input
                  required
                  type="number"
                  min={0}
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Día de pago</label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={diaMes}
                  onChange={(e) => setDiaMes(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500">Medio de pago</label>
                <select
                  value={entidadId}
                  onChange={(e) => setEntidadId(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  <option value="">—</option>
                  {entidades.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">Categoría</label>
                <select
                  value={categoriaId}
                  onChange={(e) => setCategoriaId(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  <option value="">—</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500">¿Cómo se reparte?</label>
              <div className="mt-1 flex gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => setModoReparto("automatico")}
                  className={`flex-1 rounded-lg border px-3 py-2 ${
                    modoReparto === "automatico" ? "border-brand-from bg-purple-50 font-semibold" : "border-gray-200"
                  }`}
                >
                  % automático
                </button>
                <button
                  type="button"
                  onClick={() => setModoReparto("manual")}
                  className={`flex-1 rounded-lg border px-3 py-2 ${
                    modoReparto === "manual" ? "border-brand-from bg-purple-50 font-semibold" : "border-gray-200"
                  }`}
                >
                  A una persona
                </button>
              </div>
            </div>
            {modoReparto === "manual" && (
              <div>
                <label className="text-xs text-gray-500">Persona responsable</label>
                <select
                  required
                  value={personaId}
                  onChange={(e) => setPersonaId(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  <option value="">Selecciona…</option>
                  {personas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <button
              type="submit"
              disabled={guardando}
              className="w-full rounded-lg bg-brand-gradient py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {guardando ? "Guardando…" : "Guardar"}
            </button>
          </form>
        </Card>
      )}

      <Card>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Total gastos fijos / mes</span>
          <span className="font-semibold text-gray-800">{formatCLP(total)}</span>
        </div>
      </Card>

      <div className="space-y-3">
        {gastos.map((g) => (
          <Card key={g.id}>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-gray-800">{g.descripcion}</p>
                <p className="text-xs text-gray-400">
                  {nombreCategoria(g.categoria_id)} · día {g.dia_mes_pago ?? "—"} ·{" "}
                  {g.modo_reparto === "manual" ? nombrePersona(g.persona_id) : "reparto automático"}
                </p>
              </div>
              <button onClick={() => desactivar(g.id)} className="text-xs text-gray-300 hover:text-red-400">
                quitar
              </button>
            </div>
            <p className="mt-2 text-right font-semibold text-gray-800">{formatCLP(g.monto_estimado)}</p>
          </Card>
        ))}
        {gastos.length === 0 && <p className="text-center text-sm text-gray-400">Aún no hay gastos fijos.</p>}
      </div>
    </div>
  );
}
