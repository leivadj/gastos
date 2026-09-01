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
  const [correo, setCorreo] = useState("");

  async function cargar() {
    const { data } = await supabase.from("personas").select("*").order("nombre");
    setPersonas((data as Persona[]) ?? []);
  }

  useEffect(() => {
    cargar();
    supabase.auth.getSession().then(({ data }) => setCorreo(data.session?.user?.email ?? ""));
  }, []);

  async function cerrarSesion() {
    await supabase.auth.signOut();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setGuardando(true);
    await supabase.from("personas").insert({ nombre, activo: true });
    setGuardando(false);
    setMostrarForm(false);
    setNombre("");
    cargar();
  }

  async function desactivar(id: string) {
    await supabase.from("personas").update({ activo: false }).eq("id", id);
    cargar();
  }

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-800">Personas</h1>
          <p className="text-xs text-gray-400">
            El reparto entre personas ahora se define en cada gasto/compra o en Grupos.
          </p>
        </div>
        <button
          onClick={() => setMostrarForm((v) => !v)}
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
                <button onClick={() => desactivar(p.id)} className="text-xs text-gray-300 hover:text-red-400">
                  quitar
                </button>
              </div>
            </Card>
          ))}
      </div>

      <Card>
        <p className="text-xs text-gray-400">Sesión iniciada como</p>
        <p className="mb-3 truncate text-sm font-semibold text-gray-800">{correo}</p>
        <button
          onClick={cerrarSesion}
          className="w-full rounded-lg border border-gray-200 py-2.5 text-sm font-semibold text-gray-500 hover:border-red-200 hover:text-red-500"
        >
          Cerrar sesión
        </button>
      </Card>
    </div>
  );
}
