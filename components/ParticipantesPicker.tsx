"use client";

import { Participante, Persona } from "@/lib/types";
import { formatCLP } from "@/lib/format";

// Elegir qué personas participan de un reparto (de un grupo o de un item
// suelto) y, opcionalmente, fijarle un % a cada una. Las que se dejan sin %
// (en blanco) se reparten en partes iguales lo que queda del 100% — misma
// regla que calculan las vistas SQL (vista_grupo_reparto / vista_item_reparto).
export function ParticipantesPicker({
  personas,
  value,
  onChange,
  montoTotal,
}: {
  personas: Persona[];
  value: Participante[];
  onChange: (v: Participante[]) => void;
  montoTotal?: number;
}) {
  const activas = personas.filter((p) => p.activo);

  function estaSeleccionada(id: string) {
    return value.some((v) => v.persona_id === id);
  }

  function toggle(id: string) {
    if (estaSeleccionada(id)) {
      onChange(value.filter((v) => v.persona_id !== id));
    } else {
      onChange([...value, { persona_id: id, porcentaje: null }]);
    }
  }

  function setPorcentaje(id: string, raw: string) {
    const n = raw === "" ? null : Number(raw);
    onChange(value.map((v) => (v.persona_id === id ? { ...v, porcentaje: n } : v)));
  }

  const sumaFija = value.filter((v) => v.porcentaje != null).reduce((acc, v) => acc + Number(v.porcentaje), 0);
  const sinFijar = value.filter((v) => v.porcentaje == null).length;

  function porcentajeEfectivo(v: Participante) {
    if (v.porcentaje != null) return v.porcentaje;
    if (sinFijar === 0) return 0;
    return Math.max(0, 100 - sumaFija) / sinFijar;
  }

  return (
    <div className="space-y-2">
      {activas.map((p) => {
        const seleccionada = estaSeleccionada(p.id);
        const participante = value.find((v) => v.persona_id === p.id);
        return (
          <div
            key={p.id}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
              seleccionada ? "border-brand-from bg-purple-50" : "border-gray-200"
            }`}
          >
            <button type="button" onClick={() => toggle(p.id)} className="flex flex-1 items-center gap-2 text-left">
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[10px] ${
                  seleccionada ? "border-brand-from bg-brand-gradient text-white" : "border-gray-300"
                }`}
              >
                {seleccionada && "✓"}
              </span>
              <span className="text-sm text-gray-700">{p.nombre}</span>
            </button>
            {seleccionada && participante && (
              <div className="flex shrink-0 items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={participante.porcentaje ?? ""}
                  onChange={(e) => setPorcentaje(p.id, e.target.value)}
                  placeholder={`≈${Math.round(porcentajeEfectivo(participante))}`}
                  className="w-16 rounded-lg border border-gray-200 px-2 py-1 text-right text-xs"
                />
                <span className="text-xs text-gray-400">%</span>
              </div>
            )}
          </div>
        );
      })}
      {activas.length === 0 && (
        <p className="text-xs text-gray-400">Primero agrega personas en la sección &quot;Personas&quot;.</p>
      )}
      {value.length > 0 && (
        <p className="text-[11px] text-gray-400">
          {value
            .map((v) => {
              const nombre = activas.find((p) => p.id === v.persona_id)?.nombre ?? "?";
              const pct = porcentajeEfectivo(v);
              const monto = montoTotal != null ? ` · ${formatCLP(Math.round((montoTotal * pct) / 100))}` : "";
              return `${nombre}: ${Math.round(pct)}%${monto}`;
            })
            .join("  ·  ")}
        </p>
      )}
    </div>
  );
}
