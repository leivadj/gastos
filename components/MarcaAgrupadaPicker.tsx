"use client";

import { useState } from "react";
import { Marca, TipoMarca } from "@/lib/types";
import { EntidadAvatar } from "@/components/EntidadAvatar";
import { IconoPicker } from "@/components/IconoPicker";
import { supabase } from "@/lib/supabaseClient";
import { mensajeError } from "@/lib/supabaseError";

export type GrupoMarca = { tipo: TipoMarca; label: string };

// Como MarcaSugeridaPicker (mismo estilo visual: chips con avatar + nombre,
// "Ninguna" para no elegir ninguna), pero para una pantalla que necesita
// varios TIPOS de marca a la vez en vez de uno solo sugerido por la
// categoría — hoy /auto (Bencina / Mecánico / Repuestos) y /salud (Centro
// médico / Medicamentos), ver migration_25_marcas_auto_salud.sql. Por eso
// "agregar marca nueva" pide elegir a qué grupo va, en vez de asumirlo.
export function MarcaAgrupadaPicker({
  grupos,
  marcas,
  value,
  onChange,
  onCatalogoActualizado,
}: {
  grupos: GrupoMarca[];
  marcas: Marca[];
  value: string;
  onChange: (id: string) => void;
  onCatalogoActualizado?: () => void | Promise<void>;
}) {
  const [agregando, setAgregando] = useState(false);
  const [tipoNueva, setTipoNueva] = useState<TipoMarca>(grupos[0]?.tipo ?? "otro");
  const [nombreNueva, setNombreNueva] = useState("");
  const [iconoNueva, setIconoNueva] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  function abrirAgregar() {
    setTipoNueva(grupos[0]?.tipo ?? "otro");
    setNombreNueva("");
    setIconoNueva("");
    setError("");
    setAgregando(true);
  }

  function cerrarAgregar() {
    setAgregando(false);
    setError("");
  }

  async function agregarMarca() {
    if (!nombreNueva.trim()) return;
    setError("");
    setGuardando(true);
    try {
      const { data, error: insError } = await supabase
        .from("marcas")
        .insert({ nombre: nombreNueva.trim(), tipo: tipoNueva, icono: iconoNueva || null })
        .select()
        .single();
      if (insError) throw insError;
      onChange(data.id);
      cerrarAgregar();
      if (onCatalogoActualizado) await onCatalogoActualizado();
    } catch (err) {
      setError(mensajeError(err) || "No se pudo agregar. ¿Tu cuenta tiene permiso de administrador?");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <button
          type="button"
          onClick={() => onChange("")}
          className={`flex shrink-0 flex-col items-center gap-1 rounded-lg border p-2 ${
            value === "" ? "border-brand-from bg-purple-50 dark:bg-white/10" : "border-gray-200 dark:border-white/10"
          }`}
          style={{ width: 64 }}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-xs text-gray-400 dark:bg-white/10 dark:text-gray-500">
            —
          </span>
          <span className="text-center text-[10px] text-gray-500 dark:text-gray-400">Ninguna</span>
        </button>
      </div>

      {grupos.map((grupo) => {
        const delGrupo = marcas.filter((m) => m.tipo === grupo.tipo);
        if (delGrupo.length === 0) return null;
        return (
          <div key={grupo.tipo}>
            <p className="mb-1 text-[11px] font-medium text-gray-400 dark:text-gray-500">{grupo.label}</p>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {delGrupo.map((m) => (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => onChange(m.id === value ? "" : m.id)}
                  className={`flex shrink-0 flex-col items-center gap-1 rounded-lg border p-2 ${
                    value === m.id ? "border-brand-from bg-purple-50 dark:bg-white/10" : "border-gray-200 dark:border-white/10"
                  }`}
                  style={{ width: 64 }}
                >
                  <EntidadAvatar marca={m} nombreFallback={m.nombre} className="h-9 w-9" />
                  <span className="truncate text-center text-[10px] text-gray-600 dark:text-gray-300" style={{ maxWidth: 60 }}>
                    {m.nombre}
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {!agregando && (
        <button
          type="button"
          onClick={abrirAgregar}
          className="text-[11px] font-medium text-brand-from dark:text-pink-400"
        >
          + Agregar marca nueva
        </button>
      )}

      {agregando && (
        <div className="space-y-2 rounded-lg border border-gray-200 p-3 dark:border-white/10">
          <div className="flex flex-wrap gap-1.5">
            {grupos.map((grupo) => (
              <button
                type="button"
                key={grupo.tipo}
                onClick={() => setTipoNueva(grupo.tipo)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                  tipoNueva === grupo.tipo
                    ? "border-brand-from bg-purple-50 text-brand-from dark:bg-white/10 dark:text-white"
                    : "border-gray-200 text-gray-500 dark:border-white/10 dark:text-gray-400"
                }`}
              >
                {grupo.label}
              </button>
            ))}
          </div>
          <input
            autoFocus
            value={nombreNueva}
            onChange={(e) => setNombreNueva(e.target.value)}
            placeholder="Nombre (ej: Copec)"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
          />
          <IconoPicker value={iconoNueva} onChange={setIconoNueva} />
          {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={agregarMarca}
              disabled={guardando || !nombreNueva.trim()}
              className="flex-1 rounded-lg bg-brand-gradient py-2 text-xs font-semibold text-white disabled:opacity-60"
            >
              {guardando ? "Agregando…" : `Agregar y usar`}
            </button>
            <button type="button" onClick={cerrarAgregar} className="text-[11px] text-gray-400 dark:text-gray-500">
              cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
