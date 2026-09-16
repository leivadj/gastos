"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/Card";
import { MarcaSugeridaPicker } from "@/components/MarcaSugeridaPicker";
import { TIPO_CORTO } from "@/components/TarjetaVisual";
import { formatCLP } from "@/lib/format";
import { mensajeError } from "@/lib/supabaseError";
import { buscarReglaQueCalce, normalizarPatron } from "@/lib/reglasCategorizacion";
import { Categoria, CategoriaGrupoPreferido, Entidad, Grupo, Marca, ReglaCategorizacion, SugerenciaCorreo, TipoSugerenciaCorreo } from "@/lib/types";

function fechaCorta(fechaISO: string): string {
  const fecha = new Date(`${fechaISO.slice(0, 10)}T00:00:00`);
  return new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short" }).format(fecha).replace(".", "");
}

// Felipe reportó: al confirmar una sugerencia y elegir el banco, no se podía
// distinguir "Banco Estado" débito de "Banco Estado" crédito (ambos aparecían
// con el mismo nombre en el <select>) — mismo problema que ya se había
// resuelto para EntidadPicker (ver TIPO_CORTO en TarjetaVisual.tsx, pensado
// justo para este caso). Acá se reutiliza esa misma etiqueta corta, más los
// últimos 4 dígitos si la cuenta/tarjeta los tiene, para que las opciones del
// <select> alcancen a distinguirse igual sin depender del logo/avatar (que
// este selector de texto plano no muestra).
function etiquetaEntidad(e: Entidad): string {
  const partes = [e.nombre, TIPO_CORTO[e.tipo]];
  if (e.ultimos_digitos) partes.push(`•••• ${e.ultimos_digitos}`);
  return partes.join(" · ");
}

const ETIQUETA_TIPO: Record<TipoSugerenciaCorreo, string> = {
  gasto: "Compra o pago",
  transferencia_tercero: "Transferencia a otra persona",
  transferencia_propia: "Transferencia entre tus cuentas",
};

