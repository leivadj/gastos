"use client";

// Chip/pestaña en forma de píldora — Fase 1 del rediseño "estilo Haulo".
// Se usa para los filtros tipo "Todos / Activos / Completados" y para
// cualquier selector de una sola opción entre pocas alternativas, en vez de
// un <select> o unos botones cuadrados pegados unos a otros.
export function Pildora({
  activa,
  onClick,
  children,
}: {
  activa: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition active:scale-95 ${
        activa
          ? "bg-brand-gradient text-white shadow-sm"
          : "bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400"
      }`}
    >
      {children}
    </button>
  );
}

// Fila de píldoras con scroll horizontal — el contenedor típico en el que
// vive un grupo de <Pildora>, ya con el gap y el "no-scrollbar" (definido
// en globals.css) para que el scroll no se vea con la barra fea del navegador.
export function FilaPildoras({ children }: { children: React.ReactNode }) {
  return <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">{children}</div>;
}
