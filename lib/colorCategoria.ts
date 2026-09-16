import { Categoria } from "@/lib/types";
import { colorFor } from "@/lib/avatarColor";

// Color a usar para representar una categoría (barras verticales de
// Presupuesto por categoría en Inicio, anillos de progreso en Presupuesto,
// tiles de /categorias): el color elegido a mano en /admin
// (migration_36_color_categoria.sql) si existe, o si no el color
// determinístico por nombre de siempre (lib/avatarColor.ts) — así ninguna
// categoría se ve "sin color" mientras Felipe no le haya asignado uno.
export function colorCategoria(categoria: Pick<Categoria, "nombre" | "color">): string {
  return categoria.color || colorFor(categoria.nombre);
}
