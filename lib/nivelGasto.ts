// Escala de "intensidad de gasto" por día — gris → verde → amarillo →
// naranja → rojo, calcada de una captura real de la app Not Pato (ver
// app/calendario-pagos/page.tsx, pestaña "Intensidad", donde se usó por
// primera vez). Se extrae acá para que cualquier otra pantalla que quiera
// mostrar "cuánto se gastó cada día" con colores (ej. el calendario
// "Actividad del mes" de Inicio) use EXACTAMENTE la misma paleta y el mismo
// criterio — 5 niveles relativos al día de mayor gasto del período que se
// esté mirando (no a un monto fijo en pesos), así el resultado tiene sentido
// sea que el período es "los días de esta cuenta" (Intensidad, que sigue
// siendo por cuenta) o "todas las cuentas/categorías juntas" (Actividad del
// mes) — cada pantalla arma su propio mapa día→monto y su propio máximo, y
// llama a estas mismas dos funciones.
export type NivelGasto = 0 | 1 | 2 | 3 | 4;

export function nivelDeGasto(monto: number, maxDelPeriodo: number): NivelGasto {
  if (monto <= 0 || maxDelPeriodo <= 0) return 0;
  const pct = monto / maxDelPeriodo;
  if (pct > 0.75) return 4;
  if (pct > 0.5) return 3;
  if (pct > 0.25) return 2;
  return 1;
}

export function estiloNivelGasto(nivel: NivelGasto): { background: string } {
  switch (nivel) {
    case 0:
      return { background: "rgba(120,120,120,0.08)" };
    case 1:
      return { background: "rgba(93,203,134,0.32)" };
    case 2:
      return { background: "rgba(224,197,74,0.4)" };
    case 3:
      return { background: "rgba(224,146,74,0.45)" };
    case 4:
      return { background: "rgba(226,88,75,0.55)" };
  }
}
