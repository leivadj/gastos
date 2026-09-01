"use client";

import { useState } from "react";
import { Marca, TipoMarca } from "@/lib/types";
import { EntidadAvatar } from "@/components/EntidadAvatar";
import { IconoPicker } from "@/components/IconoPicker";
import { supabase } from "@/lib/supabaseClient";

const TIPOS_MARCA: { value: TipoMarca; label: string }[] = [
  { value: "servicio_basico", label: "Servicio básico (luz, agua, gas...)" },
  { value: "banco", label: "Banco" },
  { value: "casa_comercial", label: "Casa comercial" },
  { value: "caja_compensacion", label: "Caja de compensación" },
  { value: "autopista", label: "Autopista / TAG" },
  { value: "telecom", label: "Internet / Móvil" },
  { value: "supermercado", label: "Supermercado" },
  { value: "transporte", label: "Pasajes (bus, avión)" },
  { value: "compras_online", label: "Compras online" },
  { value: "delivery", label: "Delivery (comida, encargos)" },
  { value: "suscripcion", label: "Suscripción (streaming, apps...)" },
  { value: "otro", label: "Otro" },
];

// Elegir la marca/servicio específico de un item (ej: "Jumbo" en un gasto de
// Supermercado, "Netflix" en uno de Suscripciones) — distinto del medio de
// pago. Muestra las marcas del catálogo compartido que coinciden con el tipo
// sugerido por la categoría elegida, y permite agregar una nueva ahí mismo
// si no está (con su propio ícono), sin salir del formulario.
export function MarcaSugeridaPicker({
  marcas,
  tipo,
  value,
  onChange,
  onCatalogoActualizado,
}: {
  marcas: Marca[];
  tipo: TipoMarca;
  value: string;
  onChange: (id: string) => void;
  onCatalogoActualizado?: () => void | Promise<void>;
}) {
  const [buscando, setBuscando] = useState(false);
  const [texto, setTexto] = useState("");
  const [iconoNueva, setIconoNueva] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const delTipo = marcas.filter((m) => m.tipo === tipo);
  const textoNorm = texto.trim().toLowerCase();
  const coincidencias = textoNorm
    ? delTipo.filter((m) => m.nombre.toLowerCase().includes(textoNorm) && m.id !== value)
    : [];
  const marcaExacta = delTipo.find((m) => m.nombre.trim().toLowerCase() === textoNorm);

  function cerrarBusqueda() {
    setBuscando(false);
    setTexto("");
    setIconoNueva("");
    setError("");
  }

  async function agregarMarca() {
    setError("");
    setGuardando(true);
    try {
      const { data, error: insError } = await supabase
        .from("marcas")
        .insert({ nombre: texto.trim(), tipo, icono: iconoNueva || null })
        .select()
        .single();
      if (insError) throw insError;
      onChange(data.id);
      cerrarBusqueda();
      if (onCatalogoActualizado) await onCatalogoActualizado();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo agregar. ¿Tu cuenta tiene permiso de administrador?");
    } finally {
      setGuardando(false);
    }
  }

  const label = TIPOS_MARCA.find((t) => t.value === tipo)?.label ?? tipo;

  return (
    <div>
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
          <span className="text-center text-[10px] text-gray-500">Ninguna</span>
        </button>
        {delTipo.map((m) => (
          <button
            type="button"
            key={m.id}
            onClick={() => onChange(m.id === value ? "" : m.id)}
            className={`flex shrink-0 flex-col items-center gap-1 rounded-lg border p-2 ${
              value === m.id ? "border-brand-from bg-purple-50" : "border-gray-200"
            }`}
            style={{ width: 64 }}
          >
            <EntidadAvatar marca={m} nombreFallback={m.nombre} className="h-9 w-9" />
            <span className="truncate text-center text-[10px] text-gray-600" style={{ maxWidth: 60 }}>
              {m.nombre}
            </span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setBuscando((v) => !v)}
          className={`flex shrink-0 flex-col items-center gap-1 rounded-lg border p-2 ${
            buscando ? "border-brand-from bg-purple-50" : "border-gray-200 border-dashed"
          }`}
          style={{ width: 64 }}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-lg text-gray-400">
            +
          </span>
          <span className="text-center text-[10px] text-gray-500">Buscar</span>
        </button>
      </div>

      {buscando && (
        <div className="mt-2 space-y-2 rounded-lg border border-gray-200 p-3">
          <input
            autoFocus
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={`Buscar en ${label.toLowerCase()}`}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />

          {coincidencias.length > 0 && (
            <div className="space-y-1">
              {coincidencias.map((m) => (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => {
                    onChange(m.id);
                    cerrarBusqueda();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg border border-gray-200 px-2 py-1.5 text-left hover:border-brand-from"
                >
                  <EntidadAvatar marca={m} nombreFallback={m.nombre} className="h-7 w-7" />
                  <span className="text-sm text-gray-700">{m.nombre}</span>
                </button>
              ))}
            </div>
          )}

          {textoNorm && !marcaExacta && (
            <div className="space-y-2 rounded-lg bg-purple-50 p-2">
              <p className="text-xs text-brand-from">
                &quot;{texto.trim()}&quot; no está en {label.toLowerCase()} — agrégalo:
              </p>
              <IconoPicker value={iconoNueva} onChange={setIconoNueva} />
              <button
                type="button"
                onClick={agregarMarca}
                disabled={guardando}
                className="w-full rounded-lg bg-brand-gradient py-2 text-xs font-semibold text-white disabled:opacity-60"
              >
                {guardando ? "Agregando…" : `Agregar "${texto.trim()}" y usarla`}
              </button>
            </div>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button type="button" onClick={cerrarBusqueda} className="text-[11px] text-gray-400">
            cerrar
          </button>
        </div>
      )}
    </div>
  );
}
