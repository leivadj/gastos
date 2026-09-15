"use client";

import Link from "next/link";
import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/Card";
import { NotificacionesPush } from "@/components/NotificacionesPush";
import { PersonaAvatar } from "@/components/PersonaAvatar";
import { ContadorOdometro } from "@/components/ContadorOdometro";
import { subirImagenPropia } from "@/lib/subirImagen";
import { mensajeError } from "@/lib/supabaseError";
import { formatCLP, mesActualISO } from "@/lib/format";
import { Ingreso, Marca, Persona, PreferenciasUsuario, ResumenPersonaMes, SolicitudLogo } from "@/lib/types";
import { PreferenciaTema, useTheme } from "@/lib/theme";
import { conDefectos, ordenResumenValido } from "@/lib/preferenciasUsuario";

// Fila genérica de lista (ronda 6 del rediseño, "Mi perfil"): ícono a la
// izquierda, título + subtítulo, y a la derecha una flecha ">" para entrar
// (o el control que se pase en `right`, ej. un switch o un valor). Mismo
// estilo en todas las listas nuevas (Integraciones/Configuración/
// Apariencia) — calcado de las capturas de referencia que mandó el
// usuario (una app de terceros, "Not Pato"): cada fila entra a algo o abre
// una hoja inferior, nunca navega "hacia el lado".
function IconoFlecha({ className = "shrink-0 text-gray-300 dark:text-gray-600" }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function FilaLista({
  titulo,
  subtitulo,
  href,
  onClick,
  right,
  disabled = false,
}: {
  titulo: string;
  subtitulo?: string;
  href?: string;
  onClick?: () => void;
  right?: ReactNode;
  disabled?: boolean;
}) {
  const contenido = (
    <>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium ${disabled ? "text-gray-400 dark:text-gray-500" : "text-gray-700 dark:text-gray-200"}`}>{titulo}</p>
        {subtitulo && <p className="mt-0.5 truncate text-[11px] text-gray-400 dark:text-gray-500">{subtitulo}</p>}
      </div>
      {right !== undefined ? (
        right
      ) : disabled ? (
        <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-400 dark:bg-white/10 dark:text-gray-500">
          Próximamente
        </span>
      ) : (
        <IconoFlecha />
      )}
    </>
  );
  const clase = "flex w-full items-center gap-3 py-3 text-left";
  if (href && !disabled) {
    return (
      <Link href={href} className={clase}>
        {contenido}
      </Link>
    );
  }
  return (
    <button type="button" onClick={disabled ? undefined : onClick} disabled={disabled} className={`${clase} ${disabled ? "cursor-default" : ""}`}>
      {contenido}
    </button>
  );
}

// Grupo de filas con título (Integraciones/Configuración/Apariencia) — una
// sola tarjeta con separadores finos entre filas, calcado de las capturas
// de referencia (en vez del recuadro punteado individual de antes, que
// seguía usándose solo para las filas sueltas "Próximamente").
function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 mt-4 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">{titulo}</p>
      <div className="divide-y divide-gray-100 rounded-2xl border border-gray-100 bg-white px-4 dark:divide-white/10 dark:border-white/10 dark:bg-neutral-900">
        {children}
      </div>
    </div>
  );
}

// Envoltorio común de las hojas de "Mi perfil": mismo fondo oscuro +
// bottom-sheet que el resto de la app (ver DividirGastoSheet.tsx). Hasta la
// Ronda 9 existía una versión "SheetDemo" con un aviso fijo de "vista de
// ejemplo" y un botón deshabilitado — Inicio del mes/Balance/Vista
// principal ya guardan de verdad (preferencias_usuario,
// migration_40_preferencias_usuario.sql), así que ese aviso se quitó.
function SheetBase({ titulo, subtitulo, onClose, children }: { titulo: string; subtitulo?: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-3xl bg-[#111113] p-5 pb-7 text-white sm:max-w-sm sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold">{titulo}</h2>
            {subtitulo && <p className="mt-0.5 text-xs text-white/50">{subtitulo}</p>}
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// "Inicio del mes" (Ronda 9, real): elegir qué día del mes empieza el
// ciclo. Solo días 1-28 (mismo criterio que la mayoría de bancos, para no
// tener que lidiar con "día 30 en febrero") — ver
// migration_40_preferencias_usuario.sql. Por ahora esto solo cambia el
// resumen de Inicio (Balance/Ingresos/Gastos) — ver el aviso más abajo y
// lib/cicloMes.ts para el detalle de qué pantallas quedan afuera todavía.
function SheetInicioMes({ diaActual, onClose, onGuardar }: { diaActual: number; onClose: () => void; onGuardar: (dia: number) => Promise<string | null> }) {
  const [dia, setDia] = useState(diaActual);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const dias = Array.from({ length: 28 }, (_, i) => i + 1);

  async function guardar() {
    setGuardando(true);
    setError("");
    const err = await onGuardar(dia);
    setGuardando(false);
    if (err) {
      setError(err);
      return;
    }
    onClose();
  }

  return (
    <SheetBase titulo="Inicio del mes" subtitulo="¿Cuándo comienza tu ciclo?" onClose={onClose}>
      <div className="mt-4 grid grid-cols-7 gap-1.5">
        {dias.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDia(d)}
            className={`flex aspect-square items-center justify-center rounded-[10px] text-xs font-semibold ${
              d === dia ? "bg-white font-extrabold text-black" : "bg-white/5 text-white/70"
            }`}
          >
            {d}
          </button>
        ))}
      </div>
      <p className="mt-3.5 text-[11.5px] text-white/50">
        {dia === 1 ? "Tu mes irá del 1 al 30/31 de cada mes." : `Tu ciclo irá del día ${dia} de un mes al ${dia - 1} del siguiente.`}
      </p>
      <p className="mt-2.5 rounded-xl border border-dashed border-white/15 px-3 py-2 text-[10.5px] leading-relaxed text-white/40">
        Por ahora esto solo cambia el resumen de Inicio (Balance/Ingresos/Gastos) — Movimientos, Reportes, Presupuesto y
        Tarjetas siguen agrupando por mes calendario.
      </p>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      <button
        type="button"
        disabled={guardando}
        onClick={guardar}
        className="mt-3 w-full rounded-full bg-white py-3 text-sm font-bold text-black disabled:opacity-60"
      >
        {guardando ? "Guardando…" : "Guardar"}
      </button>
    </SheetBase>
  );
}

// "Balance" (Ronda 9, real): elegir qué cuentas suman al balance/apertura
// del mes de Inicio. Antes siempre sumaba todo menos tarjetas de crédito —
// eso sigue siendo lo que pasa con Débito/Efectivo en true y Cupo TC en
// false (los valores de siempre). Línea de crédito y crédito hipotecario
// siempre suman, como hasta ahora (no son parte de este selector porque el
// mockup original tampoco los mostraba).
function Switch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`relative inline-block h-[22px] w-9 shrink-0 rounded-full transition-colors ${on ? "bg-white" : "bg-white/15"}`}
    >
      <span className={`absolute top-[3px] h-4 w-4 rounded-full transition-transform ${on ? "translate-x-[19px] bg-black" : "translate-x-[3px] bg-white"}`} />
    </button>
  );
}
function SheetBalance({
  prefs,
  onClose,
  onGuardar,
}: {
  prefs: PreferenciasUsuario;
  onClose: () => void;
  onGuardar: (cambios: Pick<PreferenciasUsuario, "balance_incluye_debito" | "balance_incluye_efectivo" | "balance_incluye_cupo_tc">) => Promise<string | null>;
}) {
  const [debito, setDebito] = useState(prefs.balance_incluye_debito);
  const [efectivo, setEfectivo] = useState(prefs.balance_incluye_efectivo);
  const [cupoTc, setCupoTc] = useState(prefs.balance_incluye_cupo_tc);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  async function aplicar() {
    setGuardando(true);
    setError("");
    const err = await onGuardar({ balance_incluye_debito: debito, balance_incluye_efectivo: efectivo, balance_incluye_cupo_tc: cupoTc });
    setGuardando(false);
    if (err) {
      setError(err);
      return;
    }
    onClose();
  }

  return (
    <SheetBase titulo="Balance" subtitulo="¿Qué incluir en tu balance?" onClose={onClose}>
      <div className="mt-3 divide-y divide-white/10">
        <div className="flex items-center gap-3 py-2.5">
          <span className="flex-1 text-sm font-semibold">Débito</span>
          <Switch on={debito} onClick={() => setDebito((v) => !v)} />
        </div>
        <div className="flex items-center gap-3 py-2.5">
          <span className="flex-1 text-sm font-semibold">Efectivo</span>
          <Switch on={efectivo} onClick={() => setEfectivo((v) => !v)} />
        </div>
        <div className="flex items-center gap-3 py-2.5">
          <span className="flex-1 text-sm font-semibold">Cupo TC</span>
          <Switch on={cupoTc} onClick={() => setCupoTc((v) => !v)} />
        </div>
      </div>
      <p className="mt-2.5 text-[10.5px] text-white/40">
        "Cupo TC" suma el cupo disponible de tus tarjetas de crédito (no un saldo). Línea de crédito y crédito
        hipotecario siempre suman, como hasta ahora.
      </p>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      <button
        type="button"
        disabled={guardando}
        onClick={aplicar}
        className="mt-3 w-full rounded-full bg-white py-3 text-sm font-bold text-black disabled:opacity-60"
      >
        {guardando ? "Aplicando…" : "Aplicar"}
      </button>
    </SheetBase>
  );
}

// "Vista principal" (Ronda 9, real): qué pestaña de Inicio (celular) abre
// primero, y en qué orden se muestran las 3 tarjetas de "Resumen" (y, de
// paso, si "Presupuesto por categoría" o "Cuentas y tarjetas" va primero en
// escritorio — ver app/page.tsx, `presupuestoPrimeroEnDesktop`). Reordenar
// con ▲▼ en vez de arrastrar: mismo criterio simple que el resto de la app,
// sin sumar una librería de drag-and-drop para 3 filas.
const LABEL_SECCION_RESUMEN: Record<string, string> = {
  categoria: "Gastos por categoría",
  presupuesto_categorias: "Presupuesto por categoría",
  actividad_mes: "Actividad del mes",
};
const LABEL_PESTANA: Record<PreferenciasUsuario["pestana_inicio_defecto"], string> = {
  resumen: "Resumen",
  ingresos: "Ingresos",
  presupuesto: "Presupuestos",
};
function SheetVistaPrincipal({
  prefs,
  onClose,
  onGuardar,
}: {
  prefs: PreferenciasUsuario;
  onClose: () => void;
  onGuardar: (cambios: Pick<PreferenciasUsuario, "pestana_inicio_defecto" | "orden_resumen">) => Promise<string | null>;
}) {
  const [pestana, setPestana] = useState(prefs.pestana_inicio_defecto);
  const [orden, setOrden] = useState<string[]>(ordenResumenValido(prefs.orden_resumen));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  function mover(i: number, dir: -1 | 1) {
    setOrden((actual) => {
      const j = i + dir;
      if (j < 0 || j >= actual.length) return actual;
      const copia = [...actual];
      [copia[i], copia[j]] = [copia[j], copia[i]];
      return copia;
    });
  }

  async function guardar() {
    setGuardando(true);
    setError("");
    const err = await onGuardar({ pestana_inicio_defecto: pestana, orden_resumen: orden });
    setGuardando(false);
    if (err) {
      setError(err);
      return;
    }
    onClose();
  }

  return (
    <SheetBase titulo="Vista principal" subtitulo="Elegí qué ver primero en Inicio" onClose={onClose}>
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-white/40">Pestaña que abre primero (celular)</p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {(Object.keys(LABEL_PESTANA) as PreferenciasUsuario["pestana_inicio_defecto"][]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPestana(p)}
            className={`rounded-full py-2 text-xs font-semibold ${pestana === p ? "bg-white text-black" : "bg-white/10 text-white/70"}`}
          >
            {LABEL_PESTANA[p]}
          </button>
        ))}
      </div>

      <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-white/40">Orden de las tarjetas de "Resumen"</p>
      <div className="mt-2 divide-y divide-white/10 rounded-xl border border-white/10">
        {orden.map((clave, i) => (
          <div key={clave} className="flex items-center gap-2 px-3 py-2.5">
            <span className="flex-1 text-sm">{LABEL_SECCION_RESUMEN[clave] ?? clave}</span>
            <button type="button" disabled={i === 0} onClick={() => mover(i, -1)} aria-label="subir" className="text-white/60 disabled:opacity-20">
              ▲
            </button>
            <button type="button" disabled={i === orden.length - 1} onClick={() => mover(i, 1)} aria-label="bajar" className="text-white/60 disabled:opacity-20">
              ▼
            </button>
          </div>
        ))}
      </div>

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      <button
        type="button"
        disabled={guardando}
        onClick={guardar}
        className="mt-4 w-full rounded-full bg-white py-3 text-sm font-bold text-black disabled:opacity-60"
      >
        {guardando ? "Guardando…" : "Guardar"}
      </button>
    </SheetBase>
  );
}

// "Sugerir un logo" (Ronda 9, real) — distinto de "Logos de marca" (que
// apunta a /admin, donde el ADMIN sube el logo): esto es para que
// CUALQUIER usuario pida el logo de una marca que todavía no lo tiene. Ver
// migration_41_solicitudes_logo.sql — el admin ve todos los pedidos
// pendientes en /admin.
function SheetSugerirLogo({
  marcas,
  propias,
  onClose,
  onEnviar,
}: {
  marcas: Marca[];
  propias: SolicitudLogo[];
  onClose: () => void;
  onEnviar: (marcaId: string, nota: string) => Promise<string | null>;
}) {
  const marcasSinLogo = marcas.filter((m) => !m.logo_url);
  const [marcaId, setMarcaId] = useState("");
  const [nota, setNota] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState("");

  async function enviar() {
    if (!marcaId) return;
    setEnviando(true);
    setError("");
    const err = await onEnviar(marcaId, nota);
    setEnviando(false);
    if (err) {
      setError(err);
      return;
    }
    setEnviado(true);
  }

  return (
    <SheetBase titulo="Sugerir un logo" subtitulo="Pedí el logo de una marca que todavía no lo tiene" onClose={onClose}>
      {enviado ? (
        <p className="mt-4 text-sm text-white/70">
          Listo — se lo pasamos a quien administra el catálogo. Cuando lo suba, el logo va a aparecer solo en esa marca.
        </p>
      ) : marcasSinLogo.length === 0 ? (
        <p className="mt-4 text-sm text-white/50">Todas las marcas del catálogo ya tienen logo — ¡nada que pedir por ahora!</p>
      ) : (
        <>
          <div className="mt-4">
            <label className="text-xs text-white/50">Marca</label>
            <select
              value={marcaId}
              onChange={(e) => setMarcaId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
            >
              <option value="">Elegir…</option>
              {marcasSinLogo.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-3">
            <label className="text-xs text-white/50">Nota (opcional)</label>
            <input
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Ej: es la app azul con una hoja"
              className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
            />
          </div>
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
          <button
            type="button"
            disabled={!marcaId || enviando}
            onClick={enviar}
            className="mt-4 w-full rounded-full bg-white py-3 text-sm font-bold text-black disabled:opacity-60"
          >
            {enviando ? "Enviando…" : "Enviar pedido"}
          </button>
        </>
      )}
      {propias.length > 0 && (
        <div className="mt-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40">Tus pedidos</p>
          <ul className="mt-1.5 space-y-1">
            {propias.map((s) => (
              <li key={s.id} className="text-xs text-white/50">
                {marcas.find((m) => m.id === s.marca_id)?.nombre ?? "Marca"} — {s.estado === "pendiente" ? "en revisión" : "resuelto"}
              </li>
            ))}
          </ul>
        </div>
      )}
    </SheetBase>
  );
}

// "Seleccionar Tema" (ronda 6, calcado de la captura de referencia) — a
// diferencia de las hojas de arriba, ESTA sí es real: usa el mismo
// ThemeProvider de siempre (lib/theme.tsx), solo que ahora vive en una hoja
// inferior con las 3 opciones en vez del selector "pill" chico (que se
// mantiene igual en el pie del Sidebar de escritorio, ver ThemeToggle.tsx).
const OPCIONES_TEMA: { value: PreferenciaTema; label: string }[] = [
  { value: "light", label: "Claro" },
  { value: "dark", label: "Oscuro" },
  { value: "system", label: "Automático" },
];

function SheetTema({ onClose }: { onClose: () => void }) {
  const { preferencia, setPreferencia } = useTheme();
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-t-3xl bg-[#111113] p-5 pb-7 text-white sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h2 className="text-base font-bold">Seleccionar tema</h2>
          <button onClick={onClose} aria-label="Cerrar" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10">
            ✕
          </button>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {OPCIONES_TEMA.map((o) => {
            const activo = preferencia === o.value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  setPreferencia(o.value);
                  onClose();
                }}
                className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-3 ${
                  activo ? "border-white" : "border-white/10"
                }`}
              >
                <span
                  className={`h-14 w-10 rounded-lg ${
                    o.value === "dark" ? "bg-black" : o.value === "light" ? "bg-white" : "bg-gradient-to-r from-white to-black"
                  }`}
                />
                <span className="text-xs font-semibold">{o.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Adivina un nombre a partir del correo (ej. "leiva.dj@gmail.com" -> "Leiva
// Dj") para no dejar el perfil sin nombre al crearlo solo — se puede
// cambiar al toque desde "editar".
function nombreDesdeCorreo(correo: string): string {
  const usuario = correo.split("@")[0] || "Yo";
  return usuario
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((palabra) => palabra.charAt(0).toUpperCase() + palabra.slice(1))
    .join(" ");
}

// Traduce errores conocidos a un mensaje entendible. "personas_nombre_key"
// es una restricción vieja (de antes de separar los datos por cuenta) que
// exige nombre único en TODAS las cuentas — ver migration_17. Se exporta
// porque /personas también la usa para el error al agregar "otras
// personas" (misma tabla, misma restricción).
export function traducirErrorPersona(err: unknown): string {
  const msg = mensajeError(err);
  if (msg.includes("personas_nombre_key")) {
    return "Todavía falta correr la migración de Supabase migration_17_elimina_unico_nombre_global_personas_grupos.sql — hay una restricción vieja que exige que el nombre sea único entre TODAS las cuentas (no solo la tuya). Corre esa migración y vuelve a intentar.";
  }
  if (msg.includes("personas_owner_id_nombre_key")) {
    return "Ya tienes una persona con ese nombre en tu cuenta.";
  }
  return msg || "No se pudo guardar.";
}

// Tarjeta "Tu perfil": foto, nombre editable, cuánto debes/ingresaste este
// mes, atajos a tarjetas y "Cerrar sesión". Crea sola tu persona "propia"
// (es_self) la primera vez que se monta, con un nombre adivinado desde tu
// correo. Vive solo en /mas (arriba de la lista de accesos) — /personas ya
// no la repite, para no mostrar dos veces el perfil y dos botones de
// cerrar sesión distintos; ahí solo queda la gestión de "otras personas"
// para repartos.
export function PerfilPropioCard() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [resumen, setResumen] = useState<ResumenPersonaMes[]>([]);
  const [ingresos, setIngresos] = useState<Ingreso[]>([]);
  const [correo, setCorreo] = useState("");
  const [cargado, setCargado] = useState(false);
  // Ronda 9: preferencias reales de "Inicio del mes"/"Balance"/"Vista
  // principal" (antes hojas de solo ejemplo) y catálogo de marcas +
  // pedidos propios de logo, para "Sugerir un logo".
  const [preferencias, setPreferencias] = useState<PreferenciasUsuario | null>(null);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [solicitudesLogoPropias, setSolicitudesLogoPropias] = useState<SolicitudLogo[]>([]);
  const prefs = conDefectos(preferencias);

  const [editandoPerfil, setEditandoPerfil] = useState(false);
  const [nombrePerfil, setNombrePerfil] = useState("");
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [errorPerfil, setErrorPerfil] = useState("");
  const [sheetAbierto, setSheetAbierto] = useState<"inicio_mes" | "balance" | "tema" | "vista_principal" | "sugerir_logo" | null>(null);
  const [mostrarEliminarCuenta, setMostrarEliminarCuenta] = useState(false);
  const { preferencia } = useTheme();
  const intentoCrearPerfil = useRef(false);

  async function cargar() {
    // Sesión primero: "solicitudes_logo" se filtra a mano por owner_id
    // porque su policy de lectura deja ver TODAS las solicitudes a las
    // cuentas admin (para que /admin las vea todas) — sin este filtro, "Tus
    // pedidos" le mostraría a un admin los pedidos de todo el mundo, no
    // solo los propios.
    const { data: sesion } = await supabase.auth.getSession();
    const uid = sesion.session?.user?.id;
    const [{ data: p }, { data: r }, { data: i }, { data: prf }, { data: mar }, { data: sl }] = await Promise.all([
      supabase.from("personas").select("*").order("nombre"),
      supabase.from("vista_resumen_personas_mes").select("*"),
      supabase.from("ingresos").select("*"),
      supabase.from("preferencias_usuario").select("*").maybeSingle(),
      supabase.from("marcas").select("*").order("nombre"),
      uid
        ? supabase.from("solicitudes_logo").select("*").eq("owner_id", uid).order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as SolicitudLogo[] }),
    ]);
    setPersonas((p as Persona[]) ?? []);
    setResumen((r as ResumenPersonaMes[]) ?? []);
    setIngresos((i as Ingreso[]) ?? []);
    setPreferencias((prf as PreferenciasUsuario) ?? null);
    setMarcas((mar as Marca[]) ?? []);
    setSolicitudesLogoPropias((sl as SolicitudLogo[]) ?? []);
    setCargado(true);
  }

  // Guarda cambios parciales de preferencias_usuario — upsert por owner_id
  // (llave primaria con default auth.uid(), ver migration_40), así que no
  // hace falta mandarlo a mano ni pasarle `onConflict`.
  async function guardarPreferencias(cambios: Partial<Omit<PreferenciasUsuario, "owner_id" | "updated_at">>): Promise<string | null> {
    const actual = conDefectos(preferencias);
    const { error } = await supabase.from("preferencias_usuario").upsert({
      dia_inicio_mes: actual.dia_inicio_mes,
      balance_incluye_debito: actual.balance_incluye_debito,
      balance_incluye_efectivo: actual.balance_incluye_efectivo,
      balance_incluye_cupo_tc: actual.balance_incluye_cupo_tc,
      pestana_inicio_defecto: actual.pestana_inicio_defecto,
      orden_resumen: actual.orden_resumen,
      ...cambios,
      updated_at: new Date().toISOString(),
    });
    if (error) return mensajeError(error) || "No se pudo guardar.";
    cargar();
    return null;
  }

  async function enviarSolicitudLogo(marcaId: string, nota: string): Promise<string | null> {
    const { error } = await supabase.from("solicitudes_logo").insert({ marca_id: marcaId, nota: nota.trim() || null });
    if (error) return mensajeError(error) || "No se pudo enviar el pedido.";
    cargar();
    return null;
  }

  useEffect(() => {
    cargar();
    supabase.auth.getSession().then(({ data }) => setCorreo(data.session?.user?.email ?? ""));
  }, []);

  // Si todavía no existe tu persona "propia" (es_self), se crea sola la
  // primera vez — con un nombre adivinado desde tu correo, editable al
  // toque. El índice único en la base evita duplicados aunque este efecto
  // se dispare dos veces (ej. en desarrollo, o si /personas y /mas se
  // montan casi juntos).
  useEffect(() => {
    if (intentoCrearPerfil.current) return;
    if (!cargado || !correo) return;
    const yaExiste = personas.some((p) => p.es_self);
    if (yaExiste) return;
    intentoCrearPerfil.current = true;
    supabase
      .from("personas")
      .insert({ nombre: nombreDesdeCorreo(correo), es_self: true, activo: true })
      .then(({ error }) => {
        if (!error) cargar();
      });
  }, [cargado, personas, correo]);

  const perfilPropio = personas.find((p) => p.es_self) ?? null;

  function iniciarEdicionPerfil() {
    if (!perfilPropio) return;
    setNombrePerfil(perfilPropio.nombre);
    setErrorPerfil("");
    setEditandoPerfil(true);
  }

  async function guardarNombrePerfil(e: FormEvent) {
    e.preventDefault();
    if (!perfilPropio) return;
    setGuardandoPerfil(true);
    setErrorPerfil("");
    try {
      const { error } = await supabase.from("personas").update({ nombre: nombrePerfil }).eq("id", perfilPropio.id);
      if (error) throw error;
      setEditandoPerfil(false);
      cargar();
    } catch (err) {
      setErrorPerfil(traducirErrorPersona(err));
    } finally {
      setGuardandoPerfil(false);
    }
  }

  async function cambiarFoto(archivo: File | null) {
    if (!archivo || !perfilPropio) return;
    setSubiendoFoto(true);
    setErrorPerfil("");
    try {
      const url = await subirImagenPropia("personas-fotos", archivo);
      const { error } = await supabase.from("personas").update({ foto_url: url }).eq("id", perfilPropio.id);
      if (error) throw error;
      cargar();
    } catch (err) {
      setErrorPerfil(mensajeError(err) || "No se pudo subir la foto.");
    } finally {
      setSubiendoFoto(false);
    }
  }

  const mesActualPrefix = mesActualISO().slice(0, 7); // "AAAA-MM"
  function debeEstaPersona(personaId: string) {
    return resumen.find((r) => r.persona_id === personaId)?.total ?? 0;
  }
  function ingresoEstaPersona(personaId: string) {
    return ingresos
      .filter((i) => i.persona_id === personaId && i.mes.slice(0, 7) === mesActualPrefix)
      .reduce((acc, i) => acc + Number(i.monto), 0);
  }

  if (!perfilPropio) return null;

  const labelTema = OPCIONES_TEMA.find((o) => o.value === preferencia)?.label ?? "Automático";

  return (
    <div className="space-y-4">
    <Card>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Tu perfil</p>
      <div className="flex items-center gap-3">
        <label className="group relative cursor-pointer">
          <PersonaAvatar fotoUrl={perfilPropio.foto_url} nombre={perfilPropio.nombre} className="h-16 w-16" />
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 text-[10px] font-medium text-transparent group-hover:bg-black/40 group-hover:text-white">
            {subiendoFoto ? "…" : "Cambiar"}
          </span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={subiendoFoto}
            onChange={(e) => cambiarFoto(e.target.files?.[0] ?? null)}
          />
        </label>

        <div className="min-w-0 flex-1">
          {editandoPerfil ? (
            <form onSubmit={guardarNombrePerfil} className="flex items-center gap-2">
              <input
                autoFocus
                required
                value={nombrePerfil}
                onChange={(e) => setNombrePerfil(e.target.value)}
                className="w-full min-w-0 rounded-lg border border-gray-200 px-2 py-1 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
              <button
                type="submit"
                disabled={guardandoPerfil}
                className="shrink-0 text-xs font-semibold text-brand-from dark:text-white disabled:opacity-60"
              >
                Guardar
              </button>
              <button type="button" onClick={() => setEditandoPerfil(false)} className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
                cancelar
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-2">
              <p className="truncate font-semibold text-gray-800 dark:text-white">{perfilPropio.nombre}</p>
              <button onClick={iniciarEdicionPerfil} className="shrink-0 text-xs text-brand-from dark:text-white">
                editar
              </button>
            </div>
          )}
          <p className="truncate text-xs text-gray-400 dark:text-gray-500">{correo}</p>
        </div>
      </div>

      {errorPerfil && <p className="mt-2 text-xs text-red-500 dark:text-red-400">{errorPerfil}</p>}

      <div className="mt-3 flex items-center justify-between text-sm">
        <div>
          <p className="text-[11px] text-gray-400 dark:text-gray-500">Debe este mes</p>
          <p className="font-semibold text-gray-800 dark:text-white">
            <ContadorOdometro texto={formatCLP(debeEstaPersona(perfilPropio.id))} />
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-gray-400 dark:text-gray-500">Ingresó este mes</p>
          <p className="font-semibold text-gray-800 dark:text-white">
            <ContadorOdometro texto={formatCLP(ingresoEstaPersona(perfilPropio.id))} />
          </p>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <Link
          href="/tarjetas?nueva=1"
          className="flex-1 rounded-lg bg-brand-gradient py-2 text-center text-xs font-semibold text-white"
        >
          + Agregar tarjeta
        </Link>
        <Link
          href="/tarjetas"
          className="flex-1 rounded-lg border border-gray-200 dark:border-white/10 py-2 text-center text-xs font-semibold text-gray-500 dark:text-gray-300"
        >
          Ver mis tarjetas
        </Link>
      </div>
    </Card>

      {/* Ronda 6 del rediseño — "Mi perfil" reorganizado en secciones,
          calcado de las capturas de referencia que mandó el usuario (una
          app de terceros, "Not Pato"): Perfil financiero/Cartola sueltas,
          luego Integraciones/Configuración/Apariencia agrupadas con flecha
          para entrar, terminando en Cerrar sesión/Eliminar cuenta. Se
          quedaron afuera a propósito los ítems tachados en las capturas
          (WhatsApp, Suscripción/"Not Pato Pro", Moneda, Tono de voz, Face
          ID, y toda la sección Soporte — ayuda, calificar, reseña,
          términos) porque son de la app de referencia, no de esta. */}
      <div className="divide-y divide-gray-100 rounded-2xl border border-gray-100 bg-white px-4 dark:divide-white/10 dark:border-white/10 dark:bg-neutral-900">
        <FilaLista
          titulo="Perfil financiero"
          subtitulo="Activa tu perfil ingresando tu sueldo en “editar”"
          disabled
        />
        <FilaLista titulo="Cartola consolidado" subtitulo="Une todas tus cuentas en un solo PDF" disabled />
      </div>

      <Seccion titulo="Integraciones">
        <FilaLista titulo="Mis tarjetas" subtitulo="Ver y administrar tus cuentas" href="/tarjetas" />
        <FilaLista titulo="Conectar banco" subtitulo="Conectar tus cuentas bancarias automáticamente" disabled />
        <FilaLista titulo="Apple Pay" subtitulo="Registrar pagos hechos con Apple Pay" disabled />
      </Seccion>

      <Seccion titulo="Configuración">
        <FilaLista titulo="Categorías" href="/categorias" />
        <FilaLista titulo="Presupuestos" subtitulo="Presupuesto mensual por categoría" href="/presupuesto" />
        <FilaLista
          titulo="Reglas de categorización"
          subtitulo="Aprende de tu correo qué categoría va con cada comercio"
          href="/reglas-categorizacion"
        />
        <FilaLista
          titulo="Inicio del mes"
          subtitulo={prefs.dia_inicio_mes === 1 ? "Tu ciclo empieza el día 1 (de siempre)" : `Tu ciclo empieza el día ${prefs.dia_inicio_mes}`}
          onClick={() => setSheetAbierto("inicio_mes")}
        />
        <NotificacionesPush compacto />
        <FilaLista
          titulo="Balance"
          subtitulo={[
            prefs.balance_incluye_debito && "Débito",
            prefs.balance_incluye_efectivo && "Efectivo",
            prefs.balance_incluye_cupo_tc && "Cupo TC",
          ]
            .filter(Boolean)
            .join(" + ") || "Nada seleccionado"}
          onClick={() => setSheetAbierto("balance")}
        />
      </Seccion>

      {/* Ronda 9: "Logos de marca" era un placeholder "Próximamente" de una
          ronda vieja, pero YA se suben y muestran logos reales de marca desde
          antes (EntidadAvatar.tsx y TarjetaVisual.tsx ya leen
          marca.logo_url) — quedó huérfano. Ronda 10 (unificación de
          categorías, ver claude/propuesta-modulo-compromisos.md) movió esa
          función de /admin a /categorias ("Marcas" queda debajo de las
          categorías ahí) — este ítem apunta ahora ahí en vez de a /admin. */}
      <Seccion titulo="Apariencia">
        <FilaLista
          titulo="Tema"
          onClick={() => setSheetAbierto("tema")}
          right={
            <span className="flex shrink-0 items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
              {labelTema}
              <IconoFlecha />
            </span>
          }
        />
        <FilaLista titulo="Vista principal" subtitulo="Elegir qué ver primero en Inicio" onClick={() => setSheetAbierto("vista_principal")} />
        <FilaLista
          titulo="Logos de marca"
          subtitulo="Ya se muestran solos cuando existen — súbelos en Categorías"
          href="/categorias"
        />
        <FilaLista
          titulo="Sugerir un logo"
          subtitulo="Pedir el logo de un comercio que falta"
          onClick={() => setSheetAbierto("sugerir_logo")}
        />
      </Seccion>

      <div className="mt-4 space-y-2">
        <button
          onClick={() => supabase.auth.signOut()}
          className="w-full rounded-lg border border-gray-200 dark:border-white/10 py-2 text-xs font-semibold text-gray-500 dark:text-gray-300 hover:border-red-200 hover:text-red-500"
        >
          Cerrar sesión
        </button>
        {mostrarEliminarCuenta ? (
          <p className="rounded-lg border border-dashed border-gray-200 px-3 py-2 text-center text-[11px] text-gray-400 dark:border-white/10 dark:text-gray-500">
            Por ahora esto no se puede hacer solo desde la app — escríbele a quien te dio acceso a Gastos del Hogar para pedir que
            elimine tu cuenta.
          </p>
        ) : (
          <button
            onClick={() => setMostrarEliminarCuenta(true)}
            className="w-full py-1 text-center text-[11px] font-semibold text-gray-300 hover:text-red-400 dark:text-gray-600"
          >
            Eliminar cuenta
          </button>
        )}
      </div>

      {sheetAbierto === "inicio_mes" && (
        <SheetInicioMes
          diaActual={prefs.dia_inicio_mes}
          onClose={() => setSheetAbierto(null)}
          onGuardar={(dia) => guardarPreferencias({ dia_inicio_mes: dia })}
        />
      )}
      {sheetAbierto === "balance" && (
        <SheetBalance prefs={prefs} onClose={() => setSheetAbierto(null)} onGuardar={(cambios) => guardarPreferencias(cambios)} />
      )}
      {sheetAbierto === "vista_principal" && (
        <SheetVistaPrincipal prefs={prefs} onClose={() => setSheetAbierto(null)} onGuardar={(cambios) => guardarPreferencias(cambios)} />
      )}
      {sheetAbierto === "sugerir_logo" && (
        <SheetSugerirLogo
          marcas={marcas}
          propias={solicitudesLogoPropias}
          onClose={() => setSheetAbierto(null)}
          onEnviar={enviarSolicitudLogo}
        />
      )}
      {sheetAbierto === "tema" && <SheetTema onClose={() => setSheetAbierto(null)} />}
    </div>
  );
}
