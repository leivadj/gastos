// Color del anillo de progreso de presupuesto por categoría (pantalla
// Presupuesto, ronda 6 del rediseño) — a diferencia del color de la barra
// vertical de Inicio (que es el color PROPIO de la categoría, ver
// lib/colorCategoria.ts), acá el color depende de CUÁNTO llevas gastado del
// presupuesto: verde → amarillo → naranjo → rojo cuando te excedes, calcado
// de una captura real de Not Pato.
export function colorAnilloPresupuesto(gastado: number, presupuesto: number): string {
  if (presupuesto <= 0) return "#9B9995";
  if (gastado > presupuesto) return "#E2584B"; // rojo — excedido
  const pct = (gastado / presupuesto) * 100;
  if (pct >= 85) return "#E8935A"; // naranjo
  if (pct >= 50) return "#E0C54A"; // amarillo
  return "#5DCB86"; // verde
}
