"use client";

import { ReactNode, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { mensajeError } from "@/lib/supabaseError";
import { PreferenciasMenu } from "@/lib/types";

type ItemBase = { key: string; label: string; icon: (active: boolean) => ReactNode };
type ItemEditable = { key: string; label: string; icon: (active: boolean) => ReactNode; oculto: boolean };

function mover<T>(lista: T[], desde: number, hasta: number): T[] {
  const copia = [...lista];
  const [item] = copia.splice(desde, 1);
  copia.splice(hasta, 0, item);
  return copia;
}

// Arma la lista de edición completa (visibles + ocultos, todos editables)
// aplicando el `orden` guardado y agregando al final cualquier ítem nuevo
// que el código haya sumado después de la última vez que se guardó — mismo
// criterio que aplicarPreferencias() de DesktopSidebar.tsx, pero sin filtrar
// los ocultos (acá se muestran apagados, no se sacan de la lista).
function listaInicial(items: ItemBase[], prefs: PreferenciasMenu | null): ItemEditable[] {
  const porKey = new Map(items.map((i) => [i.key, i]));
  const desdeOrden = (prefs?.orden ?? []).filter((k) => porKey.has(k));
  const yaIncluidos = new Set(desdeOrden);
  const nuevos = items.filter((i) => !yaIncluidos.has(i.key)).map((i) => i.key);
  const ocultosSet = new Set(prefs?.ocultos ?? []);
  return [...desdeOrden, ...nuevos].map((k) => {
    const item = porKey.get(k)!;
    return { key: item.key, label: item.label, icon: item.icon, oculto: ocultosSet.has(k) };
  });
}

// Panel para reordenar (arrastrando) y ocultar ítems del menú lateral de
// escritorio — ver DesktopSidebar.tsx y migration_24_preferencias_menu.sql.
// "Más" no pasa por acá: no es personalizable, queda siempre al final.
export function PersonalizarMenu({
  items,
  prefs,
  onClose,
  onGuardado,
}: {
  items: ItemBase[];
  prefs: PreferenciasMenu | null;
  onClose: () => void;
  onGuardado: (nuevo: PreferenciasMenu) => void;
}) {
  const [lista, setLista] = useState<ItemEditable[]>(() => listaInicial(items, prefs));
  const [arrastrando, setArrastrando] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  // Mismo efecto "panel-reveal" que PersonaBreakdown.tsx (entra deslizándose
  // desde abajo, sale con su propia duración salvo que el usuario prefiera
  // menos movimiento).
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setAbierto(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function cerrar() {
    setAbierto(false);
    const prefiereMenosMovimiento =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setTimeout(onClose, prefiereMenosMovimiento ? 0 : 350);
  }

  function toggleOculto(key: string) {
    setLista((actual) => actual.map((i) => (i.key === key ? { ...i, oculto: !i.oculto } : i)));
  }

  function restablecer() {
    setLista(items.map((i) => ({ key: i.key, label: i.label, icon: i.icon, oculto: false })));
  }

  const todosOcultos = lista.every((i) => i.oculto);

  async function guardar() {
    setError("");
    setGuardando(true);
    const orden = lista.map((i) => i.key);
    const ocultos = lista.filter((i) => i.oculto).map((i) => i.key);
    const { error: upError } = await supabase
      .from("preferencias_menu")
      .upsert({ orden, ocultos, updated_at: new Date().toISOString() }, { onConflict: "owner_id" });
    setGuardando(false);
    if (upError) {
      setError(mensajeError(upError) || "No se pudo guardar la personalización.");
      return;
    }
    onGuardado({ orden, ocultos });
  }

  return (
    <div
      data-open={abierto}
      className="panel-reveal-backdrop fixed inset-0 z-30 flex items-end justify-center bg-black/40 px-0 sm:items-center sm:px-4"
      onClick={cerrar}
    >
      <div
        data-open={abierto}
        className="panel-reveal max-h-[85vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl dark:bg-gray-900 dark:shadow-none sm:max-w-md sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-lg font-bold text-gray-800 dark:text-white">Personalizar menú</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">Arrastrá para reordenar, o apagá los que no usás.</p>
          </div>
          <button onClick={cerrar} className="rounded-full p-1 text-gray-400 hover:bg-gray-100 dark:text-gray-500 dark:hover:bg-white/10">
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-1.5">
          {lista.map((item, idx) => (
            <div
              key={item.key}
              draggable
              onDragStart={() => setArrastrando(idx)}
              onDragOver={(e) => {
                e.preventDefault();
                if (arrastrando === null || arrastrando === idx) return;
                setLista((actual) => mover(actual, arrastrando, idx));
                setArrastrando(idx);
              }}
              onDragEnd={() => setArrastrando(null)}
              className={`flex cursor-grab items-center gap-2.5 rounded-xl border border-gray-100 bg-white px-3 py-2.5 transition active:cursor-grabbing dark:border-white/10 dark:bg-gray-900 ${
                item.oculto ? "opacity-40" : ""
              } ${arrastrando === idx ? "ring-2 ring-brand-from/40" : ""}`}
            >
              <span className="shrink-0 text-gray-300 dark:text-gray-600">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="8" cy="6" r="1.6" />
                  <circle cx="16" cy="6" r="1.6" />
                  <circle cx="8" cy="12" r="1.6" />
                  <circle cx="16" cy="12" r="1.6" />
                  <circle cx="8" cy="18" r="1.6" />
                  <circle cx="16" cy="18" r="1.6" />
                </svg>
              </span>
              <span className="shrink-0 text-gray-400 dark:text-gray-500">{item.icon(false)}</span>
              <span className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-200">{item.label}</span>
              <button
                type="button"
                onClick={() => toggleOculto(item.key)}
                aria-label={item.oculto ? `Mostrar ${item.label}` : `Ocultar ${item.label}`}
                className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                  item.oculto ? "bg-gray-200 dark:bg-white/10" : "bg-brand-gradient"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${item.oculto ? "left-0.5" : "left-4"}`}
                />
              </button>
            </div>
          ))}
        </div>

        {todosOcultos && <p className="mt-2 text-xs text-red-500 dark:text-red-400">Dejá al menos un ítem visible.</p>}
        {error && <p className="mt-2 text-xs text-red-500 dark:text-red-400">{error}</p>}

        <div className="mt-5 flex items-center gap-2">
          <button onClick={restablecer} className="text-xs font-medium text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">
            Restablecer
          </button>
          <div className="flex-1" />
          <button onClick={cerrar} className="rounded-lg px-3 py-2 text-sm font-medium text-gray-500 dark:text-gray-400">
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={guardando || todosOcultos}
            className="rounded-lg bg-brand-gradient px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
