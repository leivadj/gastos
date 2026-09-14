"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabaseClient";
import { CategoriaPicker } from "@/components/CategoriaPicker";
import { MarcaSugeridaPicker } from "@/components/MarcaSugeridaPicker";
import { ParticipantesPicker } from "@/components/ParticipantesPicker";
import { colorFor } from "@/lib/avatarColor";
import { mensajeError } from "@/lib/supabaseError";
import { Categoria, Entidad, Grupo, Marca, Participante, Persona } from "@/lib/types";

const ETIQUETA_TIPO_ENTIDAD: Record<Entidad["tipo"], string> = {
  efectivo: "Efectivo",
  tarjeta_credito: "Crédito",
  tarjeta_debito: "Débito",
  linea_credito: "Línea de crédito",
  credito_hipotecario: "Hipotecario",
  transferencia: "Transferencia",
};

// Resta `meses` meses a una fecha ISO ("YYYY-MM-DD"), preservando el día.
// Se usa para reconstruir fecha_primera_cuota cuando la compra que se está
// ingresando ya lleva cuotas pagadas (ver "N° de cuota actual" más abajo):
// si hoy es la cuota 3, la primera cuota fue hace 2 meses.
function restarMeses(fechaISO: string, meses: number): string {
  const [y, m, d] = fechaISO.split("-").map(Number);
  const fecha = new Date(y, m - 1 - meses, d);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
}

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
type TipoPago = "normal" | "recurrente" | "cuotas";

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
  const [tipoPago, setTipoPago] = useState<TipoPago>("normal");
  const [numeroCuotas, setNumeroCuotas] = useState("2");
  const [cuotaInicial, setCuotaInicial] = useState("1");
  const [compartir, setCompartir] = useState(false);
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
  // "Tú" es la primera persona activa — igual de arbitrario que el mockup,
  // que muestra "Felipe (tú)" primero en ese orden.
  const yo = activas[0] ?? null;

  function nombreEntidad(id: string): string {
    if (!id) return "Efectivo · sin tarjeta";
    return entidades.find((e) => e.id === id)?.nombre ?? "Efectivo · sin tarjeta";
  }

  // Cuando hay dos cuentas con el mismo nombre (ej. dos "Banco Estado", una
  // débito y otra crédito), Felipe no podía distinguirlas en "Pagar con" —
  // se agrega el tipo entre paréntesis solo para esos nombres repetidos.
  const nombresRepetidos = new Set(
    Object.entries(
      entidades.reduce<Record<string, number>>((acc, e) => {
        acc[e.nombre] = (acc[e.nombre] ?? 0) + 1;
        return acc;
      }, {})
    )
      .filter(([, count]) => count > 1)
      .map(([nombre]) => nombre)
  );

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
    // createPortal: este dropdown se abre DENTRO de la hoja "Nuevo
    // movimiento", que a su vez ya está portada a <body> (ver más abajo) —
    // pero antes de que ese cambio existiera este overlay quedaba anidado
    // en el árbol normal de React y podía terminar detrás de contenido de la
    // página en escritorio (mismo bug de stacking que /tarjetas y
    // /movimientos, ver los comentarios ahí). Se porta también acá, directo
    // a <body>, para no depender de dónde quede montada la hoja que lo abre.
    return createPortal(
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-0 backdrop-blur-sm sm:items-center sm:px-4"
        onClick={() => setSelectorAbierto(null)}
      >
        <div
          className="max-h-[70vh] w-full overflow-y-auto rounded-t-3xl border border-gray-100 bg-white p-1.5 pb-[max(env(safe-area-inset-bottom),0.375rem)] shadow-2xl dark:border-white/10 dark:bg-neutral-900 sm:max-w-sm sm:rounded-3xl"
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
              <span className="min-w-0 flex-1 truncate">
                {e.nombre}
                {nombresRepetidos.has(e.nombre) && (
                  <span className="text-gray-400 dark:text-gray-500"> ({ETIQUETA_TIPO_ENTIDAD[e.tipo]})</span>
                )}
              </span>
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
      </div>,
      document.body
    );
  }

  // Genera la lista de participantes a guardar en item_participantes. Si
  // "Compartir gasto" está apagado (o solo hay una persona en la cuenta), el
  // gasto queda 100% asignado a "tú" — igual que antes. Si está prendido, se
  // usa lo que el usuario armó en ParticipantesPicker (puede incluir 2 o más
  // personas, con % editable o en blanco = partes iguales del resto).
  function participantesParaGuardar(): Participante[] {
    if (activas.length <= 1) return [];
    if (compartir && participantesManual.length > 0) return participantesManual;
    return yo ? [{ persona_id: yo.id, porcentaje: null }] : [];
  }

  async function guardarGasto() {
    const descripcionFinal = descripcion.trim() || marcaSeleccionada?.nombre || categoriaSeleccionada?.nombre || "Gasto";
    const participantes = participantesParaGuardar();

    // "Recurrente" (se repite todos los meses) no es una compra en cuotas —
    // va a gastos_fijos, la misma tabla que alimenta /gastos → Fijos y el
    // Calendario de pagos. dia_mes_pago sale del día de la fecha elegida.
    if (tipoPago === "recurrente") {
      const dia = Number(fecha.slice(8, 10)) || 1;
      const payload = {
        descripcion: descripcionFinal,
        monto_estimado: Number(monto),
        dia_mes_pago: dia,
        tipo_monto: "fijo" as const,
        activo: true,
        entidad_id: entidadId || null,
        categoria_id: categoriaId || null,
        marca_id: marcaId || null,
        grupo_id: null as string | null,
      };
      const { data, error: dbError } = await supabase.from("gastos_fijos").insert(payload).select().single();
      if (dbError) throw dbError;
      if (participantes.length > 0 && data) {
        const { error: partError } = await supabase.from("item_participantes").insert(
          participantes.map((p) => ({ origen: "gasto_fijo", origen_id: data.id, persona_id: p.persona_id, porcentaje: p.porcentaje }))
        );
        if (partError) throw partError;
      }
      avisarGuardado("gasto");
      return;
    }

    const nCuotas = tipoPago === "cuotas" ? Math.max(1, Number(numeroCuotas) || 1) : 1;
    // Si ya se venían pagando cuotas antes de registrar esta compra (ej. se
    // está ingresando ahora pero ya va en la cuota 3), la primera cuota fue
    // (N-1) meses antes de la fecha elegida — así cuotaActualEn() la sitúa
    // correctamente en el mes en curso sin tener que reeditar nada después.
    const cuotaInicialClamp = tipoPago === "cuotas" ? Math.min(Math.max(1, Number(cuotaInicial) || 1), nCuotas) : 1;
    const payload = {
      descripcion: descripcionFinal,
      monto_total: Number(monto),
      n_cuotas: nCuotas,
      fecha_primera_cuota: cuotaInicialClamp > 1 ? restarMeses(fecha, cuotaInicialClamp - 1) : fecha,
      entidad_id: entidadId || null,
      categoria_id: categoriaId || null,
      marca_id: marcaId || null,
      grupo_id: null as string | null,
    };
    const { data, error: dbError } = await supabase.from("compras").insert(payload).select().single();
    if (dbError) throw dbError;
    if (participantes.length > 0 && data) {
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

  // createPortal: se monta como hijo directo de <body> (mismo motivo que
  // /tarjetas y /movimientos, ver los comentarios ahí) — antes esta hoja se
  // abría desde el "+" del rail de escritorio (dentro de <aside> en
  // DesktopSidebar.tsx) o de la barra inferior, y sin portal podía terminar
  // por detrás de contenido de la página (ej. las tarjetas de "Personas"),
  // en vez de siempre por encima de todo.
  //
  // "sm:max-w-lg lg:max-w-xl" (antes "sm:max-w-md" en todos los tamaños):
  // en escritorio hay espacio de sobra y este formulario no es un mockup de
  // celular estirado — se le da más aire horizontal en vez de dejarlo
  // angosto y muy alto.
  return createPortal(
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 px-0 backdrop-blur-sm sm:items-center sm:px-4" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 pb-10 shadow-xl dark:bg-[#111113] dark:text-white sm:max-h-[85vh] sm:max-w-lg sm:rounded-3xl sm:pb-5 lg:max-w-xl"
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

        {!modoTransferencia && tipo === "gasto" && (
          <>
            <p className="mb-2 mt-4 px-1 text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">Tipo de pago</p>
            <div className="flex gap-1 rounded-2xl bg-gray-100 p-1 text-xs dark:bg-white/10">
              {(
                [
                  { key: "normal", label: "Normal" },
                  { key: "recurrente", label: "Recurrente" },
                  { key: "cuotas", label: "Cuotas" },
                ] as { key: TipoPago; label: string }[]
              ).map((op) => (
                <button
                  key={op.key}
                  type="button"
                  onClick={() => setTipoPago(op.key)}
                  className={`flex-1 rounded-xl py-2 font-semibold transition-colors ${
                    tipoPago === op.key ? "bg-white text-gray-800 shadow-sm dark:bg-[#F2F2F0] dark:text-black" : "text-gray-500 dark:text-gray-400"
                  }`}
                >
                  {op.label}
                </button>
              ))}
            </div>
            <p className="mt-1 px-1 text-[11px] text-gray-400 dark:text-gray-500">
              {tipoPago === "normal" && "Un solo pago, no se repite."}
              {tipoPago === "recurrente" && "Se repite todos los meses (arriendo, suscripción, etc.)."}
              {tipoPago === "cuotas" && "Compra en cuotas — indica cuántas cuotas."}
            </p>
            {tipoPago === "cuotas" && (
              <div className="mt-2 flex gap-2">
                <div className="flex-1">
                  <input
                    type="number"
                    min={2}
                    required
                    value={numeroCuotas}
                    onChange={(e) => setNumeroCuotas(e.target.value)}
                    placeholder="N° de cuotas"
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-medium dark:border-white/10 dark:bg-white/5"
                  />
                  <p className="mt-1 px-1 text-[10.5px] text-gray-400 dark:text-gray-500">N° de cuotas</p>
                </div>
                <div className="flex-1">
                  <input
                    type="number"
                    min={1}
                    max={Math.max(1, Number(numeroCuotas) || 1)}
                    required
                    value={cuotaInicial}
                    onChange={(e) => setCuotaInicial(e.target.value)}
                    placeholder="N° de cuota actual"
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-medium dark:border-white/10 dark:bg-white/5"
                  />
                  <p className="mt-1 px-1 text-[10.5px] text-gray-400 dark:text-gray-500">Va en la cuota N°</p>
                </div>
              </div>
            )}
          </>
        )}

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

        {!modoTransferencia && tipo === "gasto" && activas.length > 1 && (
          <>
            <label className="mt-4 flex items-center justify-between gap-2 rounded-2xl border border-gray-200 px-3.5 py-3 dark:border-white/10">
              <span className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ backgroundColor: colorFor(yo?.nombre ?? "") }}
                >
                  {(yo?.nombre ?? "?").slice(0, 2).toUpperCase()}
                </span>
                Compartir gasto
              </span>
              <input
                type="checkbox"
                checked={compartir}
                onChange={(e) => setCompartir(e.target.checked)}
                className="h-5 w-5 accent-gray-800 dark:accent-white"
              />
            </label>

            {compartir && (
              <div className="mt-3">
                <p className="mb-1 px-1 text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">¿Con quién se reparte?</p>
                <ParticipantesPicker
                  personas={activas}
                  value={participantesManual}
                  onChange={setParticipantesManual}
                  montoTotal={monto ? Number(monto) : undefined}
                />
                <p className="mt-1 px-1 text-[11px] text-gray-400 dark:text-gray-500">
                  Elige a las personas y, si no es en partes iguales, edita el % de cada una.
                </p>
              </div>
            )}
          </>
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
    </div>,
    document.body
  );
}
