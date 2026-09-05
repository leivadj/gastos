import { ReactNode } from "react";

// El fondo oscuro por defecto vive acá recién ahora que TODAS las pantallas
// de la app ya migraron sus textos/bordes a dark: (ver el historial de esta
// fase) — antes se evitaba a propósito, porque las pantallas sin migrar
// habrían quedado con texto gris oscuro sobre una tarjeta oscura,
// ilegible. Si en el futuro se agrega una pantalla nueva, sus <Card> ya
// salen oscuras solas: solo hace falta agregarle las clases dark: al
// contenido de adentro.
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-900 dark:shadow-none ${className}`}>{children}</div>
  );
}

export function GradientCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-brand-gradient p-5 text-white shadow-md ${className}`}>
      {children}
    </div>
  );
}
