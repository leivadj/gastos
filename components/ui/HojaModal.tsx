"use client";

import { ReactNode, useEffect, useState } from "react";

// Hoja modal compartida — Fase 1 del rediseño "estilo Haulo" (ver
// conversación con Felipe del 11/09/2026). Generaliza la <HojaInferior> que
// vivía duplicada dentro de MovimientoRapido.tsx: ahora es un componente
// único que se usa en cualquier pantalla que necesite un formulario o una
// selección en una hoja que sube desde abajo, con las mismas animaciones y
// el mismo "look" en todos lados.
//
// Dos cosas que la vieja <HojaInferior> no tenía y que son justamente lo
// que hace que Haulo se sienta más pulido:
// 1. Transición de entrada/salida (antes aparecía y desaparecía de golpe).
// 2. Una "manija" (barra gris arriba) que indica visualmente que se puede
//    deslizar — todavía no es arrastrable de verdad (eso queda para más
//    adelante si hace falta), pero ya comunica "esto es una hoja".
export function HojaModal({
  abierta,
  onClose,
  titulo,
  children,
  pie,
  onVolver,
}: {
  abierta: boolean;
  onClose: () => void;
  titulo: string;
  children: ReactNode;
  // Botón fijo abajo (ej. "Guardar gasto") que queda siempre visible aunque
  // el contenido tenga scroll — evita el problema de un formulario largo
  // donde el botón de guardar queda "escondido" más abajo del teclado.
  pie?: ReactNode;
  // Si se pasa, muestra una flecha "<" en vez de nada a la izquierda del
  // título (para flujos con un paso previo, ej. "elegí categoría" -> volver
  // al formulario). Si no se pasa, solo se ve el título y la "×".
  onVolver?: () => void;
}) {
  // Se mantiene montada un instante extra al cerrar para que la animación
  // de salida (deslizar hacia abajo) se alcance a ver — si se desmontara
  // apenas `abierta` pasa a false, la hoja desaparecería de golpe.
  const [montada, setMontada] = useState(abierta);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (abierta) {
      setMontada(true);
      // Un frame después de montar, para que el navegador aplique primero
      // el estado "cerrado" (translate-y-full) y recién ahí anime al
      // estado "abierto" — si se hace en el mismo frame, no hay transición.
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
    const id = setTimeout(() => setMontada(false), 300);
    return () => clearTimeout(id);
  }, [abierta]);

  if (!montada) return null;

  return (
    <div
      className={`fixed inset-0 z-40 flex items-end justify-center transition-colors duration-300 sm:items-center sm:px-4 ${
        visible ? "bg-black/50" : "bg-black/0"
      }`}
      onClick={onClose}
    >
      <div
        className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-5xl bg-white shadow-xl transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] dark:bg-gray-900 dark:shadow-none sm:max-w-md sm:rounded-4xl ${
          visible ? "translate-y-0" : "translate-y-full"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 justify-center pb-1 pt-2.5 sm:hidden">
          <div className="h-1.5 w-10 rounded-full bg-gray-200 dark:bg-white/15" />
        </div>
        <div className="flex shrink-0 items-center justify-between px-5 pb-3 pt-1">
          <div className="flex items-center gap-2">
            {onVolver && (
              <button
                onClick={onVolver}
                aria-label="Volver"
                className="-ml-1.5 flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/10"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
                  <path d="M15 5 8 12l7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
            <h2 className="text-lg font-extrabold text-gray-800 dark:text-white">{titulo}</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 dark:text-gray-500 dark:hover:bg-white/10"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
              <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-4">{children}</div>
        {pie && (
          <div className="shrink-0 border-t border-gray-100 px-5 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3 dark:border-white/10">
            {pie}
          </div>
        )}
      </div>
    </div>
  );
}
