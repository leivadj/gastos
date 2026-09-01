"use client";

import { FormEvent, useEffect, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/Card";
import { Categoria, Marca, TipoMarca } from "@/lib/types";
import { colorFor } from "@/lib/avatarColor";
import { esAdmin as checkEsAdmin } from "@/components/navItems";
import { IconoPicker } from "@/components/IconoPicker";

const TIPOS: { value: TipoMarca; label: string }[] = [
  { value: "banco", label: "Banco" },
  { value: "casa_comercial", label: "Casa comercial" },
  { value: "caja_compensacion", label: "Caja de compensación" },
  { value: "autopista", label: "Autopista / TAG" },
  { value: "telecom", label: "Internet / Móvil" },
  { value: "servicio_basico", label: "Servicio básico (luz, agua, gas...)" },
  { value: "otro", label: "Otro" },
];

export default function AdminPage() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [editandoIconoCat, setEditandoIconoCat] = useState<string | null>(null);
  const [editandoIconoMarca, setEditandoIconoMarca] = useState<string | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<TipoMarca>("banco");
  const [icono, setIcono] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [subiendoId, setSubiendoId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const esAdmin = checkEsAdmin(session?.user?.email);

  async function cargarMarcas() {
    const { data } = await supabase.from("marcas").select("*").order("nombre");
    setMarcas((data as Marca[]) ?? []);
  }

  async function cargarCategorias() {
    const { data } = await supabase.from("categorias").select("*").order("nombre");
    setCategorias((data as Categoria[]) ?? []);
  }

  useEffect(() => {
    if (esAdmin) {
      cargarMarcas();
      cargarCategorias();
    }
  }, [esAdmin]);

  async function guardarIconoCategoria(id: string, icono: string) {
    const { error: dbError } = await supabase
      .from("categorias")
      .update({ icono: icono || null })
      .eq("id", id);
    if (dbError) {
      setError(dbError.message || "No se pudo guardar el ícono de la categoría.");
      return;
    }
    cargarCategorias();
  }

  async function guardarIconoMarca(id: string, nuevoIcono: string) {
    const { error: dbError } = await supabase
      .from("marcas")
      .update({ icono: nuevoIcono || null })
      .eq("id", id);
    if (dbError) {
      setError(dbError.message || "No se pudo guardar el ícono de la marca.");
      return;
    }
    cargarMarcas();
  }

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
        icono: icono || null,
      });
      if (insertError) throw insertError;

      setMostrarForm(false);
      setNombre("");
      setTipo("banco");
      setIcono("");
      setArchivo(null);
      cargarMarcas();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la marca.");
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarLogo(m: Marca, file: File) {
    setSubiendoId(m.id);
    try {
      const ext = file.name.split(".").pop();
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("marcas-logos")
        .upload(path, file, { upsert: false });
      if (uploadError) throw uploadError;
      const { data: pub } = supabase.storage.from("marcas-logos").getPublicUrl(path);

      const logoAnterior = m.logo_url;
      const { error: updateError } = await supabase
        .from("marcas")
        .update({ logo_url: pub.publicUrl })
        .eq("id", m.id);
      if (updateError) throw updateError;

      if (logoAnterior) {
        const path2 = logoAnterior.split("/marcas-logos/")[1];
        if (path2) await supabase.storage.from("marcas-logos").remove([path2]);
      }
      cargarMarcas();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir el logo.");
    } finally {
      setSubiendoId(null);
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
            <div>
              <label className="text-xs text-gray-500">
                O ícono (si no tienes un logo a mano)
              </label>
              <IconoPicker value={icono} onChange={setIcono} />
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

      {marcas.length === 0 && (
        <p className="text-center text-sm text-gray-400">Todavía no hay marcas cargadas.</p>
      )}

      {TIPOS.map((t) => {
        const delGrupo = marcas.filter((m) => m.tipo === t.value);
        if (delGrupo.length === 0) return null;
        return (
          <div key={t.value} className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{t.label}</p>
            <div className="grid grid-cols-2 gap-3">
              {delGrupo.map((m) => (
                <Card key={m.id}>
                  <div className="flex items-center gap-3">
                    {m.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.logo_url} alt={m.nombre} className="h-10 w-10 rounded-lg object-contain" />
                    ) : m.icono ? (
                      <span
                        className="flex h-10 w-10 items-center justify-center rounded-lg text-lg text-white"
                        style={{ backgroundColor: colorFor(m.nombre) }}
                      >
                        {m.icono}
                      </span>
                    ) : (
                      <span
                        className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-semibold text-white"
                        style={{ backgroundColor: colorFor(m.nombre) }}
                      >
                        {m.nombre.charAt(0)}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-800">{m.nombre}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <label className="cursor-pointer text-[11px] text-brand-from">
                      {subiendoId === m.id ? "subiendo…" : m.logo_url ? "cambiar logo" : "+ subir logo"}
                      <input
                        type="file"
                        accept="image/*"
                        disabled={subiendoId === m.id}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) cambiarLogo(m, file);
                          e.target.value = "";
                        }}
                        className="hidden"
                      />
                    </label>
                    <button
                      onClick={() => setEditandoIconoMarca(editandoIconoMarca === m.id ? null : m.id)}
                      className="text-[11px] text-brand-from"
                    >
                      cambiar ícono
                    </button>
                    <button
                      onClick={() => eliminar(m)}
                      className="text-[11px] text-gray-300 hover:text-red-400"
                    >
                      eliminar
                    </button>
                  </div>
                  {editandoIconoMarca === m.id && (
                    <div className="mt-2">
                      <IconoPicker
                        value={m.icono ?? ""}
                        onChange={(v) => guardarIconoMarca(m.id, v)}
                      />
                      <button
                        onClick={() => setEditandoIconoMarca(null)}
                        className="mt-1 text-[11px] text-gray-400"
                      >
                        listo
                      </button>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </div>
        );
      })}

      <div className="space-y-2 pt-4">
        <div>
          <h2 className="text-sm font-bold text-gray-800">Íconos de categorías</h2>
          <p className="text-xs text-gray-400">Se muestran junto a la categoría en los gráficos y listas.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {categorias.map((c) => (
            <Card key={c.id}>
              <div className="flex items-center gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg text-white"
                  style={{ backgroundColor: colorFor(c.nombre) }}
                >
                  {c.icono || c.nombre.charAt(0)}
                </span>
                <p className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-800">{c.nombre}</p>
              </div>
              {editandoIconoCat === c.id ? (
                <div className="mt-2">
                  <IconoPicker
                    value={c.icono ?? ""}
                    onChange={(v) => guardarIconoCategoria(c.id, v)}
                  />
                  <button
                    onClick={() => setEditandoIconoCat(null)}
                    className="mt-1 text-[11px] text-gray-400"
                  >
                    listo
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setEditandoIconoCat(c.id)}
                  className="mt-2 text-[11px] text-brand-from"
                >
                  cambiar ícono
                </button>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
