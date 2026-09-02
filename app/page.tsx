"use client";

import { useEffect, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/Card";
import { PersonaBreakdown } from "@/components/PersonaBreakdown";
import { EVENTO_MOVIMIENTO_GUARDADO } from "@/components/MovimientoRapido";
import { AvatarGroupHover } from "@/components/AvatarGroupHover";
import { ContadorOdometro } from "@/components/ContadorOdometro";
import { diaDelMes, formatCLP, mesActualISO, nombreMes } from "@/lib/format";
import {
  Categoria,
  CompraVigente,
  Entidad,
  GastoFijo,
  Marca,
  Persona,
  RepartoCuota,
  RepartoGastoFijo,
  ResumenPersonaMes,
} from "@/lib/types";
import { useDeviceType } from "@/lib/useDeviceType";

const COLORES = ["#7C3AED", "#EC4899", "#F97316", "#10B981", "#3B82F6", "#F43F5E", "#8B5CF6", "#14B8A6"];
const AVATAR_COLORES = ["#F59E0B", "#10B981", "#3B82F6", "#EC4899", "#8B5CF6"];

function formatCompacto(valor: number): string {
  return new Intl.NumberFormat("es-CL", { notation: "compact", maximumFractionDigits: 1 }).format(valor);
}

function IconoDisponible({ className = "" }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="6" width="18" height="13" rx="2.5" />
      <path d="M3 10h18" />
      <path d="M16.5 15h1" />
    </svg>
  );
}

function IconoIngresos({ className = "" }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 16 10 10l4 4 6-7" />
      <path d="M15 8h5v5" />
    </svg>
  );
}

function IconoGastos({ className = "" }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 8 10 14l4-4 6 7" />
      <path d="M15 16h5v-5" />
    </svg>
  );
}

function IconoComprometido({ className = "" }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 7.5v5l3.2 1.8" />
    </svg>
  );
}

