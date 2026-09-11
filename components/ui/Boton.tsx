"use client";

import { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  cargando?: boolean;
};

// Botón "pill" grande — Fase 1 del rediseño "estilo Haulo". Los botones de
// confirmación (Listo/Guardar/Agregar) de Haulo son full-width, muy
// redondeados y con texto bold — esto reemplaza a los `rounded-lg` chicos
// que tenía cada formulario suelto.
export function BotonPrimario({ children, cargando, disabled, className = "", ...props }: Props) {
  return (
    <button
      {...props}
      disabled={disabled || cargando}
      className={`w-full rounded-full bg-brand-gradient py-3.5 text-base font-extrabold text-white transition active:scale-[0.98] disabled:opacity-60 ${className}`}
    >
      {cargando ? "Guardando…" : children}
    </button>
  );
}

export function BotonSecundario({ children, className = "", ...props }: Props) {
  return (
    <button
      {...props}
      className={`w-full rounded-full bg-gray-100 py-3.5 text-base font-extrabold text-gray-600 transition active:scale-[0.98] dark:bg-white/10 dark:text-gray-300 ${className}`}
    >
      {children}
    </button>
  );
}
