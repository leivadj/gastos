"use client";

import { Categoria } from "@/lib/types";

// Selector de categoría en chips horizontales (calcado del mockup
// "Nuevo movimiento" — antes era un <select> simple). Mismo patrón visual
// que ya usa EntidadPicker.tsx para elegir cuenta/tarjeta: fila con scroll
// horizontal de tiles ícono+nombre, con la elegida resaltada.
export function CategoriaPicker({
  categorias,
  value,
  onChange,
}: {
  categorias: Categoria[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
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
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-base dark:bg-white/10">
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
    </div>
  );
}
