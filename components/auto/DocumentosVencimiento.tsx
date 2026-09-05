"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/Card";
import { EntidadAvatar } from "@/components/EntidadAvatar";
import { mensajeError } from "@/lib/supabaseError";
import { DocumentoAuto, TipoDocumentoAuto } from "@/lib/types";

const TIPO_INFO: Record<TipoDocumentoAuto, { label: string; icono: string }> = {
  permiso_circulacion: { label: "Permiso de circulación", icono: "🚗" },
  revision_tecnica: { label: "Revisión técnica", icono: "🔧" },
  seguro: { label: "Seguro", icono: "🛡️" },
  otro: { label: "Otro documento", icono: "📄" },
};

const TIPOS_ORDEN: TipoDocumentoAuto[] = ["permiso_circulacion", "revision_tecnica", "seguro", "otro"];

// Días hasta la fecha (negativo = ya pasó). Misma lógica que /metas-ahorro,
// calculada por texto para no toparse con el corrimiento de zona horaria.
function diasHasta(fechaISO: string): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const obj = new Date(`${fechaISO}T00:00:00`);
  return Math.round((obj.getTime() - hoy.getTime()) / 86400000);
}

function fechaLarga(fechaISO: string): string {
  const fecha = new Date(`${fechaISO.slice(0, 10)}T00:00:00`);
  return new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "long", year: "numeric" }).format(fecha);
}

type Estado = "vencido" | "pronto" | "vigente";

function estadoDe(dias: number): Estado {
  if (dias < 0) return "vencido";
  if (dias <= 30) return "pronto";
  return "vigente";
}

const ESTADO_ESTILO: Record<Estado, string> = {
  vencido: "bg-red-50 text-red-500 dark:bg-red-950/40 dark:text-red-400",
  pronto: "bg-amber-50 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300",
  vigente: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300",
};

function estadoTexto(dias: number, estado: Estado): string {
  if (estado === "vencido") return `Venció hace ${-dias} día${-dias === 1 ? "" : "s"}`;
  if (dias === 0) return "Vence hoy";
  return `Vence en ${dias} día${dias === 1 ? "" : "s"}`;
}

const hoyISO = () => new Date().toISOString().slice(0, 10);

