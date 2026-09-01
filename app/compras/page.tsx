"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/Card";
import { EntidadAvatar } from "@/components/EntidadAvatar";
import { EntidadPicker } from "@/components/EntidadPicker";
import { IconoPicker } from "@/components/IconoPicker";
import { MarcaSugeridaPicker } from "@/components/MarcaSugeridaPicker";
import { ParticipantesPicker } from "@/components/ParticipantesPicker";
import { formatCLP } from "@/lib/format";
import { resolverMarca } from "@/lib/resolverMarca";
import { Categoria, CompraVigente, Entidad, Grupo, ItemParticipante, Marca, Participante, Persona } from "@/lib/types";

export default function ComprasPage() {
  const [compras, setCompras] = useState<CompraVigente[]>([]);
  const [entidades, setEntidades] = useState<Entidad[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [participantesPorItem, setParticipantesPorItem] = useState<Record<string, ItemParticipante[]>>({});
  const [mostrarForm, setMostrarForm] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const [descripcion, setDescripcion] = useState("");
  const [montoTotal, setMontoTotal] = useState("");
  const [nCuotas, setNCuotas] = useState("1");
  const [fechaPrimeraCuota, setFechaPrimeraCuota] = useState(() => new Date().toISOString().slice(0, 10));
  const [entidadId, setEntidadId] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [grupoId, setGrupoId] = useState("");
  const [marcaId, setMarcaId] = useState("");
  const [icono, setIcono] = useState("");
  const [participantes, setParticipantes] = useState<Participante[]>([]);

  async function cargarTodo() {
    const [{ data: c }, { data: e }, { data: m }, { data: cat }, { data: p }, { data: gr }, { data: ip }] =
      await Promise.all([
        supabase.from("vista_cuotas_vigentes").select("*").order("cuota_actual", { ascending: true }),
        supabase.from("entidades").select("*").order("nombre"),
        supabase.from("marcas").select("*").order("nombre"),
        supabase.from("categorias").select("*").order("nombre"),
        supabase.from("personas").select("*").eq("activo", true).order("nombre"),
        supabase.from("grupos").select("*").order("nombre"),
        supabase.from("item_participantes").select("*").eq("origen", "compra"),
      ]);
    setCompras((c as CompraVigente[]) ?? []);
    setEntidades((e as Entidad[]) ?? []);
    setMarcas((m as Marca[]) ?? []);
    setCategorias((cat as Categoria[]) ?? []);
    setPersonas((p as Persona[]) ?? []);
    setGrupos((gr as Grupo[]) ?? []);
    const agrupado: Record<string, ItemParticipante[]> = {};
    ((ip as ItemParticipante[]) ?? []).forEach((row) => {
      if (!agrupado[row.origen_id]) agrupado[row.origen_id] = [];
      agrupado[row.origen_id].push(row);
    });
    setParticipantesPorItem(agrupado);
  }

  useEffect(() => {
    cargarTodo();
  }, []);

  function cancelarForm() {
    setMostrarForm(false);
    setEditandoId(null);
    setDescripcion("");
    setMontoTotal("");
    setNCuotas("1");
    setFechaPrimeraCuota(new Date().toISOString().slice(0, 10));
    setEntidadId("");
    setCategoriaId("");
    setGrupoId("");
    setMarcaId("");
    setIcono("");
    setParticipantes([]);
    setError("");
  }

  function iniciarEdicion(c: CompraVigente) {
    setEditandoId(c.compra_id);
    setDescripcion(c.descripcion);
    setMontoTotal(String(c.monto_total));
    setNCuotas(String(c.n_cuotas));
    setFechaPrimeraCuota(c.fecha_primera_cuota.slice(0, 10));
    setEntidadId(c.entidad_id ?? "");
    setCategoriaId(c.categoria_id ?? "");
    setGrupoId(c.grupo_id ?? "");
    setMarcaId(c.marca_id ?? "");
    setIcono(c.icono ?? "");
    setParticipantes(
      (participantesPorItem[c.compra_id] ?? []).map((row) => ({ persona_id: row.persona_id, porcentaje: row.porcentaje }))
    );
    setMostrarForm(true);
  }

  async function guardarParticipantes(compraId: string) {
    const { error: delError } = await supabase
      .from("item_participantes")
      .delete()
      .eq("origen", "compra")
      .eq("origen_id", compraId);
    if (delError) throw delError;
    if (!grupoId && participantes.length > 0) {
      const { error: insError } = await supabase.from("item_participantes").insert(
        participantes.map((p) => ({ origen: "compra", origen_id: compraId, persona_id: p.persona_id, porcentaje: p.porcentaje }))
      );
      if (insError) throw insError;
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!grupoId && participantes.length === 0) {
      setError("Elige al menos una persona, o asocia la compra a un grupo.");
      return;
    }
    setGuardando(true);
    try {
      const payload = {
        descripcion,
        monto_total: Number(montoTotal),
        n_cuotas: Number(nCuotas),
        fecha_primera_cuota: fechaPrimeraCuota,
        entidad_id: entidadId || null,
        categoria_id: categoriaId || null,
        grupo_id: grupoId || null,
        marca_id: marcaId || null,
        icono: icono || null,
      };
      let compraId = editandoId;
      if (editandoId) {
        const { error: updError } = await supabase.from("compras").update(payload).eq("id", editandoId);
        if (updError) throw updError;
      } else {
        const { data, error: insError } = await supabase.from("compras").insert(payload).select().single();
        if (insError) throw insError;
        compraId = data.id;
      }
      if (compraId) await guardarParticipantes(compraId);
      cancelarForm();
      cargarTodo();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(id: string) {
    const { error: dbError } = await supabase.from("compras").delete().eq("id", id);
    if (dbError) {
      setError(dbError.message || "No se pudo eliminar.");
      return;
    }
    await supabase.from("item_participantes").delete().eq("origen", "compra").eq("origen_id", id);
    cargarTodo();
  }

  const entidadDe = (id: string | null) => entidades.find((e) => e.id === id) ?? null;
  const marcaDeEntidad = (id: string | null) => resolverMarca(entidadDe(id), marcas);
  const marcaDe = (id: string | null) => marcas.find((m) => m.id === id) ?? null;
  const nombreEntidad = (id: string | null) => entidadDe(id)?.nombre ?? "—";
  const categoriaDe = (id: string | null) => categorias.find((c) => c.id === id) ?? null;
  const nombreCategoria = (id: string | null) => categoriaDe(id)?.nombre ?? "—";
  const grupoDe = (id: string | null) => grupos.find((g) => g.id === id) ?? null;
  const categoriaSeleccionada = categoriaDe(categoriaId || null);

  function resumenReparto(c: CompraVigente) {
    if (c.grupo_id) return `Grupo: ${grupoDe(c.grupo_id)?.nombre ?? "—"}`;
    const filas = participantesPorItem[c.compra_id] ?? [];
    if (filas.length === 0) return "Sin personas asignadas";
    const nombres = filas.map((f) => personas.find((p) => p.id === f.persona_id)?.nombre ?? "?");
    return nombres.join(", ");
  }

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-800">Compras en cuotas</h1>
          <p className="text-xs text-gray-400">La cuota vigente se calcula sola cada mes, con la fecha de hoy.</p>
        </div>
        <button
          onClick={() => (mostrarForm ? cancelarForm() : setMostrarForm(true))}
          className="rounded-full bg-brand-gradient px-4 py-2 text-sm font-semibold text-white"
        >
          {mostrarForm ? "Cancelar" : "+ Nueva"}
        </button>
      </div>

      <Link
        href="/tarjetas"
        className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-sm shadow-sm"
      >
        <span className="text-gray-600">Gestionar tus tarjetas y cuentas</span>
        <span className="text-brand-from">→</span>
      </Link>

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
                placeholder="Ej: Refrigerador nuevo"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500">Monto total</label>
                <input
                  required
                  type="number"
                  min={1}
                  value={montoTotal}
                  onChange={(e) => setMontoTotal(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">N° de cuotas</label>
                <input
                  required
                  type="number"
                  min={1}
                  value={nCuotas}
                  onChange={(e) => setNCuotas(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500">Fecha de la primera cuota</label>
              <input
                required
                type="date"
                value={fechaPrimeraCuota}
                onChange={(e) => setFechaPrimeraCuota(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Tarjeta / medio de pago</label>
              <div className="mt-1">
                <EntidadPicker
                  entidades={entidades}
                  marcas={marcas}
                  value={entidadId}
                  onChange={setEntidadId}
                  onCatalogoActualizado={cargarTodo}
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500">Categoría</label>
              <select
                value={categoriaId}
                onChange={(e) => {
                  const nuevaCategoria = categorias.find((c) => c.id === e.target.value) ?? null;
                  if (nuevaCategoria?.tipo_marca_sugerido !== categoriaSeleccionada?.tipo_marca_sugerido) {
                    setMarcaId("");
                  }
                  setCategoriaId(e.target.value);
                }}
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
            {categoriaSeleccionada?.tipo_marca_sugerido && (
              <div>
                <label className="text-xs text-gray-500">
                  ¿Cuál {categoriaSeleccionada.nombre.toLowerCase()}? (opcional)
                </label>
                <div className="mt-1">
                  <MarcaSugeridaPicker
                    marcas={marcas}
                    tipo={categoriaSeleccionada.tipo_marca_sugerido}
                    value={marcaId}
                    onChange={setMarcaId}
                    onCatalogoActualizado={cargarTodo}
                  />
                </div>
              </div>
            )}
            <div>
              <label className="text-xs text-gray-500">Grupo (opcional)</label>
              <select
                value={grupoId}
                onChange={(e) => setGrupoId(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              >
                <option value="">— Sin grupo —</option>
                {grupos.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nombre}
                  </option>
                ))}
              </select>
            </div>
            {grupoId ? (
              <p className="rounded-lg bg-purple-50 px-3 py-2 text-xs text-brand-from">
                El reparto lo define el grupo &quot;{grupoDe(grupoId)?.nombre}&quot;. Para cambiarlo, ve a Grupos.
              </p>
            ) : (
              <div>
                <label className="text-xs text-gray-500">¿Quiénes participan?</label>
                <p className="mb-1 text-[11px] text-gray-400">
                  Deja el % en blanco para repartir en partes iguales el resto.
                </p>
                <ParticipantesPicker
                  personas={personas}
                  value={participantes}
                  onChange={setParticipantes}
                  montoTotal={montoTotal ? Math.round(Number(montoTotal) / Number(nCuotas || "1")) : undefined}
                />
              </div>
            )}
            <div>
              <label className="text-xs text-gray-500">Ícono del item (opcional)</label>
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
              {guardando ? "Guardando…" : editandoId ? "Guardar cambios" : "Guardar compra"}
            </button>
          </form>
        </Card>
      )}

      <div className="space-y-3">
        {compras.map((c) => {
          const activa = c.cuota_actual >= 1 && c.cuota_actual <= c.n_cuotas;
          const progreso = Math.min(100, Math.max(0, (c.cuota_actual / c.n_cuotas) * 100));
          const marcaItem = marcaDe(c.marca_id);
          return (
            <Card key={c.compra_id} className={!activa ? "opacity-50" : ""}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3">
                  <EntidadAvatar
                    entidad={entidadDe(c.entidad_id)}
                    marca={marcaItem ?? marcaDeEntidad(c.entidad_id)}
                    icono={c.icono}
                    className="h-9 w-9"
                  />
                  <div>
                    <p className="font-semibold text-gray-800">{c.descripcion}</p>
                    <p className="text-xs text-gray-400">
                      {nombreEntidad(c.entidad_id)} · {nombreCategoria(c.categoria_id)}
                      {marcaItem ? ` (${marcaItem.nombre})` : ""} · {resumenReparto(c)}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <button onClick={() => iniciarEdicion(c)} className="text-xs text-brand-from">
                    editar
                  </button>
                  <button onClick={() => eliminar(c.compra_id)} className="text-xs text-gray-300 hover:text-red-400">
                    eliminar
                  </button>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-gray-500">
                  {activa ? `Cuota ${c.cuota_actual} de ${c.n_cuotas}` : "Terminada"}
                </span>
                <span className="font-semibold text-gray-800">{formatCLP(c.monto_cuota)}/mes</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div className="h-full bg-brand-gradient" style={{ width: `${progreso}%` }} />
              </div>
            </Card>
          );
        })}
        {compras.length === 0 && <p className="text-center text-sm text-gray-400">Aún no hay compras en cuotas.</p>}
      </div>
    </div>
  );
}
