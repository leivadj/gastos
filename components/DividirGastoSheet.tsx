"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { colorFor } from "@/lib/avatarColor";
import { formatCLP } from "@/lib/format";
import { mensajeError } from "@/lib/supabaseError";
import { Grupo, ItemParticipante, OrigenItem, Participante, Persona } from "@/lib/types";
import { ParticipantesPicker } from "@/components/ParticipantesPicker";

export type ItemADividir = {
  origen: OrigenItem;
  origenId: string;
  descripcion: string;
  categoriaNombre: string;
  fechaLabel: string;
  monto: number;
  grupoId: string | null;
};

// Hoja "Dividir gasto" (mockup PDF pág. 13) — pantalla dedicada para
// repartir un gasto entre personas, calcada del mockup: toggle "Dividir con
// [grupo]", tabs "Partes iguales"/"Personalizado %" y (con exactamente 2
// personas activas, el caso real de esta cuenta) un slider único en vez de
// un % por fila. Antes esto solo se podía hacer dentro del formulario
// completo de editar el ítem (en /entidad/[id], CuotasLista, GastosFijosLista)
// — se abre ahora desde cualquier movimiento de tipo cuota/gasto fijo en
// /movimientos. Solo esos dos tipos aceptan reparto en el esquema real
// (item_participantes.origen solo permite 'compra'/'gasto_fijo' — los gastos
// diarios e ingresos no tienen esta opción, por eso no abren esta hoja).
export function DividirGastoSheet({
  item,
  grupos,
  personas,
  participantesActuales,
  onClose,
  onGuardado,
}: {
  item: ItemADividir;
  grupos: Grupo[];
  personas: Persona[];
  participantesActuales: ItemParticipante[];
  onClose: () => void;
  onGuardado: () => void;
}) {
  const activas = personas.filter((p) => p.activo);
  const dosPersonas = activas.length === 2;

  const [dividirConGrupo, setDividirConGrupo] = useState(
    item.grupoId != null || (participantesActuales.length === 0 && grupos.length > 0)
  );
  const [grupoId, setGrupoId] = useState(item.grupoId ?? grupos[0]?.id ?? "");
  const [modo, setModo] = useState<"iguales" | "personalizado">(
    participantesActuales.some((p) => p.porcentaje != null) ? "personalizado" : "iguales"
  );
  const [participantes, setParticipantes] = useState<Participante[]>(() =>
    participantesActuales.length > 0
      ? participantesActuales.map((p) => ({ persona_id: p.persona_id, porcentaje: p.porcentaje }))
      : activas.map((p) => ({ persona_id: p.id, porcentaje: null }))
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const grupoActivo = grupos.find((g) => g.id === grupoId) ?? null;

  function porcentajeDe(id: string): number {
    const p = participantes.find((x) => x.persona_id === id);
    if (!p) return 0;
    if (p.porcentaje != null) return p.porcentaje;
    const sinFijar = participantes.filter((x) => x.porcentaje == null);
    const sumaFija = participantes.filter((x) => x.porcentaje != null).reduce((acc, x) => acc + Number(x.porcentaje), 0);
    return sinFijar.length > 0 ? Math.max(0, 100 - sumaFija) / sinFijar.length : 0;
  }

  function moverSlider(pctPrimera: number) {
    if (!dosPersonas) return;
    const [a, b] = activas;
    setParticipantes([
      { persona_id: a.id, porcentaje: pctPrimera },
      { persona_id: b.id, porcentaje: 100 - pctPrimera },
    ]);
  }

  function elegirModo(nuevo: "iguales" | "personalizado") {
    setModo(nuevo);
    if (nuevo === "iguales") {
      setParticipantes(activas.map((p) => ({ persona_id: p.id, porcentaje: null })));
    } else if (dosPersonas) {
      setParticipantes([
        { persona_id: activas[0].id, porcentaje: 50 },
        { persona_id: activas[1].id, porcentaje: 50 },
      ]);
    }
  }

  const totalAsignado = Math.round(participantes.reduce((acc, p) => acc + porcentajeDe(p.persona_id), 0));

  async function guardar() {
    setGuardando(true);
    setError("");
    try {
      const tabla = item.origen === "compra" ? "compras" : "gastos_fijos";
      if (dividirConGrupo) {
        if (!grupoId) throw new Error("Elige un grupo.");
        const { error: updError } = await supabase.from(tabla).update({ grupo_id: grupoId }).eq("id", item.origenId);
        if (updError) throw updError;
        await supabase.from("item_participantes").delete().eq("origen", item.origen).eq("origen_id", item.origenId);
      } else {
        if (participantes.length === 0) throw new Error("Elige al menos una persona.");
        const { error: updError } = await supabase.from(tabla).update({ grupo_id: null }).eq("id", item.origenId);
        if (updError) throw updError;
        await supabase.from("item_participantes").delete().eq("origen", item.origen).eq("origen_id", item.origenId);
        const { error: insError } = await supabase
          .from("item_participantes")
          .insert(participantes.map((p) => ({ origen: item.origen, origen_id: item.origenId, persona_id: p.persona_id, porcentaje: p.porcentaje })));
        if (insError) throw insError;
      }
      onGuardado();
      onClose();
    } catch (err) {
      setError(mensajeError(err) || "No se pudo guardar la división.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-[#111113] p-5 text-white sm:max-w-md sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Dividir gasto</h2>
          <button onClick={onClose} aria-label="Cerrar" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
            ✕
          </button>
        </div>

        <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-white/5 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{item.descripcion}</p>
            <p className="text-xs text-white/50">
              {item.categoriaNombre} · {item.fechaLabel}
            </p>
          </div>
          <p className="shrink-0 text-base font-bold text-gasto">-{formatCLP(item.monto)}</p>
        </div>

        {grupos.length > 0 && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-white/5 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Dividir con {grupoActivo?.nombre ?? "un grupo"}</p>
              {grupos.length > 1 && dividirConGrupo && (
                <select
                  value={grupoId}
                  onChange={(e) => setGrupoId(e.target.value)}
                  className="mt-1 rounded-lg border border-white/20 bg-transparent px-2 py-1 text-xs"
                >
                  {grupos.map((g) => (
                    <option key={g.id} value={g.id} className="text-black">
                      {g.nombre}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={dividirConGrupo}
              onClick={() => setDividirConGrupo((v) => !v)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${dividirConGrupo ? "bg-white" : "bg-white/20"}`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full transition-transform ${
                  dividirConGrupo ? "translate-x-5 bg-black" : "translate-x-0.5 bg-white/70"
                }`}
              />
            </button>
          </div>
        )}

        {!dividirConGrupo && (
          <>
            <div className="mb-4 flex gap-1 rounded-2xl bg-white/5 p-1 text-sm">
              {(
                [
                  { v: "iguales", label: "Partes iguales" },
                  { v: "personalizado", label: "Personalizado %" },
                ] as { v: "iguales" | "personalizado"; label: string }[]
              ).map((m) => (
                <button
                  key={m.v}
                  type="button"
                  onClick={() => elegirModo(m.v)}
                  className={`flex-1 rounded-xl py-2 font-semibold transition-colors ${
                    modo === m.v ? "bg-white text-black" : "text-white/50"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {modo === "personalizado" && dosPersonas && (
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(porcentajeDe(activas[0].id))}
                onChange={(e) => moverSlider(Number(e.target.value))}
                className="mb-3 w-full accent-white"
              />
            )}

            {modo === "personalizado" && !dosPersonas ? (
              <div className="mb-3 rounded-2xl bg-white/5 p-3 [&_span]:!text-white [&_input]:!border-white/20 [&_input]:!bg-white/10 [&_input]:!text-white">
                <ParticipantesPicker personas={personas} value={participantes} onChange={setParticipantes} montoTotal={item.monto} />
              </div>
            ) : (
              <div className="mb-3 space-y-2">
                {activas.map((p) => {
                  const pct = Math.round(porcentajeDe(p.id));
                  const monto = Math.round((item.monto * pct) / 100);
                  return (
                    <div key={p.id} className="flex items-center gap-3 rounded-2xl bg-white/5 px-3 py-2.5">
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                        style={{ backgroundColor: colorFor(p.nombre) }}
                      >
                        {p.nombre.slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{p.nombre}</p>
                        <p className="text-xs text-white/50">{formatCLP(monto)}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            )}

            <p className={`mb-4 text-xs font-medium ${totalAsignado === 100 ? "text-ingreso" : "text-amber-400"}`}>
              {totalAsignado === 100 ? "✓ 100% asignado" : `${totalAsignado}% asignado — falta completar el 100%`}
            </p>
          </>
        )}

        {error && <p className="mb-3 text-xs text-red-400">{error}</p>}

        <button
          onClick={guardar}
          disabled={guardando || (!dividirConGrupo && (participantes.length === 0 || totalAsignado !== 100))}
          className="w-full rounded-full bg-white py-3 text-sm font-bold text-black disabled:opacity-40"
        >
          {guardando ? "Guardando…" : "Guardar división"}
        </button>
      </div>
    </div>
  );
}
