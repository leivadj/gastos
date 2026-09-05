"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/Card";
import { PersonaAvatar } from "@/components/PersonaAvatar";
import { PersonaBreakdown } from "@/components/PersonaBreakdown";
import { traducirErrorPersona } from "@/components/PerfilPropioCard";
import { ContadorOdometro } from "@/components/ContadorOdometro";
import { EVENTO_MOVIMIENTO_GUARDADO } from "@/components/MovimientoRapido";
import { formatCLP, mesActualISO, nombreMes } from "@/lib/format";
import { Categoria, Entidad, Ingreso, Marca, Persona, RepartoCuota, RepartoGastoFijo, ResumenPersonaMes } from "@/lib/types";

export default function PersonasPage() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [resumen, setResumen] = useState<ResumenPersonaMes[]>([]);
  const [ingresos, setIngresos] = useState<Ingreso[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [entidades, setEntidades] = useState<Entidad[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [repartoCuotas, setRepartoCuotas] = useState<RepartoCuota[]>([]);
  const [repartoGastos, setRepartoGastos] = useState<RepartoGastoFijo[]>([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [errorNueva, setErrorNueva] = useState("");
  // Clic en una persona -> abre su desglose (detalle de ítems + ingresos
  // editables + exportar PDF), mismo panel que ya usaba el gráfico de Inicio
  // (PersonaBreakdown.tsx) — acá además le pasamos personaId/ingresosPersona
  // para habilitar la sección de ingresos, que Inicio no necesita.
  const [personaSeleccionada, setPersonaSeleccionada] = useState<string | null>(null);

  async function cargar() {
    const [{ data: p }, { data: r }, { data: i }, { data: cat }, { data: ent }, { data: mar }, { data: rc }, { data: rg }] =
      await Promise.all([
        supabase.from("personas").select("*").order("nombre"),
        supabase.from("vista_resumen_personas_mes").select("*"),
        supabase.from("ingresos").select("*"),
        supabase.from("categorias").select("*"),
        supabase.from("entidades").select("*"),
        supabase.from("marcas").select("*"),
        supabase.from("vista_reparto_cuotas_mes").select("*"),
        supabase.from("vista_reparto_gastos_fijos").select("*"),
      ]);
    setPersonas((p as Persona[]) ?? []);
    setResumen((r as ResumenPersonaMes[]) ?? []);
    setIngresos((i as Ingreso[]) ?? []);
    setCategorias((cat as Categoria[]) ?? []);
    setEntidades((ent as Entidad[]) ?? []);
    setMarcas((mar as Marca[]) ?? []);
    setRepartoCuotas((rc as RepartoCuota[]) ?? []);
    setRepartoGastos((rg as RepartoGastoFijo[]) ?? []);
  }

  useEffect(() => {
    cargar();
    // Si se agrega/edita un ingreso desde el panel de otra pantalla (o desde
    // "+ Nuevo movimiento"), refresca los montos acá sin recargar la página.
    window.addEventListener(EVENTO_MOVIMIENTO_GUARDADO, cargar);
    return () => window.removeEventListener(EVENTO_MOVIMIENTO_GUARDADO, cargar);
  }, []);

  const otrasPersonas = personas.filter((p) => p.activo && !p.es_self);

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
        <h1 className="text-lg font-bold text-gray-800 dark:text-white">Personas</h1>
        <p className="text-xs capitalize text-gray-400 dark:text-gray-500">
          Quiénes participan en los repartos, y lo que debe e ingresó cada una en {nombreMes()}. El reparto se
          define en cada gasto/compra o en Grupos.
        </p>
      </div>

      <div className="flex items-center justify-between pt-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Otras personas (repartos)</p>
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
              <label className="text-xs text-gray-500 dark:text-gray-400">Nombre</label>
              <input
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
            </div>
            {errorNueva && <p className="text-xs text-red-500 dark:text-red-400">{errorNueva}</p>}
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {otrasPersonas.map((p) => (
          <Card key={p.id} onClick={() => setPersonaSeleccionada(p.id)} className="cursor-pointer transition hover:border-brand-from/40">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <PersonaAvatar fotoUrl={p.foto_url} nombre={p.nombre} className="h-8 w-8" />
                <p className="font-semibold text-gray-800 dark:text-white">{p.nombre}</p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  desactivar(p.id);
                }}
                className="text-xs text-gray-300 hover:text-red-400 dark:text-gray-600"
              >
                quitar
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <div>
                <p className="text-[11px] text-gray-400 dark:text-gray-500">Debe este mes</p>
                <p className="font-semibold text-gray-800 dark:text-white">
                  <ContadorOdometro texto={formatCLP(debeEstaPersona(p.id))} />
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-gray-400 dark:text-gray-500">Ingresó este mes</p>
                <p className="font-semibold text-gray-800 dark:text-white">
                  <ContadorOdometro texto={formatCLP(ingresoEstaPersona(p.id))} />
                </p>
              </div>
            </div>
          </Card>
        ))}
        {otrasPersonas.length === 0 && (
          <p className="text-center text-sm text-gray-400 dark:text-gray-500">
            Aún no agregaste otras personas para repartir gastos (ej. Marian).
          </p>
        )}
      </div>

      {personaSeleccionada &&
        (() => {
          const persona = otrasPersonas.find((p) => p.id === personaSeleccionada);
          if (!persona) return null;
          return (
            <PersonaBreakdown
              personaNombre={persona.nombre}
              mesLabel={nombreMes()}
              total={debeEstaPersona(persona.id)}
              cuotasPersona={repartoCuotas.filter((r) => r.persona_id === persona.id)}
              gastosPersona={repartoGastos.filter((r) => r.persona_id === persona.id)}
              categorias={categorias}
              entidades={entidades}
              marcas={marcas}
              personaId={persona.id}
              ingresosPersona={ingresos.filter((i) => i.persona_id === persona.id && i.mes.slice(0, 7) === mesActualPrefix)}
              onIngresosActualizados={cargar}
              onClose={() => setPersonaSeleccionada(null)}
            />
          );
        })()}
    </div>
  );
}
