import { redirect } from "next/navigation";

// /gastos-fijos se fusionó en /gastos (pestañas "Fijos" y "Variables") — se
// deja este redirect en vez de borrar la ruta, por si quedó algún acceso
// directo guardado (ej. en la pantalla de inicio del celular).
export default function GastosFijosRedirect() {
  redirect("/gastos?tab=fijos");
}