export default function DashboardPage() {
  const deviceType = useDeviceType();
  const esMobile = deviceType === "mobile";

  const [cuotas, setCuotas] = useState<CompraVigente[]>([]);
  const [gastosFijos, setGastosFijos] = useState<GastoFijo[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [entidades, setEntidades] = useState<Entidad[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [resumenPersonas, setResumenPersonas] = useState<ResumenPersonaMes[]>([]);
  const [repartoCuotas, setRepartoCuotas] = useState<RepartoCuota[]>([]);
  const [repartoGastos, setRepartoGastos] = useState<RepartoGastoFijo[]>([]);
  const [ingresosMes, setIngresosMes] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [personaSeleccionada, setPersonaSeleccionada] = useState<string | null>(null);

  useEffect(() => {
    async function cargar() {
      const [
        { data: c },
        { data: gf },
        { data: cat },
        { data: per },
        { data: ent },
        { data: mar },
        { data: rp },
        { data: rc },
        { data: rg },
        { data: ing },
      ] = await Promise.all([
        supabase.from("vista_cuotas_mes_actual").select("*"),
        supabase.from("gastos_fijos").select("*").eq("activo", true),
        supabase.from("categorias").select("*"),
        supabase.from("personas").select("*").eq("activo", true).order("nombre"),
        supabase.from("entidades").select("*"),
        supabase.from("marcas").select("*"),
        supabase.from("vista_resumen_personas_mes").select("*"),
        supabase.from("vista_reparto_cuotas_mes").select("*"),
        supabase.from("vista_reparto_gastos_fijos").select("*"),
        supabase.from("ingresos").select("monto").eq("mes", mesActualISO()),
      ]);
      setCuotas((c as CompraVigente[]) ?? []);
      setGastosFijos((gf as GastoFijo[]) ?? []);
      setCategorias((cat as Categoria[]) ?? []);
      setPersonas((per as Persona[]) ?? []);
      setEntidades((ent as Entidad[]) ?? []);
      setMarcas((mar as Marca[]) ?? []);
      setResumenPersonas((rp as ResumenPersonaMes[]) ?? []);
      setRepartoCuotas((rc as RepartoCuota[]) ?? []);
      setRepartoGastos((rg as RepartoGastoFijo[]) ?? []);
      setIngresosMes((ing ?? []).reduce((acc, r: any) => acc + Number(r.monto), 0));
      setCargando(false);
    }
    cargar();
    // Cuando se guarda un "+ Movimiento" rápido (gasto/ingreso/transferencia)
    // desde cualquier pantalla, refresca estos números sin recargar la página.
    window.addEventListener(EVENTO_MOVIMIENTO_GUARDADO, cargar);
    return () => window.removeEventListener(EVENTO_MOVIMIENTO_GUARDADO, cargar);
  }, []);

  const categoriaNombre = (id: string | null) =>
    categorias.find((c) => c.id === id)?.nombre ?? "Sin categoría";
  const categoriaTipo = (id: string | null) => categorias.find((c) => c.id === id)?.tipo ?? "variable";

  const totalCuotas = cuotas.reduce((acc, c) => acc + Number(c.monto_cuota), 0);
  const totalFijosMonto = gastosFijos.reduce((acc, g) => acc + Number(g.monto_estimado), 0);
  const totalGastos = totalCuotas + totalFijosMonto;
  const disponible = ingresosMes - totalGastos;

  // "Gastos" = ya venció su día de pago este mes (ya salió/sale de la
  // cuenta). "Comprometido" = ya sabes que viene, pero su día de pago este
  // mes todavía no llega — sigue restando del disponible, pero por
  // separado, para no confundir "ya gastado" con "ya sé que se va a ir".
  const hoyDia = new Date().getDate();
  let gastosYaPagados = 0;
  let comprometido = 0;
  cuotas.forEach((c) => {
    const monto = Number(c.monto_cuota);
    if (diaDelMes(c.fecha_primera_cuota) <= hoyDia) gastosYaPagados += monto;
    else comprometido += monto;
  });
  gastosFijos.forEach((g) => {
    const monto = Number(g.monto_estimado);
    if (g.dia_mes_pago == null || g.dia_mes_pago <= hoyDia) gastosYaPagados += monto;
    else comprometido += monto;
  });

  const porCategoria: Record<string, number> = {};
  let totalTipoFijo = 0;
  let totalTipoVariable = 0;
  cuotas.forEach((c) => {
    const nombre = categoriaNombre(c.categoria_id);
    porCategoria[nombre] = (porCategoria[nombre] ?? 0) + Number(c.monto_cuota);
    if (categoriaTipo(c.categoria_id) === "fijo") totalTipoFijo += Number(c.monto_cuota);
    else totalTipoVariable += Number(c.monto_cuota);
  });
  gastosFijos.forEach((g) => {
    const nombre = categoriaNombre(g.categoria_id);
    porCategoria[nombre] = (porCategoria[nombre] ?? 0) + Number(g.monto_estimado);
    if (categoriaTipo(g.categoria_id) === "fijo") totalTipoFijo += Number(g.monto_estimado);
    else totalTipoVariable += Number(g.monto_estimado);
  });
  const dataCategoria = Object.entries(porCategoria)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  const legendPrincipal = dataCategoria.slice(0, 3);
  const restoCategorias = dataCategoria.slice(3);
  const restoTotal = restoCategorias.reduce((acc, d) => acc + d.value, 0);

  const dataPersonas = resumenPersonas
    .map((p) => ({ name: p.persona_nombre, total: Number(p.total), persona_id: p.persona_id }))
    .sort((a, b) => b.total - a.total);

  const pctFijo = totalGastos > 0 ? (totalTipoFijo / totalGastos) * 100 : 0;

  if (cargando) {
    return <p className="py-10 text-center text-gray-400">Cargando…</p>;
  }

  // ---- Piezas reutilizadas entre el layout mobile y el de escritorio ----

  const tarjetaCategoria = (
    <Card>
      <p className="mb-3 text-sm font-semibold text-gray-600">Gastos por categoría</p>
      {dataCategoria.length === 0 ? (
        <p className="text-sm text-gray-400">Sin datos este mes todavía.</p>
      ) : (
        <div className="flex items-center gap-4">
          <div className="relative h-36 w-36 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={dataCategoria} dataKey="value" nameKey="name" innerRadius={44} outerRadius={68} paddingAngle={2}>
                  {dataCategoria.map((_, i) => (
                    <Cell key={i} fill={COLORES[i % COLORES.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatCLP(v)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-base font-bold text-gray-800">${formatCompacto(totalGastos)}</span>
              <span className="text-[10px] text-gray-400">este mes</span>
            </div>
          </div>
          <div className="flex-1 space-y-2 text-sm">
            {legendPrincipal.map((d, i) => (
              <div key={d.name} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-gray-600">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: COLORES[i % COLORES.length] }} />
                  {d.name}
                </span>
                <span className="font-medium text-gray-800">${formatCompacto(d.value)}</span>
              </div>
            ))}
            {restoCategorias.length > 0 && (
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-gray-400">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-gray-300" />+{restoCategorias.length} más
                </span>
                <span className="font-medium text-gray-400">${formatCompacto(restoTotal)}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );

  const tarjetaFijoVariable = totalGastos > 0 && (
    <Card>
      <p className="mb-2 text-sm font-semibold text-gray-600">Fijo vs. variable</p>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-pink-100">
        <div className="h-full bg-brand-gradient" style={{ width: `${pctFijo}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-brand-gradient" />
          Fijo · {formatCLP(totalTipoFijo)}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-pink-200" />
          Variable · {formatCLP(totalTipoVariable)}
        </span>
      </div>
    </Card>
  );

  const tarjetaPersonas = (
    <Card>
      <p className="mb-2 text-sm font-semibold text-gray-600">Cuánto le toca a cada persona</p>
      {dataPersonas.length === 0 ? (
        <p className="text-sm text-gray-400">Sin datos este mes todavía.</p>
      ) : (
        <>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataPersonas}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis hide />
                <Tooltip formatter={(v: number) => formatCLP(v)} />
                <Bar
                  dataKey="total"
                  radius={[6, 6, 0, 0]}
                  fill="#7C3AED"
                  style={{ cursor: "pointer" }}
                  onClick={(d: any) => setPersonaSeleccionada(d?.persona_id ?? d?.payload?.persona_id ?? null)}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 text-center text-[11px] text-gray-400">Toca una barra para ver el detalle</p>
        </>
      )}
    </Card>
  );

  const tarjetaCuotas = (
    <Card>
      <p className="mb-3 text-sm font-semibold text-gray-600">Cuotas activas este mes</p>
      {cuotas.length === 0 ? (
        <p className="text-sm text-gray-400">No hay compras en cuotas vigentes.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {cuotas.map((c) => (
            <li key={c.compra_id} className="flex items-center justify-between py-2.5 text-sm">
              <div>
                <p className="font-medium text-gray-700">{c.descripcion}</p>
                <p className="text-xs text-gray-400">
                  Cuota {c.cuota_actual} de {c.n_cuotas} · {categoriaNombre(c.categoria_id)}
                </p>
              </div>
              <p className="font-semibold text-gray-800">{formatCLP(c.monto_cuota)}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );

  // ---- Layout mobile (app instalada / pantalla angosta) ----

  const contenido = esMobile ? (
      <div className="space-y-5 pb-10">
        {/* Hero a sangre, fuera del padding del layout */}
        <div className="-mx-4 -mt-4 rounded-b-[2rem] bg-brand-gradient px-5 pb-6 pt-6 text-white">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-white/15 px-3 py-1 text-sm font-medium capitalize">
              {nombreMes()} ▾
            </span>
            <AvatarGroupHover className="flex -space-x-2">
              {personas.slice(0, 4).map((p, i) => (
                <span
                  key={p.id}
                  title={p.nombre}
                  className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white"
                  style={{ background: AVATAR_COLORES[i % AVATAR_COLORES.length] }}
                >
                  {p.nombre.charAt(0).toUpperCase()}
                </span>
              ))}
            </AvatarGroupHover>
          </div>

          <p className="mt-5 flex items-center gap-1.5 text-sm opacity-85">
            <IconoDisponible className="text-white" />
            Disponible este mes
          </p>
          <p className="text-4xl font-bold tracking-tight">
            <ContadorOdometro texto={formatCLP(disponible)} />
          </p>

          <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
            <div className="rounded-xl bg-white/15 p-3">
              <p className="flex items-center gap-1 text-[11px] opacity-85">
                <IconoIngresos className="text-white" />
                Ingresos
              </p>
              <p className="text-sm font-semibold">
                <ContadorOdometro texto={formatCLP(ingresosMes)} />
              </p>
            </div>
            <div className="rounded-xl bg-white/15 p-3">
              <p className="flex items-center gap-1 text-[11px] opacity-85">
                <IconoGastos className="text-white" />
                Gastos
              </p>
              <p className="text-sm font-semibold">
                <ContadorOdometro texto={formatCLP(gastosYaPagados)} />
              </p>
            </div>
            <div className="rounded-xl bg-white/15 p-3">
              <p className="flex items-center gap-1 text-[11px] opacity-85">
                <IconoComprometido className="text-white" />
                Comprometido
              </p>
              <p className="text-sm font-semibold">
                <ContadorOdometro texto={formatCLP(comprometido)} />
              </p>
            </div>
          </div>
        </div>

        {tarjetaCategoria}
        {tarjetaFijoVariable}
        {tarjetaPersonas}
        {tarjetaCuotas}
      </div>
  ) : (
    // ---- Layout de escritorio (navegador en PC/tablet) ----
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Resumen del mes</h1>
          <p className="text-sm capitalize text-gray-400">{nombreMes()}</p>
        </div>
        <AvatarGroupHover className="flex -space-x-2">
          {personas.slice(0, 6).map((p, i) => (
            <span
              key={p.id}
              title={p.nombre}
              className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white shadow-sm"
              style={{ background: AVATAR_COLORES[i % AVATAR_COLORES.length] }}
            >
              {p.nombre.charAt(0).toUpperCase()}
            </span>
          ))}
        </AvatarGroupHover>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <p className="text-xs font-medium text-gray-400">Ingresos</p>
          <p className="mt-1 text-2xl font-bold text-gray-800">
            <ContadorOdometro texto={formatCLP(ingresosMes)} />
          </p>
        </Card>
        <Card>
          <p className="flex items-center gap-1 text-xs font-medium text-gray-400">
            <IconoGastos className="text-gray-400" />
            Gastos
          </p>
          <p className="mt-1 text-2xl font-bold text-gray-800">
            <ContadorOdometro texto={formatCLP(gastosYaPagados)} />
          </p>
        </Card>
        <Card>
          <p className="flex items-center gap-1 text-xs font-medium text-gray-400">
            <IconoComprometido className="text-gray-400" />
            Comprometido
          </p>
          <p className="mt-1 text-2xl font-bold text-gray-800">
            <ContadorOdometro texto={formatCLP(comprometido)} />
          </p>
          <p className="text-[11px] text-gray-400">vence más adelante este mes</p>
        </Card>
        <Card>
          <p className="flex items-center gap-1 text-xs font-medium text-gray-400">
            <IconoDisponible className="text-gray-400" />
            Disponible
          </p>
          <p className="mt-1 text-2xl font-bold text-brand-from">
            <ContadorOdometro texto={formatCLP(disponible)} />
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {tarjetaCategoria}
        {tarjetaPersonas}
      </div>

      {tarjetaFijoVariable}
      {tarjetaCuotas}
    </div>
  );

  const persona = personas.find((p) => p.id === personaSeleccionada);

  return (
    <>
      {contenido}
      {persona && (
        <PersonaBreakdown
          personaNombre={persona.nombre}
          mesLabel={nombreMes()}
          total={dataPersonas.find((d) => d.persona_id === persona.id)?.total ?? 0}
          cuotasPersona={repartoCuotas.filter((r) => r.persona_id === persona.id)}
          gastosPersona={repartoGastos.filter((r) => r.persona_id === persona.id)}
          categorias={categorias}
          entidades={entidades}
          marcas={marcas}
          onClose={() => setPersonaSeleccionada(null)}
        />
      )}
    </>
  );
}
