"use client";

import { Categoria } from "@/lib/types";

// Grilla de categorías con ícono — Fase 1 del rediseño "estilo Haulo".
// Reemplaza al <select> de categoría (que obligaba a abrir un desplegable,
// leer nombres en una lista larga y no mostraba el ícono) por tarjetas
// grandes tocables: un solo toque elige la categoría, y como el ícono ya
// viene guardado en `categorias.icono` (un emoji, ver lib/types.ts) no hace
// falta ningún catálogo de íconos nuevo — usa el mismo dato que ya existe.
export function GrillaCategorias({
  categorias,
  value,
  onChange,
}: {
  categorias: Categoria[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-2.5">
      {categorias.map((c) => {
        const activa = c.id === value;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(activa ? "" : c.id)}
            className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl px-1 text-center transition active:scale-95 ${
              activa
                ? "bg-purple-50 ring-2 ring-brand-from dark:bg-white/10 dark:ring-white"
                : "bg-gray-50 dark:bg-white/[0.05]"
            }`}
          >
            <span className="text-2xl leading-none">{c.icono || "🏷️"}</span>
            <span
              className={`line-clamp-2 text-[10px] font-semibold leading-tight ${
                activa ? "text-brand-from dark:text-white" : "text-gray-500 dark:text-gray-400"
              }`}
            >
              {c.nombre}
            </span>
          </button>
        );
      })}
    </div>
  );
}
