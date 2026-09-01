"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/Card";
import { Entidad, Marca } from "@/lib/types";
import { colorFor } from "@/lib/avatarColor";

const TIPOS: { value: Entidad["tipo"]; label: string }[] = [
  { value: "tarjeta_credito", label: "Tarjeta de crédito" },
  { value: "linea_credito", label: "Línea de crédito" },
  { value: "credito_hipotecario", label: "Crédito hipotecario" },
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
];

export default function TarjetasPage() {
  const [entidades, setEntidades] = useState<Entidad[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<Entidad["tipo"]>("tarjeta_credito");
  const [marcaId, setMarcaId] = useState("");
  const [marcaAutodetectada, setMarcaAutodetectada] = useState(false);

  async function cargarTodo() {
    const [{ data: e }, { data: m }] = await Promise.all([
      supabase.from("entidades").select("*").order("nombre"),
      supabase.from("marcas").select("*").order("nombre"),
    ]);
    setEntidades((e as Entidad[]) ?? []);
    setMarcas((m as Marca[]) ?? []);
  }

  useEffect(() => {
    cargarTodo();
  }, []);

  function aplicarTipoPorMarca(m: Marca) {
    if (m.tipo === "banco") setTipo("tarjeta_credito");
    if (m.tipo === "servicio_basico" || m.tipo === "telecom" || m.tipo === "autopista") setTipo("efectivo");
    if (m.tipo === "caja_compensacion") setTipo("linea_credito");
  }

  function elegirMarca(id: string) {
    setMarcaId(id);
    setMarcaAutodetectada(false);
    const m = marcas.find((x) => x.id === id);
    if (m && !nombre) setNombre(m.nombre);
    if (m) aplicarTipoPorMarca(m);
  }

  // Si el nombre que escribe coincide con una marca del catálogo (ej: "Ripley"),
  // la asocia automáticamente en vez de dejarla como una entidad "suelta" sin logo.
  function onNombreChange(valor: string) {
    setNombre(valor);
    const texto = valor.trim().toLowerCase();
    if (!texto) {
      if (marcaAutodetectada) {
        setMarcaId("");
        setMarcaAutodetectada(false);
      }
      return;
    }
    const match = marcas.find((m) => m.nombre.trim().toLowerCase() === texto);
    if (match) {
      if (marcaId !== match.id) {
        setMarcaId(match.id);
        aplicarTipoPorMarca(match);
      }
      setMarcaAutodetectada(true);
    } else if (marcaAutodetectada) {
      // el usuario siguió escribiendo y ya no matchea ninguna marca conocida
      setMarcaId("");
      setMarcaAutodetectada(false);
    }
  }

  function cancelarForm() {
    setMostrarForm(false);
    setEditandoId(null);
    setNombre("");
    setTipo("tarjeta_credito");
    setMarcaId("");
    setMarcaAutodetectada(false);
  }

  function iniciarEdicion(e: Entidad) {
    setEditandoId(e.id);
    setNombre(e.nombre);
    setTipo(e.tipo);
    setMarcaId(e.marca_id ?? "");
    setMarcaAutodetectada(false);
    setMostrarForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setGuardando(true);
    const payload = {
      nombre,
      tipo,
      marca_id: marcaId || null,
    };
    if (editandoId) {
      await supabase.from("entidades").update(payload).eq("id", editandoId);
    } else {
      await supabase.from("entidades").insert(payload);
    }
    setGuardando(false);
    cancelarForm();
    cargarTodo();
  }

  async function eliminar(id: string) {
    await supabase.from("entidades").delete().eq("id", id);
    cargarTodo();
  }

  const marcaDe = (id: string | null) => marcas.find((m) => m.id === id);

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-800">Tus tarjetas y cuentas</h1>
          <p className="text-xs text-gray-400">Bancos, casas comerciales, efectivo — las que uses para pagar.</p>
        </div>
        <button
          onClick={() => (mostrarForm ? cancelarForm() : setMostrarForm(true))}
          className="rounded-full bg-brand-gradient px-4 py-2 text-sm font-semibold text-white"
        >
          {mostrarForm ? "Cancelar" : "+ Nueva"}
        </button>
      </div>

      {mostrarForm && (
        <Card>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-xs text-gray-500">Elegir del catálogo (opcional)</label>
              <div className="mt-1 grid grid-cols-4 gap-2">
                {marcas.map((m) => (
                  <button
                    type="button"
                    key={m.id}
                    onClick={() => elegirMarca(m.id === marcaId ? "" : m.id)}
                    className={`flex flex-col items-center gap-1 rounded-lg border p-2 ${
                      marcaId === m.id ? "border-brand-from bg-purple-50" : "border-gray-200"
                    }`}
                  >
                    {m.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.logo_url} alt={m.nombre} className="h-8 w-8 rounded object-contain" />
                    ) : (
                      <span
                        className="flex h-8 w-8 items-center justify-center rounded text-xs font-semibold text-white"
                        style={{ backgroundColor: colorFor(m.nombre) }}
                      >
                        {m.nombre.charAt(0)}
                      </span>
                    )}
                    <span className="text-center text-[10px] text-gray-600">{m.nombre}</span>
                  </button>
                ))}
              </div>
              {marcas.length === 0 && (
                <p className="mt-1 text-xs text-gray-400">
                  Todavía no hay marcas cargadas — puedes seguir y escribir el nombre a mano.
                </p>
              )}
            </div>
            <div>
              <label className="text-xs text-gray-500">Nombre</label>
              <input
                required
                value={nombre}
                onChange={(e) => onNombreChange(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                placeholder="Ej: Falabella"
              />
              {marcaAutodetectada && (
                <p className="mt-1 text-[11px] text-emerald-600">
                  ✓ Coincide con &quot;{marcaDe(marcaId)?.nombre}&quot; del catálogo — se usará su logo.
                </p>
              )}
            </div>
            <div>
              <label className="text-xs text-gray-500">Tipo</label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as Entidad["tipo"])}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              >
                {TIPOS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={guardando}
              className="w-full rounded-lg bg-brand-gradient py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {guardando ? "Guardando…" : editandoId ? "Guardar cambios" : "Guardar"}
            </button>
          </form>
        </Card>
      )}

      <div className="space-y-3">
        {entidades.map((e) => {
          const marca = marcaDe(e.marca_id);
          return (
            <Card key={e.id}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {marca?.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={marca.logo_url} alt={e.nombre} className="h-9 w-9 rounded-lg object-contain" />
                  ) : (
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-semibold text-white"
                      style={{ backgroundColor: colorFor(e.nombre) }}
                    >
                      {e.nombre.charAt(0)}
                    </span>
                  )}
                  <div>
                    <p className="font-semibold text-gray-800">{e.nombre}</p>
                    <p className="text-xs text-gray-400">{TIPOS.find((t) => t.value === e.tipo)?.label ?? e.tipo}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <button onClick={() => iniciarEdicion(e)} className="text-xs text-brand-from">
                    editar
                  </button>
                  <button onClick={() => eliminar(e.id)} className="text-xs text-gray-300 hover:text-red-400">
                    eliminar
                  </button>
                </div>
              </div>
            </Card>
          );
        })}
        {entidades.length === 0 && (
          <p className="text-center text-sm text-gray-400">Aún no tienes tarjetas o cuentas creadas.</p>
        )}
      </div>
    </div>
  );
}
