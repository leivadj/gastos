"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/Card";
import { EntidadAvatar } from "@/components/EntidadAvatar";
import { GrupoMarca, MarcaAgrupadaPicker } from "@/components/MarcaAgrupadaPicker";
import { formatCLP, mesActualISO, primerDiaMesSiguiente } from "@/lib/format";
import { mensajeError } from "@/lib/supabaseError";
import { Categoria, GastoDiario, Marca } from "@/lib/types";

const hoyISO = () => new Date().toISOString().slice(0, 10);

function fechaCorta(fechaISO: string): string {
  const fecha = new Date(`${fechaISO.slice(0, 10)}T00:00:00`);
  return new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short" }).format(fecha).replace(".", "");
}

// Gasto suelto de carga rápida: solo monto + descripción, sin medio de pago
// ni reparto entre personas. Se usa en 3 lugares con la misma lógica, cada
// uno atado a una categoría compartida distinta del catálogo (ver
// migration_21 para "Hogar" y migration_22 para "Auto"/"Salud"):
//   - Pestaña "Diarios" de /gastos (categoriaNombre="Hogar", el original):
//     compras chicas/improvisadas del día a día (pan, queso...).
//   - /auto (categoriaNombre="Auto"): bencina, mecánico, mantención.
//   - /salud (categoriaNombre="Salud"): remedios, visita al doctor.
// Al ser todas gastos_diarios con categoria_id, ya participan solas en el
// resumen por categoría de Inicio/Presupuesto y en el historial de Reportes
// (ver lib/resumenGastos.ts) — no hace falta tocar esos archivos al agregar
// una categoría nueva acá, solo instanciar este componente con el nombre
// correspondiente. Solo muestra el mes actual — no es un historial largo,
// es un anotador rápido.
export function DiariosLista({
  categoriaNombre = "Hogar",
  placeholderDescripcion = "Ej: Pan y queso",
  textoAyuda = 'Compras chicas o improvisadas (pan, queso, algo que faltaba…). Caen bajo la categoría "Hogar".',
  tituloTotal = "Total diarios este mes",
  textoVacio = "Aún no cargaste gastos diarios este mes.",
  gruposMarca,
}: {
  categoriaNombre?: string;
  placeholderDescripcion?: string;
  textoAyuda?: string;
  tituloTotal?: string;
  textoVacio?: string;
  // Cuando se pasa, agrega un selector de marca agrupado (MarcaAgrupadaPicker)
  // al formulario — hoy lo usan /auto (Bencina/Mecánico/Repuestos) y /salud
  // (Centro médico/Medicamentos). Sin esta prop el formulario queda igual
  // que siempre (solo monto + descripción + fecha), como en "Diarios" de
  // /gastos. Ver migration_25_marcas_auto_salud.sql.
  gruposMarca?: GrupoMarca[];
}) {
  const [gastos, setGastos] = useState<GastoDiario[]>([]);
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(hoyISO());
  const [marcaId, setMarcaId] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function cargarTodo() {
    setCargando(true);
    const [{ data: cat }, { data: m }] = await Promise.all([
      supabase.from("categorias").select("*").eq("nombre", categoriaNombre),
      gruposMarca ? supabase.from("marcas").select("*").order("nombre") : Promise.resolve({ data: [] as Marca[] }),
    ]);
    const catId = ((cat as Categoria[]) ?? [])[0]?.id ?? null;
    setCategoriaId(catId);
    setMarcas((m as Marca[]) ?? []);
    if (catId) {
      const { data: gastosCat } = await supabase
        .from("gastos_diarios")
        .select("*")
        .eq("categoria_id", catId)
        .gte("fecha", mesActualISO())
        .lt("fecha", primerDiaMesSiguiente())
        .order("fecha", { ascending: false })
        .order("created_at", { ascending: false });
      setGastos((gastosCat as GastoDiario[]) ?? []);
    } else {
      setGastos([]);
    }
    setCargando(false);
  }

  useEffect(() => {
    cargarTodo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoriaNombre]);

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
        categoria_id: categoriaId,
        marca_id: gruposMarca ? marcaId || null : null,
      });
      if (insError) throw insError;
      setDescripcion("");
      setMonto("");
      setFecha(hoyISO());
      setMarcaId("");
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
    return <p className="py-10 text-center text-gray-400 dark:text-gray-500">Cargando…</p>;
  }

  const total = gastos.reduce((acc, g) => acc + Number(g.monto), 0);

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-400 dark:text-gray-500">{textoAyuda}</p>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-2">
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input
              required
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder={placeholderDescripcion}
              className="w-full rounded-lg border border-gray-200 dark:border-white/10 px-3 py-2 text-sm dark:bg-white/5 dark:text-white"
            />
            <input
              required
              type="number"
              min={1}
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="Monto"
              className="w-28 rounded-lg border border-gray-200 dark:border-white/10 px-3 py-2 text-sm dark:bg-white/5 dark:text-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="rounded-lg border border-gray-200 dark:border-white/10 px-3 py-2 text-sm text-gray-500 dark:text-gray-400 dark:bg-white/5"
            />
            <button
              type="submit"
              disabled={guardando || !monto || !descripcion}
              className="flex-1 rounded-lg bg-brand-gradient py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {guardando ? "Guardando…" : "+ Agregar"}
            </button>
          </div>
          {gruposMarca && (
            <div className="pt-1">
              <p className="mb-1 text-[11px] font-medium text-gray-400 dark:text-gray-500">¿Dónde? (opcional)</p>
              <MarcaAgrupadaPicker
                grupos={gruposMarca}
                marcas={marcas}
                value={marcaId}
                onChange={setMarcaId}
                onCatalogoActualizado={cargarTodo}
              />
            </div>
          )}
          {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
        </form>
      </Card>

      {gastos.length > 0 && (
        <Card>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">{tituloTotal}</span>
            <span className="font-semibold text-gray-800 dark:text-white">{formatCLP(total)}</span>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {gastos.map((g) => {
          const marca = g.marca_id ? marcas.find((m) => m.id === g.marca_id) ?? null : null;
          return (
            <Card key={g.id} className="!p-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  {gruposMarca && <EntidadAvatar marca={marca} nombreFallback={marca?.nombre ?? g.descripcion} className="h-8 w-8" />}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-700 dark:text-gray-200">{g.descripcion}</p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500">
                      {fechaCorta(g.fecha)}
                      {marca ? ` · ${marca.nombre}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2.5">
                  <span className="text-sm font-semibold text-gray-800 dark:text-white">{formatCLP(g.monto)}</span>
                  <button onClick={() => borrar(g.id)} className="text-gray-300 dark:text-gray-600 hover:text-red-400">
                    ✕
                  </button>
                </div>
              </div>
            </Card>
          );
        })}
        {gastos.length === 0 && <p className="text-center text-sm text-gray-400 dark:text-gray-500">{textoVacio}</p>}
      </div>
    </div>
  );
}
