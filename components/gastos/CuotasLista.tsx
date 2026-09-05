"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/Card";
import { EntidadAvatar } from "@/components/EntidadAvatar";
import { EntidadPicker } from "@/components/EntidadPicker";
import { EVENTO_MOVIMIENTO_GUARDADO } from "@/components/MovimientoRapido";
import { mensajeError } from "@/lib/supabaseError";
import { IconoPicker } from "@/components/IconoPicker";
import { ItemDesplegable } from "@/components/ItemDesplegable";
import { MarcaSugeridaPicker } from "@/components/MarcaSugeridaPicker";
import { ParticipantesPicker } from "@/components/ParticipantesPicker";
import { diaDelMes, formatCLP } from "@/lib/format";
import { fechaPrimeraCuotaDesde } from "@/lib/cuotas";
import { resolverMarca } from "@/lib/resolverMarca";
import { Categoria, CompraVigente, Entidad, Grupo, ItemParticipante, Marca, Participante, Persona } from "@/lib/types";

// Pestaña "Cuotas" de /gastos — antes /compras, pantalla propia. La cuota
// vigente se calcula sola cada mes, con la fecha de hoy (ver
// vista_cuotas_vigentes en Supabase).
export function CuotasLista() {
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
  const [montoCuota, setMontoCuota] = useState("");
  const [nCuotas, setNCuotas] = useState("1");
  // "¿En qué cuota vas?" reemplaza el antiguo campo "Fecha de la primera
  // cuota": casi nadie sabe esa fecha de memoria, pero sí en qué número de
  // cuota va. diaVencimiento es interno (no se pide en el formulario): al
  // crear, se usa el día de hoy; al editar, se conserva el día que ya tenía
  // guardado la compra — ver fechaPrimeraCuotaDesde en lib/cuotas.ts.
  const [cuotaActual, setCuotaActual] = useState("1");
  const [diaVencimiento, setDiaVencimiento] = useState<number>(() => new Date().getDate());
  const [entidadId, setEntidadId] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [grupoId, setGrupoId] = useState("");
  const [marcaId, setMarcaId] = useState("");
  const [icono, setIcono] = useState("");
  const [participantes, setParticipantes] = useState<Participante[]>([]);

  // Si en la cuenta solo hay una persona activa (el caso normal de una sola
  // persona usando la app), no tiene sentido preguntar "¿quiénes
  // participan?" — se asigna sola, sin mostrar el selector. Apenas se
  // agregue una segunda persona, el selector vuelve a aparecer.
  const unicaPersona = personas.length === 1 ? personas[0] : null;

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
    window.addEventListener(EVENTO_MOVIMIENTO_GUARDADO, cargarTodo);
    return () => window.removeEventListener(EVENTO_MOVIMIENTO_GUARDADO, cargarTodo);
  }, []);

  function cancelarForm() {
    setMostrarForm(false);
    setEditandoId(null);
    setDescripcion("");
    setMontoCuota("");
    setNCuotas("1");
    setCuotaActual("1");
    setDiaVencimiento(new Date().getDate());
    setEntidadId("");
    setCategoriaId("");
    setGrupoId("");
    setMarcaId("");
    setIcono("");
    setParticipantes([]);
    setError("");
  }

  function abrirFormNuevo() {
    if (unicaPersona) setParticipantes([{ persona_id: unicaPersona.id, porcentaje: null }]);
    setMostrarForm(true);
  }

  function iniciarEdicion(c: CompraVigente) {
    setEditandoId(c.compra_id);
    setDescripcion(c.descripcion);
    setMontoCuota(String(c.monto_cuota));
    setNCuotas(String(c.n_cuotas));
    setCuotaActual(String(c.cuota_actual));
    setDiaVencimiento(diaDelMes(c.fecha_primera_cuota));
    setEntidadId(c.entidad_id ?? "");
    setCategoriaId(c.categoria_id ?? "");
    setGrupoId(c.grupo_id ?? "");
    setMarcaId(c.marca_id ?? "");
    setIcono(c.icono ?? "");
    const participantesExistentes = (participantesPorItem[c.compra_id] ?? []).map((row) => ({
      persona_id: row.persona_id,
      porcentaje: row.porcentaje,
    }));
    setParticipantes(
      participantesExistentes.length > 0
        ? participantesExistentes
        : unicaPersona
          ? [{ persona_id: unicaPersona.id, porcentaje: null }]
          : []
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
      const nCuotasNum = Math.max(1, Number(nCuotas) || 1);
      const montoCuotaNum = Number(montoCuota);
      // "En qué cuota vas" no puede pasarse de la cantidad total de cuotas.
      const cuotaActualNum = Math.min(Math.max(1, Number(cuotaActual) || 1), nCuotasNum);
      const payload = {
        descripcion,
        // No se guarda un "monto total" que la persona tenga que calcular:
        // se deriva de cuota × cantidad de cuotas (ver nota del campo en el
        // formulario sobre intereses/cargos que el banco pueda sumar aparte).
        monto_total: Math.round(montoCuotaNum * nCuotasNum),
        n_cuotas: nCuotasNum,
        fecha_primera_cuota: fechaPrimeraCuotaDesde(cuotaActualNum, diaVencimiento),
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
      setError(mensajeError(err) || "No se pudo guardar. Intenta de nuevo.");
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">La cuota vigente se calcula sola cada mes, con la fecha de hoy.</p>
        <button
          onClick={() => (mostrarForm ? cancelarForm() : abrirFormNuevo())}
          className="shrink-0 rounded-full bg-brand-gradient px-4 py-2 text-sm font-semibold text-white"
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
              <div>
                <label className="text-xs text-gray-500">Valor de la cuota</label>
                <input
                  required
                  type="number"
                  min={1}
                  value={montoCuota}
                  onChange={(e) => setMontoCuota(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500">¿En qué cuota vas?</label>
              <input
                required
                type="number"
                min={1}
                max={nCuotas || undefined}
                value={cuotaActual}
                onChange={(e) => setCuotaActual(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-[11px] text-gray-400">
                Si es una compra nueva, deja &quot;1&quot;. Si ya venías pagando, escribe en qué cuota vas hoy — no
                hace falta calcular la fecha de la primera cuota, se calcula sola.
              </p>
            </div>
            {nCuotas && montoCuota && (
              <p className="rounded-lg bg-purple-50 px-3 py-2 text-xs text-brand-from">
                Total del crédito: {formatCLP(Number(nCuotas) * Number(montoCuota))} — aproximado, sin contar
                intereses u otros cargos que el banco sume aparte.
              </p>
            )}
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
            ) : unicaPersona ? null : (
              <div>
                <label className="text-xs text-gray-500">¿Quiénes participan?</label>
                <p className="mb-1 text-[11px] text-gray-400">
                  Deja el % en blanco para repartir en partes iguales el resto.
                </p>
                <ParticipantesPicker
                  personas={personas}
                  value={participantes}
                  onChange={setParticipantes}
                  montoTotal={montoCuota ? Number(montoCuota) : undefined}
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {compras.map((c) => {
          const activa = c.cuota_actual >= 1 && c.cuota_actual <= c.n_cuotas;
          const progreso = Math.min(100, Math.max(0, (c.cuota_actual / c.n_cuotas) * 100));
          const marcaItem = marcaDe(c.marca_id);
          const filasReparto = participantesPorItem[c.compra_id] ?? [];
          const barraProgreso = (
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
              <div className="h-full bg-brand-gradient" style={{ width: `${progreso}%` }} />
            </div>
          );
          return (
            <Card key={c.compra_id} className={!activa ? "opacity-50" : ""}>
              <ItemDesplegable
                resumen={({ onClick }) => (
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <button type="button" onClick={onClick} className="flex flex-1 items-start gap-3 text-left">
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
                      </button>
                      <div className="flex shrink-0 items-center gap-3 pt-0.5">
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
                    {barraProgreso}
                  </div>
                )}
                detalle={({ onClick }) => (
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3">
                        <EntidadAvatar
                          entidad={entidadDe(c.entidad_id)}
                          marca={marcaItem ?? marcaDeEntidad(c.entidad_id)}
                          icono={c.icono}
                          className="h-9 w-9"
                        />
                        <p className="pt-1.5 font-semibold text-gray-800">{c.descripcion}</p>
                      </div>
                      <button type="button" onClick={onClick} className="shrink-0 pt-1.5 text-xs text-gray-400">
                        cerrar ✕
                      </button>
                    </div>
                    <dl className="mt-3 space-y-1.5 text-xs">
                      <div className="flex justify-between gap-3">
                        <dt className="text-gray-400">Total del crédito (aprox.)</dt>
                        <dd className="font-medium text-gray-700">{formatCLP(c.monto_total)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-gray-400">Cuota</dt>
                        <dd className="font-medium text-gray-700">
                          {activa ? `${c.cuota_actual} de ${c.n_cuotas}` : `${c.n_cuotas} (terminada)`} ·{" "}
                          {formatCLP(c.monto_cuota)}/mes
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-gray-400">Vence</dt>
                        <dd className="font-medium text-gray-700">Día {diaDelMes(c.fecha_primera_cuota)} de cada mes</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-gray-400">Tarjeta / medio de pago</dt>
                        <dd className="font-medium text-gray-700">{nombreEntidad(c.entidad_id)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="shrink-0 text-gray-400">Categoría</dt>
                        <dd className="text-right font-medium text-gray-700">
                          {nombreCategoria(c.categoria_id)}
                          {marcaItem ? ` (${marcaItem.nombre})` : ""}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="shrink-0 text-gray-400">Reparto</dt>
                        <dd className="text-right font-medium text-gray-700">
                          {c.grupo_id
                            ? `Grupo: ${grupoDe(c.grupo_id)?.nombre ?? "—"}`
                            : filasReparto.length === 0
                              ? "Sin personas asignadas"
                              : filasReparto
                                  .map((f) => {
                                    const nombre = personas.find((p) => p.id === f.persona_id)?.nombre ?? "?";
                                    return f.porcentaje != null ? `${nombre} (${f.porcentaje}%)` : nombre;
                                  })
                                  .join(", ")}
                        </dd>
                      </div>
                    </dl>
                    {barraProgreso}
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => iniciarEdicion(c)}
                        className="flex-1 rounded-lg bg-purple-50 py-2 text-xs font-semibold text-brand-from"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => eliminar(c.compra_id)}
                        className="flex-1 rounded-lg bg-gray-50 py-2 text-xs font-semibold text-gray-400 hover:text-red-400"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                )}
              />
            </Card>
          );
        })}
        {compras.length === 0 && <p className="text-center text-sm text-gray-400">Aún no hay compras en cuotas.</p>}
      </div>
    </div>
  );
}
