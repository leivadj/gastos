"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/Card";
import { EntidadAvatar } from "@/components/EntidadAvatar";
import { GrupoMarca, MarcaAgrupadaPicker } from "@/components/MarcaAgrupadaPicker";
import { formatCLP, mesActualISO, primerDiaMesSiguiente } from "@/lib/format";
import { mensajeError } from "@/lib/supabaseError";
import { Categoria, CategoriaGrupoPreferido, GastoDiario, Grupo, Marca } from "@/lib/types";

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
  categoriasElegibles,
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
  // Cuando se pasa, reemplaza `categoriaNombre` fijo por un selector (chips)
  // entre varias categorías del catálogo compartido — hoy lo usa "Diarios"
  // de /gastos (Hogar/Feria/Panadería/Educación), para poder anotar un
  // gasto suelto del día a día en cualquiera de esas categorías sin abrir
  // otra pantalla. Sin esta prop, se comporta como siempre (una sola
  // categoría fija, ver categoriaNombre) — así /auto y /salud no cambian.
  categoriasElegibles?: string[];
}) {
  const [gastos, setGastos] = useState<GastoDiario[]>([]);
  const [categoriasDisponibles, setCategoriasDisponibles] = useState<Categoria[]>([]);
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  // "Esta categoría usa este grupo por defecto" (ver Grupos y
  // migration_26_reparto_por_categoria.sql) — categoria_id -> grupo_id.
  const [preferidoPorCategoria, setPreferidoPorCategoria] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(hoyISO());
  const [marcaId, setMarcaId] = useState("");
  // Reparto (opcional) de este gasto diario — null = sin repartir, como
  // siempre. Ver migration_27_reparto_gastos_diarios.sql: a propósito no
  // hay reparto "por personas sueltas" acá, solo por grupo, para que cargar
  // un diario siga siendo rápido.
  const [grupoId, setGrupoId] = useState("");
  // true mientras el grupo elegido venga del auto-aplicado por categoría
  // (no de una elección manual) — ver el mismo patrón en CuotasLista.tsx /
  // GastosFijosLista.tsx.
  const [grupoEsAutomatico, setGrupoEsAutomatico] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const nombresBuscados = categoriasElegibles ?? [categoriaNombre];

  async function cargarTodo() {
    setCargando(true);
    const [{ data: cat }, { data: m }, { data: gr }, { data: cgp }] = await Promise.all([
      supabase.from("categorias").select("*").in("nombre", nombresBuscados),
      gruposMarca ? supabase.from("marcas").select("*").order("nombre") : Promise.resolve({ data: [] as Marca[] }),
      supabase.from("grupos").select("*").order("nombre"),
      supabase.from("categoria_grupo_preferido").select("*"),
    ]);
    // Mantiene el orden pedido en nombresBuscados (no el que devuelva la
    // consulta), así los chips salen siempre en el mismo orden.
    const disponibles = nombresBuscados
      .map((nombre) => ((cat as Categoria[]) ?? []).find((c) => c.nombre === nombre))
      .filter((c): c is Categoria => !!c);
    setCategoriasDisponibles(disponibles);
    setMarcas((m as Marca[]) ?? []);
    setGrupos((gr as Grupo[]) ?? []);
    const mapaPreferido: Record<string, string> = {};
    ((cgp as CategoriaGrupoPreferido[]) ?? []).forEach((row) => {
      mapaPreferido[row.categoria_id] = row.grupo_id;
    });
    setPreferidoPorCategoria(mapaPreferido);
    // Si la categoría seleccionada ya no existe entre las disponibles (o
    // todavía no hay ninguna elegida), vuelve a la primera.
    setCategoriaId((actual) => (actual && disponibles.some((c) => c.id === actual) ? actual : (disponibles[0]?.id ?? null)));
    const idsDisponibles = disponibles.map((c) => c.id);
    if (idsDisponibles.length > 0) {
      const { data: gastosCat } = await supabase
        .from("gastos_diarios")
        .select("*")
        .in("categoria_id", idsDisponibles)
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
  }, [categoriaNombre, ...(categoriasElegibles ?? [])]);

  // Precarga el grupo por defecto de la categoría elegida — apenas se
  // resuelve al cargar, y de nuevo si el usuario cambia de categoría a
  // mano. No pisa una elección manual del grupo (ver grupoEsAutomatico).
  useEffect(() => {
    if (!categoriaId) return;
    if (!grupoId || grupoEsAutomatico) {
      const sugerido = preferidoPorCategoria[categoriaId] ?? "";
      setGrupoId(sugerido);
      setGrupoEsAutomatico(!!sugerido);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoriaId, preferidoPorCategoria]);

  function elegirCategoria(id: string) {
    setCategoriaId(id);
  }

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
        grupo_id: grupoId || null,
      });
      if (insError) throw insError;
      setDescripcion("");
      setMonto("");
      setFecha(hoyISO());
      setMarcaId("");
      // Vuelve a aplicar el grupo por defecto de la misma categoría (queda
      // elegida para el próximo ítem, es común cargar varios seguidos).
      const sugerido = categoriaId ? (preferidoPorCategoria[categoriaId] ?? "") : "";
      setGrupoId(sugerido);
      setGrupoEsAutomatico(!!sugerido);
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
          {categoriasDisponibles.length > 1 && (
            <div className="flex flex-wrap gap-1.5 pb-1">
              {categoriasDisponibles.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => elegirCategoria(c.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    categoriaId === c.id
                      ? "bg-brand-gradient text-white"
                      : "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300"
                  }`}
                >
                  {c.icono ? `${c.icono} ` : ""}
                  {c.nombre}
                </button>
              ))}
            </div>
          )}
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
          {grupos.length > 0 && (
            <div className="pt-1">
              <label className="text-[11px] font-medium text-gray-400 dark:text-gray-500">Grupo (opcional)</label>
              <select
                value={grupoId}
                onChange={(e) => {
                  setGrupoId(e.target.value);
                  setGrupoEsAutomatico(false);
                }}
                className="mt-1 w-full rounded-lg border border-gray-200 dark:border-white/10 px-3 py-2 text-sm dark:bg-white/5 dark:text-white"
              >
                <option value="">— Sin grupo (no se reparte) —</option>
                {grupos.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nombre}
                  </option>
                ))}
              </select>
              {grupoEsAutomatico && (
                <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
                  Aplicado automáticamente porque es el reparto por defecto de esta categoría. Podés cambiarlo.
                </p>
              )}
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
          const categoria = categoriasDisponibles.length > 1 ? categoriasDisponibles.find((c) => c.id === g.categoria_id) : null;
          const grupo = g.grupo_id ? grupos.find((gr) => gr.id === g.grupo_id) : null;
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
                      {categoria ? ` · ${categoria.nombre}` : ""}
                      {grupo ? ` · Grupo: ${grupo.nombre}` : ""}
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
