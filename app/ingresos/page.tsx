import { IngresosContenido } from "@/components/IngresosContenido";

// Página standalone de /ingresos — se sigue usando desde el sidebar de
// escritorio (ver components/DesktopSidebar.tsx). En celular, este mismo
// contenido vive como la pestaña "Ingresos" de Inicio (ver app/page.tsx,
// rediseño v2) en vez de esta ruta propia.
export default function IngresosPage() {
  return <IngresosContenido />;
}
