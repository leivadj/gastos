"use client";

import { PreferenciaTema, useTheme } from "@/lib/theme";

function IconoSol({ className = "" }: { className?: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6" />
    </svg>
  );
}

function IconoLuna({ className = "" }: { className?: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.6 6.6 0 0 0 10.5 10.5Z" />
    </svg>
  );
}

function IconoAuto({ className = "" }: { className?: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="4.5" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16.5V20" />
    </svg>
  );
}

const OPCIONES: { value: PreferenciaTema; label: string; icono: (c?: string) => JSX.Element }[] = [
  { value: "light", label: "Claro", icono: (c) => <IconoSol className={c} /> },
  { value: "dark", label: "Oscuro", icono: (c) => <IconoLuna className={c} /> },
  { value: "system", label: "Automático", icono: (c) => <IconoAuto className={c} /> },
];

// Selector claro/oscuro/automático de 3 posiciones, en forma de "pill" — se
// usa tanto en el pie del Sidebar de escritorio (DesktopSidebar.tsx) como en
// el cuadro de perfil del celular (PerfilPropioCard.tsx, dentro de /mas).
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { preferencia, setPreferencia } = useTheme();

  return (
    <div className={`inline-flex items-center gap-0.5 rounded-full bg-gray-100 p-1 dark:bg-white/10 ${className}`}>
      {OPCIONES.map((o) => {
        const activo = preferencia === o.value;
        return (
          <button
            key={o.value}
            type="button"
            title={o.label}
            aria-label={o.label}
            onClick={() => setPreferencia(o.value)}
            className={`flex h-7 w-7 items-center justify-center rounded-full transition ${
              activo
                ? "bg-white text-brand-from shadow-sm dark:bg-gray-700 dark:text-white"
                : "text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            }`}
          >
            {o.icono()}
          </button>
        );
      })}
    </div>
  );
}