// Bandeja de revisión de la automatización de correo del banco (ver Novedades
// del resumen del proyecto): nada de lo que llega acá se guardó todavía como
// gasto o transferencia real — cada fila viene de un correo que se interpretó
// solo, y hay que confirmarla (con la categoría/grupo/cuentas que
// correspondan) o descartarla a mano. "gasto" y "transferencia_tercero" se
// confirman igual (quedan como un gasto diario) — la única que se confirma
// distinto es "transferencia_propia" (queda como "↔ Transferencia").
export default function SugerenciasPage() {
  const [sugerencias, setSugerencias] = useState<SugerenciaCorreo[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [entidades, setEntidades] = useState<Entidad[]>([]);
  const [preferidoPorCategoria, setPreferidoPorCategoria] = useState<Record<string, string>>({});
  // Reglas de categorización aprendidas (ver migration_38 y
  // lib/reglasCategorizacion.ts) — al abrir una sugerencia se busca si su
  // texto ya calza con alguna, para precargar categoría/marca/cuenta sin que
  // el usuario tenga que repetirlo cada vez que ve el mismo comercio.
  const [reglas, setReglas] = useState<ReglaCategorizacion[]>([]);
  const [reglaAplicada, setReglaAplicada] = useState<ReglaCategorizacion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [mostrarResueltas, setMostrarResueltas] = useState(false);

  const [abiertaId, setAbiertaId] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Formulario de confirmación — sirve tanto para "gasto" como para
  // "transferencia_tercero" (se confirman igual, como gasto diario).
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [marcaId, setMarcaId] = useState("");
  const [entidadId, setEntidadId] = useState("");
  const [grupoId, setGrupoId] = useState("");
  const [grupoEsAutomatico, setGrupoEsAutomatico] = useState(false);

  // Formulario de confirmación de "transferencia_propia".
  const [origenId, setOrigenId] = useState("");
  const [destinoId, setDestinoId] = useState("");
  const [notas, setNotas] = useState("");

  async function cargarTodo() {
    setCargando(true);
    const [{ data: s }, { data: cat }, { data: m }, { data: g }, { data: e }, { data: cgp }, { data: rc }] = await Promise.all([
      supabase.from("sugerencias_correo").select("*").order("fecha", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("categorias").select("*").order("nombre"),
      supabase.from("marcas").select("*"),
      supabase.from("grupos").select("*").order("nombre"),
      supabase.from("entidades").select("*").order("nombre"),
      supabase.from("categoria_grupo_preferido").select("*"),
      supabase.from("reglas_categorizacion").select("*"),
    ]);
    setSugerencias((s as SugerenciaCorreo[]) ?? []);
    setCategorias((cat as Categoria[]) ?? []);
    setMarcas((m as Marca[]) ?? []);
    setGrupos((g as Grupo[]) ?? []);
    setEntidades((e as Entidad[]) ?? []);
    const mapaPreferido: Record<string, string> = {};
    ((cgp as CategoriaGrupoPreferido[]) ?? []).forEach((row) => {
      mapaPreferido[row.categoria_id] = row.grupo_id;
    });
    setPreferidoPorCategoria(mapaPreferido);
    setReglas((rc as ReglaCategorizacion[]) ?? []);
    setCargando(false);
  }

  useEffect(() => {
    cargarTodo();
  }, []);

  function cerrarForm() {
    setAbiertaId(null);
    setDescripcion("");
    setMonto("");
    setFecha("");
    setCategoriaId("");
    setMarcaId("");
    setEntidadId("");
    setGrupoId("");
    setGrupoEsAutomatico(false);
    setOrigenId("");
    setDestinoId("");
    setNotas("");
    setReglaAplicada(null);
    setError("");
  }

  function abrirConfirmar(sug: SugerenciaCorreo) {
    if (abiertaId === sug.id) {
      cerrarForm();
      return;
    }
    setAbiertaId(sug.id);
    setError("");
    setMonto(String(sug.monto));
    setFecha(sug.fecha.slice(0, 10));
    if (sug.tipo === "transferencia_propia") {
      setNotas(sug.descripcion);
      setOrigenId("");
      setDestinoId("");
      setReglaAplicada(null);
    } else {
      setDescripcion(sug.descripcion);
      // Regla aprendida (ver lib/reglasCategorizacion.ts): si el texto de
      // esta sugerencia ya calzó antes con un comercio confirmado, se
      // precargan categoría/marca/cuenta solas — el usuario solo tiene que
      // revisar y confirmar, no repetir el trabajo de la vez anterior.
      const regla = buscarReglaQueCalce(normalizarPatron(sug.descripcion), reglas);
      setReglaAplicada(regla);
      setCategoriaId(regla?.categoria_id ?? "");
      setMarcaId(regla?.marca_id ?? "");
      setEntidadId(regla?.entidad_id ?? "");
      const sugerido = regla ? (preferidoPorCategoria[regla.categoria_id] ?? "") : "";
      setGrupoId(sugerido);
      setGrupoEsAutomatico(!!sugerido);
    }
  }

  function elegirCategoria(id: string) {
    setCategoriaId(id);
    setMarcaId("");
    // Si el usuario cambia la categoría a mano, la regla que se había
    // aplicado sola ya no describe lo que se va a guardar — al confirmar se
    // aprenderá/actualizará con lo que él elija, no se sigue mostrando como
    // "aplicada automáticamente".
    if (reglaAplicada && id !== reglaAplicada.categoria_id) setReglaAplicada(null);
    if (!grupoId || grupoEsAutomatico) {
      const sugerido = preferidoPorCategoria[id] ?? "";
      setGrupoId(sugerido);
      setGrupoEsAutomatico(!!sugerido);
    }
  }

  // Aprende o refuerza la regla de categorización para esta descripción (ver
  // migration_38 y lib/reglasCategorizacion.ts): si ya existía una regla con
  // el mismo patrón, se actualiza con la categoría/marca/cuenta recién
  // confirmadas (por si el usuario corrigió lo que la regla sugería) y suma
  // un uso; si no existía, se crea. Nunca debe hacer fallar la confirmación
  // del gasto: si esto falla, el gasto ya se guardó igual, solo no se
  // aprendió nada nuevo esta vez.
  async function aprenderRegla(patronOriginal: string) {
    try {
      const patron = normalizarPatron(patronOriginal);
      const existente = reglas.find((r) => r.patron === patron);
      if (existente) {
        await supabase
          .from("reglas_categorizacion")
          .update({
            categoria_id: categoriaId,
            marca_id: marcaId || null,
            entidad_id: entidadId || null,
            veces_usada: existente.veces_usada + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existente.id);
      } else {
        await supabase.from("reglas_categorizacion").insert({
          patron,
          categoria_id: categoriaId,
          marca_id: marcaId || null,
          entidad_id: entidadId || null,
        });
      }
    } catch {
      // best effort — ver comentario de la función.
    }
  }

  async function confirmarComoGasto(sug: SugerenciaCorreo) {
    setError("");
    if (!descripcion.trim() || !monto || !fecha || !categoriaId) {
      setError("Completa descripción, monto, fecha y categoría antes de confirmar.");
      return;
    }
    setGuardando(true);
    try {
      const { error: insError } = await supabase.from("gastos_diarios").insert({
        descripcion: descripcion.trim(),
        monto: Number(monto),
        fecha,
        categoria_id: categoriaId,
        marca_id: marcaId || null,
        entidad_id: entidadId || null,
        grupo_id: grupoId || null,
      });
      if (insError) throw insError;
      const { error: updError } = await supabase.from("sugerencias_correo").update({ estado: "confirmada" }).eq("id", sug.id);
      if (updError) throw updError;
      await aprenderRegla(sug.descripcion);
      cerrarForm();
      await cargarTodo();
    } catch (err) {
      setError(mensajeError(err) || "No se pudo guardar. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarComoTransferencia(sug: SugerenciaCorreo) {
    setError("");
    if (!monto || !fecha || !origenId || !destinoId) {
      setError("Elegí la cuenta de origen y destino antes de confirmar.");
      return;
    }
    if (origenId === destinoId) {
      setError("La cuenta de origen y destino no pueden ser la misma.");
      return;
    }
    setGuardando(true);
    try {
      const { error: insError } = await supabase.from("transferencias").insert({
        monto: Number(monto),
        cuenta_origen_id: origenId,
        cuenta_destino_id: destinoId,
        fecha,
        notas: notas.trim() || null,
      });
      if (insError) throw insError;
      const { error: updError } = await supabase.from("sugerencias_correo").update({ estado: "confirmada" }).eq("id", sug.id);
      if (updError) throw updError;
      cerrarForm();
      await cargarTodo();
    } catch (err) {
      setError(mensajeError(err) || "No se pudo guardar. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  async function descartar(sug: SugerenciaCorreo) {
    const { error: updError } = await supabase.from("sugerencias_correo").update({ estado: "descartada" }).eq("id", sug.id);
    if (updError) {
      setError(updError.message || "No se pudo descartar.");
      return;
    }
    if (abiertaId === sug.id) cerrarForm();
    cargarTodo();
  }

  if (cargando) {
    return <p className="py-10 text-center text-gray-400 dark:text-gray-500">Cargando…</p>;
  }

  const pendientes = sugerencias.filter((s) => s.estado === "pendiente");
  const resueltas = sugerencias.filter((s) => s.estado !== "pendiente").slice(0, 20);
  const categoriaElegida = categorias.find((c) => c.id === categoriaId) ?? null;

  return (
    <div className="space-y-4 pb-10">
      <div>
        <h1 className="text-lg font-bold text-gray-800 dark:text-white">Sugerencias</h1>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Movimientos detectados en el correo de tu banco. Nada se guarda solo — revisá cada uno y confirmalo o
          descartalo.
        </p>
      </div>

      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}

      {pendientes.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">No hay sugerencias pendientes.</p>
      ) : (
        <div className="space-y-3">
          {pendientes.map((sug) => (
            <Card key={sug.id} className="!p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-700 dark:text-gray-200">{sug.descripcion}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {fechaCorta(sug.fecha)} · {ETIQUETA_TIPO[sug.tipo]}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm font-semibold text-gray-800 dark:text-white">{formatCLP(sug.monto)}</span>
                  <button onClick={() => abrirConfirmar(sug)} className="text-xs font-medium text-brand-from dark:text-white">
                    {abiertaId === sug.id ? "cerrar" : "confirmar"}
                  </button>
                  <button onClick={() => descartar(sug)} className="text-xs text-gray-300 hover:text-red-400 dark:text-gray-600">
                    descartar
                  </button>
                </div>
              </div>

              {abiertaId === sug.id && sug.tipo !== "transferencia_propia" && (
                <form
                  onSubmit={(e: FormEvent) => {
                    e.preventDefault();
                    confirmarComoGasto(sug);
                  }}
                  className="mt-4 space-y-3 border-t border-gray-100 pt-4 dark:border-white/10"
                >
                  {reglaAplicada && (
                    <p className="rounded-lg bg-emerald-50 px-3 py-2 text-[11px] font-medium text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                      Autocategorizado: la última vez que confirmaste &quot;{reglaAplicada.patron}&quot; usaste esta
                      categoría/cuenta — revisa y confirma, o cambia lo que corresponda.
                    </p>
                  )}
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400">Descripción</label>
                    <input
                      required
                      value={descripcion}
                      onChange={(e) => setDescripcion(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400">Monto</label>
                      <input
                        required
                        type="number"
                        min={1}
                        value={monto}
                        onChange={(e) => setMonto(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400">Fecha</label>
                      <input
                        required
                        type="date"
                        value={fecha}
                        onChange={(e) => setFecha(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400">Categoría</label>
                    <select
                      required
                      value={categoriaId}
                      onChange={(e) => elegirCategoria(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
                    >
                      <option value="">— Elegir —</option>
                      {categorias.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.icono ? `${c.icono} ` : ""}
                          {c.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                  {categoriaElegida?.tipo_marca_sugerido && (
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400">Marca (opcional)</label>
                      <MarcaSugeridaPicker
                        marcas={marcas}
                        tipo={categoriaElegida.tipo_marca_sugerido}
                        value={marcaId}
                        onChange={setMarcaId}
                        onCatalogoActualizado={cargarTodo}
                      />
                    </div>
                  )}
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400">Pagado con (opcional)</label>
                    <select
                      value={entidadId}
                      onChange={(e) => setEntidadId(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
                    >
                      <option value="">Efectivo · sin tarjeta</option>
                      {entidades.map((e) => (
                        <option key={e.id} value={e.id}>
                          {etiquetaEntidad(e)}
                        </option>
                      ))}
                    </select>
                  </div>
                  {grupos.length > 0 && (
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400">Grupo (opcional)</label>
                      <select
                        value={grupoId}
                        onChange={(e) => {
                          setGrupoId(e.target.value);
                          setGrupoEsAutomatico(false);
                        }}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
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
                          Aplicado automáticamente porque es el reparto por defecto de esta categoría.
                        </p>
                      )}
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={guardando}
                    className="w-full rounded-lg bg-brand-gradient py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {guardando ? "Guardando…" : "Guardar como gasto"}
                  </button>
                </form>
              )}

              {abiertaId === sug.id && sug.tipo === "transferencia_propia" && (
                <form
                  onSubmit={(e: FormEvent) => {
                    e.preventDefault();
                    confirmarComoTransferencia(sug);
                  }}
                  className="mt-4 space-y-3 border-t border-gray-100 pt-4 dark:border-white/10"
                >
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400">Monto</label>
                      <input
                        required
                        type="number"
                        min={1}
                        value={monto}
                        onChange={(e) => setMonto(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400">Fecha</label>
                      <input
                        required
                        type="date"
                        value={fecha}
                        onChange={(e) => setFecha(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400">Desde</label>
                    <select
                      required
                      value={origenId}
                      onChange={(e) => setOrigenId(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
                    >
                      <option value="">— Elegir —</option>
                      {entidades.map((e) => (
                        <option key={e.id} value={e.id}>
                          {etiquetaEntidad(e)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400">Hacia</label>
                    <select
                      required
                      value={destinoId}
                      onChange={(e) => setDestinoId(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
                    >
                      <option value="">— Elegir —</option>
                      {entidades.map((e) => (
                        <option key={e.id} value={e.id}>
                          {etiquetaEntidad(e)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400">Nota (opcional)</label>
                    <input
                      value={notas}
                      onChange={(e) => setNotas(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={guardando}
                    className="w-full rounded-lg bg-brand-gradient py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {guardando ? "Guardando…" : "Guardar como transferencia"}
                  </button>
                </form>
              )}
            </Card>
          ))}
        </div>
      )}

      {resueltas.length > 0 && (
        <div>
          <button
            onClick={() => setMostrarResueltas((v) => !v)}
            className="text-xs font-medium text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            {mostrarResueltas ? "ocultar" : "ver"} resueltas recientes ({resueltas.length})
          </button>
          {mostrarResueltas && (
            <ul className="mt-2 divide-y divide-gray-100 dark:divide-white/10">
              {resueltas.map((sug) => (
                <li key={sug.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">{sug.descripcion}</p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500">
                      {fechaCorta(sug.fecha)} · {sug.estado === "confirmada" ? "Confirmada" : "Descartada"}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">{formatCLP(sug.monto)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
