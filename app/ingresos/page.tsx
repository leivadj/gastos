"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/Card";
import { EVENTO_MOVIMIENTO_GUARDADO } from "@/components/MovimientoRapido";
import { formatCLP, mesActualISO, nombreMes } from "@/lib/format";
import { Ingreso, Persona } from "@/lib/types";

export default function IngresosPage() {
  const [ingresos, setIngresos] = useState<Ingreso[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [personaId, setPersonaId] = useState("");
  const [monto, setMonto] = useState("");
  const [mes, setMes] = useState(mesActualISO());
  const [descripcion, setDescripcion] = useState("");

  async function cargarTodo() {
    const [{ data: i }, { data: p }] = await Promise.all([
      supabase.from("ingresos").select("*").order("mes", { ascending: false }),
      supabase.from("personas").select("*").eq("activo", true).order("nombre"),
    ]);
    setIngresos((i as Ingreso[]) ?? []);
    setPersonas((p as Persona[]) ?? []);
  }

  useEffect(() => {
    cargarTodo();
    window.addEventListener(EVENTO_MOVIMIENTO_GUARDADO, cargarTodo);
    return () => window.removeEventListener(EVENTO_MOVIMIENTO_GUARDADO, cargarTodo);
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setGuardando(true);
    await supabase.from("ingresos").insert({
      persona_id: personaId || null,
      monto: Number(monto),
      mes,
      descripcion: descripcion || null,
    });
    setGuardando(false);
    setMostrarForm(false);
    setMonto("");
    setDescripcion("");
    cargarTodo();
  }

  async function eliminar(id: string) {
    await supabase.from("ingresos").delete().eq("id", id);
    cargarTodo();
  }

  const nombrePersona = (id: string | null) => personas.find((p) => p.id === id)?.nombre ?? "—";

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-800 dark:text-white">Ingresos</h1>
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
              <label className="text-xs text-gray-500 dark:text-gray-400">Persona</label>
              <select
                required
                value={personaId}
                onChange={(e) => setPersonaId(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
              >
                <option value="">Selecciona…</option>
                {personas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400">Monto</label>
                <input
                  required
                  type="number"
                  min={0}
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400">Mes</label>
                <input
                  required
                  type="date"
                  value={mes}
                  onChange={(e) => setMes(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400">Descripción (opcional)</label>
              <input
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
                placeholder="Ej: Sueldo"
              />
            </div>
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

      <div className="space-y-3">
        {ingresos.map((i) => (
          <Card key={i.id}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-800 dark:text-white">{nombrePersona(i.persona_id)}</p>
                <p className="text-xs text-gray-400 capitalize dark:text-gray-500">
                  {nombreMes(i.mes)} {i.descripcion ? `· ${i.descripcion}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <p className="font-semibold text-gray-800 dark:text-white">{formatCLP(i.monto)}</p>
                <button onClick={() => eliminar(i.id)} className="text-xs text-gray-300 hover:text-red-400 dark:text-gray-600">
                  eliminar
                </button>
              </div>
            </div>
          </Card>
        ))}
        {ingresos.length === 0 && <p className="text-center text-sm text-gray-400 dark:text-gray-500">Aún no hay ingresos registrados.</p>}
      </div>
    </div>
  );
}
