"use client";

import { Entidad, Marca } from "@/lib/types";
import { colorFor } from "@/lib/avatarColor";

export function EntidadAvatar({
  entidad,
  marca,
  className = "h-9 w-9",
}: {
  entidad: Entidad | null | undefined;
  marca: Marca | null | undefined;
  className?: string;
}) {
  const nombre = entidad?.nombre ?? "?";

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

  return (
    <span
      className={`${className} flex shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white`}
      style={{ backgroundColor: colorFor(nombre) }}
    >
      {nombre.charAt(0).toUpperCase()}
    </span>
  );
}
