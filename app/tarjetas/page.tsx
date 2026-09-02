"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/Card";
import { TarjetasCarousel } from "@/components/TarjetasCarousel";
import { TarjetaVisual, TIPO_LABEL } from "@/components/TarjetaVisual";
import { EntidadAvatar } from "@/components/EntidadAvatar";
import { Categoria, CompraVigente, Entidad, GastoFijo, Marca } from "@/lib/types";
import { colorFor } from "@/lib/avatarColor";
import { resolverMarca } from "@/lib/resolverMarca";
import { formatCLP, nombreMes } from "@/lib/format";
import { mensajeError } from "@/lib/supabaseError";

function traducirError(err: unknown): string {
  const msg = mensajeError(err);
  if (msg.includes("entidades_owner_id_nombre_tipo_key") || msg.includes("entidades_owner_id_nombre_key")) {
    return "Ya tienes una tarjeta o cuenta con ese nombre y ese mismo tipo. Si es distinta (ej. débito vs. crédito), cambia el Tipo; si son la misma, edítala en vez de crear otra.";
  }
  if (msg.includes("Bucket not found")) {
    return "Todavía falta correr la migración de Supabase que crea el almacenamiento de imágenes de tarjetas (migration_12_tarjetas_visuales.sql). Corre esa migración y vuelve a intentar subir la imagen.";
  }
  if (msg.includes("Could not find") && msg.includes("column")) {
    return `Todavía falta correr una migración de Supabase (revisa que hayas corrido migration_12 y migration_13, en orden) — falta una columna en la base de datos. Detalle: ${msg}`;
  }
  return msg || "No se pudo guardar. Intenta de nuevo.";
}

const TIPOS: { value: Entidad["tipo"]; label: string }[] = [
  { value: "tarjeta_credito", label: "Tarjeta de crédito" },
  { value: "tarjeta_debito", label: "Tarjeta de débito" },
  { value: "linea_credito", label: "Línea de crédito" },
  { value: "credito_hipotecario", label: "Crédito hipotecario" },
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
];

