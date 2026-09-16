"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/Card";
import { mensajeError } from "@/lib/supabaseError";
import { Categoria, Entidad, Marca, ReglaCategorizacion } from "@/lib/types";

// Pantalla "Reglas de categorización" (mockup ImportarCorreo.dc.html) — la
// única función de ese mockup que Felipe confirmó como funcionalidad NUEVA
// de verdad (ver claude/mockup-v2-decisiones.md, sección "Pedido del
// usuario que SÍ es funcionalidad nueva"). Hasta la Ronda 9 esto era solo
// una demo de solo lectura con datos de ejemplo fijos, marcada
// "Próximamente" — ahora muestra las reglas reales del usuario
// (migration_38_reglas_categorizacion.sql), aprendidas automáticamente
// desde /sugerencias cada vez que confirma un gasto que llegó del correo
// del banco: la próxima vez que llegue un correo con el mismo texto,
// /sugerencias ya precarga sola la categoría (y marca/cuenta, si también se
// aprendieron) — ver lib/reglasCategorizacion.ts.
export default function ReglasCategorizacionPage() {
  const [reglas, setReglas] = useState<ReglaCategorizacion[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [entidades, setEntidades] = useState<Entidad[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [borrando, setBorrando] = useState<string | null>(null);

  async function cargarTodo() {
    setCargando(true);
    const [{ data: r }, { data: cat }, { data: m }, { data: e }] = await Promise.all([
      supabase.from("reglas_categorizacion").select("*").order("veces_usada", { ascending: false }),
      supabase.from("categorias").select("*"),
      supabase.from("marcas").select("*"),
      supabase.from("entidades").select("*"),
    ]);
    setReglas((r as ReglaCategorizacion[]) ?? []);
    setCategorias((cat as Categoria[]) ?? []);
    setMarcas((m as Marca[]) ?? []);
    setEntidades((e as Entidad[]) ?? []);
    setCargando(false);
  }

  useEffect(() => {
    cargarTodo();
  }, []);

  async function borrar(id: string) {
    setBorrando(id);
    setError("");
    const { error: delError } = await supabase.from("reglas_categorizacion").delete().eq("id", id);
    setBorrando(null);
    if (delError) {
      setError(mensajeError(delError) || "No se pudo borrar la regla.");
      return;
    }
    cargarTodo();
  }

  if (cargando) {
    return <p className="py-10 text-center text-gray-400 dark:text-gray-500">Cargando…</p>;
  }

  return (
    <div className="space-y-5 pb-10">
      <div>
        <h1 className="text-lg font-bold text-gray-800 dark:text-white">Reglas de categorización</h1>
        <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
          Cada vez que confirmás en{" "}
          <Link href="/sugerencias" className="font-semibold text-brand-from dark:text-white">
            Sugerencias
          </Link>{" "}
          un movimiento del correo del banco, se guarda (o refuerza) una regla acá: la próxima vez que llegue un
          correo con el mismo texto, la categoría y la cuenta se precargan solas.
        </p>
      </div>

      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}

      {reglas.length === 0 ? (
        <Card>
          <p className="py-4 text-center text-sm text-gray-400 dark:text-gray-500">
            Todavía no hay reglas aprendidas — confirmá algún movimiento en Sugerencias y va a aparecer acá.
          </p>
        </Card>
      ) : (
        <Card className="divide-y divide-gray-100 p-3 dark:divide-white/10">
          {reglas.map((r) => {
            const categoria = categorias.find((c) => c.id === r.categoria_id);
            const marca = r.marca_id ? marcas.find((m) => m.id === r.marca_id) : null;
            const entidad = r.entidad_id ? entidades.find((e) => e.id === r.entidad_id) : null;
            return (
              <div key={r.id} className="flex items-center gap-2.5 py-2.5 first:pt-1 last:pb-1">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-mono text-xs text-gray-500 dark:text-gray-400">{r.patron}</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-gray-300 dark:text-gray-600">
                      <path d="M4 12h16m-6-6 6 6-6 6" />
                    </svg>
                    <span className="shrink-0 rounded-full bg-gray-800 px-3 py-1 text-xs font-semibold text-white dark:bg-white dark:text-black">
                      {categoria?.icono ? `${categoria.icono} ` : ""}
                      {categoria?.nombre ?? "Sin categoría"}
                    </span>
                  </div>
                  <p className="mt-1 text-[10.5px] text-gray-400 dark:text-gray-500">
                    Usada {r.veces_usada} {r.veces_usada === 1 ? "vez" : "veces"}
                    {marca ? ` · ${marca.nombre}` : ""}
                    {entidad ? ` · ${entidad.nombre}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => borrar(r.id)}
                  disabled={borrando === r.id}
                  className="shrink-0 text-xs text-gray-300 hover:text-red-400 disabled:opacity-50 dark:text-gray-600"
                >
                  {borrando === r.id ? "borrando…" : "borrar"}
                </button>
              </div>
            );
          })}
        </Card>
      )}

      <Link href="/personas" className="block text-center text-xs font-semibold text-brand-from dark:text-white">
        ← Volver a Perfil
      </Link>
    </div>
  );
}
