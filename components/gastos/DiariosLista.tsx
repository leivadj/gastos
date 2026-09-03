"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/Card";
import { formatCLP, mesActualISO, primerDiaMesSiguiente } from "@/lib/format";
import { mensajeError } from "@/lib/supabaseError";
import { Categoria, GastoDiario } from "@/lib/types";

const hoyISO = () => new Date().toISOString().slice(0, 10);

function fechaCorta(fechaISO: string): string {
  const fecha = new Date(`${fechaISO.slice(0, 10)}T00:00:00`);
  return new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short" }).format(fecha).replace(".", "");
}

// Pestaña "Diarios" de /gastos — compras chicas/improvisadas del día a día
// (pan, queso, algo que faltaba...). Carga rápida a propósito: solo monto y
// descripción, sin medio de pago ni reparto entre personas. Todas caen bajo
// la categoría compartida "Hogar" (ver migration_21), elegida sola acá, sin
// que el usuario tenga que elegirla. Solo muestra el mes actual — no es un
// historial largo, es un anotador rápido de gastos sueltos.
export function DiariosLista() {
  const [gastos, setGastos] = useState<GastoDiario[]>([]);
  const [categoriaHogarId, setCategoriaHogarId] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(hoyISO());
  const [guardando, setGuardando] = useState(false);

  async function cargarTodo() {
    const [{ data: g }, { data: cat }] = await Promise.all([
      supabase
        .from("gastos_diarios")
        .select("*")
        .gte("fecha", mesActualISO())
        .lt("fecha", primerDiaMesSiguiente())
        .order("fecha", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase.from("categorias").select("*").eq("nombre", "Hogar"),
    ]);
    setGastos((g as GastoDiario[]) ?? []);
    setCategoriaHogarId(((cat as Categoria[]) ?? [])[0]?.id ?? null);
    setCargando(false);
  }

  useEffect(() => {
    cargarTodo();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!monto || !descripcion) return;
    setError("");
    setGuardando(true);
    try {
      const { error: insError } = await supabase.from("gastos_diarios").insert({
        descripcion,
        monto: Number(monto),
        fecha,
        categoria_id: categoriaHogarId,
      });
      if (insError) throw insError;
      setDescripcion("");
      setMonto("");
      setFecha(hoyISO());
      await cargarTodo();
    } catch (err) {
      setError(mensajeError(err) || "No se pudo guardar. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  async function borrar(id: string) {
    const { error: delError } = await supabase.from("gastos_diarios").delete().eq("id", id);
    if (delError) {
      setError(delError.message || "No se pudo borrar.");
      return;
    }
    cargarTodo();
  }

  if (cargando) {
    return <p className="py-10 text-center text-gray-400">Cargando…</p>;
  }

  const total = gastos.reduce((acc, g) => acc + Number(g.monto), 0);

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-400">
        Compras chicas o improvisadas (pan, queso, algo que faltaba…). Caen bajo la categoría &quot;Hogar&quot;.
      </p>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-2">
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input
              required
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej: Pan y queso"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
            <input
              required
              type="number"
              min={1}
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="Monto"
              className="w-28 rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-500"
            />
            <button
              type="submit"
              disabled={guardando || !monto || !descripcion}
              className="flex-1 rounded-lg bg-brand-gradient py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {guardando ? "Guardando…" : "+ Agregar"}
            </button>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </form>
      </Card>

      {gastos.length > 0 && (
        <Card>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Total diarios este mes</span>
            <span className="font-semibold text-gray-800">{formatCLP(total)}</span>
          </div>
        </Card>
      )}

      <div className="space-y-2">
        {gastos.map((g) => (
          <Card key={g.id} className="!p-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-700">{g.descripcion}</p>
                <p className="text-[11px] text-gray-400">{fechaCorta(g.fecha)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2.5">
                <span className="text-sm font-semibold text-gray-800">{formatCLP(g.monto)}</span>
                <button onClick={() => borrar(g.id)} className="text-gray-300 hover:text-red-400">
                  ✕
                </button>
              </div>
            </div>
          </Card>
        ))}
        {gastos.length === 0 && (
          <p className="text-center text-sm text-gray-400">Aún no cargaste gastos diarios este mes.</p>
        )}
      </div>
    </div>
  );
}
