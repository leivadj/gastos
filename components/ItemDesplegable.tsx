"use client";

import { ReactNode, useState } from "react";

type RenderProps = { onClick: () => void; abierto: boolean };

// Envoltorio genérico para "desplegar la información de cada item" en listas
// (gastos fijos, cuotas…) con el efecto "page-side-by-side" de transitions.dev:
// resumen y detalle viven apilados en la MISMA caja (grid: así el alto se
// ajusta solo al más alto de los dos, sin saltos), y se cruzan con un leve
// translateX (±8px) + blur, no un acordeón que empuja el resto de la lista.
// Las clases .pagina-desliza / .pagina-activa / .pagina-oculta-* viven en
// globals.css (con su guard de prefers-reduced-motion).
export function ItemDesplegable({
  resumen,
  detalle,
}: {
  resumen: (props: RenderProps) => ReactNode;
  detalle: (props: RenderProps) => ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  const alternar = () => setAbierto((v) => !v);

  return (
    <div className="grid">
      <div
        className={`col-start-1 row-start-1 pagina-desliza ${
          abierto ? "pagina-oculta-izq" : "pagina-activa"
        }`}
      >
        {resumen({ onClick: alternar, abierto })}
      </div>
      <div
        className={`col-start-1 row-start-1 pagina-desliza ${
          abierto ? "pagina-activa" : "pagina-oculta-der"
        }`}
      >
        {detalle({ onClick: alternar, abierto })}
      </div>
    </div>
  );
}
