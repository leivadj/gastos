"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/Card";
import { EntidadAvatar } from "@/components/EntidadAvatar";
import { formatCLP, mesActualISO, primerDiaMesSiguiente } from "@/lib/format";
import {
  Categoria,
  CompraVigente,
  GastoDiario,
  GastoFijo,
  Grupo,
  Marca,
  RepartoCuota,
  RepartoGastoDiario,
  RepartoGastoFijo,
} from "@/lib/types";

type ItemFila = {
  key: string;
  descripcion: string;
  categoria: string;
  detalle: string;
  monto: number;
  marcaId: string | null;
  icono: string | null;
  reparto: { persona_nombre: string; monto_persona: number }[];
};

// Pantalla de detalle de UN grupo de reparto (ej. "Hogar", con Marian 40% /
// Felipe 60%) — se llega acá desde "Personalizar menú" del sidebar de
// escritorio (ver DesktopSidebar.tsx). Junta TODO lo que se reparte con este
// grupo, venga de donde venga (cuotas, gastos fijos o diarios — ver
// migration_26_reparto_por_categoria.sql y migration_27_reparto_gastos_diarios.sql),
// no solo lo que tenga la categoría "Hogar": si Feria o Panadería también
// usan este mismo grupo, aparecen acá también.
//
// Cuotas y gastos fijos muestran "todo lo activo" (mismo criterio que
// /entidad/[id]); los diarios sí quedan acotados al mes en curso porque son
// gastos sueltos del día a día, no cuotas — mismo alcance que ya tiene
// vista_reparto_gastos_diarios.
export default function GrupoDetallePage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const [grupo, setGrupo] = useState<Grupo | null>(null);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [composicion, setComposicion] = useState<{ persona_nombre: string; porcentaje: number }[]>([]);
  const [items, setItems] = useState<ItemFila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [noEncontrado, setNoEncontrado] = useState(false);

  useEffect(() => {
    async function cargar() {
      setCargando(true);
      setNoEncontrado(false);
      const [{ data: g }, { data: m }, { data: cat }, { data: gr }, { data: c }, { data: gf }, { data: d }, { data: rc }, { data: rg }, { data: rd }] =
        await Promise.all([
          supabase.from("grupos").select("*").eq("id", id).maybeSingle(),
          supabase.from("marcas").select("*"),
          supabase.from("categorias").select("*"),
          supabase.from("vista_grupo_reparto").select("*").eq("grupo_id", id),
          supabase.from("vista_cuotas_mes_actual").select("*").eq("grupo_id", id),
          supabase.from("gastos_fijos").select("*").eq("grupo_id", id).eq("activo", true),
          supabase
            .from("gastos_diarios")
            .select("*")
            .eq("grupo_id", id)
            .gte("fecha", mesActualISO())
            .lt("fecha", primerDiaMesSiguiente()),
          supabase.from("vista_reparto_cuotas_mes").select("*").eq("grupo_id", id),
          supabase.from("vista_reparto_gastos_fijos").select("*").eq("grupo_id", id),
          supabase.from("vista_reparto_gastos_diarios").select("*").eq("grupo_id", id),
        ]);
      if (!g) {
        setNoEncontrado(true);
        setGrupo(null);
        setCargando(false);
        return;
      }
      setGrupo(g as Grupo);
      setMarcas((m as Marca[]) ?? []);
      setComposicion(
        ((gr as { persona_nombre: string; porcentaje_efectivo: number }[]) ?? []).map((r) => ({
          persona_nombre: r.persona_nombre,
          porcentaje: r.porcentaje_efectivo,
        }))
      );

      const categorias = (cat as Categoria[]) ?? [];
      const categoriaNombre = (catId: string | null) => categorias.find((x) => x.id === catId)?.nombre ?? "Sin categoría";
      const repartoCuotas = (rc as RepartoCuota[]) ?? [];
      const repartoGastos = (rg as RepartoGastoFijo[]) ?? [];
      const repartoDiarios = (rd as RepartoGastoDiario[]) ?? [];

      const filas: ItemFila[] = [
        ...((c as CompraVigente[]) ?? []).map((x) => ({
          key: `c-${x.compra_id}`,
          descripcion: x.descripcion,
          categoria: categoriaNombre(x.categoria_id),
          detalle: `Cuota ${x.cuota_actual} de ${x.n_cuotas}`,
          monto: Number(x.monto_cuota),
          marcaId: x.marca_id,
          icono: x.icono,
          reparto: repartoCuotas
            .filter((r) => r.compra_id === x.compra_id)
            .map((r) => ({ persona_nombre: r.persona_nombre, monto_persona: r.monto_persona })),
        })),
        ...((gf as GastoFijo[]) ?? []).map((x) => ({
          key: `g-${x.id}`,
          descripcion: x.descripcion,
          categoria: categoriaNombre(x.categoria_id),
          detalle: "Gasto fijo",
          monto: Number(x.monto_estimado),
          marcaId: x.marca_id,
          icono: x.icono,
          reparto: repartoGastos
            .filter((r) => r.gasto_fijo_id === x.id)
            .map((r) => ({ persona_nombre: r.persona_nombre, monto_persona: r.monto_persona })),
        })),
        ...((d as GastoDiario[]) ?? []).map((x) => ({
          key: `d-${x.id}`,
          descripcion: x.descripcion,
          categoria: categoriaNombre(x.categoria_id),
          detalle: "Diario",
          monto: Number(x.monto),
          marcaId: x.marca_id,
          icono: null as string | null,
          reparto: repartoDiarios
            .filter((r) => r.gasto_diario_id === x.id)
            .map((r) => ({ persona_nombre: r.persona_nombre, monto_persona: r.monto_persona })),
        })),
      ].sort((a, b) => b.monto - a.monto);

      setItems(filas);
      setCargando(false);
    }
    cargar();
  }, [id]);

  const marcaDe = (marcaId: string | null) => marcas.find((m) => m.id === marcaId) ?? null;
  const totalMensual = useMemo(() => items.reduce((acc, it) => acc + it.monto, 0), [items]);
  const resumenPersonas = useMemo(() => {
    const acc: Record<string, number> = {};
    items.forEach((it) => it.reparto.forEach((r) => (acc[r.persona_nombre] = (acc[r.persona_nombre] ?? 0) + r.monto_persona)));
    return Object.entries(acc)
      .map(([persona_nombre, total]) => ({ persona_nombre, total }))
      .sort((a, b) => b.total - a.total);
  }, [items]);
  const textoComposicion = composicion.map((c) => `${c.persona_nombre} ${Math.round(c.porcentaje)}%`).join(" · ");

  if (cargando) {
    return <p className="py-10 text-center text-gray-400 dark:text-gray-500">Cargando…</p>;
  }

  if (noEncontrado || !grupo) {
    return (
      <div className="space-y-3 pb-10">
        <button onClick={() => router.back()} className="text-xs text-brand-from dark:text-pink-400">
          ‹ Volver
        </button>
        <p className="text-center text-sm text-gray-400 dark:text-gray-500">No se encontró este grupo.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-10">
      <button onClick={() => router.back()} className="text-xs text-brand-from dark:text-pink-400">
        ‹ Volver
      </button>

      <div className="flex items-center gap-3">
        <EntidadAvatar icono={grupo.icono} nombreFallback={grupo.nombre} className="h-11 w-11" />
        <div>
          <h1 className="text-lg font-bold text-gray-800 dark:text-white">{grupo.nombre}</h1>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {textoComposicion || "Sin personas asignadas todavía"}
          </p>
        </div>
      </div>

      <Card className="!py-3">
        <p className="text-xs text-gray-400 dark:text-gray-500">Total vigente</p>
        <p className="text-2xl font-bold text-gray-800 dark:text-white">{formatCLP(totalMensual)}</p>
        <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
          Cuotas activas, gastos fijos y diarios de este mes repartidos con el grupo {grupo.nombre}.
        </p>
      </Card>

      {resumenPersonas.length > 0 && (
        <Card>
          <p className="mb-2 text-sm font-semibold text-gray-600 dark:text-gray-300">Le corresponde a cada uno</p>
          <ul className="divide-y divide-gray-100 dark:divide-white/10">
            {resumenPersonas.map((r) => (
              <li key={r.persona_nombre} className="flex items-center justify-between py-2 text-sm">
                <span className="text-gray-600 dark:text-gray-300">{r.persona_nombre}</span>
                <span className="font-semibold text-gray-800 dark:text-white">{formatCLP(r.total)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <p className="mb-1 text-sm font-semibold text-gray-600 dark:text-gray-300">Detalle</p>
        <p className="mb-3 text-xs text-gray-400 dark:text-gray-500">
          Todo lo repartido con el grupo {grupo.nombre}, con las cuotas que quedan y cuánto le toca a cada uno.
        </p>
        {items.length === 0 ? (
          <p className="py-2 text-sm text-gray-400 dark:text-gray-500">Nada repartido con este grupo por ahora.</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-white/10">
            {items.map((it) => (
              <li key={it.key} className="flex items-start gap-3 py-2.5">
                <EntidadAvatar marca={marcaDe(it.marcaId)} icono={it.icono} nombreFallback={it.descripcion} className="h-8 w-8" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-700 dark:text-gray-200">{it.descripcion}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {it.categoria} · {it.detalle}
                  </p>
                  <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
                    {it.reparto.length > 0
                      ? it.reparto.map((r) => `${r.persona_nombre} ${formatCLP(r.monto_persona)}`).join(" · ")
                      : "Sin repartir"}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-gray-800 dark:text-white">{formatCLP(it.monto)}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
