"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/Card";
import { Categoria, Marca, SolicitudLogo, TipoMarca } from "@/lib/types";
import { colorFor } from "@/lib/avatarColor";
import { esAdmin as checkEsAdmin } from "@/components/navItems";
import { IconoPicker } from "@/components/IconoPicker";
import { SelectorColorCategoria } from "@/components/SelectorColorCategoria";
import { mensajeError } from "@/lib/supabaseError";

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

// Ronda 9 (bug reportado por Felipe: "al agregar una categoría, en marcas no
// me aparece la categoría recién creada"): `categorias.tipo_marca_sugerido` y
// `marcas.tipo` ya no están atados a esta lista fija de 17 (ver
// migration_39_tipos_marca_libres.sql — se le quitó el check constraint en la
// base de datos). TIPOS sigue siendo el catálogo BASE (los tipos "de
// fábrica"), pero ahora se puede escribir un tipo nuevo desde el selector
// ("+ Nuevo tipo…") tanto al crear/editar una categoría como al crear una
// marca, y ese tipo queda disponible de inmediato en ambos lados.

// Convierte texto libre en un slug estable para guardar en la base de datos
// (minúsculas, sin acentos, espacios/símbolos → "_"). Nunca vacío: si no
// queda nada usable, cae a "otro".
function slugTipo(texto: string): string {
  const slug = texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug || "otro";
}

// Para mostrar un tipo "custom" (guardado como slug) con una etiqueta
// legible cuando no está en TIPOS — ej. "casa_rodante" → "Casa rodante".
function tituloDesdeSlug(slug: string): string {
  return slug
    .split("_")
    .filter(Boolean)
    .map((palabra, i) => (i === 0 ? palabra.charAt(0).toUpperCase() + palabra.slice(1) : palabra))
    .join(" ");
}

