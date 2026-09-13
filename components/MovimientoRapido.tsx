"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { CategoriaPicker } from "@/components/CategoriaPicker";
import { MarcaSugeridaPicker } from "@/components/MarcaSugeridaPicker";
import { ParticipantesPicker } from "@/components/ParticipantesPicker";
import { colorFor } from "@/lib/avatarColor";
import { mensajeError } from "@/lib/supabaseError";
import { Categoria, Entidad, Grupo, Marca, Participante, Persona } from "@/lib/types";

// Avisa a cualquier pantalla que esté escuchando (dashboard, /gastos,
// /ingresos...) que se guardó un movimiento rápido, para que refresque sus
// datos sin que el usuario tenga que recargar la página a mano.
export const EVENTO_MOVIMIENTO_GUARDADO = "movimiento:guardado";
function avisarGuardado(tipo: "gasto" | "ingreso" | "transferencia") {
  window.dispatchEvent(new CustomEvent(EVENTO_MOVIMIENTO_GUARDADO, { detail: { tipo } }));
}

const hoyISO = () => new Date().toISOString().slice(0, 10);
function horaCorta() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function fechaChipLabel(fecha: string) {
  const [, m, d] = fecha.split("-");
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${Number(d)} ${meses[Number(m) - 1]} · ${horaCorta()}`;
}

// Botón "+" — en el celular vive dentro de la barra inferior (variante
// "en-nav"), en escritorio es el ícono superior del rail (variante "rail",
// ver DesktopSidebar.tsx). Las dos abren exactamente la misma hoja de
// "Nuevo movimiento" (mockup pág. AgregarGasto.dc.html): ya no hay un menú
// intermedio de burbujas Transferencia/Ingreso/Gasto — el mockup abre la
// hoja directo, con Gasto/Ingreso como segmentado adentro y "Transferencia"
// como una opción más dentro del selector de cuenta (ver FormMovimiento).
export function MovimientoFab({ variante = "en-nav" }: { variante?: "en-nav" | "rail" }) {
  const [abierto, setAbierto] = useState(false);

  const [entidades, setEntidades] = useState<Entidad[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);

  async function cargarCatalogos() {
    const [{ data: e }, { data: m }, { data: cat }, { data: p }, { data: gr }] = await Promise.all([
      supabase.from("entidades").select("*").order("nombre"),
      supabase.from("marcas").select("*").order("nombre"),
      supabase.from("categorias").select("*").order("nombre"),
      supabase.from("personas").select("*").eq("activo", true).order("nombre"),
      supabase.from("grupos").select("*").order("nombre"),
    ]);
    setEntidades((e as Entidad[]) ?? []);
    setMarcas((m as Marca[]) ?? []);
    setCategorias((cat as Categoria[]) ?? []);
    setPersonas((p as Persona[]) ?? []);
    setGrupos((gr as Grupo[]) ?? []);
  }

  useEffect(() => {
    cargarCatalogos();
  }, []);

  const boton =
    variante === "rail" ? (
      <button
        onClick={() => setAbierto(true)}
        aria-label="Nuevo movimiento"
        title="Nuevo movimiento"
        className="flex h-[42px] w-[42px] items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-sm transition active:scale-95"
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    ) : (
      <button
        onClick={() => setAbierto(true)}
        aria-label="Agregar movimiento"
        className="-mt-7 flex h-12 w-12 items-center justify-center rounded-full bg-brand-gradient text-2xl font-light text-white shadow-xl ring-4 ring-white transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] dark:ring-black"
      >
        +
      </button>
    );

  return (
    <>
      {variante === "en-nav" ? (
        <div className="relative flex flex-1 flex-col items-center justify-end pb-2.5">{boton}</div>
      ) : (
        boton
      )}

      {abierto && (
        <FormMovimiento
          entidades={entidades}
          marcas={marcas}
          categorias={categorias}
          personas={personas}
          grupos={grupos}
          onClose={() => setAbierto(false)}
          onCatalogoActualizado={cargarCatalogos}
        />
      )}
    </>
  );
}

type Tipo = "gasto" | "ingreso";

// Hoja única "Nuevo movimiento" — calcada de AgregarGasto.dc.html (estados A
// y B). Segmentado Gasto/Ingreso arriba; el selector de cuenta (chip
// "CuentaRUT") abre un dropdown con Efectivo + cuentas reales + una opción
// "Transferencia entre mis cuentas" al fondo (Felipe: "transferencia dentro
// del selector de cuentas, ahí veo si es entre mis cuentas o a terceros" —
// una transferencia A TERCEROS sigue siendo un Gasto normal con el nombre de
// la persona en la descripción, por eso no tiene un modo propio: el esquema
// real no distingue "a quién" en un gasto, solo en item_participantes/grupos
// que reparten el gasto entre personas DE LA CUENTA, no terceros externos).
export function FormMovimiento({
  entidades,
  marcas,
  categorias,
  personas,
  grupos,
  onClose,
  onCatalogoActualizado,
}: {
  entidades: Entidad[];
  marcas: Marca[];
  categorias: Categoria[];
  personas: Persona[];
  grupos: Grupo[];
  onClose: () => void;
  onCatalogoActualizado: () => void | Promise<void>;
}) {
  const [tipo, setTipo] = useState<Tipo>("gasto");
  const [modoTransferencia, setModoTransferencia] = useState(false);
  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fecha, setFecha] = useState(hoyISO());
  const [entidadId, setEntidadId] = useState("");
  const [entidadDestinoId, setEntidadDestinoId] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [marcaId, setMarcaId] = useState("");
  const [selectorAbierto, setSelectorAbierto] = useState<"origen" | "destino" | null>(null);
  const selectorRef = useRef<HTMLDivElement>(null);

  const unicaPersona = personas.length === 1 ? personas[0] : null;
  const activas = personas;
  const [asignacion, setAsignacion] = useState<"self" | "otro" | "dividir">("self");
  const [participantesManual, setParticipantesManual] = useState<Participante[]>([]);
  const [personaIngresoId, setPersonaIngresoId] = useState(unicaPersona?.id ?? "");

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!selectorAbierto) return;
    function onClick(e: MouseEvent) {
      if (selectorRef.current && !selectorRef.current.contains(e.target as Node)) setSelectorAbierto(null);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [selectorAbierto]);

  const categoriaSeleccionada = categorias.find((c) => c.id === categoriaId) ?? null;
  const marcaSeleccionada = marcas.find((m) => m.id === marcaId) ?? null;
  // Con exactamente 2 personas activas (el caso real de esta cuenta), "tú"
  // es la primera y "el otro" la segunda — igual de arbitrario que el
  // mockup, que muestra "Felipe (tú)" / "Marianela" en ese orden.
  const yo = activas[0] ?? null;
  const otraPersona = activas.length === 2 ? activas[1] : null;
  const grupoHogar = grupos[0] ?? null;

  function nombreEntidad(id: string): string {
    if (!id) return "Efectivo · sin tarjeta";
    return entidades.find((e) => e.id === id)?.nombre ?? "Efectivo · sin tarjeta";
  }

  function iconoCuenta() {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="2.5" y="6" width="19" height="13" rx="2.5" />
        <path d="M2.5 10h19" />
      </svg>
    );
  }

  // Antes era un menú "absolute" anidado dentro del formulario con scroll
  // (overflow-y-auto): al desplegarse cerca del fondo de la hoja quedaba
  // cortado (no cabía) y, al no tener su propio fondo, se confundía
  // visualmente con la hoja "Nuevo movimiento" que queda detrás. Ahora es un
  // overlay "fixed" de pantalla completa (mismo patrón que el resto de las
  // hojas de la app) con su propio fondo oscuro + difuminado, así siempre
  // cabe entero y se nota claramente que es una ventana aparte, por encima.
  function DropdownCuentas({ valor, onElegir, onTransferencia }: { valor: string; onElegir: (id: string) => void; onTransferencia?: () => void }) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-0 backdrop-blur-sm sm:items-center sm:px-4"
        onClick={() => setSelectorAbierto(null)}
      >
        <div
          className="max-h-[70vh] w-full overflow-y-auto rounded-t-3xl border border-gray-100 bg-white p-1.5 pb-[max(env(safe-area-inset-bottom),0.375rem)] shadow-2xl dark:border-white/10 dark:bg-gray-900 sm:max-w-sm sm:rounded-3xl"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="px-3 pb-1.5 pt-2 text-[10.5px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">Pagar con</p>
          <button
            type="button"
            onClick={() => onElegir("")}
            className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm ${
              valor === "" ? "bg-gray-50 font-semibold dark:bg-white/10" : "hover:bg-gray-50 dark:hover:bg-white/5"
            }`}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="8.5" />
                <path d="M12 7.5v9M9 9.8h4.2a1.9 1.9 0 1 1 0 3.8H10a1.9 1.9 0 1 0 0 3.8H15" />
              </svg>
            </span>
            <span className="min-w-0 flex-1 truncate">
              Efectivo <span className="text-gray-400 dark:text-gray-500">· sin tarjeta</span>
            </span>
            {valor === "" && (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                <path d="m4 12 5 5L20 6" />
              </svg>
            )}
          </button>
          {entidades.map((e) => (
            <button
              type="button"
              key={e.id}
              onClick={() => onElegir(e.id)}
              className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm ${
                valor === e.id ? "bg-gray-50 font-semibold dark:bg-white/10" : "hover:bg-gray-50 dark:hover:bg-white/5"
              }`}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300">
                {iconoCuenta()}
              </span>
              <span className="min-w-0 flex-1 truncate">{e.nombre}</span>
              {valor === e.id && (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                  <path d="m4 12 5 5L20 6" />
                </svg>
              )}
            </button>
          ))}
          {onTransferencia && (
            <>
              <div className="my-1 h-px bg-gray-100 dark:bg-white/10" />
              <button
                type="button"
                onClick={onTransferencia}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/5"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 3 21 7l-4 4" />
                    <path d="M21 7H9a4 4 0 0 0-4 4v1" />
                    <path d="M7 21 3 17l4-4" />
                    <path d="M3 17h12a4 4 0 0 0 4-4v-1" />
                  </svg>
                </span>
                Transferencia entre mis cuentas
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  function participantesParaGuardar(): { grupoId: string | null; participantes: Participante[] } {
    if (activas.length <= 1) return { grupoId: null, participantes: [] };
    if (asignacion === "dividir") {
      if (grupoHogar) return { grupoId: grupoHogar.id, participantes: [] };
      return {
        grupoId: null,
        participantes: activas.length === 2 ? [{ persona_id: yo!.id, porcentaje: null }, { persona_id: otraPersona!.id, porcentaje: null }] : participantesManual,
      };
    }
    if (asignacion === "otro" && otraPersona) return { grupoId: null, participantes: [{ persona_id: otraPersona.id, porcentaje: null }] };
    return { grupoId: null, participantes: yo ? [{ persona_id: yo.id, porcentaje: null }] : participantesManual };
  }

  async function guardarGasto() {
    const payload = {
      descripcion: descripcion.trim() || marcaSeleccionada?.nombre || categoriaSeleccionada?.nombre || "Gasto",
      monto_total: Number(monto),
      n_cuotas: 1,
      fecha_primera_cuota: fecha,
      entidad_id: entidadId || null,
      categoria_id: categoriaId || null,
      marca_id: marcaId || null,
      grupo_id: null as string | null,
    };
    const { grupoId, participantes } = participantesParaGuardar();
    payload.grupo_id = grupoId;
    const { data, error: dbError } = await supabase.from("compras").insert(payload).select().single();
    if (dbError) throw dbError;
    if (!grupoId && participantes.length > 0 && data) {
      const { error: partError } = await supabase.from("item_participantes").insert(
        participantes.map((p) => ({ origen: "compra", origen_id: data.id, persona_id: p.persona_id, porcentaje: p.porcentaje }))
      );
      if (partError) throw partError;
    }
    avisarGuardado("gasto");
  }

  async function guardarIngreso() {
    const mes = `${fecha.slice(0, 7)}-01`;
    const payload = {
      persona_id: personaIngresoId || null,
      monto: Number(monto),
      mes,
      descripcion: descripcion.trim() || null,
    };
    const { error: dbError } = await supabase.from("ingresos").insert(payload);
    if (dbError) throw dbError;
    avisarGuardado("ingreso");
  }

  async function guardarTransferencia() {
    if (entidadId && entidadDestinoId && entidadId === entidadDestinoId) {
      throw new Error("La cuenta de origen y destino no pueden ser la misma.");
    }
    const payload = {
      monto: Number(monto),
      cuenta_origen_id: entidadId || null,
      cuenta_destino_id: entidadDestinoId || null,
      fecha,
      notas: descripcion.trim() || null,
    };
    const { error: dbError } = await supabase.from("transferencias").insert(payload);
    if (dbError) throw dbError;
    avisarGuardado("transferencia");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setGuardando(true);
    try {
      if (modoTransferencia) await guardarTransferencia();
      else if (tipo === "ingreso") await guardarIngreso();
      else await guardarGasto();
      onClose();
    } catch (err) {
      setError(mensajeError(err) || "No se pudo guardar. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  const titulo = modoTransferencia ? "Transferencia entre cuentas" : "Nuevo movimiento";

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/45 px-0 sm:items-center sm:px-4" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 pb-10 shadow-xl dark:bg-[#111113] dark:text-white sm:max-w-md sm:rounded-3xl sm:pb-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-800 dark:text-white">{titulo}</h2>
          <button
            type="button"
            onClick={modoTransferencia ? () => setModoTransferencia(false) : onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 dark:text-gray-500 dark:hover:bg-white/10"
            aria-label={modoTransferencia ? "Volver" : "Cerrar"}
          >
            ✕
          </button>
        </div>

        {!modoTransferencia && (
          <div className="mb-4 flex gap-1 rounded-2xl bg-gray-100 p-1 text-sm dark:bg-white/10">
            {(["gasto", "ingreso"] as Tipo[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTipo(t)}
                className={`flex-1 rounded-xl py-2 font-semibold capitalize transition-colors ${
                  tipo === t ? "bg-white text-gray-800 shadow-sm dark:bg-[#F2F2F0] dark:text-black" : "text-gray-500 dark:text-gray-400"
                }`}
              >
                {t === "gasto" ? "Gasto" : "Ingreso"}
              </button>
            ))}
          </div>
        )}

        <div className="mb-1 flex items-center gap-2">
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
              tipo === "gasto" || modoTransferencia ? "bg-gasto/10 text-gasto" : "bg-ingreso/10 text-ingreso"
            }`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
              {tipo === "gasto" || modoTransferencia ? <path d="M5 12h14" /> : <path d="M12 19V5M6 11l6-6 6 6" />}
            </svg>
          </span>
          <input
            required
            autoFocus
            type="number"
            min={1}
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder="$0"
            className={`w-full bg-transparent text-3xl font-bold outline-none ${
              tipo === "gasto" || modoTransferencia ? "text-gasto" : "text-ingreso"
            }`}
          />
        </div>

        <input
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder={modoTransferencia ? "Nota (opcional)" : marcaSeleccionada?.nombre || categoriaSeleccionada?.nombre || "Descripción"}
          className="mt-3 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium dark:border-white/10 dark:bg-white/5"
        />
        {!modoTransferencia && (
          <p className="mt-1 px-1 text-[11px] text-gray-400 dark:text-gray-500">
            ¿Es una transferencia a un tercero? Descríbelo acá, ej. &quot;Transferencia a Marianela&quot;.
          </p>
        )}

        <div className="mt-3 flex gap-2">
          <div className="relative flex shrink-0 items-center gap-1.5 rounded-2xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-xs font-semibold dark:border-white/10 dark:bg-white/5">
            {fechaChipLabel(fecha)}
            <input
              type="date"
              required
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
              aria-label="Fecha"
            />
          </div>
          {!modoTransferencia && tipo === "gasto" && (
            <div className="relative min-w-0 flex-1" ref={selectorRef}>
              <button
                type="button"
                onClick={() => setSelectorAbierto(selectorAbierto === "origen" ? null : "origen")}
                className="flex w-full items-center justify-between gap-2 rounded-2xl border border-gray-300 bg-gray-50 px-3.5 py-2.5 text-xs font-semibold dark:border-white/20 dark:bg-white/5"
              >
                <span className="truncate">{nombreEntidad(entidadId)}</span>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              {selectorAbierto === "origen" && (
                <DropdownCuentas
                  valor={entidadId}
                  onElegir={(id) => {
                    setEntidadId(id);
                    setSelectorAbierto(null);
                  }}
                  onTransferencia={() => {
                    setModoTransferencia(true);
                    setSelectorAbierto(null);
                  }}
                />
              )}
            </div>
          )}
        </div>
        {!modoTransferencia && tipo === "gasto" && (
          <p className="mt-1.5 px-1 text-[11px] text-gray-400 dark:text-gray-500">Toca para elegir tarjeta, cuenta o efectivo</p>
        )}

        {modoTransferencia && (
          <div className="mt-3 space-y-2">
            <div className="relative" ref={selectorAbierto === "origen" ? selectorRef : undefined}>
              <p className="mb-1 px-1 text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">Desde</p>
              <button
                type="button"
                onClick={() => setSelectorAbierto(selectorAbierto === "origen" ? null : "origen")}
                className="flex w-full items-center justify-between gap-2 rounded-2xl border border-gray-300 bg-gray-50 px-3.5 py-2.5 text-sm font-semibold dark:border-white/20 dark:bg-white/5"
              >
                <span className="truncate">{nombreEntidad(entidadId)}</span>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              {selectorAbierto === "origen" && <DropdownCuentas valor={entidadId} onElegir={(id) => { setEntidadId(id); setSelectorAbierto(null); }} />}
            </div>
            <div className="relative" ref={selectorAbierto === "destino" ? selectorRef : undefined}>
              <p className="mb-1 px-1 text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">Hacia</p>
              <button
                type="button"
                onClick={() => setSelectorAbierto(selectorAbierto === "destino" ? null : "destino")}
                className="flex w-full items-center justify-between gap-2 rounded-2xl border border-gray-300 bg-gray-50 px-3.5 py-2.5 text-sm font-semibold dark:border-white/20 dark:bg-white/5"
              >
                <span className="truncate">{nombreEntidad(entidadDestinoId)}</span>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              {selectorAbierto === "destino" && <DropdownCuentas valor={entidadDestinoId} onElegir={(id) => { setEntidadDestinoId(id); setSelectorAbierto(null); }} />}
            </div>
            <p className="px-1 text-[11px] text-gray-400 dark:text-gray-500">No mueve el saldo de las cuentas automáticamente todavía — queda como registro.</p>
          </div>
        )}

        {!modoTransferencia && tipo === "gasto" && (
          <>
            <p className="mb-2 mt-4 px-1 text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">Categoría</p>
            <CategoriaPicker
              categorias={categorias}
              value={categoriaId}
              onChange={(id) => {
                const nueva = categorias.find((c) => c.id === id) ?? null;
                if (nueva?.tipo_marca_sugerido !== categoriaSeleccionada?.tipo_marca_sugerido) setMarcaId("");
                setCategoriaId(id);
              }}
            />
            {categoriaSeleccionada?.tipo_marca_sugerido && (
              <div className="mt-2">
                <p className="mb-1 px-1 text-[11px] text-gray-400 dark:text-gray-500">
                  ¿Cuál {categoriaSeleccionada.nombre.toLowerCase()}? (opcional)
                </p>
                <MarcaSugeridaPicker
                  marcas={marcas}
                  tipo={categoriaSeleccionada.tipo_marca_sugerido}
                  value={marcaId}
                  onChange={setMarcaId}
                  onCatalogoActualizado={onCatalogoActualizado}
                />
              </div>
            )}
          </>
        )}

        {!modoTransferencia && tipo === "ingreso" && activas.length > 1 && (
          <div className="mt-4">
            <p className="mb-1 px-1 text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">¿De quién?</p>
            <select
              value={personaIngresoId}
              onChange={(e) => setPersonaIngresoId(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
            >
              <option value="">—</option>
              {personas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
        )}

        {!modoTransferencia && tipo === "gasto" && activas.length === 2 && (
          <>
            <p className="mb-2 mt-4 px-1 text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              Asignar a · {grupoHogar?.nombre ?? "Grupo compartido"}
            </p>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              <button
                type="button"
                onClick={() => setAsignacion("self")}
                className={`flex shrink-0 items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3.5 text-xs font-semibold ${
                  asignacion === "self" ? "border-gray-800 bg-gray-800 text-white dark:border-white dark:bg-white dark:text-black" : "border-gray-200 text-gray-600 dark:border-white/15 dark:text-gray-300"
                }`}
              >
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ backgroundColor: asignacion === "self" ? undefined : colorFor(yo?.nombre ?? "") }}
                >
                  {(yo?.nombre ?? "?").slice(0, 2).toUpperCase()}
                </span>
                {yo?.nombre?.split(" ")[0] ?? "Tú"} (tú)
              </button>
              {otraPersona && (
                <button
                  type="button"
                  onClick={() => setAsignacion("otro")}
                  className={`flex shrink-0 items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3.5 text-xs font-semibold ${
                    asignacion === "otro" ? "border-gray-800 bg-gray-800 text-white dark:border-white dark:bg-white dark:text-black" : "border-gray-200 text-gray-600 dark:border-white/15 dark:text-gray-300"
                  }`}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: colorFor(otraPersona.nombre) }}>
                    {otraPersona.nombre.slice(0, 2).toUpperCase()}
                  </span>
                  {otraPersona.nombre.split(" ")[0]}
                </button>
              )}
              <button
                type="button"
                onClick={() => setAsignacion("dividir")}
                className={`flex shrink-0 items-center gap-2 rounded-full border border-dashed py-1.5 pl-3 pr-3.5 text-xs font-semibold ${
                  asignacion === "dividir" ? "border-gray-800 text-gray-800 dark:border-white dark:text-white" : "border-gray-300 text-gray-500 dark:border-white/20 dark:text-gray-400"
                }`}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Dividir entre ambos
              </button>
            </div>
            <p className="mt-1 px-1 text-[11px] text-gray-400 dark:text-gray-500">
              Esta fila solo aparece si {grupoHogar?.nombre ?? "tu grupo"} tiene más de una persona.
            </p>
          </>
        )}

        {!modoTransferencia && tipo === "gasto" && activas.length > 2 && (
          <div className="mt-4">
            <p className="mb-1 px-1 text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">Asignar a</p>
            <ParticipantesPicker personas={personas} value={participantesManual} onChange={setParticipantesManual} montoTotal={monto ? Number(monto) : undefined} />
          </div>
        )}

        {error && <p className="mt-3 text-xs text-red-500 dark:text-red-400">{error}</p>}

        {/* Al enfocar el input de monto/descripción en iPhone, Safari muestra
            su propia barra de accesorios del teclado (flechas ◀▶ + "Listo")
            justo encima del teclado — no es parte de esta app y no se puede
            ocultar desde CSS/JS, pero si tapaba este botón era porque no
            había espacio para hacerle scroll por encima (el formulario
            terminaba justo en el borde). El scroll-mb reserva ese margen al
            hacer scroll-into-view y el pb-10/pb-28 del form de arriba deja
            aire real debajo para poder subirlo del todo. */}
        <button
          type="submit"
          disabled={guardando}
          style={{ scrollMarginBottom: "140px" }}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-gray-900 py-3.5 text-sm font-bold text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            <path d="m4 12 5 5L20 6" />
          </svg>
          {guardando ? "Guardando…" : modoTransferencia ? "Guardar transferencia" : tipo === "gasto" ? "Guardar movimiento" : "Guardar ingreso"}
        </button>
      </form>
    </div>
  );
}
