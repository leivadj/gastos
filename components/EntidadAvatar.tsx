"use client";

import { Entidad, Marca } from "@/lib/types";
import { colorFor } from "@/lib/avatarColor";

export function EntidadAvatar({
  entidad,
  marca,
  icono,
  nombreFallback,
  className = "h-9 w-9",
}: {
  entidad?: Entidad | null;
  marca?: Marca | null;
  icono?: string | null;
  nombreFallback?: string;
  className?: string;
}) {
  const nombre = nombreFallback ?? entidad?.nombre ?? "?";

  // Ícono propio del item/grupo/categoría, si tiene uno — tiene prioridad
  // sobre el logo/ícono de la marca asociada.
  if (icono) {
    return (
      <span
        className={`${className} flex shrink-0 items-center justify-center rounded-lg text-lg leading-none text-white`}
        style={{ backgroundColor: colorFor(nombre) }}
      >
        {icono}
      </span>
    );
  }

  if (marca?.logo_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={marca.logo_url}
        alt={nombre}
        className={`${className} shrink-0 rounded-lg object-contain`}
      />
    );
  }

  if (marca?.icono) {
    return (
      <span
        className={`${className} flex shrink-0 items-center justify-center rounded-lg text-lg leading-none text-white`}
        style={{ backgroundColor: colorFor(nombre) }}
      >
        {marca.icono}
      </span>
    );
  }

  return (
    <span
      className={`${className} flex shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white`}
      style={{ backgroundColor: colorFor(nombre) }}
    >
      {nombre.charAt(0).toUpperCase()}
    </span>
  );
}
