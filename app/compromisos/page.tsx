"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/Card";
import { EntidadAvatar } from "@/components/EntidadAvatar";
import { PersonaAvatar } from "@/components/PersonaAvatar";
import { TIPO_LABEL } from "@/components/TarjetaVisual";
import {
  cuotaActualEn,
  esMismoMes,
  isoDelMes,
  mesAnterior,
  mesRefActual,
  mesSiguiente,
  MesRef,
} from "@/lib/cuotasHistoricas";
import { formatCLP, nombreMesCorto } from "@/lib/format";
import { promedioMovil } from "@/lib/promedioMovil";
import { resolverMarca } from "@/lib/resolverMarca";
import { resolverPorcentajesEfectivos } from "@/lib/reparto";
import {
  Categoria,
  Compra,
  Entidad,
  GastoFijo,
  Grupo,
  GrupoParticipante,
  ItemParticipante,
  Marca,
  OrigenItem,
  Pago,
  Persona,
} from "@/lib/types";

// ============================================================================
// "Compromisos" — cuánto le corresponde pagar a cada persona este mes, y por
// qué (a pedido de Felipe: reemplaza el Excel que llevaba a mano con
// PRODUCTOS/VALOR/CUOTAS/PAPÁ/MARIAN/FELIPE/GASTOS DEPTO/TARJETAS DE
// CREDITO/GASTOS HOGAR/FALABELLA/PARIS/BANCO ESTADO).
//
// NO reemplaza /movimientos ni /reportes — reutiliza los mismos datos
// (compras, gastos_fijos, pagos, item_participantes, grupo_participantes) y
// básicamente la misma lógica de reparto que ya tiene /reportes
// (repartoFinal, cuotaActualEn, promedioMovil), pero agrupada distinto: por
// PERSONA primero, y dentro de cada persona, en 3 secciones en vez de una
// tabla plana:
//   1. Casas comerciales / tarjetas de terceros — items pagados con una
//      entidad que es de una casa comercial (Falabella, Paris — marca.tipo
//      "casa_comercial") o que tiene un titular distinto de uno mismo (ver
//      entidades.titular_persona_id, migration_33) — agrupados por entidad,
//      con subtotal cada una.
//   2. Gastos personales — el resto de lo asignado a esa persona (con o sin
//      entidad propia), sin agrupar.
//   3. Hogar — items del grupo marcado como "el" Grupo Hogar (grupos.
//      es_principal, migration_33), con el % aplicado a cada uno.
// Esta es la regla de agrupación elegida para la Fase 1 — documentada acá y
// en el proyecto de Claude por si Felipe quiere ajustarla.
//
// El PDF individual por persona (punto 9 del pedido) es la Fase 2, todavía
// no está en este archivo.
// ============================================================================

type FilaCompromiso = {
  key: string;
  origen: OrigenItem;
  origenId: string;
  descripcion: string;
  categoriaId: string | null;
  entidadId: string | null;
  grupoId: string | null;
  detalle: string; // "Cuota 2 de 3" o "Gasto fijo"
  monto: number;
  pagado: boolean;
  reparto: { persona_id: string; monto: number }[];
};

