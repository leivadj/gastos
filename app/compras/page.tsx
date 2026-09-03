import { redirect } from "next/navigation";

// /compras se fusionó en /gastos (pestaña "Cuotas") — se deja este redirect
// en vez de borrar la ruta, por si quedó algún acceso directo guardado (ej.
// en la pantalla de inicio del celular).
export default function ComprasRedirect() {
  redirect("/gastos?tab=cuotas");
}
