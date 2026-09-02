"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/Card";
import { PersonaAvatar } from "@/components/PersonaAvatar";
import { PerfilPropioCard, traducirErrorPersona } from "@/components/PerfilPropioCard";
import { ContadorOdometro } from "@/components/ContadorOdometro";
import { formatCLP, mesActualISO, nombreMes } from "@/lib/format";
import { Ingreso, Persona, ResumenPersonaMes } from "@/lib/types";

export default function PersonasPage() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [resumen, setResumen] = useState<ResumenPersonaMes[]>([]);
  const [ingresos, setIngresos] = useState<Ingreso[]>([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [errorNueva, setErrorNueva] = useState("");

  async function cargar() {
    const [{ data: p }, { data: r }, { data: i }] = await Promise.all([
      supabase.from("personas").select("*").order("nombre"),
      supabase.from("vista_resumen_personas_mes").select("*"),
      supabase.from("ingresos").select("*"),
    ]);
    setPersonas((p as Persona[]) ?? []);
    setResumen((r as ResumenPersonaMes[]) ?? []);
    setIngresos((i as Ingreso[]) ?? []);
  }

  useEffect(() => {
    cargar();
    supabase.auth.getSession().then(({ data }) => setCorreo(data.session?.user?.email ?? ""));
  }, []);

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

      <PerfilPropioCard />

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
                <p className="font-semibold text-gray-800">
                  <ContadorOdometro texto={formatCLP(debeEstaPersona(p.id))} />
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-gray-400">Ingresó este mes</p>
                <p className="font-semibold text-gray-800">
                  <ContadorOdometro texto={formatCLP(ingresoEstaPersona(p.id))} />
                </p>
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
