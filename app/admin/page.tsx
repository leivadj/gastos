import { redirect } from "next/navigation";

// Ronda 10 (unificación de categorías) portó todo lo que hacía este panel —
// crear/editar/borrar categorías y marcas, subir logos — a /categorias
// (Perfil > Configuración > Categorías), disponible ahí para cualquier
// cuenta en vez de solo la admin. Ronda 11: Felipe pidió eliminar el menú
// Admin del todo (no solo dejar de enlazarlo desde la navegación) — la
// última pieza que faltaba portar, "Logos solicitados" (revisar los pedidos
// de "Sugerir un logo"), también se movió a /categorias. Se deja este
// redirect en vez de borrar la ruta, por si quedó algún acceso directo
// guardado (mismo criterio que /compras y /gastos-fijos).
export default function AdminRedirect() {
  redirect("/categorias");
}
