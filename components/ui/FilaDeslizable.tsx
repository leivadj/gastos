"use client";

import { ReactNode, useRef, useState } from "react";

export interface AccionDeslizable {
  icono: ReactNode;
  etiqueta: string;
  onClick: () => void;
  // Color de fondo del botón de acción, ej. "bg-red-500" para eliminar.
  color: string;
}

// Fila con acciones al deslizar — Fase 1 del rediseño "estilo Haulo". En vez
// de un botón "editar" y otro "eliminar" siempre visibles (o un menú de
// "⋮" con otra hoja adentro), el usuario desliza la fila hacia la
// izquierda y aparecen los íconos de acción atrás — el mismo patrón que
// usa Haulo en su lista de "hauls" para editar/duplicar/archivar.
//
// Implementación con Pointer Events (no una librería aparte): se seguía el
// principio de "menos pasos, no más dependencias" del resto del proyecto.
export function FilaDeslizable({ children, acciones }: { children: ReactNode; acciones: AccionDeslizable[] }) {
  const ANCHO_ACCION = 68; // px por botón — suficiente para ícono + etiqueta chica
  const anchoTotal = acciones.length * ANCHO_ACCION;

  const [desplazamiento, setDesplazamiento] = useState(0); // 0 = cerrada, negativo = abierta hacia la izq.
  const arrastrando = useRef(false);
  const inicioX = useRef(0);
  const inicioDesplazamiento = useRef(0);

  function onPointerDown(e: React.PointerEvent) {
    arrastrando.current = true;
    inicioX.current = e.clientX;
    inicioDesplazamiento.current = desplazamiento;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!arrastrando.current) return;
    const delta = e.clientX - inicioX.current;
    const nuevo = Math.max(-anchoTotal, Math.min(0, inicioDesplazamiento.current + delta));
    setDesplazamiento(nuevo);
  }

  function onPointerUp() {
    if (!arrastrando.current) return;
    arrastrando.current = false;
    // Snap: si se deslizó más de la mitad, queda completamente abierta;
    // si no, vuelve a cerrarse sola.
    setDesplazamiento(desplazamiento < -anchoTotal / 2 ? -anchoTotal : 0);
  }

  function cerrar() {
    setDesplazamiento(0);
  }

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <div className="absolute inset-y-0 right-0 flex" style={{ width: anchoTotal }}>
        {acciones.map((a, i) => (
          <button
            key={i}
            onClick={() => {
              cerrar();
              a.onClick();
            }}
            className={`flex h-full flex-col items-center justify-center gap-1 text-[10px] font-semibold text-white ${a.color}`}
            style={{ width: ANCHO_ACCION }}
          >
            {a.icono}
            {a.etiqueta}
          </button>
        ))}
      </div>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="relative touch-pan-y bg-inherit transition-transform duration-200 ease-out"
        style={{ transform: `translateX(${desplazamiento}px)` }}
      >
        {children}
      </div>
    </div>
  );
}
