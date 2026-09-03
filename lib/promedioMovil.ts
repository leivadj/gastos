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

// Historial de hasta n meses ANTERIORES al actual con pago real registrado,
// en orden cronológico (más antiguo primero) — a diferencia de
// promedioMovil, que los junta en un solo número, esto expone cada mes por
// separado para el mini gráfico de barras de /servicios-basicos.
export function historialUltimosMeses(
  pagos: Pago[],
  gastoFijoId: string,
  mesActualISO: string,
  n = 3
): { mes: string; monto: number }[] {
  return pagos
    .filter(
      (p) =>
        p.origen === "gasto_fijo" &&
        p.origen_id === gastoFijoId &&
        p.monto_real != null &&
        p.mes < mesActualISO
    )
    .sort((a, b) => (a.mes < b.mes ? 1 : a.mes > b.mes ? -1 : 0))
    .slice(0, n)
    .reverse()
    .map((p) => ({ mes: p.mes, monto: Number(p.monto_real) }));
}