export default function CompromisosPage() {
  const [compras, setCompras] = useState<Compra[]>([]);
  const [gastosFijos, setGastosFijos] = useState<GastoFijo[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [entidades, setEntidades] = useState<Entidad[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [grupoParticipantes, setGrupoParticipantes] = useState<GrupoParticipante[]>([]);
  const [itemParticipantes, setItemParticipantes] = useState<ItemParticipante[]>([]);
  const [cargando, setCargando] = useState(true);

  const [rangoRef, setRangoRef] = useState<MesRef>(mesRefActual());
  const [personaAbiertaId, setPersonaAbiertaId] = useState<string | null>(null);
  const [categoriaFiltro, setCategoriaFiltro] = useState("");
  const [entidadFiltro, setEntidadFiltro] = useState("");
  const [soloHogar, setSoloHogar] = useState(false);
  const [soloCuotas, setSoloCuotas] = useState(false);
  const [estadoFiltro, setEstadoFiltro] = useState<"" | "pagado" | "pendiente">("");

  useEffect(() => {
    async function cargar() {
      const [{ data: c }, { data: gf }, { data: pg }, { data: p }, { data: cat }, { data: ent }, { data: mar }, { data: gr }, { data: gp }, { data: ipC }, { data: ipG }] =
        await Promise.all([
          supabase.from("compras").select("*"),
          supabase.from("gastos_fijos").select("*").eq("activo", true),
          supabase.from("pagos").select("*"),
          supabase.from("personas").select("*").eq("activo", true).order("nombre"),
          supabase.from("categorias").select("*"),
          supabase.from("entidades").select("*"),
          supabase.from("marcas").select("*"),
          supabase.from("grupos").select("*"),
          supabase.from("grupo_participantes").select("*"),
          supabase.from("item_participantes").select("*").eq("origen", "compra"),
          supabase.from("item_participantes").select("*").eq("origen", "gasto_fijo"),
        ]);
      setCompras((c as Compra[]) ?? []);
      setGastosFijos((gf as GastoFijo[]) ?? []);
      setPagos((pg as Pago[]) ?? []);
      setPersonas((p as Persona[]) ?? []);
      setCategorias((cat as Categoria[]) ?? []);
      setEntidades((ent as Entidad[]) ?? []);
      setMarcas((mar as Marca[]) ?? []);
      setGrupos((gr as Grupo[]) ?? []);
      setGrupoParticipantes((gp as GrupoParticipante[]) ?? []);
      setItemParticipantes([...((ipC as ItemParticipante[]) ?? []), ...((ipG as ItemParticipante[]) ?? [])]);
      setCargando(false);
    }
    cargar();
  }, []);

  const refIso = isoDelMes(rangoRef);
  const nombreMesLargo = new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric" }).format(
    new Date(rangoRef.year, rangoRef.month, 1)
  );
  const nombreMesLargoCap = nombreMesLargo.charAt(0).toUpperCase() + nombreMesLargo.slice(1);

  const personaSelf = personas.find((p) => p.es_self) ?? null;
  const grupoHogar = grupos.find((g) => g.es_principal) ?? null;
  const idsPersonasActivas = new Set(personas.map((p) => p.id));

  function pagoDe(origen: OrigenItem, origenId: string, mes: string): Pago | undefined {
    return pagos.find((p) => p.origen === origen && p.origen_id === origenId && p.mes === mes);
  }

  // Reparto de un ítem: su propio snapshot en item_participantes si lo tiene
  // (esto es lo normal desde migration_33 — incluye lo que antes se resolvía
  // vía grupo), si no el grupo en vivo (respaldo, ver app/reportes/page.tsx
  // para la misma lógica y por qué), si no 100% para uno mismo.
  function repartoDeItem(origen: OrigenItem, origenId: string): { persona_id: string; porcentaje: number }[] {
    const propio = itemParticipantes.filter((ip) => ip.origen === origen && ip.origen_id === origenId);
    if (propio.length > 0) return resolverPorcentajesEfectivos(propio, idsPersonasActivas);
    return [];
  }
  function repartoDeGrupo(grupoId: string): { persona_id: string; porcentaje: number }[] {
    return resolverPorcentajesEfectivos(
      grupoParticipantes.filter((gp) => gp.grupo_id === grupoId),
      idsPersonasActivas
    );
  }
  function repartoFinal(grupoId: string | null, origen: OrigenItem, origenId: string): { persona_id: string; porcentaje: number }[] {
    const propio = repartoDeItem(origen, origenId);
    if (propio.length > 0) return propio;
    if (grupoId) {
      const deGrupo = repartoDeGrupo(grupoId);
      if (deGrupo.length > 0) return deGrupo;
    }
    return personaSelf ? [{ persona_id: personaSelf.id, porcentaje: 100 }] : [];
  }

  const filas: FilaCompromiso[] = useMemo(() => {
    const out: FilaCompromiso[] = [];
    compras.forEach((c) => {
      const cuotaActual = cuotaActualEn(c.fecha_primera_cuota, rangoRef);
      if (cuotaActual < 1 || cuotaActual > c.n_cuotas) return;
      const pago = pagoDe("compra", c.id, refIso);
      const monto = pago?.monto_real != null ? Number(pago.monto_real) : Math.round(c.monto_total / c.n_cuotas);
      const reparto = repartoFinal(c.grupo_id, "compra", c.id);
      out.push({
        key: `c-${c.id}`,
        origen: "compra",
        origenId: c.id,
        descripcion: c.descripcion,
        categoriaId: c.categoria_id,
        entidadId: c.entidad_id,
        grupoId: c.grupo_id,
        detalle: `Cuota ${cuotaActual} de ${c.n_cuotas}`,
        monto,
        pagado: pago?.pagado ?? false,
        reparto: reparto.map((r) => ({ persona_id: r.persona_id, monto: Math.round((monto * r.porcentaje) / 100) })),
      });
    });
    gastosFijos.forEach((g) => {
      const pago = pagoDe("gasto_fijo", g.id, refIso);
      let monto: number;
      if (pago?.monto_real != null) monto = Number(pago.monto_real);
      else if (g.tipo_monto === "variable") monto = promedioMovil(pagos, g.id, refIso, Number(g.monto_estimado)).promedio;
      else monto = Number(g.monto_estimado);
      const reparto = repartoFinal(g.grupo_id, "gasto_fijo", g.id);
      out.push({
        key: `g-${g.id}`,
        origen: "gasto_fijo",
        origenId: g.id,
        descripcion: g.descripcion,
        categoriaId: g.categoria_id,
        entidadId: g.entidad_id,
        grupoId: g.grupo_id,
        detalle: "Gasto fijo",
        monto,
        pagado: pago?.pagado ?? false,
        reparto: reparto.map((r) => ({ persona_id: r.persona_id, monto: Math.round((monto * r.porcentaje) / 100) })),
      });
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compras, gastosFijos, pagos, itemParticipantes, grupoParticipantes, personas, rangoRef, refIso]);

  // El return condicional va DESPUÉS de todos los hooks (useState/useEffect/
  // useMemo de arriba) — nunca antes de un hook, porque eso viola las Rules
  // of Hooks (React lanza "Rendered more/fewer hooks than expected" en
  // cuanto `cargando` cambia de true a false, que es exactamente el bug que
  // producía el "Application error: a client-side exception has occurred"
  // en /compromisos).
  if (cargando) {
    return <p className="py-10 text-center text-gray-400 dark:text-gray-500">Cargando…</p>;
  }

  const categoriaDe = (id: string | null) => categorias.find((c) => c.id === id) ?? null;
  const entidadDe = (id: string | null) => entidades.find((e) => e.id === id) ?? null;
  const personaDe = (id: string) => personas.find((p) => p.id === id) ?? null;

  // Filtros comunes (mes ya aplicado arriba, en `filas`).
  const filasFiltradas = filas.filter((f) => {
    if (categoriaFiltro && f.categoriaId !== categoriaFiltro) return false;
    if (entidadFiltro && f.entidadId !== entidadFiltro) return false;
    if (soloHogar && (!grupoHogar || f.grupoId !== grupoHogar.id)) return false;
    if (soloCuotas && f.origen !== "compra") return false;
    if (estadoFiltro === "pagado" && !f.pagado) return false;
    if (estadoFiltro === "pendiente" && f.pagado) return false;
    return true;
  });

  function totalDePersona(personaId: string): number {
    return filasFiltradas.reduce((acc, f) => acc + (f.reparto.find((r) => r.persona_id === personaId)?.monto ?? 0), 0);
  }

  // "Es tarjeta de terceros/casa comercial": la entidad tiene marca tipo
  // casa_comercial (Falabella, Paris...) o un titular distinto del dueño de
  // la cuenta — ver el comentario grande al inicio del archivo.
  function esTarjetaDeTerceros(entidad: Entidad | null): boolean {
    if (!entidad) return false;
    if (resolverMarca(entidad, marcas)?.tipo === "casa_comercial") return true;
    if (entidad.titular_persona_id && entidad.titular_persona_id !== personaSelf?.id) return true;
    return false;
  }

  function subtitutloEntidad(entidad: Entidad): string {
    const partes = [TIPO_LABEL[entidad.tipo]];
    if (entidad.ultimos_digitos) partes.push(`•••• ${entidad.ultimos_digitos}`);
    if (entidad.titular_persona_id) {
      const titular = personaDe(entidad.titular_persona_id);
      if (titular) partes.push(`Titular: ${titular.nombre}`);
    }
    return partes.join(" · ");
  }

  return (
    <div className="space-y-4 pb-10">
      <div>
        <h1 className="text-lg font-bold text-gray-800 dark:text-white">Compromisos</h1>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Cuánto le corresponde pagar a cada persona este mes, y por qué — tarjetas de terceros, casas comerciales,
          cuotas, gastos asignados y Hogar.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-full border border-gray-200 px-2 py-1.5 text-xs font-medium text-gray-600 dark:border-white/10 dark:text-gray-300">
          <button
            onClick={() => setRangoRef((r) => mesAnterior(r))}
            aria-label="Mes anterior"
            className="rounded-full px-1.5 text-gray-400 hover:bg-gray-50 dark:text-gray-500 dark:hover:bg-white/5"
          >
            ‹
          </button>
          <span className="capitalize">{nombreMesLargoCap}</span>
          <button
            onClick={() => setRangoRef((r) => (esMismoMes(r, mesRefActual()) ? r : mesSiguiente(r)))}
            disabled={esMismoMes(rangoRef, mesRefActual())}
            aria-label="Mes siguiente"
            className="rounded-full px-1.5 text-gray-400 hover:bg-gray-50 disabled:opacity-30 dark:text-gray-500 dark:hover:bg-white/5"
          >
            ›
          </button>
        </div>

        <select
          value={categoriaFiltro}
          onChange={(e) => setCategoriaFiltro(e.target.value)}
          className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 dark:border-white/10 dark:bg-transparent dark:text-gray-300"
        >
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>

        <select
          value={entidadFiltro}
          onChange={(e) => setEntidadFiltro(e.target.value)}
          className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 dark:border-white/10 dark:bg-transparent dark:text-gray-300"
        >
          <option value="">Todas las cuentas/tarjetas</option>
          {entidades.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre}
            </option>
          ))}
        </select>

        <select
          value={estadoFiltro}
          onChange={(e) => setEstadoFiltro(e.target.value as "" | "pagado" | "pendiente")}
          className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 dark:border-white/10 dark:bg-transparent dark:text-gray-300"
        >
          <option value="">Pagado y pendiente</option>
          <option value="pagado">Solo pagado</option>
          <option value="pendiente">Solo pendiente</option>
        </select>

        <button
          onClick={() => setSoloHogar((v) => !v)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
            soloHogar ? "bg-brand-gradient text-white" : "border border-gray-200 text-gray-600 dark:border-white/10 dark:text-gray-300"
          }`}
        >
          Solo Hogar
        </button>
        <button
          onClick={() => setSoloCuotas((v) => !v)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
            soloCuotas ? "bg-brand-gradient text-white" : "border border-gray-200 text-gray-600 dark:border-white/10 dark:text-gray-300"
          }`}
        >
          Solo cuotas
        </button>
      </div>

      {!grupoHogar && (
        <p className="rounded-2xl bg-gray-50 px-4 py-3 text-xs text-gray-500 dark:bg-white/5 dark:text-gray-400">
          Todavía no marcaste cuál de tus grupos es el Grupo Hogar — hazlo en{" "}
          <a href="/grupos" className="font-semibold text-brand-from dark:text-white">
            Grupos
          </a>{" "}
          para que la sección Hogar de acá aparezca.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {personas.map((p) => (
          <Card
            key={p.id}
            onClick={() => setPersonaAbiertaId((actual) => (actual === p.id ? null : p.id))}
            className={`cursor-pointer transition hover:border-brand-from/40 ${personaAbiertaId === p.id ? "border-brand-from/60" : ""}`}
          >
            <div className="flex items-center gap-2.5">
              <PersonaAvatar fotoUrl={p.foto_url} nombre={p.nombre} className="h-8 w-8" />
              <p className="font-semibold text-gray-800 dark:text-white">
                {p.nombre}
                {p.es_self && <span className="ml-1 text-xs font-normal text-gray-400 dark:text-gray-500">(tú)</span>}
              </p>
            </div>
            <p className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">Debe {nombreMesLargoCap}</p>
            <p className="text-xl font-extrabold text-gray-800 dark:text-white">{formatCLP(totalDePersona(p.id))}</p>
          </Card>
        ))}
        {personas.length === 0 && (
          <p className="text-center text-sm text-gray-400 dark:text-gray-500">Todavía no hay personas activas.</p>
        )}
      </div>

      {personaAbiertaId &&
        (() => {
          const persona = personaDe(personaAbiertaId);
          if (!persona) return null;
          const itemsPersona = filasFiltradas
            .map((f) => ({ ...f, montoPersona: f.reparto.find((r) => r.persona_id === persona.id)?.monto ?? 0 }))
            .filter((f) => f.montoPersona > 0);

          const deHogar = itemsPersona.filter((f) => grupoHogar && f.grupoId === grupoHogar.id);
          const resto = itemsPersona.filter((f) => !(grupoHogar && f.grupoId === grupoHogar.id));
          const deTerceros = resto.filter((f) => esTarjetaDeTerceros(entidadDe(f.entidadId)));
          const personales = resto.filter((f) => !esTarjetaDeTerceros(entidadDe(f.entidadId)));

          // Agrupa "de terceros" por entidad, con subtotal cada una.
          const porEntidad: Record<string, typeof deTerceros> = {};
          deTerceros.forEach((f) => {
            const key = f.entidadId ?? "sin-entidad";
            if (!porEntidad[key]) porEntidad[key] = [];
            porEntidad[key].push(f);
          });

          const totalPersona = itemsPersona.reduce((acc, f) => acc + f.montoPersona, 0);

          return (
            <Card>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-bold text-gray-800 dark:text-white">{persona.nombre}</p>
                  <p className="text-xs capitalize text-gray-400 dark:text-gray-500">{nombreMesLargoCap}</p>
                </div>
                <button
                  onClick={() => setPersonaAbiertaId(null)}
                  className="rounded-full p-1 text-gray-400 hover:bg-gray-100 dark:text-gray-500 dark:hover:bg-white/10"
                >
                  ✕ cerrar
                </button>
              </div>

              <p className="mt-3 text-2xl font-bold text-brand-from dark:text-white">{formatCLP(totalPersona)}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">Total a pagar (con los filtros de arriba aplicados)</p>

              {Object.keys(porEntidad).length > 0 && (
                <div className="mt-5">
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                    Casas comerciales / tarjetas de terceros
                  </p>
                  <div className="mt-2 space-y-3">
                    {Object.entries(porEntidad).map(([entidadId, items]) => {
                      const entidad = entidadDe(entidadId === "sin-entidad" ? null : entidadId);
                      const subtotal = items.reduce((acc, f) => acc + f.montoPersona, 0);
                      return (
                        <div key={entidadId} className="rounded-xl border border-gray-100 p-3 dark:border-white/10">
                          <div className="flex items-center gap-2.5">
                            <EntidadAvatar entidad={entidad} marca={resolverMarca(entidad, marcas)} className="h-8 w-8" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-gray-700 dark:text-gray-200">
                                {entidad?.nombre ?? "Sin cuenta"}
                              </p>
                              {entidad && (
                                <p className="truncate text-[11px] text-gray-400 dark:text-gray-500">{subtitutloEntidad(entidad)}</p>
                              )}
                            </div>
                            <p className="shrink-0 text-sm font-bold text-gray-800 dark:text-white">{formatCLP(subtotal)}</p>
                          </div>
                          <div className="mt-2 divide-y divide-gray-50 dark:divide-white/10">
                            {items.map((f) => (
                              <div key={f.key} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                                <div className="min-w-0">
                                  <p className="truncate text-gray-700 dark:text-gray-200">{f.descripcion}</p>
                                  <p className="text-[11px] text-gray-400 dark:text-gray-500">
                                    {categoriaDe(f.categoriaId)?.nombre ?? "Sin categoría"} · {f.detalle}
                                    {!f.pagado && " · pendiente"}
                                  </p>
                                </div>
                                <p className="shrink-0 font-semibold text-gray-800 dark:text-white">{formatCLP(f.montoPersona)}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {personales.length > 0 && (
                <div className="mt-5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">Gastos personales</p>
                    <p className="text-xs font-bold text-gray-600 dark:text-gray-300">
                      {formatCLP(personales.reduce((acc, f) => acc + f.montoPersona, 0))}
                    </p>
                  </div>
                  <div className="mt-2 divide-y divide-gray-50 dark:divide-white/10">
                    {personales.map((f) => (
                      <div key={f.key} className="flex items-center gap-3 py-2.5">
                        <EntidadAvatar entidad={entidadDe(f.entidadId)} marca={resolverMarca(entidadDe(f.entidadId), marcas)} className="h-8 w-8" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-700 dark:text-gray-200">{f.descripcion}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            {categoriaDe(f.categoriaId)?.nombre ?? "Sin categoría"} · {f.detalle}
                            {!f.pagado && " · pendiente"}
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-semibold text-gray-800 dark:text-white">{formatCLP(f.montoPersona)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {deHogar.length > 0 && grupoHogar && (
                <div className="mt-5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                      Hogar · {grupoHogar.nombre}
                    </p>
                    <p className="text-xs font-bold text-gray-600 dark:text-gray-300">
                      {formatCLP(deHogar.reduce((acc, f) => acc + f.montoPersona, 0))}
                    </p>
                  </div>
                  <div className="mt-2 divide-y divide-gray-50 dark:divide-white/10">
                    {deHogar.map((f) => {
                      const pct = f.monto > 0 ? Math.round((f.montoPersona / f.monto) * 100) : 0;
                      return (
                        <div key={f.key} className="flex items-center gap-3 py-2.5">
                          <EntidadAvatar entidad={entidadDe(f.entidadId)} marca={resolverMarca(entidadDe(f.entidadId), marcas)} className="h-8 w-8" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-gray-700 dark:text-gray-200">{f.descripcion}</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500">
                              {pct}% de {formatCLP(f.monto)}
                              {!f.pagado && " · pendiente"}
                            </p>
                          </div>
                          <p className="shrink-0 text-sm font-semibold text-gray-800 dark:text-white">{formatCLP(f.montoPersona)}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {itemsPersona.length === 0 && (
                <p className="mt-5 text-center text-sm text-gray-400 dark:text-gray-500">
                  Sin compromisos para {persona.nombre} este mes (con los filtros de arriba).
                </p>
              )}
            </Card>
          );
        })()}
    </div>
  );
}
