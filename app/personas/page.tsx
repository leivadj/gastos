"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/Card";
import { PersonaAvatar } from "@/components/PersonaAvatar";
import { subirImagenPropia } from "@/lib/subirImagen";
import { mensajeError } from "@/lib/supabaseError";
import { formatCLP, mesActualISO, nombreMes } from "@/lib/format";
import { Ingreso, Persona, ResumenPersonaMes } from "@/lib/types";

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
// exige nombre único en TODAS las cuentas — ver migration_17.
function traducirErrorPersona(err: unknown): string {
  const msg = mensajeError(err);
  if (msg.includes("personas_nombre_key")) {
    return "Todavía falta correr la migración de Supabase migration_17_elimina_unico_nombre_global_personas_grupos.sql — hay una restricción vieja que exige que el nombre sea único entre TODAS las cuentas (no solo la tuya). Corre esa migración y vuelve a intentar.";
  }
  if (msg.includes("personas_owner_id_nombre_key")) {
    return "Ya tienes una persona con ese nombre en tu cuenta.";
  }
  return msg || "No se pudo guardar.";
}

export default function PersonasPage() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [resumen, setResumen] = useState<ResumenPersonaMes[]>([]);
  const [ingresos, setIngresos] = useState<Ingreso[]>([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [errorNueva, setErrorNueva] = useState("");

  const [editandoPerfil, setEditandoPerfil] = useState(false);
  const [nombrePerfil, setNombrePerfil] = useState("");
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [errorPerfil, setErrorPerfil] = useState("");
  const intentoCrearPerfil = useRef(false);

  const [cargado, setCargado] = useState(false);

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
  // primera vez que abres esta página — con un nombre adivinado desde tu
  // correo, editable al toque. El índice único en la base evita duplicados
  // aunque este efecto se dispare dos veces (ej. en desarrollo).
  useEffect(() => {
    if (intentoCrearPerfil.current) return;
    if (!cargado || !correo) return; // todavía cargando la primera vez
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
  const otrasPersonas = personas.filter((p) => p.activo && !p.es_self);

  async function cerrarSesion() {
    await supabase.auth.signOut();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setErrorNueva("");
    const { error } = await supabase.from("personas").insert({ nombre, activo: true });
    setGuardando(false);
    if (error) {
      setErrorNueva(traducirErrorPersona(error));
      return;
    }
    setMostrarForm(false);
    setNombre("");
    cargar();
  }

  async function desactivar(id: string) {
    await supabase.from("personas").update({ activo: false }).eq("id", id);
    cargar();
  }

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

  return (
    <div className="space-y-4 pb-10">
      <div>
        <h1 className="text-lg font-bold text-gray-800">Personas</h1>
        <p className="text-xs capitalize text-gray-400">
          Tu perfil, y lo que debe e ingresó cada persona en {nombreMes()}. El reparto se define en cada
          gasto/compra o en Grupos.
        </p>
      </div>

      {perfilPropio && (
        <Card>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Tu perfil</p>
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
                    className="w-full min-w-0 rounded-lg border border-gray-200 px-2 py-1 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={guardandoPerfil}
                    className="shrink-0 text-xs font-semibold text-brand-from disabled:opacity-60"
                  >
                    Guardar
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditandoPerfil(false)}
                    className="shrink-0 text-xs text-gray-400"
                  >
                    cancelar
                  </button>
                </form>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold text-gray-800">{perfilPropio.nombre}</p>
                  <button onClick={iniciarEdicionPerfil} className="shrink-0 text-xs text-brand-from">
                    editar
                  </button>
                </div>
              )}
              <p className="truncate text-xs text-gray-400">{correo}</p>
            </div>
          </div>

          {errorPerfil && <p className="mt-2 text-xs text-red-500">{errorPerfil}</p>}

          <div className="mt-3 flex items-center justify-between text-sm">
            <div>
              <p className="text-[11px] text-gray-400">Debe este mes</p>
              <p className="font-semibold text-gray-800">{formatCLP(debeEstaPersona(perfilPropio.id))}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-gray-400">Ingresó este mes</p>
              <p className="font-semibold text-gray-800">{formatCLP(ingresoEstaPersona(perfilPropio.id))}</p>
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
              className="flex-1 rounded-lg border border-gray-200 py-2 text-center text-xs font-semibold text-gray-500"
            >
              Ver mis tarjetas
            </Link>
          </div>
        </Card>
      )}

      <div className="flex items-center justify-between pt-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Otras personas (repartos)</p>
        <button
          onClick={() => {
            setMostrarForm((v) => !v);
            setErrorNueva("");
          }}
          className="rounded-full bg-brand-gradient px-4 py-1.5 text-xs font-semibold text-white"
        >
          {mostrarForm ? "Cancelar" : "+ Nueva"}
        </button>
      </div>

      {mostrarForm && (
        <Card>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-xs text-gray-500">Nombre</label>
              <input
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
            {errorNueva && <p className="text-xs text-red-500">{errorNueva}</p>}
            <button
              type="submit"
              disabled={guardando}
              className="w-full rounded-lg bg-brand-gradient py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {guardando ? "Guardando…" : "Guardar"}
            </button>
          </form>
        </Card>
      )}

      <div className="space-y-3">
        {otrasPersonas.map((p) => (
          <Card key={p.id}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <PersonaAvatar fotoUrl={p.foto_url} nombre={p.nombre} className="h-8 w-8" />
                <p className="font-semibold text-gray-800">{p.nombre}</p>
              </div>
              <button onClick={() => desactivar(p.id)} className="text-xs text-gray-300 hover:text-red-400">
                quitar
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <div>
                <p className="text-[11px] text-gray-400">Debe este mes</p>
                <p className="font-semibold text-gray-800">{formatCLP(debeEstaPersona(p.id))}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-gray-400">Ingresó este mes</p>
                <p className="font-semibold text-gray-800">{formatCLP(ingresoEstaPersona(p.id))}</p>
              </div>
            </div>
          </Card>
        ))}
        {otrasPersonas.length === 0 && (
          <p className="text-center text-sm text-gray-400">
            Aún no agregaste otras personas para repartir gastos (ej. Marian).
          </p>
        )}
      </div>

      <Card>
        <p className="text-xs text-gray-400">Sesión iniciada como</p>
        <p className="mb-3 truncate text-sm font-semibold text-gray-800">{correo}</p>
        <button
          onClick={cerrarSesion}
          className="w-full rounded-lg border border-gray-200 py-2.5 text-sm font-semibold text-gray-500 hover:border-red-200 hover:text-red-500"
        >
          Cerrar sesión
        </button>
      </Card>
    </div>
  );
}
