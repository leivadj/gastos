"use client";

// Anillo de progreso circular — Fase 1 del rediseño "estilo Haulo". Un solo
// arco (no una torta multi-segmento) para "cuánto de mi presupuesto ya
// gasté", igual al que Haulo muestra en su tarjeta de resumen — la idea es
// que un vistazo alcance, sin tener que leer una leyenda con varios colores.
export function AnilloProgreso({
  porcentaje,
  tamano = 140,
  grosor = 12,
  children,
}: {
  // 0-100. Valores fuera de rango se recortan (ej. gastado > presupuesto).
  porcentaje: number;
  tamano?: number;
  grosor?: number;
  children?: React.ReactNode;
}) {
  const pct = Math.max(0, Math.min(100, porcentaje));
  const radio = (tamano - grosor) / 2;
  const circunferencia = 2 * Math.PI * radio;
  const offset = circunferencia * (1 - pct / 100);
  const centro = tamano / 2;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: tamano, height: tamano }}>
      <svg width={tamano} height={tamano} className="-rotate-90">
        <circle
          cx={centro}
          cy={centro}
          r={radio}
          fill="none"
          strokeWidth={grosor}
          className="stroke-gray-100 dark:stroke-white/10"
        />
        <circle
          cx={centro}
          cy={centro}
          r={radio}
          fill="none"
          strokeWidth={grosor}
          strokeLinecap="round"
          strokeDasharray={circunferencia}
          strokeDashoffset={offset}
          className="stroke-brand-from transition-[stroke-dashoffset] duration-700 ease-out dark:stroke-white"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children ?? <span className="text-2xl font-black text-gray-800 dark:text-white">{Math.round(pct)}%</span>}
      </div>
    </div>
  );
}
