"use client";

import { FormEvent, useEffect, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/Card";
import { Categoria, Marca, TipoMarca } from "@/lib/types";
import { colorFor } from "@/lib/avatarColor";
import { esAdmin as checkEsAdmin } from "@/components/navItems";
import { IconoPicker } from "@/components/IconoPicker";
import { mensajeError } from "@/lib/supabaseError";

// Paleta de colores propios de categoría (ronda 6 del rediseño, ver
// migration_36_color_categoria.sql) — vivos y distinguibles a propósito
// (a diferencia de la paleta gris de lib/avatarColor.ts, pensada para
// logos/avatares de respaldo), calcada de una captura real de Not Pato
// donde cada categoría tiene su propio color reconocible de un vistazo.
const PALETA_COLOR_CATEGORIA = [
  "#E2584B", // rojo
  "#E8935A", // naranjo
  "#E0C54A", // amarillo
  "#5DCB86", // verde
  "#4FB6C7", // celeste
  "#5B8DEF", // azul
  "#9B7FE0", // morado
  "#D46FB3", // rosado
];

function SelectorColorCategoria({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {PALETA_COLOR_CATEGORIA.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(value === c ? "" : c)}
          aria-label={`Color ${c}`}
          className={`h-7 w-7 rounded-full transition ${value === c ? "ring-2 ring-offset-2 ring-gray-800 dark:ring-white dark:ring-offset-neutral-900" : ""}`}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );
}

// A diferencia de personas/grupos/entidades (que son POR CUENTA), el
// catálogo de marcas es compartido entre todas las cuentas a propósito —
// por eso "nombre" es único en TODA la tabla, sin owner_id. Si ya existe
// (ej. "Spotify"), no hay que crearla de nuevo: está más arriba, en su
// grupo por tipo, y se puede editar el logo/ícono ahí mismo.
function traducirErrorMarca(err: unknown, nombreIntentado: string): string {
  const msg = mensajeError(err);
  if (msg.includes("marcas_nombre_key")) {
    return `Ya existe "${nombreIntentado}" en el catálogo (es compartido entre todas las cuentas, no puede haber dos con el mismo nombre) — buscala más arriba en su grupo y usa "cambiar logo" o "cambiar ícono" ahí mismo en vez de crearla de nuevo.`;
  }
  return msg || "No se pudo guardar la marca.";
}

function traducirErrorMarcaEliminar(err: unknown, nombreIntentado: string): string {
  const msg = mensajeError(err);
  if (msg.includes("violates foreign key constraint")) {
    return `"${nombreIntentado}" está en uso (alguna tarjeta/cuenta, gasto o compra la tiene asociada) — no se puede eliminar del catálogo mientras esté en uso.`;
  }
  return msg || "No se pudo eliminar la marca.";
}

// Categorías es compartida igual que marcas (sin owner_id), pero a
// diferencia de marcas, hasta ahora solo se podía crear/renombrar/borrar por
// SQL — el ícono y la marca sugerida ya eran editables acá. Mismo criterio
// de traducción de errores que marcas: nombre duplicado y borrado en uso.
function traducirErrorCategoria(err: unknown, nombreIntentado: string, accion: "guardar" | "eliminar"): string {
  const msg = mensajeError(err);
  if (msg.includes("categorias_nombre_key")) {
    return `Ya existe una categoría llamada "${nombreIntentado}" — elige otro nombre o edita la que ya está en la lista.`;
  }
  if (accion === "eliminar" && msg.includes("violates foreign key constraint")) {
    return `"${nombreIntentado}" está en uso (algún gasto o compra la tiene asociada) — no se puede eliminar mientras esté en uso. Podés dejarla sin usar en vez de borrarla.`;
  }
  return msg || (accion === "eliminar" ? "No se pudo eliminar la categoría." : "No se pudo guardar la categoría.");
}

const TIPOS: { value: TipoMarca; label: string }[] = [
  { value: "banco", label: "Banco" },
  { value: "casa_comercial", label: "Casa comercial" },
  { value: "caja_compensacion", label: "Caja de compensación" },
  { value: "autopista", label: "Autopista / TAG" },
  { value: "telecom", label: "Internet / Móvil" },
  { value: "servicio_basico", label: "Servicio básico (luz, agua, gas...)" },
  { value: "supermercado", label: "Supermercado" },
  { value: "transporte", label: "Pasajes (bus, avión)" },
  { value: "compras_online", label: "Compras online" },
  { value: "delivery", label: "Delivery (comida, encargos)" },
  { value: "suscripcion", label: "Suscripción (streaming, apps...)" },
  { value: "bencina", label: "Bencina" },
  { value: "mecanico", label: "Mecánico" },
  { value: "repuestos", label: "Repuestos" },
  { value: "centro_medico", label: "Centro médico" },
  { value: "farmacia", label: "Farmacia (medicamentos)" },
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

  // --- Categorías: alta y edición de nombre/tipo (ícono y marca sugerida ya
  // eran editables desde acá) ---
  const [mostrarFormCategoria, setMostrarFormCategoria] = useState(false);
  const [guardandoCategoria, setGuardandoCategoria] = useState(false);
  const [nombreCategoria, setNombreCategoria] = useState("");
  const [tipoCategoria, setTipoCategoria] = useState<"fijo" | "variable">("variable");
  const [iconoCategoria, setIconoCategoria] = useState("");
  const [colorCategoria, setColorCategoria] = useState("");
  const [editandoDatosCat, setEditandoDatosCat] = useState<string | null>(null);
  const [nombreCatEdit, setNombreCatEdit] = useState("");
  const [tipoCatEdit, setTipoCatEdit] = useState<"fijo" | "variable">("variable");

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

  async function guardarColorCategoria(id: string, color: string) {
    const { error: dbError } = await supabase
      .from("categorias")
      .update({ color: color || null })
      .eq("id", id);
    if (dbError) {
      setError(dbError.message || "No se pudo guardar el color de la categoría.");
      return;
    }
    cargarCategorias();
  }

  async function guardarTipoSugerido(id: string, tipoSugerido: string) {
    const { error: dbError } = await supabase
      .from("categorias")
      .update({ tipo_marca_sugerido: tipoSugerido || null })
      .eq("id", id);
    if (dbError) {
      setError(dbError.message || "No se pudo guardar la marca sugerida de la categoría.");
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
      setError(traducirErrorMarca(err, nombre));
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
      setError(mensajeError(err) || "No se pudo subir el logo.");
    } finally {
      setSubiendoId(null);
    }
  }

  async function eliminar(m: Marca) {
    setError("");
    const { error: delError } = await supabase.from("marcas").delete().eq("id", m.id);
    if (delError) {
      setError(traducirErrorMarcaEliminar(delError, m.nombre));
      return;
    }
    if (m.logo_url) {
      const path = m.logo_url.split("/marcas-logos/")[1];
      if (path) await supabase.storage.from("marcas-logos").remove([path]);
    }
    cargarMarcas();
  }

  async function crearCategoria(e: FormEvent) {
    e.preventDefault();
    setError("");
    setGuardandoCategoria(true);
    try {
      const { error: insertError } = await supabase.from("categorias").insert({
        nombre: nombreCategoria,
        tipo: tipoCategoria,
        icono: iconoCategoria || null,
        color: colorCategoria || null,
      });
      if (insertError) throw insertError;
      setMostrarFormCategoria(false);
      setNombreCategoria("");
      setTipoCategoria("variable");
      setIconoCategoria("");
      setColorCategoria("");
      cargarCategorias();
    } catch (err) {
      setError(traducirErrorCategoria(err, nombreCategoria, "guardar"));
    } finally {
      setGuardandoCategoria(false);
    }
  }

  function iniciarEdicionCategoria(c: Categoria) {
    setError("");
    setEditandoDatosCat(c.id);
    setNombreCatEdit(c.nombre);
    setTipoCatEdit(c.tipo);
  }

  async function guardarDatosCategoria(id: string) {
    setError("");
    const { error: updateError } = await supabase
      .from("categorias")
      .update({ nombre: nombreCatEdit, tipo: tipoCatEdit })
      .eq("id", id);
    if (updateError) {
      setError(traducirErrorCategoria(updateError, nombreCatEdit, "guardar"));
      return;
    }
    setEditandoDatosCat(null);
    cargarCategorias();
  }

  async function eliminarCategoria(c: Categoria) {
    setError("");
    const { error: delError } = await supabase.from("categorias").delete().eq("id", c.id);
    if (delError) {
      setError(traducirErrorCategoria(delError, c.nombre, "eliminar"));
      return;
    }
    cargarCategorias();
  }

  if (session === undefined) {
    return <p className="pt-10 text-center text-sm text-gray-400 dark:text-gray-500">Cargando…</p>;
  }

  if (!esAdmin) {
    return (
      <div className="pt-10">
        <Card>
          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
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
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Administración</p>
          <h1 className="text-lg font-bold text-gray-800 dark:text-white">Categorías y marcas</h1>
        </div>
        <span className="shrink-0 rounded-full bg-gray-100 px-3 py-1.5 text-[11px] font-semibold text-gray-500 dark:bg-white/10 dark:text-gray-400">
          Solo visible para tu cuenta admin
        </span>
      </div>

      {/* Banner general de error: antes cada acción (ícono, marca sugerida,
          eliminar) guardaba el mensaje en `error` pero solo se mostraba si el
          formulario de "+ Nueva marca" estaba abierto — el resto de las
          acciones fallaban en silencio para el usuario. Ahora se muestra acá
          arriba, visible sin importar qué formulario esté abierto. */}
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-500 dark:bg-red-950/40 dark:text-red-400">{error}</p>
      )}

      {/* Dos paneles lado a lado en escritorio (mockup PDF pág. 15,
          "Categorías y marcas"): antes eran dos secciones apiladas con
          grillas de tarjetas — mismo contenido y funciones, ahora en filas
          de lista dentro de cada panel. */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-800 dark:text-white">Categorías</h2>
            <button
              onClick={() => setMostrarFormCategoria((v) => !v)}
              className="shrink-0 rounded-full bg-brand-gradient px-3 py-1.5 text-xs font-semibold text-white"
            >
              {mostrarFormCategoria ? "Cancelar" : "+ Nueva categoría"}
            </button>
          </div>
          <p className="mb-3 text-[11px] text-gray-400 dark:text-gray-500">
            Nombre, tipo (para el desglose fijo/variable de Presupuesto y Reportes), ícono, y qué marca sugerida se
            ofrece al usar esta categoría en un gasto/compra.
          </p>

          {mostrarFormCategoria && (
            <form onSubmit={crearCategoria} className="mb-3 space-y-3 rounded-xl border border-gray-100 p-3 dark:border-white/10">
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400">Nombre</label>
                <input
                  required
                  value={nombreCategoria}
                  onChange={(e) => setNombreCategoria(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
                  placeholder="Ej: Mascotas"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400">Tipo</label>
                <select
                  value={tipoCategoria}
                  onChange={(e) => setTipoCategoria(e.target.value as "fijo" | "variable")}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
                >
                  <option value="variable">Variable (compras, ocio, mercado...)</option>
                  <option value="fijo">Fijo (arriendo, suscripciones...)</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400">Ícono (opcional)</label>
                <IconoPicker value={iconoCategoria} onChange={setIconoCategoria} />
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400">Color (opcional — si no eliges uno, se usa un color fijo por nombre)</label>
                <div className="mt-1">
                  <SelectorColorCategoria value={colorCategoria} onChange={setColorCategoria} />
                </div>
              </div>
              <button
                type="submit"
                disabled={guardandoCategoria}
                className="w-full rounded-lg bg-brand-gradient py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {guardandoCategoria ? "Guardando…" : "Guardar categoría"}
              </button>
            </form>
          )}

          {categorias.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400 dark:text-gray-500">Todavía no hay categorías.</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-white/10">
              {categorias.map((c) => (
                <li key={c.id} className="py-2.5">
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base text-white"
                      style={{ backgroundColor: c.color || colorFor(c.nombre) }}
                    >
                      {c.icono || c.nombre.charAt(0)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-800 dark:text-white">{c.nombre}</p>
                      <p className="truncate text-[11px] text-gray-400 dark:text-gray-500">
                        {c.tipo_marca_sugerido
                          ? `Marca sugerida: ${TIPOS.find((t) => t.value === c.tipo_marca_sugerido)?.label ?? c.tipo_marca_sugerido}`
                          : "Sin marca sugerida"}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10.5px] font-semibold text-gray-500 dark:bg-white/10 dark:text-gray-400">
                      {c.tipo === "fijo" ? "Fijo" : "Variable"}
                    </span>
                    <div className="flex shrink-0 items-center gap-2.5">
                      <button
                        onClick={() => (editandoDatosCat === c.id ? setEditandoDatosCat(null) : iniciarEdicionCategoria(c))}
                        aria-label="editar"
                        className="text-brand-from dark:text-white"
                      >
                        ✎
                      </button>
                      <button onClick={() => eliminarCategoria(c)} aria-label="eliminar" className="text-gray-300 hover:text-red-400 dark:text-gray-600">
                        🗑
                      </button>
                    </div>
                  </div>

                  {editandoDatosCat === c.id && (
                    <div className="mt-2 space-y-2 rounded-lg bg-gray-50 p-2.5 dark:bg-white/5">
                      <input
                        value={nombreCatEdit}
                        onChange={(e) => setNombreCatEdit(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs dark:border-white/10 dark:bg-white/5 dark:text-white"
                      />
                      <select
                        value={tipoCatEdit}
                        onChange={(e) => setTipoCatEdit(e.target.value as "fijo" | "variable")}
                        className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs dark:border-white/10 dark:bg-white/5 dark:text-white"
                      >
                        <option value="variable">Variable</option>
                        <option value="fijo">Fijo</option>
                      </select>
                      <div>
                        <label className="text-[11px] text-gray-400 dark:text-gray-500">Marca sugerida</label>
                        <select
                          value={c.tipo_marca_sugerido ?? ""}
                          onChange={(e) => guardarTipoSugerido(c.id, e.target.value)}
                          className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs dark:border-white/10 dark:bg-white/5 dark:text-white"
                        >
                          <option value="">— Ninguna —</option>
                          {TIPOS.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] text-gray-400 dark:text-gray-500">Ícono</label>
                        <IconoPicker value={c.icono ?? ""} onChange={(v) => guardarIconoCategoria(c.id, v)} />
                      </div>
                      <div>
                        <label className="text-[11px] text-gray-400 dark:text-gray-500">Color</label>
                        <SelectorColorCategoria value={c.color ?? ""} onChange={(v) => guardarColorCategoria(c.id, v)} />
                      </div>
                      <div className="flex items-center gap-3 pt-1">
                        <button onClick={() => guardarDatosCategoria(c.id)} className="text-[11px] font-semibold text-brand-from dark:text-white">
                          guardar
                        </button>
                        <button onClick={() => setEditandoDatosCat(null)} className="text-[11px] text-gray-400 dark:text-gray-500">
                          cerrar
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-800 dark:text-white">Marcas</h2>
            <button
              onClick={() => setMostrarForm((v) => !v)}
              className="shrink-0 rounded-full bg-brand-gradient px-3 py-1.5 text-xs font-semibold text-white"
            >
              {mostrarForm ? "Cancelar" : "+ Nueva marca"}
            </button>
          </div>
          <p className="mb-3 text-[11px] text-gray-400 dark:text-gray-500">
            Bancos, tiendas, servicios, suscripciones y más — con su logo, para elegir al pagar o al crear un item.
            Se comparte entre todas las cuentas.
          </p>

          {mostrarForm && (
            <form onSubmit={handleSubmit} className="mb-3 space-y-3 rounded-xl border border-gray-100 p-3 dark:border-white/10">
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400">Nombre</label>
                <input
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
                  placeholder="Ej: Banco Estado"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400">Tipo</label>
                <select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as TipoMarca)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
                >
                  {TIPOS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400">Logo (imagen)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400">O ícono (si no tienes un logo a mano)</label>
                <IconoPicker value={icono} onChange={setIcono} />
              </div>
              <button
                type="submit"
                disabled={guardando}
                className="w-full rounded-lg bg-brand-gradient py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {guardando ? "Guardando…" : "Guardar"}
              </button>
            </form>
          )}

          {marcas.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400 dark:text-gray-500">Todavía no hay marcas cargadas.</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-white/10">
              {marcas.map((m) => (
                <li key={m.id} className="py-2.5">
                  <div className="flex items-center gap-3">
                    {m.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.logo_url} alt={m.nombre} className="h-9 w-9 shrink-0 rounded-lg object-contain" />
                    ) : (
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base text-white"
                        style={{ backgroundColor: colorFor(m.nombre) }}
                      >
                        {m.icono || m.nombre.charAt(0)}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-800 dark:text-white">{m.nombre}</p>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500">{TIPOS.find((t) => t.value === m.tipo)?.label ?? m.tipo}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2.5">
                      <label className="cursor-pointer text-brand-from dark:text-white" aria-label={m.logo_url ? "cambiar logo" : "subir logo"}>
                        {subiendoId === m.id ? "…" : "🖼"}
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
                        aria-label="cambiar ícono"
                        className="text-brand-from dark:text-white"
                      >
                        ✎
                      </button>
                      <button onClick={() => eliminar(m)} aria-label="eliminar" className="text-gray-300 hover:text-red-400 dark:text-gray-600">
                        🗑
                      </button>
                    </div>
                  </div>
                  {editandoIconoMarca === m.id && (
                    <div className="mt-2 rounded-lg bg-gray-50 p-2.5 dark:bg-white/5">
                      <IconoPicker value={m.icono ?? ""} onChange={(v) => guardarIconoMarca(m.id, v)} />
                      <button onClick={() => setEditandoIconoMarca(null)} className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
                        listo
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[10.5px] text-gray-400 dark:text-gray-500">
            El ícono con el marco (🖼) sube un logo; el lápiz (✎) edita el ícono. Solo cuentas admin pueden escribir en
            este catálogo — se comparte entre todas las cuentas.
          </p>
        </Card>
      </div>
    </div>
  );
}
