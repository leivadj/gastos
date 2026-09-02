"use client";

import { ReactNode, useRef } from "react";

// Efecto "avatar-group-hover" (transitions.dev): envuelve una fila de
// avatares superpuestos (ej. las iniciales de cada persona en el hero del
// dashboard) y, al pasar el mouse por uno, lo levanta/agranda un poco y
// levanta a los vecinos una fracción menos según su distancia (caída
// geométrica), en vez de solo resaltar el que está bajo el cursor. Las
// clases .avatar-group-item viven en globals.css (con su guard de
// prefers-reduced-motion). Es puramente decorativo en touch (no hay hover
// real), así que en celular simplemente no pasa nada — no estorba.
const LEVANTE_PX = -4;
const CAIDA = 0.45;
const ESCALA_ACTIVA = 1.05;
const CURVA_ENTRADA = "cubic-bezier(0.22, 1, 0.36, 1)";
const CURVA_SALIDA = "cubic-bezier(0.34, 3.85, 0.64, 1)";

export function AvatarGroupHover({
  children,
  className = "",
}: {
  children: ReactNode[];
  className?: string;
}) {
  const contenedorRef = useRef<HTMLDivElement>(null);

  function alEntrar(indiceActivo: number) {
    const items = Array.from(contenedorRef.current?.children ?? []) as HTMLElement[];
    items.forEach((item, i) => {
      const distancia = Math.abs(i - indiceActivo);
      item.style.transitionTimingFunction = CURVA_ENTRADA;
      item.style.setProperty("--shift", `${LEVANTE_PX * Math.pow(CAIDA, distancia)}px`);
      item.style.setProperty("--scale-active", i === indiceActivo ? String(ESCALA_ACTIVA) : "1");
    });
  }

  function alSalir() {
    const items = Array.from(contenedorRef.current?.children ?? []) as HTMLElement[];
    items.forEach((item) => {
      item.style.transitionTimingFunction = CURVA_SALIDA;
      item.style.setProperty("--shift", "0px");
      item.style.setProperty("--scale-active", "1");
    });
  }

  return (
    <div ref={contenedorRef} className={className} onMouseLeave={alSalir}>
      {children.map((child, i) => (
        <div key={i} className="avatar-group-item" onMouseEnter={() => alEntrar(i)}>
          {child}
        </div>
      ))}
    </div>
  );
}
