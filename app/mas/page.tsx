"use client";

import { navItems } from "@/components/navItems";
import { PerfilPropioCard, Seccion, FilaLista } from "@/components/PerfilPropioCard";

// Todo lo que no entra en la barra inferior (Metas, Auto, Salud, Ingresos,
// Grupos, Personas, Sugerencias, Gastos, Calendario, Movimientos, Reportes)
// vive acá agrupado. Esto NO es la app anterior al rediseño — son pantallas
// actuales del rediseño v2 (Felipe reportó no encontrar varias de estas —
// el nombre daba a entender que eran herramientas viejas/descartables).
// "Auto" y "Salud" son pantallas nuevas de gastos sueltos (ver
// navItems.tsx).
//
// Ronda 10: se sacó "Admin" de esta lista — la gestión de categorías y
// marcas que vivía en /admin ahora está en Perfil > Configuración >
// Categorías (/categorias). Ronda 11: /admin se retiró del todo (redirige a
// /categorias, ver app/admin/page.tsx), así que ya ni hacía falta filtrarlo
// acá — nunca estuvo en HREFS de todas formas.
//
// Ronda 11 (2): Felipe pidió mantener esta lista completa (a diferencia del
// menú lateral de escritorio, donde sí se sacaron Auto/Salud — ver
// DesktopSidebar.tsx) pero con "el formato del menú nuevo": pasa del
// acordeón propio (tarjeta con borde punteado, ícono a la izquierda de cada
// fila, flecha gruesa) a `Seccion`/`FilaLista`, el mismo patrón de fila con
// título + flecha fina que ya usan Integraciones/Configuración/Apariencia
// dentro de `PerfilPropioCard` — ahora exportados desde ahí para
// reutilizarlos acá sin duplicar el estilo. Sin acordeón: ninguna otra
// sección de Perfil se colapsa, así que esta tampoco, por consistencia.
const HREFS_MAS_SECCIONES = [
  "/metas-ahorro",
  "/auto",
  "/salud",
  "/ingresos",
  "/grupos",
  "/compromisos",
  "/personas",
  "/sugerencias",
  "/gastos",
  "/calendario-pagos",
  "/movimientos",
  "/reportes",
];

export default function MasPage() {
  const itemsMasSecciones = navItems.filter((item) => HREFS_MAS_SECCIONES.includes(item.href));

  return (
    <div className="space-y-6 pb-10 pt-2">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Más</h1>
        <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">Tu perfil y el resto de las secciones.</p>
      </div>

      <PerfilPropioCard />

      <Seccion titulo="Más secciones">
        {itemsMasSecciones.map((item) => (
          <FilaLista key={item.href} titulo={item.label} href={item.href} />
        ))}
      </Seccion>
    </div>
  );
}
