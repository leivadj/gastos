"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/Card";
import { IconoPicker } from "@/components/IconoPicker";
import { SelectorColorCategoria } from "@/components/SelectorColorCategoria";
import { SelectorTipoMarca } from "@/components/SelectorTipoMarca";
import { EntidadAvatar } from "@/components/EntidadAvatar";
import { colorCategoria } from "@/lib/colorCategoria";
import { mensajeError } from "@/lib/supabaseError";
import { generarSlugUnico, tituloDesdeSlug } from "@/lib/tiposMarca";
import { Categoria, Marca } from "@/lib/types";

// Ronda 10 — Felipe pidió unificar la gestión de categorías y marcas en un
// solo lugar ("dejar solo categorías en perfil/configuración/categorías"):
// antes esta pantalla era de solo lectura (una grilla de tiles) y mandaba a
// /admin (panel solo-admin, solo cómodo en escritorio) para cualquier
// cambio. Ahora ES el lugar: crear/editar/borrar categorías, y más abajo un
// listado de marcas donde se elige a qué categoría está asociada cada una
// (crear marcas nuevas y subirles su logo también, cuando el catálogo aún no
// las tiene). /admin sigue existiendo tal cual (accesible desde "Más" en el
// rail de escritorio, ver DesktopSidebar.tsx) por si hace falta, pero deja
// de ser el único camino.
//
// Cómo queda guardada la asociación marca↔categoría: NO se agregó una
// columna nueva (`marcas.categoria_id`) — se reutiliza el mecanismo que ya
// usa toda la app (categorias.tipo_marca_sugerido ↔ marcas.tipo, ver
// MarcaSugeridaPicker.tsx y EntidadPicker.tsx): cada categoría tiene un
// "tipo" propio (un slug, ej. "supermercado"), y asociar una marca a esa
// categoría es simplemente ponerle ese mismo tipo. Así esta pantalla queda
// 100% compatible con todo lo que ya funcionaba (nada se reescribe en otras
// pantallas) y no hace falta ninguna migración nueva. Para que CUALQUIER
// categoría pueda recibir una marca asociada (no solo las que ya tenían
// "marca sugerida" configurada desde /admin), el efecto `asegurarTipos` de
// abajo le genera un tipo propio a cualquier categoría que todavía no tenga
// uno, la primera vez que se abre esta pantalla — no cambia nada visible,
// solo completa un dato que faltaba.
//
// Nota sobre permisos: `categorias` es de escritura abierta a cualquier
// cuenta logueada (RLS `solo_autenticados`), pero `marcas` solo admite
// escritura de las 2 cuentas admin (ver ADMIN_EMAILS en navItems.tsx) — hoy
// eso incluye a las 2 únicas cuentas reales de la app, así que en la
// práctica no bloquea a nadie; si algún día se agrega una cuenta no-admin,
// un intento de crear/editar una marca desde acá mostrará el mismo error
// traducido que ya usan EntidadPicker/MarcaSugeridaPicker en ese caso.
export default function CategoriasPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  // --- Categorías: alta y edición ---
  const [mostrarFormCategoria, setMostrarFormCategoria] = useState(false);
  const [guardandoCategoria, setGuardandoCategoria] = useState(false);
  const [nombreCategoria, setNombreCategoria] = useState("");
  const [tipoCategoria, setTipoCategoria] = useState<"fijo" | "variable">("variable");
  const [iconoCategoria, setIconoCategoria] = useState("");
  const [colorCategoriaNueva, setColorCategoriaNueva] = useState("");
  const [editandoCatId, setEditandoCatId] = useState<string | null>(null);
  const [nombreCatEdit, setNombreCatEdit] = useState("");
  const [tipoCatEdit, setTipoCatEdit] = useState<"fijo" | "variable">("variable");

  // --- Marcas: alta y asociación a categoría ---
  const [mostrarFormMarca, setMostrarFormMarca] = useState(false);
  const [guardandoMarca, setGuardandoMarca] = useState(false);
  const [nombreMarca, setNombreMarca] = useState("");
  const [tipoMarcaNueva, setTipoMarcaNueva] = useState("otro");
  const [iconoMarca, setIconoMarca] = useState("");
  const [archivoMarca, setArchivoMarca] = useState<File | null>(null);
  const [editandoIconoMarcaId, setEditandoIconoMarcaId] = useState<string | null>(null);
  const [subiendoLogoId, setSubiendoLogoId] = useState<string | null>(null);

  const backfillEnCursoRef = useRef(false);

  async function cargarCategorias() {
    const { data } = await supabase.from("categorias").select("*").order("nombre");
    setCategorias((data as Categoria[]) ?? []);
  }

  async function cargarMarcas() {
    const { data } = await supabase.from("marcas").select("*").order("nombre");
    setMarcas((data as Marca[]) ?? []);
  }

  useEffect(() => {
    Promise.all([cargarCategorias(), cargarMarcas()]).then(() => setCargando(false));
  }, []);

  // Le genera un tipo propio (tipo_marca_sugerido) a cualquier categoría que
  // todavía no tenga uno, para que el selector "Categoría asociada" de
  // marcas (más abajo) pueda ofrecerla de inmediato — ver comentario grande
  // al inicio del archivo. Corre una sola vez por carga (se detiene sola en
  // cuanto ya no queda ninguna categoría sin tipo).
  useEffect(() => {
    if (cargando || backfillEnCursoRef.current) return;
    const faltantes = categorias.filter((c) => !c.tipo_marca_sugerido);
    if (faltantes.length === 0) return;
    backfillEnCursoRef.current = true;
    (async () => {
      const usados = new Set(categorias.map((c) => c.tipo_marca_sugerido).filter(Boolean) as string[]);
      for (const c of faltantes) {
        const slug = generarSlugUnico(c.nombre, usados);
        usados.add(slug);
        await supabase.from("categorias").update({ tipo_marca_sugerido: slug }).eq("id", c.id);
      }
      await cargarCategorias();
      backfillEnCursoRef.current = false;
    })();
  }, [cargando, categorias]);

  // Tipos disponibles para "Categoría asociada": uno por cada categoría (con
  // su nombre e ícono como etiqueta, para que elegir un tipo se lea como
  // elegir una categoría), más "Otro / sin categoría" y cualquier tipo viejo
  // que alguna marca ya tenga pero que no corresponda a ninguna categoría
  // actual (para que esa marca no "desaparezca" de su selector).
  const tiposDeCategoria = useMemo(() => {
    const vistos = new Set<string>();
    const lista: { value: string; label: string }[] = [];
    for (const c of categorias) {
      if (!c.tipo_marca_sugerido || vistos.has(c.tipo_marca_sugerido)) continue;
      vistos.add(c.tipo_marca_sugerido);
      lista.push({ value: c.tipo_marca_sugerido, label: `${c.icono ? c.icono + " " : ""}${c.nombre}` });
    }
    if (!vistos.has("otro")) {
      vistos.add("otro");
      lista.push({ value: "otro", label: "Otro / sin categoría" });
    }
    for (const m of marcas) {
      if (!m.tipo || vistos.has(m.tipo)) continue;
      vistos.add(m.tipo);
      lista.push({ value: m.tipo, label: tituloDesdeSlug(m.tipo) });
    }
    return lista;
  }, [categorias, marcas]);

  function traducirErrorCategoria(err: unknown, nombreIntentado: string, accion: "guardar" | "eliminar"): string {
    const msg = mensajeError(err);
    if (msg.includes("categorias_nombre_key")) {
      return `Ya existe una categoría llamada "${nombreIntentado}" — elige otro nombre o edita la que ya está en la lista.`;
    }
    if (accion === "eliminar" && msg.includes("violates foreign key constraint")) {
      return `"${nombreIntentado}" está en uso (algún gasto o compra la tiene asociada) — no se puede eliminar mientras esté en uso.`;
    }
    return msg || (accion === "eliminar" ? "No se pudo eliminar la categoría." : "No se pudo guardar la categoría.");
  }

  function traducirErrorMarca(err: unknown, nombreIntentado: string): string {
    const msg = mensajeError(err);
    if (msg.includes("marcas_nombre_key")) {
      return `Ya existe "${nombreIntentado}" en el catálogo (es compartido — buscala en la lista de abajo y editala ahí en vez de crearla de nuevo).`;
    }
    return msg || "No se pudo guardar la marca. ¿Tu cuenta tiene permiso de administrador?";
  }

  async function crearCategoria(e: FormEvent) {
    e.preventDefault();
    setError("");
    setGuardandoCategoria(true);
    try {
      const usados = new Set(categorias.map((c) => c.tipo_marca_sugerido).filter(Boolean) as string[]);
      const { error: insertError } = await supabase.from("categorias").insert({
        nombre: nombreCategoria,
        tipo: tipoCategoria,
        icono: iconoCategoria || null,
        color: colorCategoriaNueva || null,
        // Cada categoría nueva ya sale con su propio tipo de marca (ver
        // comentario grande arriba) — así queda disponible de inmediato en
        // "Categoría asociada" de marcas, sin un paso manual extra.
        tipo_marca_sugerido: generarSlugUnico(nombreCategoria, usados),
      });
      if (insertError) throw insertError;
      setMostrarFormCategoria(false);
      setNombreCategoria("");
      setTipoCategoria("variable");
      setIconoCategoria("");
      setColorCategoriaNueva("");
      await cargarCategorias();
    } catch (err) {
      setError(traducirErrorCategoria(err, nombreCategoria, "guardar"));
    } finally {
      setGuardandoCategoria(false);
    }
  }

  function iniciarEdicionCategoria(c: Categoria) {
    setError("");
    setEditandoCatId(c.id);
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
    setEditandoCatId(null);
    cargarCategorias();
  }

  async function guardarIconoCategoria(id: string, icono: string) {
    const { error: dbError } = await supabase.from("categorias").update({ icono: icono || null }).eq("id", id);
    if (dbError) {
      setError(dbError.message || "No se pudo guardar el ícono de la categoría.");
      return;
    }
    cargarCategorias();
  }

  async function guardarColorCategoria(id: string, color: string) {
    const { error: dbError } = await supabase.from("categorias").update({ color: color || null }).eq("id", id);
    if (dbError) {
      setError(dbError.message || "No se pudo guardar el color de la categoría.");
      return;
    }
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

  async function crearMarca(e: FormEvent) {
    e.preventDefault();
    setError("");
    setGuardandoMarca(true);
    try {
      let logoUrl: string | null = null;
      if (archivoMarca) {
        const ext = archivoMarca.name.split(".").pop();
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("marcas-logos").upload(path, archivoMarca, { upsert: false });
        if (uploadError) throw uploadError;
        const { data: pub } = supabase.storage.from("marcas-logos").getPublicUrl(path);
        logoUrl = pub.publicUrl;
      }
      const { error: insertError } = await supabase.from("marcas").insert({
        nombre: nombreMarca,
        tipo: tipoMarcaNueva,
        logo_url: logoUrl,
        icono: iconoMarca || null,
      });
      if (insertError) throw insertError;
      setMostrarFormMarca(false);
      setNombreMarca("");
      setTipoMarcaNueva("otro");
      setIconoMarca("");
      setArchivoMarca(null);
      await cargarMarcas();
    } catch (err) {
      setError(traducirErrorMarca(err, nombreMarca));
    } finally {
      setGuardandoMarca(false);
    }
  }

  async function asociarMarca(m: Marca, nuevoTipo: string) {
    setError("");
    const { error: updError } = await supabase.from("marcas").update({ tipo: nuevoTipo }).eq("id", m.id);
    if (updError) {
      setError(traducirErrorMarca(updError, m.nombre));
      return;
    }
    cargarMarcas();
  }

  async function guardarIconoMarca(id: string, nuevoIcono: string) {
    const { error: dbError } = await supabase.from("marcas").update({ icono: nuevoIcono || null }).eq("id", id);
    if (dbError) {
      setError(traducirErrorMarca(dbError, ""));
      return;
    }
    cargarMarcas();
  }

  async function cambiarLogoMarca(m: Marca, file: File) {
    setError("");
    setSubiendoLogoId(m.id);
    try {
      const ext = file.name.split(".").pop();
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("marcas-logos").upload(path, file, { upsert: false });
      if (uploadError) throw uploadError;
      const { data: pub } = supabase.storage.from("marcas-logos").getPublicUrl(path);
      const logoAnterior = m.logo_url;
      const { error: updateError } = await supabase.from("marcas").update({ logo_url: pub.publicUrl }).eq("id", m.id);
      if (updateError) throw updateError;
      if (logoAnterior) {
        const path2 = logoAnterior.split("/marcas-logos/")[1];
        if (path2) await supabase.storage.from("marcas-logos").remove([path2]);
      }
      cargarMarcas();
    } catch (err) {
      setError(traducirErrorMarca(err, m.nombre));
    } finally {
      setSubiendoLogoId(null);
    }
  }

  async function eliminarMarca(m: Marca) {
    setError("");
    const { error: delError } = await supabase.from("marcas").delete().eq("id", m.id);
    if (delError) {
      const msg = mensajeError(delError);
      setError(
        msg.includes("violates foreign key constraint")
          ? `"${m.nombre}" está en uso (alguna tarjeta/cuenta, gasto o compra la tiene asociada) — no se puede eliminar mientras esté en uso.`
          : traducirErrorMarca(delError, m.nombre)
      );
      return;
    }
    if (m.logo_url) {
      const path = m.logo_url.split("/marcas-logos/")[1];
      if (path) await supabase.storage.from("marcas-logos").remove([path]);
    }
    cargarMarcas();
  }

  if (cargando) {
    return <p className="py-10 text-center text-gray-400 dark:text-gray-500">Cargando…</p>;
  }

  return (
    <div className="space-y-5 pb-10">
      <h1 className="text-lg font-bold text-gray-800 dark:text-white">Categorías</h1>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-500 dark:bg-red-950/40 dark:text-red-400">{error}</p>
      )}

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-800 dark:text-white">Tus categorías</h2>
          <button
            onClick={() => setMostrarFormCategoria((v) => !v)}
            className="shrink-0 rounded-full bg-brand-gradient px-3 py-1.5 text-xs font-semibold text-white"
          >
            {mostrarFormCategoria ? "Cancelar" : "+ Nueva categoría"}
          </button>
        </div>

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
              <label className="text-xs text-gray-500 dark:text-gray-400">
                Color (opcional — si no eliges uno, se usa un color fijo por nombre)
              </label>
              <div className="mt-1">
                <SelectorColorCategoria value={colorCategoriaNueva} onChange={setColorCategoriaNueva} />
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
          <p className="py-4 text-center text-sm text-gray-400 dark:text-gray-500">Todavía no tienes categorías creadas.</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-white/10">
            {categorias.map((c) => (
              <li key={c.id} className="py-2.5">
                <div className="flex items-center gap-3">
                  <Link
                    href={`/categoria/${c.id}`}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base"
                    style={{ backgroundColor: `${colorCategoria(c)}26` }}
                  >
                    {c.icono || "•"}
                  </Link>
                  <Link href={`/categoria/${c.id}`} className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-800 dark:text-white">{c.nombre}</p>
                  </Link>
                  <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10.5px] font-semibold text-gray-500 dark:bg-white/10 dark:text-gray-400">
                    {c.tipo === "fijo" ? "Fijo" : "Variable"}
                  </span>
                  <div className="flex shrink-0 items-center gap-2.5">
                    <button
                      onClick={() => (editandoCatId === c.id ? setEditandoCatId(null) : iniciarEdicionCategoria(c))}
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

                {editandoCatId === c.id && (
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
                      <button onClick={() => setEditandoCatId(null)} className="text-[11px] text-gray-400 dark:text-gray-500">
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
            onClick={() => setMostrarFormMarca((v) => !v)}
            className="shrink-0 rounded-full bg-brand-gradient px-3 py-1.5 text-xs font-semibold text-white"
          >
            {mostrarFormMarca ? "Cancelar" : "+ Nueva marca"}
          </button>
        </div>
        <p className="mb-3 text-[11px] text-gray-400 dark:text-gray-500">
          Bancos, tiendas, servicios y suscripciones — elige a qué categoría está asociada cada una para que aparezca
          sugerida al usarla en un gasto o compra. Catálogo compartido entre todas las cuentas.
        </p>

        {mostrarFormMarca && (
          <form onSubmit={crearMarca} className="mb-3 space-y-3 rounded-xl border border-gray-100 p-3 dark:border-white/10">
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400">Nombre</label>
              <input
                required
                value={nombreMarca}
                onChange={(e) => setNombreMarca(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
                placeholder="Ej: Banco Estado"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400">Categoría asociada</label>
              <SelectorTipoMarca value={tipoMarcaNueva} onChange={setTipoMarcaNueva} tiposDisponibles={tiposDeCategoria} />
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400">Logo (imagen)</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setArchivoMarca(e.target.files?.[0] ?? null)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400">O ícono (si no tienes un logo a mano)</label>
              <IconoPicker value={iconoMarca} onChange={setIconoMarca} />
            </div>
            <button
              type="submit"
              disabled={guardandoMarca}
              className="w-full rounded-lg bg-brand-gradient py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {guardandoMarca ? "Guardando…" : "Guardar marca"}
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
                  <EntidadAvatar marca={m} nombreFallback={m.nombre} className="h-9 w-9" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-800 dark:text-white">{m.nombre}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2.5">
                    <label className="cursor-pointer text-brand-from dark:text-white" aria-label={m.logo_url ? "cambiar logo" : "subir logo"}>
                      {subiendoLogoId === m.id ? "…" : "🖼"}
                      <input
                        type="file"
                        accept="image/*"
                        disabled={subiendoLogoId === m.id}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) cambiarLogoMarca(m, file);
                          e.target.value = "";
                        }}
                        className="hidden"
                      />
                    </label>
                    <button
                      onClick={() => setEditandoIconoMarcaId(editandoIconoMarcaId === m.id ? null : m.id)}
                      aria-label="cambiar ícono"
                      className="text-brand-from dark:text-white"
                    >
                      ✎
                    </button>
                    <button onClick={() => eliminarMarca(m)} aria-label="eliminar" className="text-gray-300 hover:text-red-400 dark:text-gray-600">
                      🗑
                    </button>
                  </div>
                </div>
                <div className="mt-2">
                  <label className="text-[11px] text-gray-400 dark:text-gray-500">Categoría asociada</label>
                  <SelectorTipoMarca
                    value={m.tipo}
                    onChange={(v) => asociarMarca(m, v)}
                    tiposDisponibles={tiposDeCategoria}
                    className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs dark:border-white/10 dark:bg-white/5 dark:text-white"
                  />
                </div>
                {editandoIconoMarcaId === m.id && (
                  <div className="mt-2 rounded-lg bg-gray-50 p-2.5 dark:bg-white/5">
                    <IconoPicker value={m.icono ?? ""} onChange={(v) => guardarIconoMarca(m.id, v)} />
                    <button onClick={() => setEditandoIconoMarcaId(null)} className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
                      listo
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[10.5px] text-gray-400 dark:text-gray-500">
          El ícono con marco (🖼) sube un logo; el lápiz (✎) edita el ícono de respaldo (se usa solo si no hay logo).
        </p>
      </Card>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Ingresos</p>
        <p className="rounded-2xl border border-dashed border-gray-200 px-4 py-3 text-xs text-gray-400 dark:border-white/10 dark:text-gray-500">
          Los ingresos todavía no se clasifican por categoría — próximamente.
        </p>
      </div>
    </div>
  );
}
