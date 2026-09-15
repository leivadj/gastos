"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { colorCategoria } from "@/lib/colorCategoria";
import { Categoria } from "@/lib/types";

// Pantalla "Categorías" del mockup móvil: solo lectura (grid de
// ícono+nombre, agrupadas Egresos/Ingresos), con una nota al pie que
// manda a /admin en escritorio para editar íconos/nombres — mismo
// criterio ya decidido para el mockup (ver claude/mockup-v2-decisiones.md:
// "toda la edición... quedará como menú admin solo en web"). Los tiles sí
// llevan a /categoria/[id] (el detalle de esa categoría este mes), a
// diferencia del mockup que no tiene ese link — es una mejora natural
// dado que esa pantalla de detalle ya existe.
//
// La sección "Ingresos" del mockup (Sueldo/Transferencias/Otros
// ingresos) no tiene respaldo real: la tabla `ingresos` no guarda
// categoría (solo persona/monto/mes/descripción) — se deja como nota en
// vez de inventar categorías que no filtran nada.
export default function CategoriasPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    supabase
      .from("categorias")
      .select("*")
      .order("nombre")
      .then(({ data }) => {
        setCategorias((data as Categoria[]) ?? []);
        setCargando(false);
      });
  }, []);

  if (cargando) {
    return <p className="py-10 text-center text-gray-400 dark:text-gray-500">Cargando…</p>;
  }

  return (
    <div className="space-y-5 pb-10">
      <h1 className="text-lg font-bold text-gray-800 dark:text-white">Categorías</h1>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Egresos</p>
        {categorias.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">Todavía no tienes categorías creadas.</p>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {categorias.map((c) => (
              <Link
                key={c.id}
                href={`/categoria/${c.id}`}
                className="flex flex-col items-center gap-1.5 rounded-2xl border border-gray-100 bg-white py-3 text-center dark:border-white/10 dark:bg-neutral-900"
              >
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-2xl text-xl"
                  style={{ backgroundColor: `${colorCategoria(c)}26` }}
                >
                  {c.icono || "•"}
                </span>
                <span className="truncate px-1 text-[11px] font-medium text-gray-600 dark:text-gray-300" style={{ maxWidth: 70 }}>
                  {c.nombre}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Ingresos</p>
        <p className="rounded-2xl border border-dashed border-gray-200 px-4 py-3 text-xs text-gray-400 dark:border-white/10 dark:text-gray-500">
          Los ingresos todavía no se clasifican por categoría — próximamente.
        </p>
      </div>

      <p className="rounded-2xl bg-gray-50 px-4 py-3 text-center text-[11px] text-gray-400 dark:bg-white/5 dark:text-gray-500">
        Para cambiar íconos, marcas o crear categorías nuevas, usa el panel de administración en la versión web.
      </p>
    </div>
  );
}
