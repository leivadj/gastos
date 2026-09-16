"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { mensajeError } from "@/lib/supabaseError";
import { IconoPicker } from "@/components/IconoPicker";
import { PALETA_COLOR_CATEGORIA, SelectorColorCategoria } from "@/components/SelectorColorCategoria";
import { Categoria } from "@/lib/types";

// Selector de categoría en chips horizontales (calcado del mockup
// "Nuevo movimiento" — antes era un <select> simple). Mismo patrón visual
// que ya usa EntidadPicker.tsx para elegir cuenta/tarjeta: fila con scroll
// horizontal de tiles ícono+nombre, con la elegida resaltada.
//
// Ronda 7 del rediseño: Felipe pidió poder crear una categoría nueva con
// ícono y color ahí mismo, desde "Nuevo movimiento" en el celular, en vez
// de tener que ir a /admin en la web (que sigue existiendo, para editar
// categorías ya creadas) — mismo patrón de "+" con panel de creación en
// línea que ya usa MarcaSugeridaPicker.tsx para marcas nuevas.
export function CategoriaPicker({
  categorias,
  value,
  onChange,
  onCatalogoActualizado,
}: {
  categorias: Categoria[];
  value: string;
  onChange: (id: string) => void;
  onCatalogoActualizado?: () => void | Promise<void>;
}) {
  const [creando, setCreando] = useState(false);
  const [nombreNueva, setNombreNueva] = useState("");
  const [iconoNueva, setIconoNueva] = useState("");
  const [colorNueva, setColorNueva] = useState(PALETA_COLOR_CATEGORIA[0]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  function cerrarCreacion() {
    setCreando(false);
    setNombreNueva("");
    setIconoNueva("");
    setColorNueva(PALETA_COLOR_CATEGORIA[0]);
    setError("");
  }

  async function crearCategoria() {
    if (!nombreNueva.trim()) return;
    setError("");
    setGuardando(true);
    try {
      const { data, error: insError } = await supabase
        .from("categorias")
        .insert({ nombre: nombreNueva.trim(), icono: iconoNueva || null, color: colorNueva || null })
        .select()
        .single();
      if (insError) throw insError;
      onChange(data.id);
      cerrarCreacion();
      if (onCatalogoActualizado) await onCatalogoActualizado();
    } catch (err) {
      const msg = mensajeError(err);
      setError(msg.includes("categorias_nombre_key") ? `Ya existe una categoría "${nombreNueva.trim()}" — elígela de la lista.` : msg || "No se pudo crear la categoría.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {categorias.map((c) => {
          const activa = value === c.id;
          return (
            <button
              type="button"
              key={c.id}
              onClick={() => onChange(c.id === value ? "" : c.id)}
              className={`flex shrink-0 flex-col items-center gap-1 rounded-lg border p-2 ${
                activa ? "border-brand-from bg-gray-50 dark:bg-white/10" : "border-gray-200 dark:border-white/10"
              }`}
              style={{ width: 64 }}
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-lg text-base ${c.color ? "" : "bg-gray-100 dark:bg-white/10"}`}
                style={c.color ? { backgroundColor: `${c.color}26` } : undefined}
              >
                {c.icono || "•"}
              </span>
              <span
                className="truncate text-center text-[10px] leading-tight text-gray-600 dark:text-gray-300"
                style={{ maxWidth: 60 }}
              >
                {c.nombre}
              </span>
            </button>
          );
        })}
        {onCatalogoActualizado && (
          <button
            type="button"
            onClick={() => setCreando((v) => !v)}
            className={`flex shrink-0 flex-col items-center gap-1 rounded-lg border p-2 ${
              creando ? "border-brand-from bg-gray-50 dark:bg-white/10" : "border-gray-200 border-dashed dark:border-white/10"
            }`}
            style={{ width: 64 }}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-lg text-gray-400 dark:bg-white/10 dark:text-gray-500">
              +
            </span>
            <span className="text-center text-[10px] text-gray-500 dark:text-gray-400">Nueva</span>
          </button>
        )}
      </div>

      {creando && (
        <div className="mt-2 space-y-2.5 rounded-lg border border-gray-200 p-3 dark:border-white/10">
          <input
            autoFocus
            value={nombreNueva}
            onChange={(e) => setNombreNueva(e.target.value)}
            placeholder="Nombre de la categoría (ej: Préstamo)"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
          />
          <div>
            <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Ícono</p>
            <IconoPicker value={iconoNueva} onChange={setIconoNueva} />
          </div>
          <div>
            <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Color</p>
            <SelectorColorCategoria value={colorNueva} onChange={setColorNueva} />
          </div>
          {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={crearCategoria}
              disabled={guardando || !nombreNueva.trim()}
              className="flex-1 rounded-lg bg-brand-gradient px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
            >
              {guardando ? "Guardando…" : "Crear y usar"}
            </button>
            <button
              type="button"
              onClick={cerrarCreacion}
              className="rounded-lg bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-400 dark:bg-white/5 dark:text-gray-500"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
