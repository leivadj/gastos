"use client";

import { FormEvent, useEffect, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/Card";
import { Marca, TipoMarca } from "@/lib/types";

const ADMIN_EMAIL = "leivadj@gmail.com";

const TIPOS: { value: TipoMarca; label: string }[] = [
  { value: "banco", label: "Banco" },
  { value: "casa_comercial", label: "Casa comercial" },
  { value: "servicio_basico", label: "Servicio básico (luz, agua, gas...)" },
  { value: "otro", label: "Otro" },
];

export default function AdminPage() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<TipoMarca>("banco");
  const [archivo, setArchivo] = useState<File | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const esAdmin = session?.user?.email === ADMIN_EMAIL;

  async function cargarMarcas() {
    const { data } = await supabase.from("marcas").select("*").order("nombre");
    setMarcas((data as Marca[]) ?? []);
  }

  useEffect(() => {
    if (esAdmin) cargarMarcas();
  }, [esAdmin]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setGuardando(true);
    try {
      let logoUrl: string | null = null;

      if (archivo) {
        const ext = archivo.name.split(".").pop();
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("marcas-logos")
          .upload(path, archivo, { upsert: false });
        if (uploadError) throw uploadError;
        const { data: pub } = supabase.storage.from("marcas-logos").getPublicUrl(path);
        logoUrl = pub.publicUrl;
      }

      const { error: insertError } = await supabase.from("marcas").insert({
        nombre,
        tipo,
        logo_url: logoUrl,
      });
      if (insertError) throw insertError;

      setMostrarForm(false);
      setNombre("");
      setTipo("banco");
      setArchivo(null);
      cargarMarcas();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la marca.");
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(m: Marca) {
    await supabase.from("marcas").delete().eq("id", m.id);
    if (m.logo_url) {
      const path = m.logo_url.split("/marcas-logos/")[1];
      if (path) await supabase.storage.from("marcas-logos").remove([path]);
    }
    cargarMarcas();
  }

  if (session === undefined) {
    return <p className="pt-10 text-center text-sm text-gray-400">Cargando…</p>;
  }

  if (!esAdmin) {
    return (
      <div className="pt-10">
        <Card>
          <p className="text-center text-sm text-gray-500">
            No autorizado. Esta sección es solo para la cuenta administradora.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-800">Catálogo de marcas</h1>
          <p className="text-xs text-gray-400">Bancos, casas comerciales y servicios — con su logo.</p>
        </div>
        <button
          onClick={() => setMostrarForm((v) => !v)}
          className="rounded-full bg-brand-gradient px-4 py-2 text-sm font-semibold text-white"
        >
          {mostrarForm ? "Cancelar" : "+ Nueva"}
        </button>
      </div>

      {mostrarForm && (
        <Card>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-xs text-gray-500">Nombre</label>
              <input
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                placeholder="Ej: Banco Estado"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Tipo</label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TipoMarca)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              >
                {TIPOS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Logo (imagen)</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button
              type="submit"
              disabled={guardando}
              className="w-full rounded-lg bg-brand-gradient py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {guardando ? "Guardando…" : "Guardar"}
            </button>
          </form>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        {marcas.map((m) => (
          <Card key={m.id}>
            <div className="flex items-center gap-3">
              {m.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.logo_url} alt={m.nombre} className="h-10 w-10 rounded-lg object-contain" />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-sm font-semibold text-gray-400">
                  {m.nombre.charAt(0)}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-800">{m.nombre}</p>
                <p className="text-[11px] text-gray-400">{TIPOS.find((t) => t.value === m.tipo)?.label}</p>
              </div>
            </div>
            <button
              onClick={() => eliminar(m)}
              className="mt-2 w-full text-center text-[11px] text-gray-300 hover:text-red-400"
            >
              eliminar
            </button>
          </Card>
        ))}
        {marcas.length === 0 && (
          <p className="col-span-2 text-center text-sm text-gray-400">Todavía no hay marcas cargadas.</p>
        )}
      </div>
    </div>
  );
}
