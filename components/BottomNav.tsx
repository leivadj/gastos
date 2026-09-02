"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { adminNavItem, esAdmin as checkEsAdmin, navItems } from "@/components/navItems";
import { MovimientoFab } from "@/components/MovimientoRapido";

export function BottomNav() {
  const pathname = usePathname();
  const [esAdmin, setEsAdmin] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setEsAdmin(checkEsAdmin(data.session?.user?.email));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setEsAdmin(checkEsAdmin(s?.user?.email));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const visibles = esAdmin ? [...navItems, adminNavItem] : navItems;
  // El botón "+" va en el medio de la barra (como en el mockup), no flotando
  // encima del contenido tapando lo que hay debajo. Se reparten los demás
  // items en dos mitades a cada lado.
  const mitad = Math.ceil(visibles.length / 2);
  const izquierda = visibles.slice(0, mitad);
  const derecha = visibles.slice(mitad);

  function renderItem(item: (typeof visibles)[number]) {
    const active = pathname === item.href;
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] transition ${
          active ? "text-brand-from" : "text-gray-400"
        }`}
      >
        <span className={active ? "text-brand-from" : ""}>{item.icon(active)}</span>
        <span className={active ? "font-semibold" : ""}>{item.label}</span>
      </Link>
    );
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl">
        {izquierda.map(renderItem)}
        <MovimientoFab variante="en-nav" />
        {derecha.map(renderItem)}
      </div>
      <div className="h-[max(env(safe-area-inset-bottom),12px)] bg-white/95" />
    </nav>
  );
}
