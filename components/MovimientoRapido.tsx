"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { EntidadPicker } from "@/components/EntidadPicker";
import { MarcaSugeridaPicker } from "@/components/MarcaSugeridaPicker";
import { TIPO_CORTO } from "@/components/TarjetaVisual";
import { mensajeError } from "@/lib/supabaseError";
import { Categoria, Entidad, Marca } from "@/lib/types";

// Avisa a cualquier pantalla que esté escuchando (dashboard, /compras,
// /ingresos...) que se guardó un movimiento rápido, para que refresque sus
// datos sin que el usuario tenga que recargar la página a mano.
export const EVENTO_MOVIMIENTO_GUARDADO = "movimiento:guardado";
function avisarGuardado(tipo: "gasto" | "ingreso" | "transferencia") {
  window.dispatchEvent(new CustomEvent(EVENTO_MOVIMIENTO_GUARDADO, { detail: { tipo } }));
}

const hoyISO = () => new Date().toISOString().slice(0, 10);

function IconoGasto() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
      <path d="M12 3.5v17M8 7h5.5a2.5 2.5 0 0 1 0 5H10a2.5 2.5 0 0 0 0 5h6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconoIngreso() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
      <path d="M12 19V5M6 11l6-6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconoTransferencia() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
      <path d="M17 7 21 11l-4 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 11h18" strokeLinecap="round" />
      <path d="M7 21 3 17l4-4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 17H3" strokeLinecap="round" />
    </svg>
  );
}

type ModalActivo = "gasto" | "ingreso" | "transferencia" | null;

