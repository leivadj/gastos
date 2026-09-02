"use client";

import { usePathname } from "next/navigation";

// Cross-fade suave al cambiar de pantalla (dashboard -> cuotas -> etc.),
// inspirado en el estilo de transiciones de transitions.dev, sin depender
// de una librería: al cambiar la ruta, React vuelve a montar este bloque
// (la key cambia) y la animación CSS de globals.css hace el resto.
export function TransicionPagina({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="animate-entrada-pagina">
      {children}
    </div>
  );
}
