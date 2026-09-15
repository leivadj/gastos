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
import { Ingreso, Persona, ResumenPersonaMes } from "@/lib/types";
import { PreferenciaTema, useTheme } from "@/lib/theme";

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

// Envoltorio común de las hojas de demostración: mismo fondo oscuro +
// bottom-sheet que el resto de la app (ver DividirGastoSheet.tsx), con un
// aviso fijo de que es solo un ejemplo — ninguna de las dos guarda nada de
// verdad todavía.
function SheetDemo({ titulo, subtitulo, onClose, children, textoBoton }: { titulo: string; subtitulo?: string; onClose: () => void; children: ReactNode; textoBoton: string }) {
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

        <p className="mt-4 rounded-xl border border-dashed border-white/15 px-3 py-2 text-[10.5px] leading-relaxed text-white/40">
          Vista de ejemplo — todavía no se puede guardar de verdad, próximamente.
        </p>
        <button
          type="button"
          disabled
          className="mt-3 w-full cursor-not-allowed rounded-full bg-white/20 py-3 text-sm font-bold text-white/50"
        >
          {textoBoton}
        </button>
      </div>
    </div>
  );
}

// "Inicio del mes" (Sheets.dc.html) — elegir qué día del mes empieza el
// ciclo. Grilla de ejemplo estática (día 1 marcado, igual que el mockup) —
// hoy el ciclo siempre empieza el día 1 de cada mes en toda la app, esto
// solo muestra cómo se vería el selector.
function SheetInicioMesDemo({ onClose }: { onClose: () => void }) {
  const dias = Array.from({ length: 14 }, (_, i) => i + 1);
  return (
    <SheetDemo titulo="Inicio del mes" subtitulo="¿Cuándo comienza tu ciclo?" onClose={onClose} textoBoton="Guardar">
      <div className="mt-4 grid grid-cols-7 gap-1.5">
        {dias.map((d) => (
          <span
            key={d}
            className={`flex aspect-square items-center justify-center rounded-[10px] text-xs font-semibold ${
              d === 1 ? "bg-white font-extrabold text-black" : "bg-white/5 text-white/70"
            }`}
          >
            {d}
          </span>
        ))}
      </div>
      <p className="mt-3.5 text-[11.5px] text-white/50">Tu mes irá del 1 al 30 de cada mes.</p>
    </SheetDemo>
  );
}

// "Balance" (Sheets.dc.html) — elegir qué cuentas suman al balance
// general. Switches de ejemplo estáticos (Débito/Efectivo activados, Cupo
// TC desactivado, igual que el mockup) — hoy el balance de la app siempre
// suma todas las cuentas.
function SwitchDemo({ on }: { on: boolean }) {
  return (
    <span className={`relative inline-block h-[22px] w-9 shrink-0 rounded-full transition-colors ${on ? "bg-white" : "bg-white/15"}`}>
      <span
        className={`absolute top-[3px] h-4 w-4 rounded-full transition-transform ${on ? "translate-x-[19px] bg-black" : "translate-x-[3px] bg-white"}`}
      />
    </span>
  );
}
function SheetBalanceDemo({ onClose }: { onClose: () => void }) {
  const filas = [
    { titulo: "Débito", on: true },
    { titulo: "Efectivo", on: true },
    { titulo: "Cupo TC", on: false },
  ];
  return (
    <SheetDemo titulo="Balance" subtitulo="¿Qué incluir en tu balance?" onClose={onClose} textoBoton="Aplicar">
      <div className="mt-3 divide-y divide-white/10">
        {filas.map((f) => (
          <div key={f.titulo} className="flex items-center gap-3 py-2.5">
            <span className="flex-1 text-sm font-semibold">{f.titulo}</span>
            <SwitchDemo on={f.on} />
          </div>
        ))}
      </div>
    </SheetDemo>
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

  const [editandoPerfil, setEditandoPerfil] = useState(false);
  const [nombrePerfil, setNombrePerfil] = useState("");
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [errorPerfil, setErrorPerfil] = useState("");
  const [sheetAbierto, setSheetAbierto] = useState<"inicio_mes" | "balance" | "tema" | null>(null);
  const [mostrarEliminarCuenta, setMostrarEliminarCuenta] = useState(false);
  const { preferencia } = useTheme();
  const intentoCrearPerfil = useRef(false);

  async function cargar() {
    const [{ data: p }, { data: r }, { data: i }] = await Promise.all([
      supabase.from("personas").select("*").order("nombre"),
      supabase.from("vista_resumen_personas_mes").select("*"),
      supabase.from("ingresos").select("*"),
    ]);
    setPersonas((p as Persona[]) ?? []);
    setResumen((r as ResumenPersonaMes[]) ?? []);
    setIngresos((i as Ingreso[]) ?? []);
    setCargado(true);
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
        <FilaLista titulo="Inicio del mes" subtitulo="Hoy siempre es el día 1" onClick={() => setSheetAbierto("inicio_mes")} />
        <NotificacionesPush compacto />
        <FilaLista titulo="Balance" subtitulo="Qué cuentas suman al balance (hoy suma todas)" onClick={() => setSheetAbierto("balance")} />
      </Seccion>

      {/* Ronda 9: "Logos de marca" era un placeholder "Próximamente" de una
          ronda vieja, pero /admin (panel de Categorías y Marcas) YA subía y
          mostraba logos reales de marca desde antes (EntidadAvatar.tsx y
          TarjetaVisual.tsx ya leen marca.logo_url) — quedó huérfano. Ahora
          apunta directo a /admin, donde la función ya existe de verdad. */}
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
        <FilaLista titulo="Vista principal" subtitulo="Elegir qué ver primero en Inicio" disabled />
        <FilaLista
          titulo="Logos de marca"
          subtitulo="Ya se muestran solos cuando existen — súbelos en el panel admin"
          href="/admin"
        />
        <FilaLista titulo="Sugerir un logo" subtitulo="Pedir el logo de un comercio que falta" disabled />
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

      {sheetAbierto === "inicio_mes" && <SheetInicioMesDemo onClose={() => setSheetAbierto(null)} />}
      {sheetAbierto === "balance" && <SheetBalanceDemo onClose={() => setSheetAbierto(null)} />}
      {sheetAbierto === "tema" && <SheetTema onClose={() => setSheetAbierto(null)} />}
    </div>
  );
}
