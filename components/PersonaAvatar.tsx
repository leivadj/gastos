"use client";

import { colorFor } from "@/lib/avatarColor";

export function PersonaAvatar({
  fotoUrl,
  nombre,
  className = "h-9 w-9",
}: {
  fotoUrl?: string | null;
  nombre: string;
  className?: string;
}) {
  if (fotoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={fotoUrl} alt={nombre} className={`${className} shrink-0 rounded-full object-cover`} />
    );
  }
  return (
    <span
      className={`${className} flex shrink-0 items-center justify-center rounded-full text-lg font-semibold text-white`}
      style={{ backgroundColor: colorFor(nombre) }}
    >
      {nombre.charAt(0).toUpperCase() || "?"}
    </span>
  );
}
