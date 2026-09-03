"use client";

import { ReactNode, useState } from "react";

type RenderProps = { onClick: () => void; abierto: boolean };

// Envoltorio genérico para "desplegar la información de cada item" en listas
// (gastos fijos, cuotas…) con el efecto "page-side-by-side" de transitions.dev:
// resumen y detalle se cruzan con un leve translateX (±8px) + blur, no un
// acordeón que empuja de golpe el resto de la lista. Solo la página ACTIVA
// queda en el flujo normal (así el alto de la tarjeta es el de lo que se ve,
// nunca el del detalle aunque esté oculto); la que no está activa se saca del
// flujo con `absolute inset-0` para que no infle el alto de la caja mientras
// se cruzan — el alto pega un salto chico al tocar en vez de animarse, pero
// eso es preferible a dejar un hueco en blanco del tamaño del detalle.
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
    <div className="relative">
      <div className={`pagina-desliza ${abierto ? "pagina-oculta-izq absolute inset-0" : "pagina-activa"}`}>
        {resumen({ onClick: alternar, abierto })}
      </div>
      <div className={`pagina-desliza ${abierto ? "pagina-activa" : "pagina-oculta-der absolute inset-0"}`}>
        {detalle({ onClick: alternar, abierto })}
      </div>
    </div>
  );
}
