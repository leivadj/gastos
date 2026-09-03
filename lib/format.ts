export function formatCLP(valor: number | null | undefined): string {
  const n = valor ?? 0;
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(n);
}

export function mesActualISO(): string {
  const hoy = new Date();
  const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  return primerDia.toISOString().slice(0, 10);
}

// Primer día del mes SIGUIENTE al actual — límite superior (exclusivo) útil
// para filtrar filas con fecha real (ej. gastos_diarios) al mes en curso:
// `.gte("fecha", mesActualISO()).lt("fecha", primerDiaMesSiguiente())`.
export function primerDiaMesSiguiente(): string {
  const hoy = new Date();
  const siguiente = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);
  return siguiente.toISOString().slice(0, 10);
}

export function nombreMes(fechaISO?: string): string {
  const fecha = fechaISO ? new Date(fechaISO) : new Date();
  return new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric" }).format(fecha);
}

// Día del mes de una fecha guardada como texto (ej. "2026-08-05" -> 5),
// sacado por texto en vez de `new Date(...).getDate()` para no toparse con
// el corrimiento de zona horaria (una fecha sin hora se interpreta en UTC,
// y con Chile en UTC-3/-4 eso puede devolver el día anterior).
export function diaDelMes(fechaISO: string): number {
  return Number(fechaISO.slice(0, 10).split("-")[2]);
}

// Nombre corto del mes (ej. "2026-07-01" -> "jul") para etiquetas chicas
// como el mini gráfico de barras de /servicios-basicos. Arma la fecha con
// hora explícita, por la misma razón que diaDelMes: evitar el corrimiento
// de zona horaria de una fecha sin hora.
export function nombreMesCorto(fechaISO: string): string {
  const fecha = new Date(`${fechaISO.slice(0, 7)}-01T00:00:00`);
  return new Intl.DateTimeFormat("es-CL", { month: "short" }).format(fecha).replace(".", "");
}
