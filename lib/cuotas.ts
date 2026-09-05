// A partir de "en qué número de cuota vas" y el día del mes en que vence
// cada cuota, arma la fecha ISO de la PRIMERA cuota, retrocediendo esos
// meses. Así, al agregar una compra en cuotas que ya viene en curso, la
// persona no tiene que saber ni calcular esa fecha (dato que casi nadie
// tiene a mano en su tarjeta/app del banco) — solo en qué cuota va y cuánto
// paga por cuota (ver CuotasLista.tsx). El resto de la app (calendario de
// pagos, reportes, dashboard) sigue funcionando igual porque sigue viendo
// una fecha_primera_cuota normal — solo cambia cómo se calcula al guardar.
//
// Arma la fecha con componentes locales de Date (año/mes/día) en vez de
// Date+toISOString, por la misma razón que lib/format.ts > diaDelMes: evitar
// corrimientos de huso horario al convertir a UTC.
export function fechaPrimeraCuotaDesde(cuotaActual: number, diaVencimiento: number, refFechaISO?: string): string {
  const ref = refFechaISO ? new Date(`${refFechaISO.slice(0, 10)}T00:00:00`) : new Date();
  const mesesAtras = Math.max(0, Math.round(cuotaActual) - 1);
  const fecha = new Date(ref.getFullYear(), ref.getMonth() - mesesAtras, diaVencimiento);
  const year = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${year}-${mes}-${dia}`;
}
