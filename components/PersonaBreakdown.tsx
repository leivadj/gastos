"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { EVENTO_MOVIMIENTO_GUARDADO } from "@/components/MovimientoRapido";
import { Categoria, Entidad, Ingreso, Marca, RepartoCuota, RepartoGastoFijo } from "@/lib/types";
import { Card } from "@/components/Card";
import { EntidadAvatar } from "@/components/EntidadAvatar";
import { formatCLP, mesActualISO } from "@/lib/format";
import { mensajeError } from "@/lib/supabaseError";
import { resolverMarca } from "@/lib/resolverMarca";
import { exportarDesglosePersonaPdf } from "@/lib/exportarPdf";

export function PersonaBreakdown({
  personaNombre,
  mesLabel,
  total,
  cuotasPersona,
  gastosPersona,
  categorias,
  entidades,
  marcas,
  onClose,
  personaId,
  ingresosPersona,
  onIngresosActualizados,
  variant = "modal",
}: {
  personaNombre: string;
  mesLabel: string;
  total: number;
  cuotasPersona: RepartoCuota[];
  gastosPersona: RepartoGastoFijo[];
  categorias: Categoria[];
  entidades: Entidad[];
  marcas: Marca[];
  onClose: () => void;
  // Sección "Ingresos este mes", editable ahí mismo — opcional: solo aparece
  // cuando quien abre el panel (hoy, /personas) pasa estos 3 props. El
  // dashboard (Inicio) sigue abriendo este mismo panel sin ellos, sin
  // cambios de comportamiento.
  personaId?: string;
  ingresosPersona?: Ingreso[];
  onIngresosActualizados?: () => void | Promise<void>;
  // "modal" (por defecto): el panel flotante de siempre — lo sigue usando
  // Inicio al hacer clic en la barra del gráfico de personas. "inline": se
  // dibuja como una sección más de la página (misma tarjeta que el resto),
  // sin overlay ni límite de alto — lo usa /personas, para que el detalle no
  // salga "cortado" en ventanas más chicas. Mismo contenido en ambos casos.
  variant?: "modal" | "inline";
}) {
  // Efecto "panel-reveal" (transitions.dev): el panel entra deslizándose
  // desde abajo con un leve cross-blur en vez de aparecer de golpe, y sale
  // con su propia duración (ver .panel-reveal / .panel-reveal-backdrop en
  // globals.css) — por eso el cierre real (onClose, que desmonta el sheet)
  // se retrasa lo que dura la animación, salvo que el usuario prefiera
  // menos movimiento.
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setAbierto(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function cerrar() {
    // La sección inline (/personas) no tiene animación de salida propia — se
    // desmonta directo, como cualquier otra tarjeta de la página.
    if (variant === "inline") {
      onClose();
      return;
    }
    setAbierto(false);
    const prefiereMenosMovimiento =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setTimeout(onClose, prefiereMenosMovimiento ? 0 : 350);
  }

  const nombreCategoria = (id: string | null) => categorias.find((c) => c.id === id)?.nombre ?? "Sin categoría";
  const entidadDe = (id: string | null) => entidades.find((e) => e.id === id) ?? null;
  const marcaDeEntidad = (id: string | null) => resolverMarca(entidadDe(id), marcas);
  const marcaDe = (id: string | null) => marcas.find((m) => m.id === id) ?? null;

  const items = [
    ...cuotasPersona.map((c) => ({
      key: `c-${c.compra_id}`,
      descripcion: c.descripcion,
      categoria: nombreCategoria(c.categoria_id),
      entidad_id: c.entidad_id,
      marca_id: c.marca_id,
      icono: c.icono,
      detalle: `Cuota ${c.cuota_actual} de ${c.n_cuotas}`,
      monto: c.monto_persona,
    })),
    ...gastosPersona.map((g) => ({
      key: `g-${g.gasto_fijo_id}`,
      descripcion: g.descripcion,
      categoria: nombreCategoria(g.categoria_id),
      entidad_id: g.entidad_id,
      marca_id: g.marca_id,
      icono: g.icono,
      detalle: "Gasto fijo",
      monto: g.monto_persona,
    })),
  ].sort((a, b) => b.monto - a.monto);

  // --- Ingresos este mes: alta/edición/borrado ahí mismo, sin salir del
  // panel (antes solo se podía desde /ingresos, filtrando a mano). ---
  const [agregandoIngreso, setAgregandoIngreso] = useState(false);
  const [montoNuevo, setMontoNuevo] = useState("");
  const [descNuevo, setDescNuevo] = useState("");
  const [editandoIngresoId, setEditandoIngresoId] = useState<string | null>(null);
  const [montoEdit, setMontoEdit] = useState("");
  const [descEdit, setDescEdit] = useState("");
  const [guardandoIngreso, setGuardandoIngreso] = useState(false);
  const [errorIngreso, setErrorIngreso] = useState("");

  function avisarIngresoGuardado() {
    window.dispatchEvent(new CustomEvent(EVENTO_MOVIMIENTO_GUARDADO, { detail: { tipo: "ingreso" } }));
  }

  async function actualizar() {
    if (onIngresosActualizados) await onIngresosActualizados();
    avisarIngresoGuardado();
  }

  async function agregarIngreso() {
    if (!personaId || !montoNuevo) return;
    setErrorIngreso("");
    setGuardandoIngreso(true);
    const { error } = await supabase.from("ingresos").insert({
      persona_id: personaId,
      monto: Number(montoNuevo),
      mes: mesActualISO(),
      descripcion: descNuevo || null,
    });
    setGuardandoIngreso(false);
    if (error) {
      setErrorIngreso(mensajeError(error) || "No se pudo agregar el ingreso.");
      return;
    }
    setMontoNuevo("");
    setDescNuevo("");
    setAgregandoIngreso(false);
    await actualizar();
  }

  function iniciarEdicionIngreso(ing: Ingreso) {
    setEditandoIngresoId(ing.id);
    setMontoEdit(String(ing.monto));
    setDescEdit(ing.descripcion ?? "");
    setErrorIngreso("");
  }

  async function guardarEdicionIngreso(id: string) {
    if (!montoEdit) return;
    setErrorIngreso("");
    setGuardandoIngreso(true);
    const { error } = await supabase
      .from("ingresos")
      .update({ monto: Number(montoEdit), descripcion: descEdit || null })
      .eq("id", id);
    setGuardandoIngreso(false);
    if (error) {
      setErrorIngreso(mensajeError(error) || "No se pudo guardar el ingreso.");
      return;
    }
    setEditandoIngresoId(null);
    await actualizar();
  }

  async function eliminarIngreso(id: string) {
    const { error } = await supabase.from("ingresos").delete().eq("id", id);
    if (error) {
      setErrorIngreso(mensajeError(error) || "No se pudo eliminar el ingreso.");
      return;
    }
    await actualizar();
  }

  function exportarPdf() {
    exportarDesglosePersonaPdf({
      personaNombre,
      mesLabel,
      total,
      items: items.map((it) => ({
        descripcion: it.descripcion,
        categoria: it.categoria,
        detalle: it.detalle,
        monto: it.monto,
      })),
    });
  }

  // Mismo contenido para las dos presentaciones (modal e inline) — solo
  // cambia lo que lo envuelve, más abajo.
  const contenido = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-lg font-bold text-gray-800 dark:text-white">{personaNombre}</p>
          <p className="text-xs capitalize text-gray-400 dark:text-gray-500">{mesLabel}</p>
        </div>
        <button onClick={cerrar} className="rounded-full p-1 text-gray-400 hover:bg-gray-100 dark:text-gray-500 dark:hover:bg-white/10">
          {variant === "inline" ? "✕ cerrar" : "✕"}
        </button>
      </div>

      <p className="mt-3 text-2xl font-bold text-brand-from dark:text-pink-400">{formatCLP(total)}</p>
      <p className="text-xs text-gray-400 dark:text-gray-500">Total que le corresponde este mes</p>

      {personaId && ingresosPersona && (
          <div className="mt-4 rounded-xl border border-gray-100 p-3 dark:border-white/10">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Ingresos este mes</p>
              <button
                type="button"
                onClick={() => {
                  setAgregandoIngreso((v) => !v);
                  setErrorIngreso("");
                }}
                className="text-xs font-medium text-brand-from dark:text-pink-400"
              >
                {agregandoIngreso ? "cancelar" : "+ Agregar"}
              </button>
            </div>

            <div className="mt-2 space-y-1.5">
              {ingresosPersona.length === 0 && !agregandoIngreso && (
                <p className="text-xs text-gray-400 dark:text-gray-500">Sin ingresos cargados este mes.</p>
              )}
              {ingresosPersona.map((ing) =>
                editandoIngresoId === ing.id ? (
                  <div key={ing.id} className="space-y-1.5 rounded-lg bg-gray-50 p-2 dark:bg-white/5">
                    <div className="flex gap-1.5">
                      <input
                        type="number"
                        min={0}
                        autoFocus
                        value={montoEdit}
                        onChange={(e) => setMontoEdit(e.target.value)}
                        placeholder="Monto"
                        className="w-24 rounded-lg border border-gray-200 px-2 py-1.5 text-xs dark:border-white/10 dark:bg-white/5 dark:text-white"
                      />
                      <input
                        value={descEdit}
                        onChange={(e) => setDescEdit(e.target.value)}
                        placeholder="Descripción (opcional)"
                        className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs dark:border-white/10 dark:bg-white/5 dark:text-white"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => guardarEdicionIngreso(ing.id)}
                        disabled={guardandoIngreso || !montoEdit}
                        className="rounded-lg bg-brand-gradient px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-60"
                      >
                        Guardar
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditandoIngresoId(null)}
                        className="text-xs text-gray-400 dark:text-gray-500"
                      >
                        cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div key={ing.id} className="flex items-center justify-between gap-2 py-1">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-gray-700 dark:text-gray-200">{ing.descripcion || "Ingreso"}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2.5">
                      <span className="text-sm font-semibold text-gray-800 dark:text-white">{formatCLP(ing.monto)}</span>
                      <button
                        type="button"
                        onClick={() => iniciarEdicionIngreso(ing)}
                        className="text-xs text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                      >
                        editar
                      </button>
                      <button
                        type="button"
                        onClick={() => eliminarIngreso(ing.id)}
                        className="text-xs text-gray-300 hover:text-red-400 dark:text-gray-600"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>

            {agregandoIngreso && (
              <div className="mt-2 space-y-1.5 rounded-lg bg-gray-50 p-2 dark:bg-white/5">
                <div className="flex gap-1.5">
                  <input
                    type="number"
                    min={0}
                    autoFocus
                    value={montoNuevo}
                    onChange={(e) => setMontoNuevo(e.target.value)}
                    placeholder="Monto"
                    className="w-24 rounded-lg border border-gray-200 px-2 py-1.5 text-xs dark:border-white/10 dark:bg-white/5 dark:text-white"
                  />
                  <input
                    value={descNuevo}
                    onChange={(e) => setDescNuevo(e.target.value)}
                    placeholder="Ej: Sueldo"
                    className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs dark:border-white/10 dark:bg-white/5 dark:text-white"
                  />
                </div>
                <button
                  type="button"
                  onClick={agregarIngreso}
                  disabled={guardandoIngreso || !montoNuevo}
                  className="w-full rounded-lg bg-brand-gradient py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {guardandoIngreso ? "Guardando…" : "Guardar ingreso"}
                </button>
              </div>
            )}

            {errorIngreso && <p className="mt-1.5 text-xs text-red-500 dark:text-red-400">{errorIngreso}</p>}
          </div>
        )}

      {variant === "inline" && (
        <>
          <p className="mb-1 mt-4 text-sm font-semibold text-gray-600 dark:text-gray-300">Movimientos</p>
          <p className="mb-1 text-xs capitalize text-gray-400 dark:text-gray-500">{mesLabel}</p>
        </>
      )}
      <div className={variant === "inline" ? "divide-y divide-gray-100 dark:divide-white/10" : "mt-4 divide-y divide-gray-100 dark:divide-white/10"}>
        {items.length === 0 && <p className="py-4 text-sm text-gray-400 dark:text-gray-500">Sin ítems este mes.</p>}
        {items.map((it) => (
          <div key={it.key} className="flex items-center gap-3 py-2.5">
            <EntidadAvatar
              entidad={entidadDe(it.entidad_id) ?? undefined}
              marca={marcaDe(it.marca_id) ?? marcaDeEntidad(it.entidad_id)}
              icono={it.icono}
              className="h-8 w-8"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-700 dark:text-gray-200">{it.descripcion}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {it.categoria} · {it.detalle}
              </p>
            </div>
            <p className="shrink-0 text-sm font-semibold text-gray-800 dark:text-white">{formatCLP(it.monto)}</p>
          </div>
        ))}
      </div>

      <button
        onClick={exportarPdf}
        disabled={items.length === 0}
        className="mt-5 w-full rounded-lg bg-brand-gradient py-2.5 text-sm font-semibold text-white disabled:opacity-40"
      >
        Exportar PDF
      </button>
    </>
  );

  // Inline (/personas): una tarjeta más de la página, con el scroll natural
  // de la página — nada de overlay ni de alto máximo, así no puede salir
  // "cortada" como pasaba con el modal en ventanas más chicas.
  if (variant === "inline") {
    return <Card>{contenido}</Card>;
  }

  return (
    <div
      data-open={abierto}
      className="panel-reveal-backdrop fixed inset-0 z-30 flex items-end justify-center bg-black/40 px-0 sm:items-center sm:px-4"
      onClick={cerrar}
    >
      <div
        data-open={abierto}
        className="panel-reveal max-h-[85vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl dark:bg-gray-900 dark:shadow-none sm:max-w-lg sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {contenido}
      </div>
    </div>
  );
}