// Hoja inferior compartida por los 3 formularios rápidos.
function HojaInferior({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 px-0 sm:items-center sm:px-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-md sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-800">{titulo}</h2>
          <button onClick={onClose} className="rounded-full p-1 text-gray-400 hover:bg-gray-100">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function MovimientoFab({ variante = "flotante" }: { variante?: "flotante" | "en-nav" }) {
  const [abierto, setAbierto] = useState(false);
  const [modal, setModal] = useState<ModalActivo>(null);

  const [entidades, setEntidades] = useState<Entidad[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);

  async function cargarCatalogos() {
    const [{ data: e }, { data: m }, { data: cat }] = await Promise.all([
      supabase.from("entidades").select("*").order("nombre"),
      supabase.from("marcas").select("*").order("nombre"),
      supabase.from("categorias").select("*").order("nombre"),
    ]);
    setEntidades((e as Entidad[]) ?? []);
    setMarcas((m as Marca[]) ?? []);
    setCategorias((cat as Categoria[]) ?? []);
  }

  useEffect(() => {
    cargarCatalogos();
  }, []);

  function abrir(m: Exclude<ModalActivo, null>) {
    setAbierto(false);
    setModal(m);
  }

  // "en-nav": el botón vive DENTRO de la barra inferior (como en el mockup),
  // en vez de flotar encima del contenido y taparlo. "flotante": el botón
  // clásico fijo abajo a la derecha — se usa solo en escritorio, donde no
  // hay barra inferior debajo de la que taparse.
  const menuAbierto = abierto && (
    <div
      className={
        variante === "en-nav"
          ? "absolute bottom-full left-1/2 z-30 mb-3 flex -translate-x-1/2 flex-col items-center gap-2"
          : "mb-3 flex flex-col items-end gap-2"
      }
    >
      <button
        onClick={() => abrir("transferencia")}
        className="animate-pop-resorte flex items-center gap-2 whitespace-nowrap rounded-full bg-white py-2 pl-4 pr-2 text-sm font-medium text-gray-700 shadow-lg"
        style={{ animationDelay: "120ms" }}
      >
        Transferencia
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-sky-600">
          <IconoTransferencia />
        </span>
      </button>
      <button
        onClick={() => abrir("ingreso")}
        className="animate-pop-resorte flex items-center gap-2 whitespace-nowrap rounded-full bg-white py-2 pl-4 pr-2 text-sm font-medium text-gray-700 shadow-lg"
        style={{ animationDelay: "60ms" }}
      >
        Ingreso
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <IconoIngreso />
        </span>
      </button>
      <button
        onClick={() => abrir("gasto")}
        className="animate-pop-resorte flex items-center gap-2 whitespace-nowrap rounded-full bg-white py-2 pl-4 pr-2 text-sm font-medium text-gray-700 shadow-lg"
      >
        Gasto
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-pink-100 text-pink-600">
          <IconoGasto />
        </span>
      </button>
    </div>
  );

  const boton = (
    <button
      onClick={() => setAbierto((v) => !v)}
      aria-label="Agregar movimiento"
      className={
        variante === "en-nav"
          ? `-mt-7 flex h-12 w-12 items-center justify-center rounded-full bg-brand-gradient text-2xl font-light text-white shadow-xl ring-4 ring-white transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
              abierto ? "rotate-45" : ""
            }`
          : `flex h-14 w-14 items-center justify-center rounded-full bg-brand-gradient text-2xl font-light text-white shadow-xl transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
              abierto ? "rotate-45" : ""
            }`
      }
    >
      +
    </button>
  );

  return (
    <>
      {variante === "en-nav" ? (
        <div className="relative flex flex-1 flex-col items-center justify-end pb-2.5">
          {menuAbierto}
          {boton}
        </div>
      ) : (
        <div className="fixed bottom-6 right-4 z-30">
          {menuAbierto}
          {boton}
        </div>
      )}

      {abierto && <div className="fixed inset-0 z-20" onClick={() => setAbierto(false)} />}

      {modal === "gasto" && (
        <FormGasto
          entidades={entidades}
          marcas={marcas}
          categorias={categorias}
          onClose={() => setModal(null)}
          onCatalogoActualizado={cargarCatalogos}
        />
      )}
      {modal === "ingreso" && <FormIngreso onClose={() => setModal(null)} />}
      {modal === "transferencia" && <FormTransferencia entidades={entidades} onClose={() => setModal(null)} />}
    </>
  );
}

function FormGasto({
  entidades,
  marcas,
  categorias,
  onClose,
  onCatalogoActualizado,
}: {
  entidades: Entidad[];
  marcas: Marca[];
  categorias: Categoria[];
  onClose: () => void;
  onCatalogoActualizado: () => void | Promise<void>;
}) {
  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [marcaId, setMarcaId] = useState("");
  const [entidadId, setEntidadId] = useState("");
  const [fecha, setFecha] = useState(hoyISO());
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const categoriaSeleccionada = categorias.find((c) => c.id === categoriaId) ?? null;
  const marcaSeleccionada = marcas.find((m) => m.id === marcaId) ?? null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setGuardando(true);
    try {
      const payload = {
        descripcion: descripcion.trim() || marcaSeleccionada?.nombre || categoriaSeleccionada?.nombre || "Gasto",
        monto_total: Number(monto),
        n_cuotas: 1,
        fecha_primera_cuota: fecha,
        entidad_id: entidadId || null,
        categoria_id: categoriaId || null,
        marca_id: marcaId || null,
      };
      const { error: dbError } = await supabase.from("compras").insert(payload);
      if (dbError) throw dbError;
      avisarGuardado("gasto");
      onClose();
    } catch (err) {
      setError(mensajeError(err) || "No se pudo guardar. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <HojaInferior titulo="+ Gasto" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs text-gray-500">Monto</label>
          <input
            required
            autoFocus
            type="number"
            min={1}
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder="0"
            className="w-full rounded-lg border border-gray-200 px-3 py-3 text-2xl font-bold text-gray-800"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500">Categoría</label>
          <select
            value={categoriaId}
            onChange={(e) => {
              const nueva = categorias.find((c) => c.id === e.target.value) ?? null;
              if (nueva?.tipo_marca_sugerido !== categoriaSeleccionada?.tipo_marca_sugerido) setMarcaId("");
              setCategoriaId(e.target.value);
            }}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            <option value="">—</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icono ? `${c.icono} ` : ""}
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
        {categoriaSeleccionada?.tipo_marca_sugerido && (
          <div>
            <label className="text-xs text-gray-500">¿Cuál {categoriaSeleccionada.nombre.toLowerCase()}? (opcional)</label>
            <div className="mt-1">
              <MarcaSugeridaPicker
                marcas={marcas}
                tipo={categoriaSeleccionada.tipo_marca_sugerido}
                value={marcaId}
                onChange={setMarcaId}
                onCatalogoActualizado={onCatalogoActualizado}
              />
            </div>
          </div>
        )}
        <div>
          <label className="text-xs text-gray-500">Descripción (opcional)</label>
          <input
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder={marcaSeleccionada?.nombre || categoriaSeleccionada?.nombre || "Ej: Supermercado"}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500">Cuenta</label>
          <div className="mt-1">
            <EntidadPicker entidades={entidades} marcas={marcas} value={entidadId} onChange={setEntidadId} onCatalogoActualizado={onCatalogoActualizado} />
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500">Fecha</label>
          <input
            required
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={guardando}
          className="w-full rounded-lg bg-brand-gradient py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {guardando ? "Guardando…" : "Guardar gasto"}
        </button>
        <p className="text-center text-[11px] text-gray-400">
          No se reparte entre personas automáticamente — si quieres dividirlo, créalo desde Cuotas.
        </p>
      </form>
    </HojaInferior>
  );
}

function FormIngreso({ onClose }: { onClose: () => void }) {
  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fecha, setFecha] = useState(hoyISO());
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setGuardando(true);
    try {
      const mes = `${fecha.slice(0, 7)}-01`;
      const payload = {
        persona_id: null,
        monto: Number(monto),
        mes,
        descripcion: descripcion.trim() || null,
      };
      const { error: dbError } = await supabase.from("ingresos").insert(payload);
      if (dbError) throw dbError;
      avisarGuardado("ingreso");
      onClose();
    } catch (err) {
      setError(mensajeError(err) || "No se pudo guardar. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <HojaInferior titulo="+ Ingreso" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs text-gray-500">Monto</label>
          <input
            required
            autoFocus
            type="number"
            min={1}
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder="0"
            className="w-full rounded-lg border border-gray-200 px-3 py-3 text-2xl font-bold text-gray-800"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500">Descripción (opcional)</label>
          <input
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Ej: Sueldo, bono, venta…"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500">Fecha</label>
          <input
            required
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={guardando}
          className="w-full rounded-lg bg-brand-gradient py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {guardando ? "Guardando…" : "Guardar ingreso"}
        </button>
      </form>
    </HojaInferior>
  );
}

function FormTransferencia({ entidades, onClose }: { entidades: Entidad[]; onClose: () => void }) {
  const [monto, setMonto] = useState("");
  const [origenId, setOrigenId] = useState("");
  const [destinoId, setDestinoId] = useState("");
  const [fecha, setFecha] = useState(hoyISO());
  const [notas, setNotas] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (origenId && destinoId && origenId === destinoId) {
      setError("La cuenta de origen y destino no pueden ser la misma.");
      return;
    }
    setGuardando(true);
    try {
      const payload = {
        monto: Number(monto),
        cuenta_origen_id: origenId || null,
        cuenta_destino_id: destinoId || null,
        fecha,
        notas: notas.trim() || null,
      };
      const { error: dbError } = await supabase.from("transferencias").insert(payload);
      if (dbError) throw dbError;
      avisarGuardado("transferencia");
      onClose();
    } catch (err) {
      setError(mensajeError(err) || "No se pudo guardar. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <HojaInferior titulo="↔ Transferencia" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs text-gray-500">Monto</label>
          <input
            required
            autoFocus
            type="number"
            min={1}
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder="0"
            className="w-full rounded-lg border border-gray-200 px-3 py-3 text-2xl font-bold text-gray-800"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500">Desde</label>
          <select value={origenId} onChange={(e) => setOrigenId(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
            <option value="">—</option>
            {entidades.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre} · {TIPO_CORTO[e.tipo]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500">Hacia</label>
          <select value={destinoId} onChange={(e) => setDestinoId(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
            <option value="">—</option>
            {entidades.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre} · {TIPO_CORTO[e.tipo]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500">Fecha</label>
          <input
            required
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500">Nota (opcional)</label>
          <input
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={guardando}
          className="w-full rounded-lg bg-brand-gradient py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {guardando ? "Guardando…" : "Guardar transferencia"}
        </button>
        <p className="text-center text-[11px] text-gray-400">
          No mueve el saldo de las cuentas automáticamente todavía — queda como registro.
        </p>
      </form>
    </HojaInferior>
  );
}
