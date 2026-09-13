"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/Card";
import { TarjetasCarousel } from "@/components/TarjetasCarousel";
import { TarjetaVisual, TIPO_LABEL } from "@/components/TarjetaVisual";
import { EntidadAvatar } from "@/components/EntidadAvatar";
import { Categoria, CompraVigente, Entidad, GastoFijo, Marca, Transferencia } from "@/lib/types";
import { colorFor } from "@/lib/avatarColor";
import { resolverMarca } from "@/lib/resolverMarca";
import { formatCLP, mesActualISO, nombreMes } from "@/lib/format";
import { mensajeError } from "@/lib/supabaseError";
import { avisarHojaPantallaCompleta } from "@/lib/sheetVisibility";

function traducirError(err: unknown): string {
  const msg = mensajeError(err);
  if (msg.includes("entidades_owner_id_nombre_tipo_key") || msg.includes("entidades_owner_id_nombre_key")) {
    return "Ya tienes una tarjeta o cuenta con ese nombre y ese mismo tipo. Si es distinta (ej. débito vs. crédito), cambia el Tipo; si son la misma, edítala en vez de crear otra.";
  }
  if (msg.includes("entidades_nombre_key")) {
    return "Todavía falta correr la migración de Supabase migration_16_elimina_unico_nombre_global.sql — hay una restricción vieja que exige que el nombre sea único entre TODAS las cuentas (no solo la tuya), y por eso bloquea nombres que ya usa otra cuenta. Corre esa migración y vuelve a intentar.";
  }
  if (msg.includes("Bucket not found")) {
    return "Todavía falta correr la migración de Supabase que crea el almacenamiento de imágenes de tarjetas (migration_12_tarjetas_visuales.sql). Corre esa migración y vuelve a intentar subir la imagen.";
  }
  if (msg.includes("Could not find") && msg.includes("column")) {
    return `Todavía falta correr una migración de Supabase (revisa que hayas corrido migration_12 y migration_13, en orden) — falta una columna en la base de datos. Detalle: ${msg}`;
  }
  if (msg.includes("entidades_ultimos_digitos_formato")) {
    return "Los últimos dígitos deben ser exactamente 4 números (ej. 5344).";
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
  const [transferencias, setTransferencias] = useState<Transferencia[]>([]);
  const [cargando, setCargando] = useState(true);

  const [activaId, setActivaId] = useState<string | null>(null);

  const [mostrarForm, setMostrarForm] = useState(false);
  // Mockup pág. 3 (Cuentas.dc.html) separa la lista (carrusel + botón "Ver
  // detalles de X") del detalle completo, que vive en una hoja aparte
  // (Tarjetas.dc.html, pág. 7) — antes esta pantalla mostraba el detalle
  // siempre visible debajo del carrusel, fusionando las dos pantallas.
  const [mostrarDetalle, setMostrarDetalle] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<Entidad["tipo"]>("tarjeta_credito");
  const [marcaId, setMarcaId] = useState("");
  const [marcaAutodetectada, setMarcaAutodetectada] = useState(false);
  const [saldo, setSaldo] = useState("");
  const [cupo, setCupo] = useState("");
  const [ultimosDigitos, setUltimosDigitos] = useState("");
  const [colorHex, setColorHex] = useState<string | null>(null);
  const [imagenFondoUrl, setImagenFondoUrl] = useState<string | null>(null);
  const [archivoFondo, setArchivoFondo] = useState<File | null>(null);
  const [previewFondo, setPreviewFondo] = useState<string | null>(null);
  const [subiendoFondo, setSubiendoFondo] = useState(false);

  async function cargarTodo() {
    const [{ data: e }, { data: m }, { data: cat }, { data: c }, { data: gf }, { data: t }] = await Promise.all([
      supabase.from("entidades").select("*").order("nombre"),
      supabase.from("marcas").select("*").order("nombre"),
      supabase.from("categorias").select("*"),
      supabase.from("vista_cuotas_mes_actual").select("*"),
      supabase.from("gastos_fijos").select("*").eq("activo", true),
      supabase.from("transferencias").select("*"),
    ]);
    const listaEntidades = (e as Entidad[]) ?? [];
    setEntidades(listaEntidades);
    setMarcas((m as Marca[]) ?? []);
    setCategorias((cat as Categoria[]) ?? []);
    setCuotas((c as CompraVigente[]) ?? []);
    setGastosFijos((gf as GastoFijo[]) ?? []);
    setTransferencias((t as Transferencia[]) ?? []);
    setCargando(false);
    setActivaId((actual) => {
      if (actual && listaEntidades.some((x) => x.id === actual)) return actual;
      return listaEntidades[0]?.id ?? null;
    });
  }

  useEffect(() => {
    cargarTodo();
    // Acceso directo desde "Tu perfil" (/personas): abre el formulario de
    // nueva tarjeta directamente, sin pasos extra. Se lee así (en vez de
    // useSearchParams) para no forzar un límite de Suspense en la página.
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("nueva") === "1") {
      setMostrarForm(true);
    }
  }, []);

  // Revoca el object URL de la previsualización local cuando cambia o se
  // desmonta, para no dejar memoria colgando.
  useEffect(() => {
    return () => {
      if (previewFondo) URL.revokeObjectURL(previewFondo);
    };
  }, [previewFondo]);

  // Mientras el detalle de la cuenta está abierto (hoja de pantalla
  // completa), se oculta BottomNav — ver lib/sheetVisibility.ts.
  useEffect(() => {
    avisarHojaPantallaCompleta(mostrarDetalle);
    return () => {
      if (mostrarDetalle) avisarHojaPantallaCompleta(false);
    };
  }, [mostrarDetalle]);

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
    setSaldo("");
    setCupo("");
    setUltimosDigitos("");
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
    setSaldo(e.saldo != null ? String(e.saldo) : "");
    setCupo(e.cupo != null ? String(e.cupo) : "");
    setUltimosDigitos(e.ultimos_digitos ?? "");
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
        saldo: saldo.trim() === "" ? null : Number(saldo),
        cupo: cupo.trim() === "" ? null : Number(cupo),
        ultimos_digitos: ultimosDigitos.trim() === "" ? null : ultimosDigitos.trim(),
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

  // Cupo disponible por tarjeta de crédito (ver migration_28_cupo_tarjetas.sql):
  // usado = deuda pendiente REAL de cuotas vigentes (todas las cuotas que
  // faltan de cada compra, no solo la de este mes — a diferencia de
  // gastoPorEntidad arriba) + gastos fijos activos ahí, menos lo que ya se
  // haya abonado con "↔ Transferencia" hacia esa tarjeta. disponible = cupo
  // - usado, nunca negativo. Solo trae valor para entidades con cupo puesto.
  const disponiblePorEntidad = useMemo(() => {
    const deudaCuotas: Record<string, number> = {};
    cuotas.forEach((c) => {
      if (!c.entidad_id) return;
      const cuotasRestantes = c.n_cuotas - c.cuota_actual + 1;
      deudaCuotas[c.entidad_id] = (deudaCuotas[c.entidad_id] ?? 0) + Number(c.monto_cuota) * cuotasRestantes;
    });
    const deudaFijos: Record<string, number> = {};
    gastosFijos.forEach((g) => {
      if (!g.entidad_id) return;
      deudaFijos[g.entidad_id] = (deudaFijos[g.entidad_id] ?? 0) + Number(g.monto_estimado);
    });
    const abonos: Record<string, number> = {};
    transferencias.forEach((t) => {
      if (!t.cuenta_destino_id) return;
      abonos[t.cuenta_destino_id] = (abonos[t.cuenta_destino_id] ?? 0) + Number(t.monto);
    });
    const acc: Record<string, number> = {};
    entidades.forEach((e) => {
      if (e.tipo !== "tarjeta_credito" || e.cupo == null) return;
      const usado = Math.max(0, (deudaCuotas[e.id] ?? 0) + (deudaFijos[e.id] ?? 0) - (abonos[e.id] ?? 0));
      acc[e.id] = Math.max(0, e.cupo - usado);
    });
    return acc;
  }, [cuotas, gastosFijos, transferencias, entidades]);

  const entidadActiva = entidades.find((e) => e.id === activaId) ?? null;
  const marcaActiva = resolverMarca(entidadActiva, marcas);
  const nombreEntidad = (id: string | null) => entidades.find((e) => e.id === id)?.nombre ?? "otra cuenta";

  // Suma solo las cuentas a las que el usuario ya les puso un saldo (es
  // manual/opcional, no todas lo van a tener necesariamente).
  const totalSaldo = useMemo(
    () => entidades.reduce((acc, e) => acc + (e.saldo ?? 0), 0),
    [entidades]
  );
  const hayAlgunSaldo = entidades.some((e) => e.saldo != null);

  // "Saldo disponible / Ingresos este mes / Gastos este mes" (mockup PDF pág.
  // 7, sheet de detalle de cuenta): ingresos = transferencias que ENTRARON a
  // esta cuenta este mes (no hay otro "ingreso" ligado a una cuenta puntual
  // en el esquema real); gastos = lo recurrente cargado ahí (cuotas + gastos
  // fijos, ya calculado arriba en gastoPorEntidad) más las transferencias que
  // SALIERON de esta cuenta este mes.
  const prefijoMesActual = mesActualISO().slice(0, 7);
  const ingresosCuentaActivaMes = useMemo(() => {
    if (!activaId) return 0;
    return transferencias
      .filter((t) => t.cuenta_destino_id === activaId && t.fecha.slice(0, 7) === prefijoMesActual)
      .reduce((acc, t) => acc + Number(t.monto), 0);
  }, [transferencias, activaId, prefijoMesActual]);
  const gastosCuentaActivaMes = useMemo(() => {
    if (!activaId) return 0;
    const salidas = transferencias
      .filter((t) => t.cuenta_origen_id === activaId && t.fecha.slice(0, 7) === prefijoMesActual)
      .reduce((acc, t) => acc + Number(t.monto), 0);
    return (gastoPorEntidad[activaId] ?? 0) + salidas;
  }, [transferencias, gastoPorEntidad, activaId, prefijoMesActual]);

  // Exportar (mockup pág. 7, botón "Exportar" en el detalle de cuenta): CSV
  // simple de los movimientos que se están viendo debajo ("itemsActivos"),
  // se genera y descarga en el momento, sin backend.
  function exportarMovimientosCSV() {
    if (!entidadActiva) return;
    const filas = [
      ["Descripción", "Categoría", "Detalle", "Monto"],
      ...itemsActivos.map((it) => [it.descripcion, it.categoria, it.detalle, String(it.signo * it.monto)]),
    ];
    const csv = filas.map((f) => f.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `movimientos-${entidadActiva.nombre.toLowerCase().replace(/\s+/g, "-")}-${prefijoMesActual}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

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
          signo: -1 as const,
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
          signo: -1 as const,
          marca_id: g.marca_id,
          icono: g.icono,
        })),
      ...transferencias
        .filter((t) => t.cuenta_origen_id === activaId || t.cuenta_destino_id === activaId)
        .map((t) => {
          const esSalida = t.cuenta_origen_id === activaId;
          return {
            key: `t-${t.id}`,
            descripcion: t.notas || (esSalida ? "Transferencia enviada" : "Transferencia recibida"),
            categoria: "Transferencia",
            detalle: esSalida ? `Hacia ${nombreEntidad(t.cuenta_destino_id)}` : `Desde ${nombreEntidad(t.cuenta_origen_id)}`,
            monto: Number(t.monto),
            signo: (esSalida ? -1 : 1) as -1 | 1,
            marca_id: null,
            icono: esSalida ? "↗️" : "↙️",
          };
        }),
    ].sort((a, b) => b.monto - a.monto);
  }, [cuotas, gastosFijos, transferencias, activaId, categorias, entidades]);

  if (cargando) {
    return <p className="py-10 text-center text-gray-400 dark:text-gray-500">Cargando…</p>;
  }

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-800 dark:text-white">Tus tarjetas y cuentas</h1>
          <p className="text-xs text-gray-400 dark:text-gray-500">Bancos, casas comerciales, efectivo — las que uses para pagar.</p>
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
              <label className="text-xs text-gray-500 dark:text-gray-400">Elegir del catálogo (opcional)</label>
              <div className="mt-1 grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
                {marcas
                  .filter((m) => m.tipo === "banco" || m.tipo === "casa_comercial" || m.tipo === "caja_compensacion")
                  .map((m) => (
                  <button
                    type="button"
                    key={m.id}
                    onClick={() => elegirMarca(m.id === marcaId ? "" : m.id)}
                    className={`flex flex-col items-center gap-1 rounded-lg border p-2 ${
                      marcaId === m.id ? "border-brand-from bg-gray-50 dark:bg-white/10 dark:text-white" : "border-gray-200 dark:border-white/10"
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
                    <span className="text-center text-[10px] text-gray-600 dark:text-gray-300">{m.nombre}</span>
                  </button>
                ))}
              </div>
              {marcas.length === 0 && (
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  Todavía no hay marcas cargadas — puedes seguir y escribir el nombre a mano.
                </p>
              )}
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400">Nombre</label>
              <input
                required
                value={nombre}
                onChange={(e) => onNombreChange(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
                placeholder="Ej: Falabella"
              />
              {marcaAutodetectada && (
                <p className="mt-1 text-[11px] text-black dark:text-white">
                  ✓ Coincide con &quot;{marcaDe(marcaId)?.nombre}&quot; del catálogo — se usará su logo.
                </p>
              )}
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400">Tipo</label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as Entidad["tipo"])}
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
              <label className="text-xs text-gray-500 dark:text-gray-400">Saldo actual (opcional)</label>
              <input
                type="number"
                value={saldo}
                onChange={(e) => setSaldo(e.target.value)}
                placeholder="Ej: 250000"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
              <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
                Lo actualizas tú a mano cuando quieras — no se calcula solo a partir de tus gastos.
              </p>
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400">Últimos 4 dígitos (opcional)</label>
              <input
                value={ultimosDigitos}
                onChange={(e) => setUltimosDigitos(e.target.value.replace(/\D/g, "").slice(0, 4))}
                inputMode="numeric"
                placeholder="Ej: 5344"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
              <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
                Para reconocerla de un vistazo (se muestra como &quot;•••• {ultimosDigitos || "1234"}&quot;).
              </p>
            </div>
            {tipo === "tarjeta_credito" && (
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400">Cupo (límite de crédito, opcional)</label>
                <input
                  type="number"
                  value={cupo}
                  onChange={(e) => setCupo(e.target.value)}
                  placeholder="Ej: 1500000"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
                />
                <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
                  Con esto puesto, la tarjeta te muestra sola cuánto cupo te queda disponible: se calcula a partir de
                  las cuotas y gastos fijos activos ahí, y se libera cuando le haces un abono con &quot;↔
                  Transferencia&quot; desde tu banco.
                </p>
              </div>
            )}

            <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3 dark:border-white/10 dark:bg-white/5">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">Diseño de la tarjeta</p>
              <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
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
                    saldo: saldo.trim() === "" ? null : Number(saldo),
                    cupo: cupo.trim() === "" ? null : Number(cupo),
                    ultimos_digitos: ultimosDigitos.trim() === "" ? null : ultimosDigitos.trim(),
                    color_hex: colorHex,
                    imagen_fondo_url: previewFondo ?? imagenFondoUrl,
                  }}
                  marca={marcaDe(marcaId)}
                  gastoMes={editandoId ? gastoPorEntidad[editandoId] ?? 0 : 0}
                  className="max-w-xs"
                />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                  Color
                  <input
                    type="color"
                    value={colorHex || colorFor(nombre || "?")}
                    onChange={(e) => setColorHex(e.target.value)}
                    className="h-8 w-10 cursor-pointer rounded border border-gray-200 bg-white p-0.5 dark:border-white/10 dark:bg-gray-800"
                  />
                </label>
                {colorHex && (
                  <button type="button" onClick={() => setColorHex(null)} className="text-[11px] text-brand-from dark:text-white">
                    usar color automático
                  </button>
                )}

                <label className="cursor-pointer rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 hover:border-brand-from dark:border-white/10 dark:bg-gray-800 dark:text-gray-300">
                  {previewFondo || imagenFondoUrl ? "Cambiar imagen" : "+ Subir imagen"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => onElegirArchivo(e.target.files?.[0] ?? null)}
                  />
                </label>
                {(previewFondo || imagenFondoUrl) && (
                  <button type="button" onClick={quitarImagenFondo} className="text-[11px] text-gray-400 hover:text-red-400 dark:text-gray-500">
                    quitar imagen
                  </button>
                )}
              </div>
            </div>

            {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
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
        <p className="text-center text-sm text-gray-400 dark:text-gray-500">Aún no tienes tarjetas o cuentas creadas.</p>
      ) : (
        <>
          {hayAlgunSaldo && (
            <Card className="!py-3">
              <p className="text-xs text-gray-400 dark:text-gray-500">Total en tus cuentas</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-white">{formatCLP(totalSaldo)}</p>
              <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
                Solo suma las cuentas a las que ya les pusiste un saldo.
              </p>
            </Card>
          )}

          <TarjetasCarousel
            entidades={entidades}
            marcas={marcas}
            gastoPorEntidad={gastoPorEntidad}
            disponiblePorEntidad={disponiblePorEntidad}
            activaId={activaId}
            onCambiarActiva={setActivaId}
          />

          {entidadActiva && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setMostrarDetalle(true)}
                className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-gray-200"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="6" width="18" height="13" rx="2.5" />
                  <path d="M3 10h18" />
                </svg>
                Ver detalles de {entidadActiva.nombre}
              </button>
            </div>
          )}

          <Card>
            <div className="mb-1 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">Movimientos</p>
              <a href="/movimientos" className="shrink-0 text-xs font-semibold text-brand-from dark:text-white">
                Ver todos
              </a>
            </div>
            {itemsActivos.length === 0 ? (
              <p className="py-2 text-sm text-gray-400 dark:text-gray-500">Sin movimientos este mes con esta cuenta.</p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-white/10">
                {itemsActivos.slice(0, 4).map((it) => (
                  <li key={it.key} className="flex items-center gap-3 py-2.5">
                    <EntidadAvatar marca={marcaDe(it.marca_id) ?? marcaActiva} icono={it.icono} nombreFallback={it.descripcion} className="h-8 w-8" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-700 dark:text-gray-200">{it.descripcion}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {it.categoria} · {it.detalle}
                      </p>
                    </div>
                    <p className={`shrink-0 text-sm font-semibold ${it.signo === 1 ? "text-ingreso" : "text-gasto"}`}>
                      {it.signo === 1 ? "+" : "-"}
                      {formatCLP(it.monto)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      {mostrarDetalle && entidadActiva && createPortal(
        // createPortal: se monta como hijo directo de <body>, así la hoja
        // siempre queda fija sobre el viewport actual sin importar el
        // scroll o el contenedor donde React la haya insertado en el árbol
        // (antes quedaba encajonada/desplazada por el layout de escritorio
        // con overflow-y-auto que envuelve el contenido, ver AuthGate.tsx).
        // "100vh" en el celular incluye el área que queda tapada por la
        // barra de direcciones/el home indicator cuando están visibles —
        // eso hacía que esta hoja (anclada abajo con items-end) se dibujara
        // más alta que el área realmente visible, empujando su parte de
        // arriba (donde vive el botón ✕, sticky) por encima de lo que se
        // ve, y dejando un hueco en blanco abajo una vez el navegador
        // recalculaba. "dvh" (dynamic viewport height) sigue el tamaño
        // REAL visible en cada momento, así que la hoja completa (header +
        // botón cerrar) siempre cabe en pantalla. Mismo motivo por el que
        // se agrega "px-0 sm:px-4" al fondo: en el celular (angosto) la
        // hoja debe cubrir el ancho completo de borde a borde; recién en
        // sm: (ya se ve como modal centrado) tiene sentido dejarle aire a
        // los costados.
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 px-0 backdrop-blur-sm sm:items-center sm:px-4"
          onClick={() => setMostrarDetalle(false)}
        >
          <div
            className="max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl bg-white text-gray-800 shadow-2xl dark:bg-[#111113] dark:text-white sm:max-w-md sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header sticky: antes se desplazaba junto con el resto del
                contenido dentro de este mismo panel con scroll, así que al
                bajar a ver los movimientos el botón de cerrar (✕) quedaba
                fuera de la pantalla y no había forma de cerrar la hoja sin
                volver a subir el scroll del todo. */}
            <div className="sticky top-0 z-10 flex items-start justify-between gap-2 rounded-t-3xl bg-white p-5 pb-3 dark:bg-[#111113] sm:rounded-t-3xl">
              <div className="min-w-0">
                <p className="truncate text-base font-bold">{entidadActiva.nombre}</p>
                <p className="text-xs text-gray-400 dark:text-white/50">
                  {TIPO_LABEL[entidadActiva.tipo]}
                  {entidadActiva.ultimos_digitos && ` · •••• ${entidadActiva.ultimos_digitos}`}
                </p>
              </div>
              <button
                onClick={() => setMostrarDetalle(false)}
                aria-label="Cerrar"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-white/10"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-0">
              {entidadActiva.tipo === "tarjeta_credito" && entidadActiva.cupo != null ? (
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-white/50">Cupo disponible</p>
                  <p className="text-3xl font-bold">{formatCLP(disponiblePorEntidad[entidadActiva.id] ?? entidadActiva.cupo)}</p>
                  <p className="mt-0.5 text-xs text-gray-400 dark:text-white/50">de {formatCLP(entidadActiva.cupo)}</p>
                </div>
              ) : entidadActiva.saldo != null ? (
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-white/50">Saldo disponible</p>
                  <p className="text-3xl font-bold">{formatCLP(entidadActiva.saldo)}</p>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-2xl bg-gray-50 p-3.5 dark:bg-white/5">
                  <p className="text-[11px] text-gray-400 dark:text-white/50">Ingresos este mes</p>
                  <p className="mt-0.5 text-sm font-bold text-ingreso">+{formatCLP(ingresosCuentaActivaMes)}</p>
                </div>
                <div className="rounded-2xl bg-gray-50 p-3.5 dark:bg-white/5">
                  <p className="text-[11px] text-gray-400 dark:text-white/50">Gastos este mes</p>
                  <p className="mt-0.5 text-sm font-bold text-gasto">-{formatCLP(gastosCuentaActivaMes)}</p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-white/50">Movimientos de esta cuenta</p>
                {itemsActivos.length === 0 ? (
                  <p className="py-1 text-sm text-gray-400 dark:text-white/40">Sin movimientos este mes con esta cuenta.</p>
                ) : (
                  <ul className="divide-y divide-gray-100 dark:divide-white/10">
                    {itemsActivos.map((it) => (
                      <li key={it.key} className="flex items-center gap-3 py-2.5">
                        <EntidadAvatar marca={marcaDe(it.marca_id) ?? marcaActiva} icono={it.icono} nombreFallback={it.descripcion} className="h-9 w-9" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{it.descripcion}</p>
                          <p className="text-xs text-gray-400 dark:text-white/50">
                            {it.categoria} · {it.detalle}
                          </p>
                        </div>
                        <p className={`shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold dark:bg-white/10 ${it.signo === 1 ? "text-ingreso" : "text-gasto"}`}>
                          {it.signo === 1 ? "+" : "-"}
                          {formatCLP(it.monto)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex gap-2.5 pt-1">
                <button
                  onClick={exportarMovimientosCSV}
                  disabled={itemsActivos.length === 0}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-gray-100 py-3 text-xs font-bold disabled:opacity-40 dark:bg-white/10"
                >
                  Exportar
                </button>
                <button
                  onClick={() => {
                    setMostrarDetalle(false);
                    iniciarEdicion(entidadActiva);
                  }}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-gray-100 py-3 text-xs font-bold dark:bg-white/10"
                >
                  Editar
                </button>
                <button
                  onClick={() => {
                    setMostrarDetalle(false);
                    eliminar(entidadActiva.id);
                  }}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-gasto/10 py-3 text-xs font-bold text-gasto"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
