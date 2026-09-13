"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { formatCLP } from "@/lib/format";
import { EVENTO_MOVIMIENTO_GUARDADO } from "@/components/MovimientoRapido";
import { SugerenciaCorreo, TipoSugerenciaCorreo } from "@/lib/types";

function fechaCorta(fechaISO: string): string {
  const fecha = new Date(`${fechaISO.slice(0, 10)}T00:00:00`);
  return new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short" }).format(fecha).replace(".", "");
}

const ETIQUETA_TIPO: Record<TipoSugerenciaCorreo, string> = {
  gasto: "Compra o pago",
  transferencia_tercero: "Transferencia a otra persona",
  transferencia_propia: "Transferencia entre tus cuentas",
};

function IconoCampana({ className = "" }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M6 10a6 6 0 1 1 12 0c0 4.5 1.5 6 1.5 6h-15S6 14.5 6 10Z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  );
}

// Campana de notificaciones (Inicio, mobile y escritorio): antes era un
// botón puramente decorativo (sin datos ni acción). Ahora lee las
// sugerencias de correo pendientes (mismos datos que /sugerencias) y las
// despliega en un panel al hacer clic — con un "Descartar" rápido para las
// que no valen la pena, y un link a /sugerencias para confirmarlas de
// verdad (categoría, cuenta, etc. — ese formulario completo no se duplica
// acá). Un punto rojo en la campana avisa que hay algo pendiente sin tener
// que abrir el panel.
export function NotificacionesBell({ buttonClassName = "" }: { buttonClassName?: string }) {
  const [pendientes, setPendientes] = useState<SugerenciaCorreo[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [descartando, setDescartando] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  async function cargar() {
    const { data } = await supabase
      .from("sugerencias_correo")
      .select("*")
      .eq("estado", "pendiente")
      .order("fecha", { ascending: false });
    setPendientes((data as SugerenciaCorreo[]) ?? []);
  }

  useEffect(() => {
    cargar();
    window.addEventListener(EVENTO_MOVIMIENTO_GUARDADO, cargar);
    return () => window.removeEventListener(EVENTO_MOVIMIENTO_GUARDADO, cargar);
  }, []);

  useEffect(() => {
    if (!abierto) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [abierto]);

  async function descartar(id: string) {
    setDescartando(id);
    await supabase.from("sugerencias_correo").update({ estado: "descartada" }).eq("id", id);
    setPendientes((actual) => actual.filter((s) => s.id !== id));
    setDescartando(null);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="Notificaciones"
        onClick={() => setAbierto((v) => !v)}
        className={`relative flex items-center justify-center ${buttonClassName}`}
      >
        <IconoCampana />
        {pendientes.length > 0 && (
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-gasto ring-2 ring-white dark:ring-gray-900" />
        )}
      </button>

      {abierto && (
        <div className="absolute right-0 top-full z-40 mt-2 w-80 max-w-[85vw] rounded-2xl border border-gray-100 bg-white p-3 shadow-2xl dark:border-white/10 dark:bg-gray-900">
          <div className="flex items-center justify-between px-1 pb-2">
            <p className="text-sm font-bold text-gray-800 dark:text-white">Sugerencias</p>
            <Link href="/sugerencias" onClick={() => setAbierto(false)} className="text-xs font-semibold text-brand-from dark:text-white">
              Ver todas
            </Link>
          </div>
          {pendientes.length === 0 ? (
            <p className="px-1 py-3 text-xs text-gray-400 dark:text-gray-500">No tienes sugerencias por revisar.</p>
          ) : (
            <div className="max-h-80 space-y-1 overflow-y-auto">
              {pendientes.slice(0, 6).map((s) => (
                <div key={s.id} className="flex items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-gray-50 dark:hover:bg-white/5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-gray-700 dark:text-gray-200">{s.descripcion}</p>
                    <p className="truncate text-[11px] text-gray-400 dark:text-gray-500">
                      {ETIQUETA_TIPO[s.tipo] ?? s.tipo} · {fechaCorta(s.fecha)} · {formatCLP(s.monto)}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={descartando === s.id}
                    onClick={() => descartar(s.id)}
                    className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-[10.5px] font-semibold text-gray-500 hover:bg-gray-200 disabled:opacity-50 dark:bg-white/10 dark:text-gray-400 dark:hover:bg-white/15"
                  >
                    Descartar
                  </button>
                </div>
              ))}
              {pendientes.length > 6 && (
                <p className="px-2 pt-1 text-[11px] text-gray-400 dark:text-gray-500">+{pendientes.length - 6} más — ver todas.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
