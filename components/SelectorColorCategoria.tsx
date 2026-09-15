"use client";

// Paleta de colores propios de categoría (ronda 6 del rediseño, ver
// migration_36_color_categoria.sql) — vivos y distinguibles a propósito
// (a diferencia de la paleta gris de lib/avatarColor.ts, pensada para
// logos/avatares de respaldo), calcada de una captura real de Not Pato
// donde cada categoría tiene su propio color reconocible de un vistazo.
//
// Compartido entre /admin (edición de categorías existentes) y
// MovimientoRapido (crear una categoría nueva con ícono/color directo
// desde el celular, ronda 7 del rediseño) — antes vivía solo en
// app/admin/page.tsx.
export const PALETA_COLOR_CATEGORIA = [
  "#E2584B", // rojo
  "#E8935A", // naranjo
  "#E0C54A", // amarillo
  "#5DCB86", // verde
  "#4FB6C7", // celeste
  "#5B8DEF", // azul
  "#9B7FE0", // morado
  "#D46FB3", // rosado
];

export function SelectorColorCategoria({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {PALETA_COLOR_CATEGORIA.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(value === c ? "" : c)}
          aria-label={`Color ${c}`}
          className={`h-7 w-7 rounded-full transition ${value === c ? "ring-2 ring-offset-2 ring-gray-800 dark:ring-white dark:ring-offset-neutral-900" : ""}`}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );
}