// Selector de "tipo de marca" reutilizable con opción de crear uno nuevo al
// vuelo. Antes había un <select> con solo los 17 valores de TIPOS en cada uno
// de los 3 lugares que usan tipo de marca (categoría: alta y edición; marca:
// alta) — por eso una categoría nueva nunca podía introducir un tipo nuevo.
function SelectorTipoMarca({
  value,
  onChange,
  tiposDisponibles,
  permitirNinguna,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  tiposDisponibles: { value: string; label: string }[];
  permitirNinguna?: boolean;
  className?: string;
}) {
  const [creandoNuevo, setCreandoNuevo] = useState(false);
  const [nuevoTipo, setNuevoTipo] = useState("");
  const claseBase =
    className ?? "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white";

  if (creandoNuevo) {
    return (
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={nuevoTipo}
          onChange={(e) => setNuevoTipo(e.target.value)}
          placeholder="Ej: Mascotas"
          className={claseBase}
        />
        <button
          type="button"
          onClick={() => {
            onChange(slugTipo(nuevoTipo));
            setCreandoNuevo(false);
            setNuevoTipo("");
          }}
          className="shrink-0 text-xs font-semibold text-brand-from dark:text-white"
        >
          usar
        </button>
        <button
          type="button"
          onClick={() => {
            setCreandoNuevo(false);
            setNuevoTipo("");
          }}
          className="shrink-0 text-xs text-gray-400 dark:text-gray-500"
        >
          cancelar
        </button>
      </div>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => {
        if (e.target.value === "__nuevo__") {
          setCreandoNuevo(true);
          return;
        }
        onChange(e.target.value);
      }}
      className={claseBase}
    >
      {permitirNinguna && <option value="">— Ninguna —</option>}
      {tiposDisponibles.map((t) => (
        <option key={t.value} value={t.value}>
          {t.label}
        </option>
      ))}
      <option value="__nuevo__">+ Nuevo tipo…</option>
    </select>
  );
}

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
  const [tipoMarcaSugeridaCategoria, setTipoMarcaSugeridaCategoria] = useState("");

  // "Sugerir un logo" (Ronda 9): pedidos de logo de cualquier usuario (ver
  // migration_41_solicitudes_logo.sql y components/PerfilPropioCard.tsx) —
  // el admin los ve todos acá para saber qué marcas subir.
  const [solicitudesLogo, setSolicitudesLogo] = useState<SolicitudLogo[]>([]);
  const [resolviendoSolicitud, setResolviendoSolicitud] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const esAdmin = checkEsAdmin(session?.user?.email);

  // Tipos de marca disponibles: los 17 "de fábrica" (TIPOS) más cualquier
  // valor custom que ya exista en categorías o marcas cargadas (creado antes
  // desde "+ Nuevo tipo…") — así un tipo custom aparece como opción en TODOS
  // los selectores, no solo en el registro donde se creó.
  const tiposDisponibles = useMemo(() => {
    const extras = new Map<string, string>();
    for (const c of categorias) {
      if (c.tipo_marca_sugerido && !TIPOS.some((t) => t.value === c.tipo_marca_sugerido)) {
        extras.set(c.tipo_marca_sugerido, tituloDesdeSlug(c.tipo_marca_sugerido));
      }
    }
    for (const m of marcas) {
      if (m.tipo && !TIPOS.some((t) => t.value === m.tipo)) {
        extras.set(m.tipo, tituloDesdeSlug(m.tipo));
      }
    }
    return [...TIPOS, ...Array.from(extras, ([value, label]) => ({ value, label }))];
  }, [categorias, marcas]);

  async function cargarMarcas() {
    const { data } = await supabase.from("marcas").select("*").order("nombre");
    setMarcas((data as Marca[]) ?? []);
  }

  async function cargarCategorias() {
    const { data } = await supabase.from("categorias").select("*").order("nombre");
    setCategorias((data as Categoria[]) ?? []);
  }

  async function cargarSolicitudesLogo() {
    const { data } = await supabase.from("solicitudes_logo").select("*").order("created_at", { ascending: false });
    setSolicitudesLogo((data as SolicitudLogo[]) ?? []);
  }

  useEffect(() => {
    if (esAdmin) {
      cargarMarcas();
      cargarCategorias();
      cargarSolicitudesLogo();
    }
  }, [esAdmin]);

  async function marcarSolicitudResuelta(id: string) {
    setResolviendoSolicitud(id);
    await supabase.from("solicitudes_logo").update({ estado: "resuelta" }).eq("id", id);
    setResolviendoSolicitud(null);
    cargarSolicitudesLogo();
  }

  async function borrarSolicitud(id: string) {
    setResolviendoSolicitud(id);
    await supabase.from("solicitudes_logo").delete().eq("id", id);
    setResolviendoSolicitud(null);
    cargarSolicitudesLogo();
  }

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
        tipo_marca_sugerido: tipoMarcaSugeridaCategoria || null,
      });
      if (insertError) throw insertError;
      setMostrarFormCategoria(false);
      setNombreCategoria("");
      setTipoCategoria("variable");
      setIconoCategoria("");
      setColorCategoria("");
      setTipoMarcaSugeridaCategoria("");
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

      {/* "Logos solicitados" (Ronda 9) — pedidos de "Sugerir un logo"
          (cualquier usuario, ver components/PerfilPropioCard.tsx y
          migration_41_solicitudes_logo.sql). Solo se muestra si hay algo
          pendiente, para no ocupar espacio de siempre cuando no hay nada
          que revisar. */}
      {solicitudesLogo.some((s) => s.estado === "pendiente") && (
        <Card>
          <h2 className="mb-2 text-sm font-bold text-gray-800 dark:text-white">Logos solicitados</h2>
          <ul className="divide-y divide-gray-100 dark:divide-white/10">
            {solicitudesLogo
              .filter((s) => s.estado === "pendiente")
              .map((s) => {
                const marca = marcas.find((m) => m.id === s.marca_id);
                return (
                  <li key={s.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-800 dark:text-white">{marca?.nombre ?? "Marca borrada"}</p>
                      {s.nota && <p className="truncate text-[11px] text-gray-400 dark:text-gray-500">{s.nota}</p>}
                    </div>
                    <button
                      onClick={() => marcarSolicitudResuelta(s.id)}
                      disabled={resolviendoSolicitud === s.id}
                      className="shrink-0 text-xs font-semibold text-brand-from disabled:opacity-50 dark:text-white"
                    >
                      resuelto
                    </button>
                    <button
                      onClick={() => borrarSolicitud(s.id)}
                      disabled={resolviendoSolicitud === s.id}
                      className="shrink-0 text-gray-300 hover:text-red-400 disabled:opacity-50 dark:text-gray-600"
                      aria-label="descartar"
                    >
                      🗑
                    </button>
                  </li>
                );
              })}
          </ul>
          <p className="mt-2 text-[10.5px] text-gray-400 dark:text-gray-500">
            Subí el logo desde la lista de "Marcas" de abajo (el ícono con marco 🖼) y marcá el pedido como resuelto.
          </p>
        </Card>
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
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400">
                  Marca sugerida (opcional — qué tipo de marca se ofrece primero al usar esta categoría)
                </label>
                <SelectorTipoMarca
                  value={tipoMarcaSugeridaCategoria}
                  onChange={setTipoMarcaSugeridaCategoria}
                  tiposDisponibles={tiposDisponibles}
                  permitirNinguna
                />
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
                          ? `Marca sugerida: ${tiposDisponibles.find((t) => t.value === c.tipo_marca_sugerido)?.label ?? c.tipo_marca_sugerido}`
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
                        <SelectorTipoMarca
                          value={c.tipo_marca_sugerido ?? ""}
                          onChange={(v) => guardarTipoSugerido(c.id, v)}
                          tiposDisponibles={tiposDisponibles}
                          permitirNinguna
                          className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs dark:border-white/10 dark:bg-white/5 dark:text-white"
                        />
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
                <SelectorTipoMarca value={tipo} onChange={(v) => setTipo(v as TipoMarca)} tiposDisponibles={tiposDisponibles} />
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
                      <p className="text-[11px] text-gray-400 dark:text-gray-500">{tiposDisponibles.find((t) => t.value === m.tipo)?.label ?? m.tipo}</p>
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
