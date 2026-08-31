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

export function nombreMes(fechaISO?: string): string {
  const fecha = fechaISO ? new Date(fechaISO) : new Date();
  return new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric" }).format(fecha);
}
