import { PresupuestoContenido } from "@/components/PresupuestoContenido";

// Página standalone de /presupuesto — se sigue usando desde el sidebar de
// escritorio (ver components/DesktopSidebar.tsx). En celular, este mismo
// contenido vive como la pestaña "Presupuestos" de Inicio (ver
// app/page.tsx, rediseño v2) en vez de esta ruta propia.
export default function PresupuestoPage() {
  return <PresupuestoContenido />;
}
