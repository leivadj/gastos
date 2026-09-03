"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const links = [
  { href: "/", label: "Inicio" },
  { href: "/gastos", label: "Gastos" },
  { href: "/ingresos", label: "Ingresos" },
  { href: "/personas", label: "Personas" },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-gray-100">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <span className="bg-brand-gradient bg-clip-text text-lg font-bold text-transparent">
          Gastos del Hogar
        </span>
        <button
          onClick={() => supabase.auth.signOut()}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          Cerrar sesión
        </button>
      </div>
      <nav className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-4 pb-2 text-sm">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 transition ${
              pathname === l.href
                ? "bg-brand-gradient text-white"
                : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
