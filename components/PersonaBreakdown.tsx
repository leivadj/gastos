"use client";

import { useEffect, useState } from "react";
import { Categoria, Entidad, Marca, RepartoCuota, RepartoGastoFijo } from "@/lib/types";
import { EntidadAvatar } from "@/components/EntidadAvatar";
import { formatCLP } from "@/lib/format";
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
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-lg font-bold text-gray-800 dark:text-white">{personaNombre}</p>
            <p className="text-xs capitalize text-gray-400 dark:text-gray-500">{mesLabel}</p>
          </div>
          <button onClick={cerrar} className="rounded-full p-1 text-gray-400 hover:bg-gray-100 dark:text-gray-500 dark:hover:bg-white/10">
            ✕
          </button>
        </div>

        <p className="mt-3 text-2xl font-bold text-brand-from dark:text-pink-400">{formatCLP(total)}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500">Total que le corresponde este mes</p>

        <div className="mt-4 divide-y divide-gray-100 dark:divide-white/10">
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
      </div>
    </div>
  );
}
