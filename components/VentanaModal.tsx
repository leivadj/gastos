"use client";

import { createPortal } from "react-dom";
import { ReactNode } from "react";

// Ronda 8 del rediseño: Felipe (como pedido de UX de escritorio) notó que
// varios modales de la web ("Ver detalles" de /tarjetas, el detalle de un
// día en Inicio, etc.) se abren con el mismo ancho angosto que usan en el
// celular (sm:max-w-md) y no aprovechan el espacio de una pantalla de
// computador — mismo motivo por el que "editar desde el mismo listado en
// una ventana popup" (pedido nuevo de Gastos) debía nacer ya ancho en vez
// de calcar ese patrón angosto.
//
// Esta es la versión "ancha" de la hoja/modal que ya usan /tarjetas,
// /movimientos e Inicio (mismo createPortal a document.body, mismo fondo
// oscuro con blur, mismo comportamiento de hoja-desde-abajo en celular) —
// la diferencia es sólo el ancho en escritorio: en vez de quedar fijo en
// max-w-md, el llamador elige "md" | "lg" | "xl" | "2xl" según cuánto
// contenido tenga (ej. un formulario de edición angosto sigue siendo "md";
// un listado con filtros + detalle en 2 columnas pide "xl" o "2xl").
//
// No reemplaza los modales existentes automáticamente — cada pantalla se
// migra a mano cuando tiene sentido (ver /tarjetas), para no arriesgar
// romper una hoja que ya funciona bien angosta (ej. confirmaciones cortas).
const ANCHOS: Record<"md" | "lg" | "xl" | "2xl", string> = {
  md: "sm:max-w-md",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
  "2xl": "sm:max-w-6xl",
};

export function VentanaModal({
  titulo,
  subtitulo,
  onClose,
  ancho = "lg",
  children,
  footer,
}: {
  titulo: ReactNode;
  subtitulo?: ReactNode;
  onClose: () => void;
  ancho?: "md" | "lg" | "xl" | "2xl";
  children: ReactNode;
  footer?: ReactNode;
}) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 px-0 backdrop-blur-sm sm:items-center sm:px-4"
      onClick={onClose}
    >
      <div
        className={`max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white text-gray-800 shadow-2xl dark:bg-[#111113] dark:text-white sm:rounded-3xl ${ANCHOS[ancho]}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-2 rounded-t-3xl bg-white p-5 pb-3 dark:bg-[#111113]">
          <div className="min-w-0">
            <p className="truncate text-base font-bold">{titulo}</p>
            {subtitulo && <p className="text-xs text-gray-400 dark:text-white/50">{subtitulo}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-white/10"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-0">{children}</div>

        {footer && (
          <div className="sticky bottom-0 flex gap-2.5 border-t border-gray-100 bg-white p-5 pt-3 dark:border-white/10 dark:bg-[#111113]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
