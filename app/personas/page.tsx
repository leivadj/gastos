"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/Card";
import { Persona } from "@/lib/types";

export default function PersonasPage() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [porcentaje, setPorcentaje] = useState("");

  async function cargar() {
    const { data } = await supabase.from("personas").select("*").order("nombre");
    setPersonas((data as Persona[]) ?? []);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setGuardando(true);
    await supabase.from("personas").insert({
      nombre,
      porcentaje_reparto: porcentaje ? Number(porcentaje) : null,
      activo: true,
    });
    setGuardando(false);
    setMostrarForm(false);
    setNombre("");
    setPorcentaje("");
    cargar();
  }

  async function actualizarPorcentaje(id: string, valor: string) {
    const n = valor === "" ? null : Number(valor);
    await supabase.from("personas").update({ porcentaje_reparto: n }).eq("id", id);
    cargar();
  }

  async function desactivar(id: string) {
    await supabase.from("personas").update({ activo: false }).eq("id", id);
    cargar();
  }

  const sumaPorcentajes = personas
    .filter((p) => p.activo && p.porcentaje_reparto != null)
    .reduce((acc, p) => acc + Number(p.porcentaje_reparto), 0);

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-800">Personas</h1>
          <p className="text-xs text-gray-400">El % se usa solo en los gastos con reparto automático.</p>
        </div>
        <button
          onClick={() => setMostrarForm((v) => !v)}
          className="rounded-full bg-brand-gradient px-4 py-2 text-sm font-semibold text-white"
        >
          {mostrarForm ? "Cancelar" : "+ Nueva"}
        </button>
      </div>

      {sumaPorcentajes !== 0 && sumaPorcentajes !== 100 && (
        <div className="rounded-xl bg-amber-50 px-4 py-2 text-xs text-amber-700">
          Los porcentajes de reparto automático suman {sumaPorcentajes}%, no 100%. Ajusta para que los gastos
          compartidos calcen exactos.
        </div>
      )}

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
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">% de reparto automático (opcional)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={porcentaje}
                onChange={(e) => setPorcentaje(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                placeholder="Déjalo vacío si no participa del reparto automático"
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
        {personas
          .filter((p) => p.activo)
          .map((p) => (
            <Card key={p.id}>
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-gray-800">{p.nombre}</p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    defaultValue={p.porcentaje_reparto ?? ""}
                    onBlur={(e) => actualizarPorcentaje(p.id, e.target.value)}
                    placeholder="—"
                    className="w-16 rounded-lg border border-gray-200 px-2 py-1 text-right text-sm"
                  />
                  <span className="text-sm text-gray-400">%</span>
                  <button onClick={() => desactivar(p.id)} className="text-xs text-gray-300 hover:text-red-400">
                    quitar
                  </button>
                </div>
              </div>
            </Card>
          ))}
      </div>
    </div>
  );
}
