"use client";

import { Entidad, Marca } from "@/lib/types";
import { EntidadAvatar } from "@/components/EntidadAvatar";
import { resolverMarca } from "@/lib/resolverMarca";

export function EntidadPicker({
  entidades,
  marcas,
  value,
  onChange,
}: {
  entidades: Entidad[];
  marcas: Marca[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      <button
        type="button"
        onClick={() => onChange("")}
        className={`flex shrink-0 flex-col items-center gap-1 rounded-lg border p-2 ${
          value === "" ? "border-brand-from bg-purple-50" : "border-gray-200"
        }`}
        style={{ width: 64 }}
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-xs text-gray-400">
          —
        </span>
        <span className="text-center text-[10px] text-gray-500">Sin dato</span>
      </button>
      {entidades.map((e) => (
        <button
          type="button"
          key={e.id}
          onClick={() => onChange(e.id === value ? "" : e.id)}
          className={`flex shrink-0 flex-col items-center gap-1 rounded-lg border p-2 ${
            value === e.id ? "border-brand-from bg-purple-50" : "border-gray-200"
          }`}
          style={{ width: 64 }}
        >
          <EntidadAvatar entidad={e} marca={resolverMarca(e, marcas)} className="h-9 w-9" />
          <span className="truncate text-center text-[10px] text-gray-600" style={{ maxWidth: 60 }}>
            {e.nombre}
          </span>
        </button>
      ))}
      {entidades.length === 0 && (
        <p className="py-2 text-xs text-gray-400">
          Aún no tienes tarjetas o cuentas — créalas en &quot;Gestionar tus tarjetas y cuentas&quot;.
        </p>
      )}
    </div>
  );
}
