"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/Card";
import { EntidadAvatar } from "@/components/EntidadAvatar";
import { EntidadPicker } from "@/components/EntidadPicker";
import { formatCLP } from "@/lib/format";
import { Categoria, CompraVigente, Entidad, Marca, ModoReparto, Persona } from "@/lib/types";

export default function ComprasPage() {
  const [compras, setCompras] = useState<CompraVigente[]>([]);
  const [entidades, setEntidades] = useState<Entidad[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [descripcion, setDescripcion] = useState("");
  const [montoTotal, setMontoTotal] = useState("");
  const [nCuotas, setNCuotas] = useState("1");
  const [fechaPrimeraCuota, setFechaPrimeraCuota] = useState(() => new Date().toISOString().slice(0, 10));
  const [entidadId, setEntidadId] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [modoReparto, setModoReparto] = useState<ModoReparto>("manual");
  const [personaId, setPersonaId] = useState("");

  async function cargarTodo() {
    const [{ data: c }, { data: e }, { data: m }, { data: cat }, { data: p }] = await Promise.all([
      supabase.from("vista_cuotas_vigentes").select("*").order("cuota_actual", { ascending: true }),
      supabase.from("entidades").select("*").order("nombre"),
      supabase.from("marcas").select("*").order("nombre"),
      supabase.from("categorias").select("*").order("nombre"),
      supabase.from("personas").select("*").eq("activo", true).order("nombre"),
    ]);
    setCompras((c as CompraVigente[]) ?? []);
    setEntidades((e as Entidad[]) ?? []);
    setMarcas((m as Marca[]) ?? []);
    setCategorias((cat as Categoria[]) ?? []);
    setPersonas((p as Persona[]) ?? []);
  }

  useEffect(() => {
    cargarTodo();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setGuardando(true);
    await supabase.from("compras").insert({
      descripcion,
      monto_total: Number(montoTotal),
      n_cuotas: Number(nCuotas),
      fecha_primera_cuota: fechaPrimeraCuota,
      entidad_id: entidadId || null,
      categoria_id: categoriaId || null,
      modo_reparto: modoReparto,
      persona_id: modoReparto === "manual" ? personaId || null : null,
    });
    setGuardando(false);
    setMostrarForm(false);
    setDescripcion("");
    setMontoTotal("");
    setNCuotas("1");
    setPersonaId("");
    cargarTodo();
  }

  async function eliminar(id: string) {
    await supabase.from("compras").delete().eq("id", id);
    cargarTodo();
  }

  const entidadDe = (id: string | null) => entidades.find((e) => e.id === id) ?? null;
  const marcaDeEntidad = (id: string | null) => {
    const e = entidadDe(id);
    return e?.marca_id ? marcas.find((m) => m.id === e.marca_id) ?? null : null;
  };
  const nombreEntidad = (id: string | null) => entidadDe(id)?.nombre ?? "—";
  const nombreCategoria = (id: string | null) => categorias.find((c) => c.id === id)?.nombre ?? "—";
  const nombrePersona = (id: string | null) => personas.find((p) => p.id === id)?.nombre ?? "—";

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-800">Compras en cuotas</h1>
          <p className="text-xs text-gray-400">La cuota vigente se calcula sola cada mes, con la fecha de hoy.</p>
        </div>
        <button
          onClick={() => setMostrarForm((v) => !v)}
          className="rounded-full bg-brand-gradient px-4 py-2 text-sm font-semibold text-white"
        >
          {mostrarForm ? "Cancelar" : "+ Nueva"}
        </button>
      </div>

      <Link
        href="/tarjetas"
        className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-sm shadow-sm"
      >
        <span className="text-gray-600">Gestionar tus tarjetas y cuentas</span>
        <span className="text-brand-from">→</span>
      </Link>

      {mostrarForm && (
        <Card>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-xs text-gray-500">Descripción</label>
              <input
                required
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                placeholder="Ej: Refrigerador nuevo"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500">Monto total</label>
                <input
                  required
                  type="number"
                  min={1}
                  value={montoTotal}
                  onChange={(e) => setMontoTotal(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">N° de cuotas</label>
                <input
                  required
                  type="number"
                  min={1}
                  value={nCuotas}
                  onChange={(e) => setNCuotas(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500">Fecha de la primera cuota</label>
              <input
                required
                type="date"
                value={fechaPrimeraCuota}
                onChange={(e) => setFechaPrimeraCuota(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Tarjeta / medio de pago</label>
              <div className="mt-1">
                <EntidadPicker entidades={entidades} marcas={marcas} value={entidadId} onChange={setEntidadId} />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500">Categoría</label>
              <select
                value={categoriaId}
                onChange={(e) => setCategoriaId(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              >
                <option value="">—</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">¿Cómo se reparte?</label>
              <div className="mt-1 flex gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => setModoReparto("manual")}
                  className={`flex-1 rounded-lg border px-3 py-2 ${
                    modoReparto === "manual" ? "border-brand-from bg-purple-50 font-semibold" : "border-gray-200"
                  }`}
                >
                  A una persona
                </button>
                <button
                  type="button"
                  onClick={() => setModoReparto("automatico")}
                  className={`flex-1 rounded-lg border px-3 py-2 ${
                    modoReparto === "automatico" ? "border-brand-from bg-purple-50 font-semibold" : "border-gray-200"
                  }`}
                >
                  % automático
                </button>
              </div>
            </div>
            {modoReparto === "manual" && (
              <div>
                <label className="text-xs text-gray-500">Persona responsable</label>
                <select
                  required
                  value={personaId}
                  onChange={(e) => setPersonaId(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  <option value="">Selecciona…</option>
                  {personas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <button
              type="submit"
              disabled={guardando}
              className="w-full rounded-lg bg-brand-gradient py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {guardando ? "Guardando…" : "Guardar compra"}
            </button>
          </form>
        </Card>
      )}

      <div className="space-y-3">
        {compras.map((c) => {
          const activa = c.cuota_actual >= 1 && c.cuota_actual <= c.n_cuotas;
          const progreso = Math.min(100, Math.max(0, (c.cuota_actual / c.n_cuotas) * 100));
          return (
            <Card key={c.id} className={!activa ? "opacity-50" : ""}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3">
                  <EntidadAvatar entidad={entidadDe(c.entidad_id)} marca={marcaDeEntidad(c.entidad_id)} className="h-9 w-9" />
                  <div>
                    <p className="font-semibold text-gray-800">{c.descripcion}</p>
                    <p className="text-xs text-gray-400">
                      {nombreEntidad(c.entidad_id)} · {nombreCategoria(c.categoria_id)} ·{" "}
                      {c.modo_reparto === "manual" ? nombrePersona(c.persona_id) : "reparto automático"}
                    </p>
                  </div>
                </div>
                <button onClick={() => eliminar(c.id)} className="shrink-0 text-xs text-gray-300 hover:text-red-400">
                  eliminar
                </button>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-gray-500">
                  {activa ? `Cuota ${c.cuota_actual} de ${c.n_cuotas}` : "Terminada"}
                </span>
                <span className="font-semibold text-gray-800">{formatCLP(c.monto_cuota)}/mes</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div className="h-full bg-brand-gradient" style={{ width: `${progreso}%` }} />
              </div>
            </Card>
          );
        })}
        {compras.length === 0 && <p className="text-center text-sm text-gray-400">Aún no hay compras en cuotas.</p>}
      </div>
    </div>
  );
}