// Sección de /auto para trackear documentos con vencimiento anual (permiso
// de circulación, revisión técnica, seguro, u otro libre) — distinto de los
// gastos sueltos (bencina, mecánico, mantención) que se cargan más abajo
// con DiariosLista. Al renovar un documento se edita la fecha del mismo
// registro en vez de crear uno nuevo cada año (ver migration_23).
export function DocumentosVencimiento() {
  const [documentos, setDocumentos] = useState<DocumentoAuto[]>([]);
  const [cargando, setCargando] = useState(true);

  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const [tipo, setTipo] = useState<TipoDocumentoAuto>("permiso_circulacion");
  const [nombre, setNombre] = useState("");
  const [nombreTocado, setNombreTocado] = useState(false);
  const [fechaVencimiento, setFechaVencimiento] = useState(hoyISO());
  const [notas, setNotas] = useState("");

  async function cargarTodo() {
    const { data } = await supabase
      .from("documentos_auto")
      .select("*")
      .order("fecha_vencimiento", { ascending: true });
    setDocumentos((data as DocumentoAuto[]) ?? []);
    setCargando(false);
  }

  useEffect(() => {
    cargarTodo();
  }, []);

  function elegirTipo(t: TipoDocumentoAuto) {
    setTipo(t);
    // Para los 3 tipos sugeridos el nombre no se edita a mano (el campo ni
    // se muestra), así que siempre sigue la etiqueta del tipo. Solo "otro"
    // deja el nombre a mano — mientras no se haya tocado, también sigue la
    // etiqueta por defecto para no dejar el campo vacío.
    if (t !== "otro" || !nombreTocado) setNombre(TIPO_INFO[t].label);
    if (t !== "otro") setNombreTocado(false);
  }

  function onNombreChange(valor: string) {
    setNombre(valor);
    setNombreTocado(true);
  }

  function cancelarForm() {
    setMostrarForm(false);
    setEditandoId(null);
    setTipo("permiso_circulacion");
    setNombre(TIPO_INFO.permiso_circulacion.label);
    setNombreTocado(false);
    setFechaVencimiento(hoyISO());
    setNotas("");
    setError("");
  }

  function abrirNuevo() {
    cancelarForm();
    setMostrarForm(true);
  }

  function iniciarEdicion(d: DocumentoAuto) {
    setEditandoId(d.id);
    setTipo(d.tipo);
    setNombre(d.nombre);
    setNombreTocado(true);
    setFechaVencimiento(d.fecha_vencimiento);
    setNotas(d.notas ?? "");
    setMostrarForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setGuardando(true);
    try {
      const payload = {
        tipo,
        nombre: nombre.trim() || TIPO_INFO[tipo].label,
        fecha_vencimiento: fechaVencimiento,
        notas: notas.trim() || null,
      };
      const { error: dbError } = editandoId
        ? await supabase.from("documentos_auto").update(payload).eq("id", editandoId)
        : await supabase.from("documentos_auto").insert(payload);
      if (dbError) throw dbError;
      cancelarForm();
      cargarTodo();
    } catch (err) {
      setError(mensajeError(err) || "No se pudo guardar. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(id: string) {
    const { error: dbError } = await supabase.from("documentos_auto").delete().eq("id", id);
    if (dbError) {
      setError(dbError.message || "No se pudo eliminar.");
      return;
    }
    cargarTodo();
  }

  if (cargando) {
    return <p className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">Cargando…</p>;
  }

  const urgentes = documentos.filter((d) => estadoDe(diasHasta(d.fecha_vencimiento)) !== "vigente");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Documentos con vencimiento</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">Permiso de circulación, revisión técnica, seguro…</p>
        </div>
        <button
          onClick={() => (mostrarForm ? cancelarForm() : abrirNuevo())}
          className="rounded-full bg-brand-gradient px-4 py-1.5 text-xs font-semibold text-white"
        >
          {mostrarForm ? "Cancelar" : "+ Nuevo"}
        </button>
      </div>

      {!mostrarForm && urgentes.length > 0 && (
        <Card className="border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/40 !py-3">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">⚠️ Por vencer o vencidos</p>
          <ul className="mt-1 space-y-0.5 text-xs text-amber-700 dark:text-amber-300">
            {urgentes.map((d) => (
              <li key={d.id}>
                {TIPO_INFO[d.tipo].icono} {d.nombre} — {estadoTexto(diasHasta(d.fecha_vencimiento), estadoDe(diasHasta(d.fecha_vencimiento)))}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {mostrarForm && (
        <Card>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400">Tipo de documento</label>
              <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {TIPOS_ORDEN.map((t) => (
                  <button
                    type="button"
                    key={t}
                    onClick={() => elegirTipo(t)}
                    className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-center ${
                      tipo === t ? "border-brand-from bg-purple-50 dark:bg-white/10" : "border-gray-200 dark:border-white/10"
                    }`}
                  >
                    <span className="text-lg leading-none">{TIPO_INFO[t].icono}</span>
                    <span className="text-[10px] text-gray-600 dark:text-gray-300">{TIPO_INFO[t].label}</span>
                  </button>
                ))}
              </div>
            </div>
            {tipo === "otro" && (
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400">Nombre</label>
                <input
                  required
                  value={nombre}
                  onChange={(e) => onNombreChange(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-white/10 dark:bg-white/5 dark:text-white px-3 py-2 text-sm"
                  placeholder="Ej: Permiso municipal"
                />
              </div>
            )}
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400">Fecha de vencimiento</label>
              <input
                required
                type="date"
                value={fechaVencimiento}
                onChange={(e) => setFechaVencimiento(e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-white/10 dark:bg-white/5 dark:text-white px-3 py-2 text-sm"
              />
              <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
                Cuando lo renueves, edita este mismo documento con la nueva fecha.
              </p>
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400">Notas (opcional)</label>
              <input
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-white/10 dark:bg-white/5 dark:text-white px-3 py-2 text-sm"
                placeholder="Ej: N° de póliza"
              />
            </div>
            {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
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

      {documentos.length === 0 && !mostrarForm ? (
        <p className="text-center text-sm text-gray-400 dark:text-gray-500">Todavía no registraste documentos del auto.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {documentos.map((d) => {
            const dias = diasHasta(d.fecha_vencimiento);
            const estado = estadoDe(dias);
            return (
              <Card key={d.id}>
                <div className="flex items-start gap-3">
                  <EntidadAvatar icono={TIPO_INFO[d.tipo].icono} nombreFallback={d.nombre} className="h-9 w-9" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-gray-800 dark:text-white">{d.nombre}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">Vence el {fechaLarga(d.fecha_vencimiento)}</p>
                    {d.notas && <p className="mt-0.5 truncate text-xs text-gray-400 dark:text-gray-500">{d.notas}</p>}
                  </div>
                </div>
                <span className={`mt-2.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${ESTADO_ESTILO[estado]}`}>
                  {estadoTexto(dias, estado)}
                </span>
                <div className="mt-3 flex gap-2 border-t border-gray-50 dark:border-white/10 pt-3">
                  <button
                    onClick={() => iniciarEdicion(d)}
                    className="flex-1 rounded-lg bg-gray-50 dark:bg-white/5 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => eliminar(d.id)}
                    className="flex-1 rounded-lg bg-gray-50 dark:bg-white/5 py-1.5 text-xs font-semibold text-gray-400 dark:text-gray-500 hover:text-red-400"
                  >
                    Eliminar
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {error && !mostrarForm && <p className="text-center text-xs text-red-500 dark:text-red-400">{error}</p>}
    </div>
  );
}