export default function TarjetasPage() {
  const [entidades, setEntidades] = useState<Entidad[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cuotas, setCuotas] = useState<CompraVigente[]>([]);
  const [gastosFijos, setGastosFijos] = useState<GastoFijo[]>([]);
  const [cargando, setCargando] = useState(true);

  const [activaId, setActivaId] = useState<string | null>(null);

  const [mostrarForm, setMostrarForm] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<Entidad["tipo"]>("tarjeta_credito");
  const [marcaId, setMarcaId] = useState("");
  const [marcaAutodetectada, setMarcaAutodetectada] = useState(false);
  const [colorHex, setColorHex] = useState<string | null>(null);
  const [imagenFondoUrl, setImagenFondoUrl] = useState<string | null>(null);
  const [archivoFondo, setArchivoFondo] = useState<File | null>(null);
  const [previewFondo, setPreviewFondo] = useState<string | null>(null);
  const [subiendoFondo, setSubiendoFondo] = useState(false);

  async function cargarTodo() {
    const [{ data: e }, { data: m }, { data: cat }, { data: c }, { data: gf }] = await Promise.all([
      supabase.from("entidades").select("*").order("nombre"),
      supabase.from("marcas").select("*").order("nombre"),
      supabase.from("categorias").select("*"),
      supabase.from("vista_cuotas_mes_actual").select("*"),
      supabase.from("gastos_fijos").select("*").eq("activo", true),
    ]);
    const listaEntidades = (e as Entidad[]) ?? [];
    setEntidades(listaEntidades);
    setMarcas((m as Marca[]) ?? []);
    setCategorias((cat as Categoria[]) ?? []);
    setCuotas((c as CompraVigente[]) ?? []);
    setGastosFijos((gf as GastoFijo[]) ?? []);
    setCargando(false);
    setActivaId((actual) => {
      if (actual && listaEntidades.some((x) => x.id === actual)) return actual;
      return listaEntidades[0]?.id ?? null;
    });
  }

  useEffect(() => {
    cargarTodo();
  }, []);

  // Revoca el object URL de la previsualización local cuando cambia o se
  // desmonta, para no dejar memoria colgando.
  useEffect(() => {
    return () => {
      if (previewFondo) URL.revokeObjectURL(previewFondo);
    };
  }, [previewFondo]);

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

  function onElegirArchivo(file: File | null) {
    setArchivoFondo(file);
    setPreviewFondo((anterior) => {
      if (anterior) URL.revokeObjectURL(anterior);
      return file ? URL.createObjectURL(file) : null;
    });
  }

  function quitarImagenFondo() {
    onElegirArchivo(null);
    setImagenFondoUrl(null);
  }

  function cancelarForm() {
    setMostrarForm(false);
    setEditandoId(null);
    setNombre("");
    setTipo("tarjeta_credito");
    setMarcaId("");
    setMarcaAutodetectada(false);
    setColorHex(null);
    setImagenFondoUrl(null);
    onElegirArchivo(null);
    setError("");
  }

  function iniciarEdicion(e: Entidad) {
    setEditandoId(e.id);
    setNombre(e.nombre);
    setTipo(e.tipo);
    setMarcaId(e.marca_id ?? "");
    setMarcaAutodetectada(false);
    setColorHex(e.color_hex ?? null);
    setImagenFondoUrl(e.imagen_fondo_url ?? null);
    onElegirArchivo(null);
    setMostrarForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setGuardando(true);
    try {
      let fondoUrlFinal = imagenFondoUrl;

      if (archivoFondo) {
        setSubiendoFondo(true);
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Sesión expirada, vuelve a iniciar sesión.");
        const ext = archivoFondo.name.split(".").pop() || "jpg";
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("tarjetas-fondos")
          .upload(path, archivoFondo, { upsert: false });
        if (uploadError) throw uploadError;
        const { data: pub } = supabase.storage.from("tarjetas-fondos").getPublicUrl(path);
        fondoUrlFinal = pub.publicUrl;
        setSubiendoFondo(false);
      }

      const payload = {
        nombre,
        tipo,
        marca_id: marcaId || null,
        color_hex: colorHex || null,
        imagen_fondo_url: fondoUrlFinal,
      };
      const { error: dbError } = editandoId
        ? await supabase.from("entidades").update(payload).eq("id", editandoId)
        : await supabase.from("entidades").insert(payload);
      if (dbError) throw dbError;
      cancelarForm();
      cargarTodo();
    } catch (err) {
      setError(traducirError(err));
    } finally {
      setSubiendoFondo(false);
      setGuardando(false);
    }
  }

  async function eliminar(id: string) {
    const { error: dbError } = await supabase.from("entidades").delete().eq("id", id);
    if (dbError) {
      setError(dbError.message || "No se pudo eliminar.");
      return;
    }
    cargarTodo();
  }

  const marcaDe = (id: string | null) => marcas.find((m) => m.id === id) ?? null;
  const categoriaNombre = (id: string | null) => categorias.find((c) => c.id === id)?.nombre ?? "Sin categoría";

  const gastoPorEntidad = useMemo(() => {
    const acc: Record<string, number> = {};
    cuotas.forEach((c) => {
      if (!c.entidad_id) return;
      acc[c.entidad_id] = (acc[c.entidad_id] ?? 0) + Number(c.monto_cuota);
    });
    gastosFijos.forEach((g) => {
      if (!g.entidad_id) return;
      acc[g.entidad_id] = (acc[g.entidad_id] ?? 0) + Number(g.monto_estimado);
    });
    return acc;
  }, [cuotas, gastosFijos]);

  const entidadActiva = entidades.find((e) => e.id === activaId) ?? null;
  const marcaActiva = resolverMarca(entidadActiva, marcas);

  const itemsActivos = useMemo(() => {
    if (!activaId) return [];
    return [
      ...cuotas
        .filter((c) => c.entidad_id === activaId)
        .map((c) => ({
          key: `c-${c.compra_id}`,
          descripcion: c.descripcion,
          categoria: categoriaNombre(c.categoria_id),
          detalle: `Cuota ${c.cuota_actual} de ${c.n_cuotas}`,
          monto: c.monto_cuota,
          marca_id: c.marca_id,
          icono: c.icono,
        })),
      ...gastosFijos
        .filter((g) => g.entidad_id === activaId)
        .map((g) => ({
          key: `g-${g.id}`,
          descripcion: g.descripcion,
          categoria: categoriaNombre(g.categoria_id),
          detalle: "Gasto fijo",
          monto: g.monto_estimado,
          marca_id: g.marca_id,
          icono: g.icono,
        })),
    ].sort((a, b) => b.monto - a.monto);
  }, [cuotas, gastosFijos, activaId, categorias]);

  if (cargando) {
    return <p className="py-10 text-center text-gray-400">Cargando…</p>;
  }

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
          <form onSubmit={handleSubmit} className="space-y-4">
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

            <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
              <p className="text-xs font-semibold text-gray-600">Diseño de la tarjeta</p>
              <p className="mt-0.5 text-[11px] text-gray-400">
                Sube una foto/captura del diseño real (ej. de tu banco), o elige un color — si no eliges nada, se
                usa un color automático.
              </p>

              <div className="mt-3">
                <TarjetaVisual
                  entidad={{
                    id: "preview",
                    nombre: nombre || "Nombre de la tarjeta",
                    tipo,
                    marca_id: marcaId || null,
                    color_hex: colorHex,
                    imagen_fondo_url: previewFondo ?? imagenFondoUrl,
                  }}
                  marca={marcaDe(marcaId)}
                  gastoMes={editandoId ? gastoPorEntidad[editandoId] ?? 0 : 0}
                  className="max-w-xs"
                />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-gray-600">
                  Color
                  <input
                    type="color"
                    value={colorHex || colorFor(nombre || "?")}
                    onChange={(e) => setColorHex(e.target.value)}
                    className="h-8 w-10 cursor-pointer rounded border border-gray-200 bg-white p-0.5"
                  />
                </label>
                {colorHex && (
                  <button type="button" onClick={() => setColorHex(null)} className="text-[11px] text-brand-from">
                    usar color automático
                  </button>
                )}

                <label className="cursor-pointer rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 hover:border-brand-from">
                  {previewFondo || imagenFondoUrl ? "Cambiar imagen" : "+ Subir imagen"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => onElegirArchivo(e.target.files?.[0] ?? null)}
                  />
                </label>
                {(previewFondo || imagenFondoUrl) && (
                  <button type="button" onClick={quitarImagenFondo} className="text-[11px] text-gray-400 hover:text-red-400">
                    quitar imagen
                  </button>
                )}
              </div>
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}
            <button
              type="submit"
              disabled={guardando}
              className="w-full rounded-lg bg-brand-gradient py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {guardando ? (subiendoFondo ? "Subiendo imagen…" : "Guardando…") : editandoId ? "Guardar cambios" : "Guardar"}
            </button>
          </form>
        </Card>
      )}

      {entidades.length === 0 ? (
        <p className="text-center text-sm text-gray-400">Aún no tienes tarjetas o cuentas creadas.</p>
      ) : (
        <>
          <TarjetasCarousel
            entidades={entidades}
            marcas={marcas}
            gastoPorEntidad={gastoPorEntidad}
            activaId={activaId}
            onCambiarActiva={setActivaId}
          />

          {entidadActiva && (
            <div className="flex items-center justify-between px-1">
              <p className="text-sm font-semibold text-gray-700">
                {entidadActiva.nombre} <span className="font-normal text-gray-400">· {TIPO_LABEL[entidadActiva.tipo]}</span>
              </p>
              <div className="flex shrink-0 items-center gap-3">
                <button onClick={() => iniciarEdicion(entidadActiva)} className="text-xs text-brand-from">
                  editar
                </button>
                <button onClick={() => eliminar(entidadActiva.id)} className="text-xs text-gray-300 hover:text-red-400">
                  eliminar
                </button>
              </div>
            </div>
          )}

          <Card>
            <p className="mb-1 text-sm font-semibold text-gray-600">Gastos con esta tarjeta</p>
            <p className="mb-3 text-xs capitalize text-gray-400">{nombreMes()}</p>
            {itemsActivos.length === 0 ? (
              <p className="py-2 text-sm text-gray-400">Sin gastos este mes con esta tarjeta.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {itemsActivos.map((it) => (
                  <li key={it.key} className="flex items-center gap-3 py-2.5">
                    <EntidadAvatar marca={marcaDe(it.marca_id) ?? marcaActiva} icono={it.icono} nombreFallback={it.descripcion} className="h-8 w-8" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-700">{it.descripcion}</p>
                      <p className="text-xs text-gray-400">
                        {it.categoria} · {it.detalle}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-gray-800">{formatCLP(it.monto)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {entidades.length > 1 && (
            <div>
              <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Todas tus tarjetas y cuentas
              </p>
              <div className="space-y-2">
                {entidades.map((e) => {
                  const marca = resolverMarca(e, marcas);
                  return (
                    <Card key={e.id} className={`!p-3 ${e.id === activaId ? "ring-1 ring-brand-from" : ""}`}>
                      <button type="button" onClick={() => setActivaId(e.id)} className="flex w-full items-center gap-3 text-left">
                        <EntidadAvatar entidad={e} marca={marca} className="h-9 w-9" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-gray-800">{e.nombre}</p>
                          <p className="text-xs text-gray-400">{TIPO_LABEL[e.tipo]}</p>
                        </div>
                        <p className="shrink-0 text-xs font-medium text-gray-500">
                          {formatCLP(gastoPorEntidad[e.id] ?? 0)}
                        </p>
                      </button>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
