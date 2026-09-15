import { MesRef, esMismoMes, mesAnterior, mesRefDeFecha } from "./cuotasHistoricas";

// "Inicio del mes" (Ronda 9) — hasta ahora el ciclo de Inicio siempre
// empezaba el día 1 de cada mes calendario. Estas funciones traducen una
// fecha real (ej. gastos_diarios.fecha) al "mes de ciclo" al que pertenece
// cuando el usuario elige un día de inicio distinto de 1 — ej. si el ciclo
// arranca el día 25, el 27 de septiembre ya es parte del ciclo "septiembre"
// (empezó el 25/09), pero el 20 de septiembre todavía es parte del ciclo
// "agosto" (empezó el 25/08).
//
// A propósito solo se usa hoy en Inicio (app/page.tsx, balance/ingresos/
// gastos del resumen) — /movimientos, /reportes, /tarjetas,
// PresupuestoContenido y el calendario de "Actividad del mes" siguen
// agrupando por mes calendario (día 1) sin importar esta preferencia; los
// gastos fijos, cuotas e ingresos tampoco cambian, porque ya están
// etiquetados a un mes calendario específico por el usuario al crearlos
// (eso no tiene que ver con "qué día arranca mi ciclo"). Extender esto a
// todas las pantallas es un cambio más grande, pendiente para una ronda
// dedicada si Felipe lo pide.
//
// Con diaInicioMes = 1 (el valor por defecto) estas funciones devuelven
// exactamente lo mismo que el mes calendario de siempre — cero cambio de
// comportamiento para quien no haya tocado esta preferencia.

// Se parsea el texto en vez de `new Date(fechaIso)` por la misma razón que
// diaDelMes() en lib/format.ts: una fecha sin hora se interpreta en UTC, y
// eso puede devolver el día anterior con la zona horaria de Chile.
export function refCicloDeFecha(fechaIso: string, diaInicioMes: number): MesRef {
  const [y, m, d] = fechaIso.slice(0, 10).split("-").map(Number); // m: 1-12
  const base: MesRef = { year: y, month: m - 1 };
  if (diaInicioMes <= 1 || d >= diaInicioMes) return base;
  return mesAnterior(base);
}

export function refCicloActual(diaInicioMes: number): MesRef {
  const hoy = new Date();
  if (diaInicioMes <= 1 || hoy.getDate() >= diaInicioMes) return mesRefDeFecha(hoy);
  return mesAnterior(mesRefDeFecha(hoy));
}

export function perteneceAlCiclo(fechaIso: string, ref: MesRef, diaInicioMes: number): boolean {
  return esMismoMes(refCicloDeFecha(fechaIso, diaInicioMes), ref);
}
