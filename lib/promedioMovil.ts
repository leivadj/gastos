import { Pago } from "./types";

// Promedio móvil de un gasto fijo de monto variable (luz, agua, gas...):
// promedia los últimos hasta 3 meses ANTERIORES al actual que tengan un
// pago real registrado (ver /calendario-pagos). Si todavía no hay ningún
// mes con pago real, usa el monto estimado que se cargó al crear el gasto
// — así el número mostrado siempre es razonable, incluso antes de empezar
// a registrar pagos.
export function promedioMovil(
  pagos: Pago[],
  gastoFijoId: string,
  mesActualISO: string,
  montoEstimado: number
): { promedio: number; meses: number } {
  const historial = pagos
    .filter(
      (p) =>
        p.origen === "gasto_fijo" &&
        p.origen_id === gastoFijoId &&
        p.monto_real != null &&
        p.mes < mesActualISO
    )
    .sort((a, b) => (a.mes < b.mes ? 1 : a.mes > b.mes ? -1 : 0))
    .slice(0, 3);

  if (historial.length === 0) {
    return { promedio: montoEstimado, meses: 0 };
  }
  const suma = historial.reduce((acc, p) => acc + Number(p.monto_real), 0);
  return { promedio: Math.round(suma / historial.length), meses: historial.length };
}
