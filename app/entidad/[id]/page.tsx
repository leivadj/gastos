"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/Card";
import { EntidadAvatar } from "@/components/EntidadAvatar";
import { TIPO_LABEL } from "@/components/TarjetaVisual";
import { resolverMarca } from "@/lib/resolverMarca";
import { formatCLP } from "@/lib/format";
import { Categoria, CompraVigente, Entidad, GastoFijo, Marca, RepartoCuota, RepartoGastoFijo } from "@/lib/types";

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

// Pantalla de detalle de UNA cuenta/tarjeta (ej. "Falabella", "Paris", "Banco
// Estado", "Caja de Compensación") — se llega acá desde "Personalizar menú"
// del sidebar de escritorio (ver DesktopSidebar.tsx), ancladas ahí a pedido
// del usuario. Pensada para el caso real: Marian presta estas tarjetas a
// terceros y necesita ver de un vistazo qué hay cargado en cada una, cuántas
// cuotas quedan y a quién le corresponde pagar cada ítem.
//
// A propósito NO filtra por mes (a diferencia de "Movimientos" en
// /tarjetas): reutiliza las mismas vistas de "vigente ahora" que ya usa esa
// pantalla (vista_cuotas_mes_actual ya representa la cuota activa de cada
// compra, con su n_cuotas total — no hace falta un filtro de mes aparte para
// ver "todo lo activo, con cuotas restantes") y gastos_fijos activos, así
// que el resultado es siempre "el estado actual", listo para informar en
// cualquier momento sin esperar a fin de mes.
export default function EntidadDetallePage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const [entidad, setEntidad] = useState<Entidad | null>(null);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [items, setItems] = useState<ItemFila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [noEncontrada, setNoEncontrada] = useState(false);

  useEffect(() => {
    async function cargar() {
      setCargando(true);
      setNoEncontrada(false);
      const [{ data: e }, { data: m }, { data: cat }, { data: c }, { data: gf }, { data: rc }, { data: rg }] = await Promise.all([
        supabase.from("entidades").select("*").eq("id", id).maybeSingle(),
        supabase.from("marcas").select("*"),
        supabase.from("categorias").select("*"),
        supabase.from("vista_cuotas_mes_actual").select("*").eq("entidad_id", id),
        supabase.from("gastos_fijos").select("*").eq("entidad_id", id).eq("activo", true),
        supabase.from("vista_reparto_cuotas_mes").select("*").eq("entidad_id", id),
        supabase.from("vista_reparto_gastos_fijos").select("*").eq("entidad_id", id),
      ]);
      if (!e) {
        setNoEncontrada(true);
        setEntidad(null);
        setCargando(false);
        return;
      }
      setEntidad(e as Entidad);
      setMarcas((m as Marca[]) ?? []);

      const categorias = (cat as Categoria[]) ?? [];
      const categoriaNombre = (catId: string | null) => categorias.find((x) => x.id === catId)?.nombre ?? "Sin categoría";
      const repartoCuotas = (rc as RepartoCuota[]) ?? [];
      const repartoGastos = (rg as RepartoGastoFijo[]) ?? [];

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
      ].sort((a, b) => b.monto - a.monto);

      setItems(filas);
      setCargando(false);
    }
    cargar();
  }, [id]);

  const marcaEntidad = resolverMarca(entidad, marcas);
  const marcaDe = (marcaId: string | null) => marcas.find((m) => m.id === marcaId) ?? null;
  const totalMensual = useMemo(() => items.reduce((acc, it) => acc + it.monto, 0), [items]);
  const resumenPersonas = useMemo(() => {
    const acc: Record<string, number> = {};
    items.forEach((it) => it.reparto.forEach((r) => (acc[r.persona_nombre] = (acc[r.persona_nombre] ?? 0) + r.monto_persona)));
    return Object.entries(acc)
      .map(([persona_nombre, total]) => ({ persona_nombre, total }))
      .sort((a, b) => b.total - a.total);
  }, [items]);

  if (cargando) {
    return <p className="py-10 text-center text-gray-400 dark:text-gray-500">Cargando…</p>;
  }

  if (noEncontrada || !entidad) {
    return (
      <div className="space-y-3 pb-10">
        <button onClick={() => router.back()} className="text-xs text-brand-from dark:text-pink-400">
          ‹ Volver
        </button>
        <p className="text-center text-sm text-gray-400 dark:text-gray-500">No se encontró esta cuenta.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-10">
      <button onClick={() => router.back()} className="text-xs text-brand-from dark:text-pink-400">
        ‹ Volver
      </button>

      <div className="flex items-center gap-3">
        <EntidadAvatar entidad={entidad} marca={marcaEntidad} className="h-11 w-11" />
        <div>
          <h1 className="text-lg font-bold text-gray-800 dark:text-white">{entidad.nombre}</h1>
          <p className="text-xs text-gray-400 dark:text-gray-500">{TIPO_LABEL[entidad.tipo]}</p>
        </div>
      </div>

      <Card className="!py-3">
        <p className="text-xs text-gray-400 dark:text-gray-500">Total vigente</p>
        <p className="text-2xl font-bold text-gray-800 dark:text-white">{formatCLP(totalMensual)}</p>
        <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
          Cuotas activas y gastos fijos cargados con esta cuenta, con lo que queda pendiente de cada uno.
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
          Todo lo activo cargado con {entidad.nombre}, con las cuotas que quedan y quién debe pagar cada ítem.
        </p>
        {items.length === 0 ? (
          <p className="py-2 text-sm text-gray-400 dark:text-gray-500">Nada cargado con esta cuenta por ahora.</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-white/10">
            {items.map((it) => (
              <li key={it.key} className="flex items-start gap-3 py-2.5">
                <EntidadAvatar marca={marcaDe(it.marcaId) ?? marcaEntidad} icono={it.icono} nombreFallback={it.descripcion} className="h-8 w-8" />
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
