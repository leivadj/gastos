"use client";

import Link from "next/link";
import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/Card";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificacionesPush } from "@/components/NotificacionesPush";
import { PersonaAvatar } from "@/components/PersonaAvatar";
import { ContadorOdometro } from "@/components/ContadorOdometro";
import { subirImagenPropia } from "@/lib/subirImagen";
import { mensajeError } from "@/lib/supabaseError";
import { formatCLP, mesActualISO } from "@/lib/format";
import { Ingreso, Persona, ResumenPersonaMes } from "@/lib/types";

// Fila deshabilitada para algo que el mockup muestra pero que hoy no es
// una función real de la app (ver el comentario donde se usa, más abajo).
function FilaProximamente({ titulo, descripcion }: { titulo: string; descripcion: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-dashed border-gray-200 px-3 py-2 opacity-60 dark:border-white/10">
      <div className="min-w-0 pr-2">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{titulo}</p>
        <p className="truncate text-[10.5px] text-gray-400 dark:text-gray-500">{descripcion}</p>
      </div>
      <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-400 dark:bg-white/10 dark:text-gray-500">
        Próximamente
      </span>
    </div>
  );
}

// Variante clickeable de FilaProximamente — para "Reglas de
// categorización" (única función de las 4 sin respaldo real que además
// tiene una pantalla de demostración construida, ver
// app/reglas-categorizacion/page.tsx), a diferencia de las otras 3
// (Cartola consolidado/Integraciones/Suscripción Premium) que son solo una
// fila deshabilitada sin nada detrás.
function FilaProximamenteConDemo({ titulo, descripcion, href }: { titulo: string; descripcion: string; href: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-lg border border-dashed border-gray-200 px-3 py-2 dark:border-white/10"
    >
      <div className="min-w-0 pr-2">
        <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">{titulo}</p>
        <p className="truncate text-[10.5px] text-gray-400 dark:text-gray-500">{descripcion}</p>
      </div>
      <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-400 dark:bg-white/10 dark:text-gray-500">
        Próximamente
      </span>
    </Link>
  );
}

// Otra variante clickeable — para "Inicio del mes" y "Balance", que en vez
// de llevar a una pantalla nueva abren una hoja (bottom sheet) de
// demostración calcada de Sheets.dc.html (ver los dos componentes de más
// abajo). Un <button> en vez de <Link> porque no navega, solo abre el sheet.
function FilaProximamenteConSheet({ titulo, descripcion, onClick }: { titulo: string; descripcion: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-lg border border-dashed border-gray-200 px-3 py-2 text-left dark:border-white/10"
    >
      <div className="min-w-0 pr-2">
        <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">{titulo}</p>
        <p className="truncate text-[10.5px] text-gray-400 dark:text-gray-500">{descripcion}</p>
      </div>
      <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-400 dark:bg-white/10 dark:text-gray-500">
        Próximamente
      </span>
    </button>
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
  const [sheetAbierto, setSheetAbierto] = useState<"inicio_mes" | "balance" | null>(null);
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

  return (
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

      {/* Estas 3 filas están en el mockup pero no son funciones que existan
          hoy (unir cuentas en un PDF, conectar cuentas bancarias de
          verdad, cobro de una suscripción) — Felipe pidió dejarlas
          visibles en su lugar del mockup, marcadas "Próximamente" en vez
          de ocultarlas o simular que ya funcionan. */}
      <div className="mt-3 space-y-2">
        <FilaProximamente titulo="Cartola consolidado" descripcion="Une todas tus cuentas en un solo PDF" />
        <FilaProximamente titulo="Integraciones" descripcion="Conectar tus cuentas bancarias automáticamente" />
        <FilaProximamente titulo="Suscripción Premium" descripcion="Funciones extra con una suscripción paga" />
      </div>

      <p className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
        Configuración
      </p>

      <div className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-white/10 px-3 py-2">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Tema</span>
        <ThemeToggle />
      </div>

      <NotificacionesPush />

      <div className="mt-2 space-y-2">
        <FilaProximamenteConSheet
          titulo="Inicio del mes"
          descripcion="Elegir qué día del mes empieza tu ciclo (hoy siempre es el día 1)"
          onClick={() => setSheetAbierto("inicio_mes")}
        />
        <FilaProximamenteConSheet
          titulo="Balance"
          descripcion="Elegir qué cuentas suman al balance (hoy suma todas)"
          onClick={() => setSheetAbierto("balance")}
        />
        <FilaProximamenteConDemo
          titulo="Reglas de categorización"
          descripcion="Aprende de tu correo qué categoría va con cada comercio"
          href="/reglas-categorizacion"
        />
        <Link
          href="/categorias"
          className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-500 dark:border-white/10 dark:text-gray-300"
        >
          Categorías
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="text-gray-300 dark:text-gray-600">
            <path d="m9 6 6 6-6 6" />
          </svg>
        </Link>
      </div>

      <button
        onClick={() => supabase.auth.signOut()}
        className="mt-2 w-full rounded-lg border border-gray-200 dark:border-white/10 py-2 text-xs font-semibold text-gray-500 dark:text-gray-300 hover:border-red-200 hover:text-red-500"
      >
        Cerrar sesión
      </button>

      {sheetAbierto === "inicio_mes" && <SheetInicioMesDemo onClose={() => setSheetAbierto(null)} />}
      {sheetAbierto === "balance" && <SheetBalanceDemo onClose={() => setSheetAbierto(null)} />}
    </Card>
  );
}
