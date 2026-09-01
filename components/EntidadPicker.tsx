"use client";

import { useState } from "react";
import { Entidad, Marca, TipoMarca } from "@/lib/types";
import { EntidadAvatar } from "@/components/EntidadAvatar";
import { IconoPicker } from "@/components/IconoPicker";
import { resolverMarca } from "@/lib/resolverMarca";
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
  { value: "otro", label: "Otro" },
];

function tipoEntidadPorMarca(tipoMarca: TipoMarca): Entidad["tipo"] {
  if (tipoMarca === "banco") return "tarjeta_credito";
  if (tipoMarca === "caja_compensacion") return "linea_credito";
  return "efectivo";
}

// Elegir un medio de pago: entre los que ya tienes, o buscando en el
// catálogo compartido de marcas (bancos, casas comerciales, servicios como
// "Aguas Andinas") — y si el catálogo todavía no la tiene, agregarla ahí
// mismo con su propio ícono, sin salir del formulario.
export function EntidadPicker({
  entidades,
  marcas,
  value,
  onChange,
  onCatalogoActualizado,
}: {
  entidades: Entidad[];
  marcas: Marca[];
  value: string;
  onChange: (id: string) => void;
  onCatalogoActualizado?: () => void | Promise<void>;
}) {
  const [buscando, setBuscando] = useState(false);
  const [texto, setTexto] = useState("");
  const [tipoNuevaMarca, setTipoNuevaMarca] = useState<TipoMarca>("servicio_basico");
  const [iconoNuevaMarca, setIconoNuevaMarca] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const nombresYaAgregados = new Set(entidades.map((e) => e.nombre.trim().toLowerCase()));
  const textoNorm = texto.trim().toLowerCase();
  const coincidencias = textoNorm
    ? marcas.filter((m) => m.nombre.toLowerCase().includes(textoNorm) && !nombresYaAgregados.has(m.nombre.trim().toLowerCase()))
    : [];
  const marcaExacta = marcas.find((m) => m.nombre.trim().toLowerCase() === textoNorm);

  function cerrarBusqueda() {
    setBuscando(false);
    setTexto("");
    setIconoNuevaMarca("");
    setTipoNuevaMarca("servicio_basico");
    setError("");
  }

  async function crearEntidadDesdeMarca(marca: Marca) {
    setError("");
    setGuardando(true);
    try {
      const { data, error: insError } = await supabase
        .from("entidades")
        .insert({ nombre: marca.nombre, tipo: tipoEntidadPorMarca(marca.tipo), marca_id: marca.id })
        .select()
        .single();
      if (insError) throw insError;
      onChange(data.id);
      cerrarBusqueda();
      if (onCatalogoActualizado) await onCatalogoActualizado();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo agregar.");
    } finally {
      setGuardando(false);
    }
  }

  async function agregarMarcaYUsarla() {
    setError("");
    setGuardando(true);
    try {
      const { data: marca, error: marcaError } = await supabase
        .from("marcas")
        .insert({ nombre: texto.trim(), tipo: tipoNuevaMarca, icono: iconoNuevaMarca || null })
        .select()
        .single();
      if (marcaError) throw marcaError;
      const { data: entidad, error: insError } = await supabase
        .from("entidades")
        .insert({ nombre: marca.nombre, tipo: tipoEntidadPorMarca(tipoNuevaMarca), marca_id: marca.id })
        .select()
        .single();
      if (insError) throw insError;
      onChange(entidad.id);
      cerrarBusqueda();
      if (onCatalogoActualizado) await onCatalogoActualizado();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo agregar. ¿Tu cuenta tiene permiso de administrador?");
    } finally {
      setGuardando(false);
    }
  }

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
            placeholder="Ej: Aguas Andinas"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />

          {coincidencias.length > 0 && (
            <div className="space-y-1">
              {coincidencias.map((m) => (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => crearEntidadDesdeMarca(m)}
                  disabled={guardando}
                  className="flex w-full items-center gap-2 rounded-lg border border-gray-200 px-2 py-1.5 text-left hover:border-brand-from disabled:opacity-60"
                >
                  <EntidadAvatar marca={m} nombreFallback={m.nombre} className="h-7 w-7" />
                  <span className="text-sm text-gray-700">{m.nombre}</span>
                </button>
              ))}
            </div>
          )}

          {textoNorm && !marcaExacta && !nombresYaAgregados.has(textoNorm) && (
            <div className="space-y-2 rounded-lg bg-purple-50 p-2">
              <p className="text-xs text-brand-from">
                &quot;{texto.trim()}&quot; no está en el catálogo — agrégalo:
              </p>
              <select
                value={tipoNuevaMarca}
                onChange={(e) => setTipoNuevaMarca(e.target.value as TipoMarca)}
                className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
              >
                {TIPOS_MARCA.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <IconoPicker value={iconoNuevaMarca} onChange={setIconoNuevaMarca} />
              <button
                type="button"
                onClick={agregarMarcaYUsarla}
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

      {entidades.length === 0 && !buscando && (
        <p className="mt-1 py-1 text-xs text-gray-400">
          Aún no tienes tarjetas o cuentas — créalas aquí o en &quot;Gestionar tus tarjetas y cuentas&quot;.
        </p>
      )}
    </div>
  );
}
