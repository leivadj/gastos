import { Categoria, CompraVigente, GastoDiario, GastoFijo } from "./types";

export interface ResumenGastosMes {
  dataCategoria: { name: string; value: number }[];
  totalGastos: number;
  totalTipoFijo: number;
  totalTipoVariable: number;
  pctFijo: number;
}

// Agrupa las cuotas vigentes + gastos fijos activos + gastos diarios del mes
// por categoría, y separa el total entre categorías "fijo" (arriendo,
// suscripciones...) y "variable" (compras, delivery, Hogar...) según
// categorias.tipo. Se usa tanto en el resumen de Inicio como en Presupuesto,
// para no tener el mismo cálculo duplicado en dos pantallas y arriesgar que
// se desalineen con el tiempo. `gastosDiarios` es opcional (Inicio/Presupuesto
// solo cargan el mes actual; Reportes reconstruye meses pasados aparte).
export function resumenGastosMes(
  cuotas: CompraVigente[],
  gastosFijos: GastoFijo[],
  categorias: Categoria[],
  gastosDiarios: GastoDiario[] = []
): ResumenGastosMes {
  const categoriaNombre = (id: string | null) =>
    categorias.find((c) => c.id === id)?.nombre ?? "Sin categoría";
  const categoriaTipo = (id: string | null) => categorias.find((c) => c.id === id)?.tipo ?? "variable";

  const porCategoria: Record<string, number> = {};
  let totalTipoFijo = 0;
  let totalTipoVariable = 0;

  cuotas.forEach((c) => {
    const nombre = categoriaNombre(c.categoria_id);
    porCategoria[nombre] = (porCategoria[nombre] ?? 0) + Number(c.monto_cuota);
    if (categoriaTipo(c.categoria_id) === "fijo") totalTipoFijo += Number(c.monto_cuota);
    else totalTipoVariable += Number(c.monto_cuota);
  });
  gastosFijos.forEach((g) => {
    const nombre = categoriaNombre(g.categoria_id);
    porCategoria[nombre] = (porCategoria[nombre] ?? 0) + Number(g.monto_estimado);
    if (categoriaTipo(g.categoria_id) === "fijo") totalTipoFijo += Number(g.monto_estimado);
    else totalTipoVariable += Number(g.monto_estimado);
  });
  gastosDiarios.forEach((d) => {
    const nombre = categoriaNombre(d.categoria_id);
    porCategoria[nombre] = (porCategoria[nombre] ?? 0) + Number(d.monto);
    if (categoriaTipo(d.categoria_id) === "fijo") totalTipoFijo += Number(d.monto);
    else totalTipoVariable += Number(d.monto);
  });

  const dataCategoria = Object.entries(porCategoria)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const totalGastos = totalTipoFijo + totalTipoVariable;
  const pctFijo = totalGastos > 0 ? (totalTipoFijo / totalGastos) * 100 : 0;

  return { dataCategoria, totalGastos, totalTipoFijo, totalTipoVariable, pctFijo };
}
