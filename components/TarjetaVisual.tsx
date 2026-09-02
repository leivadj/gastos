"use client";

import { Entidad, Marca } from "@/lib/types";
import { colorFor } from "@/lib/avatarColor";
import { gradienteTarjeta } from "@/lib/cardColor";
import { formatCLP } from "@/lib/format";

export const TIPO_LABEL: Record<Entidad["tipo"], string> = {
  efectivo: "Efectivo",
  tarjeta_credito: "Tarjeta de crédito",
  tarjeta_debito: "Tarjeta de débito",
  linea_credito: "Línea de crédito",
  credito_hipotecario: "Crédito hipotecario",
  transferencia: "Transferencia",
};

// Versión corta de TIPO_LABEL para espacios chicos (ej. debajo del nombre en
// EntidadPicker) — para poder distinguir "Banco Estado" débito de "Banco
// Estado" crédito sin espacio para el label largo.
export const TIPO_CORTO: Record<Entidad["tipo"], string> = {
  efectivo: "Efectivo",
  tarjeta_credito: "Crédito",
  tarjeta_debito: "Débito",
  linea_credito: "Línea créd.",
  credito_hipotecario: "Hipotecario",
  transferencia: "Transferencia",
};

// La "cara" visual de una tarjeta/cuenta, estilo wallet: si el usuario subió
// una imagen del diseño real (ej. una captura de su tarjeta), se usa como
// fondo; si no, se genera un degradado a partir de su color (elegido o
// determinístico por nombre) para que igual se vea como una tarjeta de
// verdad y no una casilla gris.
export function TarjetaVisual({
  entidad,
  marca,
  gastoMes,
  className = "",
}: {
  entidad: Entidad;
  marca: Marca | null;
  gastoMes: number;
  className?: string;
}) {
  const colorBase = entidad.color_hex || colorFor(entidad.nombre);
  const estiloFondo = entidad.imagen_fondo_url
    ? {
        backgroundImage: `url(${entidad.imagen_fondo_url})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : { backgroundImage: gradienteTarjeta(colorBase) };

  return (
    <div
      className={`relative flex aspect-[8/5] w-full shrink-0 flex-col justify-between overflow-hidden rounded-2xl p-5 text-white shadow-lg ${className}`}
      style={estiloFondo}
    >
      {entidad.imagen_fondo_url && <div className="absolute inset-0 bg-black/30" />}

      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-base font-bold leading-tight drop-shadow-sm">{entidad.nombre}</p>
          <p className="text-[11px] opacity-85">{TIPO_LABEL[entidad.tipo]}</p>
          {entidad.saldo != null && (
            <p className="mt-1 text-xl font-bold tracking-tight drop-shadow-sm">{formatCLP(entidad.saldo)}</p>
          )}
        </div>
        {marca?.logo_url && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/90 p-1.5 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={marca.logo_url} alt="" className="h-full w-full object-contain" />
          </span>
        )}
      </div>

      <div className="relative">
        <p className="text-[11px] opacity-85">Gastado este mes</p>
        <p className="text-2xl font-bold tracking-tight drop-shadow-sm">{formatCLP(gastoMes)}</p>
      </div>
    </div>
  );
}
