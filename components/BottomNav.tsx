"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems, masNavItem } from "@/components/navItems";
import { MovimientoFab } from "@/components/MovimientoRapido";

// Rutas que "pertenecen" a la pestaña Más, para que se marque activa aunque
// el usuario esté en /compras, /grupos, /admin, etc. (no solo en /mas mismo).
const RUTAS_MAS = ["/mas", "/compras", "/ingresos", "/grupos", "/personas", "/admin"];

// Barra inferior rediseñada (rediseño "cuotas"): 4 destinos + el botón
// central "+" — Inicio, Cuentas, Presupuesto y Más (que agrupa
// Cuotas/Ingresos/Grupos/Personas/Admin, ver /mas). Cada ítem activo
// muestra una "chip" redondeada detrás del ícono que aparece con una
// animación tipo resorte (leve rebote), inspirada en las
// micro-interacciones de transitions.dev, en vez de solo cambiar de color
// de golpe.
export function BottomNav() {
  const pathname = usePathname();

  const inicio = navItems.find((item) => item.href === "/")!;
  const cuentas = navItems.find((item) => item.href === "/tarjetas")!;
  const presupuesto = navItems.find((item) => item.href === "/gastos-fijos")!;

  function renderItem(item: (typeof navItems)[number], active: boolean) {
    return (
      <Link
        key={item.href}
        href={item.href}
        className="flex flex-1 flex-col items-center gap-1 py-2 text-[11px]"
      >
        <span className="relative flex h-9 w-12 items-center justify-center">
          <span
            className={`absolute inset-0 rounded-2xl bg-purple-50 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
              active ? "scale-100 opacity-100" : "scale-75 opacity-0"
            }`}
          />
          <span className={`relative transition-colors duration-200 ${active ? "text-brand-from" : "text-gray-400"}`}>
            {item.icon(active)}
          </span>
        </span>
        <span className={`transition-colors duration-200 ${active ? "font-semibold text-brand-from" : "text-gray-400"}`}>
          {item.label}
        </span>
      </Link>
    );
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 rounded-t-3xl bg-white/90 shadow-[0_-8px_30px_rgba(17,24,39,0.06)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-3xl">
        {renderItem(inicio, pathname === inicio.href)}
        {renderItem(cuentas, pathname === cuentas.href)}
        <MovimientoFab variante="en-nav" />
        {renderItem(presupuesto, pathname === presupuesto.href)}
        {renderItem(masNavItem, RUTAS_MAS.includes(pathname))}
      </div>
      <div className="h-[max(env(safe-area-inset-bottom),12px)] bg-white/90" />
    </nav>
  );
}
