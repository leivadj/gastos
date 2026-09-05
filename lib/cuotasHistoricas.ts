// Matemática de fechas para reconstruir, con certeza, en qué cuota estaba
// una compra en un mes de referencia arbitrario (pasado, actual o futuro) —
// la misma matemática que la vista SQL vista_cuotas_vigentes, pero evaluada
// del lado del cliente. Se usa en /reportes (últimos 6 meses) y en
// /movimientos (navegación mes a mes) — vivía duplicada en reportes/page.tsx
// hasta que /movimientos necesitó la misma lógica, así que se extrajo acá
// para que ambas pantallas no puedan desalinearse con el tiempo.

export type MesRef = { year: number; month: number }; // month: 0-11, como Date.getMonth()

export function mesRefDeFecha(fecha: Date): MesRef {
  return { year: fecha.getFullYear(), month: fecha.getMonth() };
}

export function mesRefActual(): MesRef {
  return mesRefDeFecha(new Date());
}

// Primer día del mes de referencia, en formato ISO ("2026-09-01") — el mismo
// formato que usan mesActualISO()/gastos_fijos.mes/pagos.mes en el resto de
// la app.
export function isoDelMes(ref: MesRef): string {
  return `${ref.year}-${String(ref.month + 1).padStart(2, "0")}-01`;
}

export function mesSiguiente(ref: MesRef): MesRef {
  return mesRefDeFecha(new Date(ref.year, ref.month + 1, 1));
}

export function mesAnterior(ref: MesRef): MesRef {
  return mesRefDeFecha(new Date(ref.year, ref.month - 1, 1));
}

export function esMismoMes(a: MesRef, b: MesRef): boolean {
  return a.year === b.year && a.month === b.month;
}

// true si `ref` es un mes posterior a `limite` (para no dejar navegar a
// futuro más allá del mes actual en /movimientos).
export function esPosteriorA(ref: MesRef, limite: MesRef): boolean {
  return ref.year > limite.year || (ref.year === limite.year && ref.month > limite.month);
}

// N° de cuota vigente de una compra en el mes de referencia (1-based). Puede
// devolver <1 (todavía no empezaba) o >n_cuotas (ya terminó) — quien llama
// filtra ese rango contra compras.n_cuotas.
export function cuotaActualEn(fechaPrimeraCuota: string, ref: MesRef): number {
  const [y, m] = fechaPrimeraCuota.slice(0, 7).split("-").map(Number); // m: 1-12
  const diffMeses = (ref.year - y) * 12 + (ref.month - (m - 1));
  return diffMeses + 1;
}
