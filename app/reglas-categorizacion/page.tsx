"use client";

import Link from "next/link";
import { Card } from "@/components/Card";

// Pantalla "Reglas de categorización" (mockup ImportarCorreo.dc.html,
// página 12 del PDF) — la única función del mockup que el usuario confirmó
// que SÍ es nueva (no existe hoy en la app real, ver
// claude/mockup-v2-decisiones.md, sección "Pedido del usuario que SÍ es
// funcionalidad nueva"). Construirla de verdad requeriría una tabla nueva
// (reglas texto-de-comercio → categoría) + que /sugerencias la consulte y
// la actualice al confirmar un gasto — no se ha construido nada de eso
// todavía.
//
// Felipe eligió (para esta y otras 3 funciones sin respaldo real)
// "dejarlas pero marcadas 'Próximamente'" en vez de omitirlas. Esta
// pantalla es esa demo: reproduce exactamente el ejemplo del mockup con
// datos de muestra fijos (no vienen de Supabase, no hay backend detrás),
// para que Felipe pueda ver la idea completa tal como se vería el día que
// se construya. Todo acá es de solo lectura — los chips no son
// clickeables y no hay ningún guardado real.
const EJEMPLO_POR_REVISAR = [
  {
    id: "pza-vespucio",
    texto: "PZA VESPUCIO",
    monto: -3500,
    estado: "autocategorizado" as const,
    categoria: "🅿️ Estacionamiento",
  },
  {
    id: "servipag",
    texto: "SERVIPAG EXPRESS",
    monto: -14990,
    estado: "por_revisar" as const,
    sugerencias: ["Hogar", "Servicios", "Otro"],
  },
];

const EJEMPLO_REGLAS_APRENDIDAS = [
  { texto: "PZA VESPUCIO", categoria: "Estacionamiento" },
  { texto: "JUMBO", categoria: "Súper" },
  { texto: "FARMACIAS AHUMADA", categoria: "Salud" },
];

function formatCLPDemo(monto: number): string {
  const signo = monto < 0 ? "-" : "+";
  return `${signo}$${Math.abs(monto).toLocaleString("es-CL")}`;
}

export default function ReglasCategorizacionPage() {
  return (
    <div className="space-y-5 pb-10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-800 dark:text-white">Reglas de categorización</h1>
          <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
            Cuando importemos un movimiento desde tu correo y su texto ya coincida con una regla, lo categorizamos
            solo. Si es nuevo, eliges la categoría una vez y queda aprendida.
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-semibold text-gray-500 dark:bg-white/10 dark:text-gray-400">
          Próximamente
        </span>
      </div>

      <p className="rounded-2xl border border-dashed border-gray-200 px-4 py-3 text-[11px] leading-relaxed text-gray-400 dark:border-white/10 dark:text-gray-500">
        Esto es una vista de ejemplo con datos de muestra — todavía no está conectada a tu correo ni guarda reglas de
        verdad. Se construye cuando se sume la importación automática desde el correo del banco.
      </p>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
          Por revisar
        </p>
        <Card className="divide-y divide-gray-100 dark:divide-white/10">
          {EJEMPLO_POR_REVISAR.map((item) => (
            <div key={item.id} className="flex flex-col gap-2.5 py-3.5 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-gray-400 dark:text-gray-500">
                    <rect x="3" y="5" width="18" height="14" rx="2.5" />
                    <path d="m3.5 6.5 8.5 6 8.5-6" />
                  </svg>
                  <span className="truncate font-mono text-xs text-gray-500 dark:text-gray-400">{item.texto}</span>
                </div>
                <span className="shrink-0 text-sm font-bold text-gasto">{formatCLPDemo(item.monto)}</span>
              </div>

              {item.estado === "autocategorizado" ? (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10.5px] font-bold text-emerald-500 dark:bg-emerald-500/10">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                      <path d="m4 12 5 5L20 6" />
                    </svg>
                    Autocategorizado
                  </span>
                  <span className="rounded-full bg-gray-800 px-3 py-1 text-xs font-semibold text-white dark:bg-white dark:text-black">
                    {item.categoria}
                  </span>
                </div>
              ) : (
                <div>
                  <p className="mb-1.5 text-[11px] text-gray-400 dark:text-gray-500">No lo reconocemos aún — elige una categoría:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {item.sugerencias?.map((s) => (
                      <span key={s} className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-500 dark:bg-white/5 dark:text-gray-400">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </Card>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
          Reglas aprendidas
        </p>
        <Card className="divide-y divide-gray-100 p-3 dark:divide-white/10">
          {EJEMPLO_REGLAS_APRENDIDAS.map((r) => (
            <div key={r.texto} className="flex items-center gap-2.5 py-2.5 first:pt-1 last:pb-1">
              <span className="flex-1 truncate font-mono text-xs text-gray-500 dark:text-gray-400">{r.texto}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-gray-300 dark:text-gray-600">
                <path d="M4 12h16m-6-6 6 6-6 6" />
              </svg>
              <span className="shrink-0 rounded-full bg-gray-800 px-3 py-1 text-xs font-semibold text-white dark:bg-white dark:text-black">
                {r.categoria}
              </span>
            </div>
          ))}
        </Card>
      </div>

      <Link href="/personas" className="block text-center text-xs font-semibold text-brand-from dark:text-white">
        ← Volver a Perfil
      </Link>
    </div>
  );
}
