"use client";

import { useRef } from "react";
import { Entidad, Marca } from "@/lib/types";
import { TarjetaVisual } from "@/components/TarjetaVisual";

// Carrusel horizontal tipo wallet: se desliza con el dedo/mouse (scroll-snap
// nativo, sin librerías), y a medida que se desliza avisa cuál tarjeta quedó
// centrada (onCambiarActiva) para que la pantalla pueda mostrar su detalle
// de gastos debajo. Los puntitos abajo indican cuál está activa.
export function TarjetasCarousel({
  entidades,
  marcas,
  gastoPorEntidad,
  activaId,
  onCambiarActiva,
}: {
  entidades: Entidad[];
  marcas: Marca[];
  gastoPorEntidad: Record<string, number>;
  activaId: string | null;
  onCambiarActiva: (id: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const centro = el.scrollLeft + el.clientWidth / 2;
    let mejorId: string | null = null;
    let mejorDist = Infinity;
    Array.from(el.children).forEach((hijo, i) => {
      const item = hijo as HTMLElement;
      const centroItem = item.offsetLeft + item.clientWidth / 2;
      const dist = Math.abs(centro - centroItem);
      if (dist < mejorDist) {
        mejorDist = dist;
        mejorId = entidades[i]?.id ?? null;
      }
    });
    if (mejorId && mejorId !== activaId) onCambiarActiva(mejorId);
  }

  function irA(id: string, i: number) {
    const el = scrollRef.current;
    const item = el?.children[i] as HTMLElement | undefined;
    item?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    onCambiarActiva(id);
  }

  const marcaDe = (id: string | null) => marcas.find((m) => m.id === id) ?? null;

  return (
    <div>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-1"
      >
        {entidades.map((e, i) => (
          <button
            type="button"
            key={e.id}
            onClick={() => irA(e.id, i)}
            className="w-[78%] shrink-0 snap-center text-left sm:w-[320px]"
          >
            <TarjetaVisual entidad={e} marca={marcaDe(e.marca_id)} gastoMes={gastoPorEntidad[e.id] ?? 0} />
          </button>
        ))}
      </div>

      {entidades.length > 1 && (
        <div className="mt-3 flex justify-center gap-1.5">
          {entidades.map((e, i) => (
            <button
              type="button"
              key={e.id}
              aria-label={e.nombre}
              onClick={() => irA(e.id, i)}
              className={`h-1.5 rounded-full transition-all ${
                e.id === activaId ? "w-5 bg-brand-from" : "w-1.5 bg-gray-300"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
