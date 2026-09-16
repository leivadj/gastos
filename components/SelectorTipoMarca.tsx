"use client";

import { useState } from "react";
import { slugTipo } from "@/lib/tiposMarca";

// Selector de "tipo de marca" reutilizable con opción de crear uno nuevo al
// vuelo — antes vivía solo dentro de app/admin/page.tsx (un <select> con los
// 17 valores de TIPOS_MARCA_BASE en cada uno de los lugares que usan tipo de
// marca, así que una categoría nueva nunca podía introducir un tipo nuevo).
// Se centraliza acá en Ronda 10 porque app/categorias/page.tsx también lo
// necesita (ver claude/propuesta-modulo-compromisos.md) — mismo componente,
// cero cambio de comportamiento para /admin.
export function SelectorTipoMarca({
  value,
  onChange,
  tiposDisponibles,
  permitirNinguna,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  tiposDisponibles: { value: string; label: string }[];
  permitirNinguna?: boolean;
  className?: string;
}) {
  const [creandoNuevo, setCreandoNuevo] = useState(false);
  const [nuevoTipo, setNuevoTipo] = useState("");
  const claseBase =
    className ?? "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white";

  if (creandoNuevo) {
    return (
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={nuevoTipo}
          onChange={(e) => setNuevoTipo(e.target.value)}
          placeholder="Ej: Mascotas"
          className={claseBase}
        />
        <button
          type="button"
          onClick={() => {
            onChange(slugTipo(nuevoTipo));
            setCreandoNuevo(false);
            setNuevoTipo("");
          }}
          className="shrink-0 text-xs font-semibold text-brand-from dark:text-white"
        >
          usar
        </button>
        <button
          type="button"
          onClick={() => {
            setCreandoNuevo(false);
            setNuevoTipo("");
          }}
          className="shrink-0 text-xs text-gray-400 dark:text-gray-500"
        >
          cancelar
        </button>
      </div>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => {
        if (e.target.value === "__nuevo__") {
          setCreandoNuevo(true);
          return;
        }
        onChange(e.target.value);
      }}
      className={claseBase}
    >
      {permitirNinguna && <option value="">— Ninguna —</option>}
      {tiposDisponibles.map((t) => (
        <option key={t.value} value={t.value}>
          {t.label}
        </option>
      ))}
      <option value="__nuevo__">+ Nuevo tipo…</option>
    </select>
  );
}
