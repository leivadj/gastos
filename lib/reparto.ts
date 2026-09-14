// Resuelve el % efectivo de una lista de filas de reparto (grupo_participantes
// o item_participantes) — porcentaje null = partes iguales del resto, mismo
// criterio que ya usan las vistas SQL vista_grupo_reparto/vista_item_reparto
// y ReportesPage.repartoEfectivo. Se extrajo acá para que también lo use el
// snapshot que se graba al guardar un gasto con grupo (ver
// migration_33_compromisos_fundacion.sql) — antes de esa migración, un ítem
// con grupo no guardaba ningún reparto propio y se resolvía siempre en vivo
// contra el grupo, lo que hacía que un cambio de % afectara retroactivamente
// los meses ya cargados.
export interface FilaReparto {
  persona_id: string;
  porcentaje: number | null;
}

export interface ParticipanteEfectivo {
  persona_id: string;
  porcentaje: number;
}

export function resolverPorcentajesEfectivos(
  filas: FilaReparto[],
  idsPersonasActivas: Set<string>
): ParticipanteEfectivo[] {
  const filasActivas = filas.filter((f) => idsPersonasActivas.has(f.persona_id));
  const sumaFija = filasActivas.filter((f) => f.porcentaje != null).reduce((acc, f) => acc + Number(f.porcentaje), 0);
  const sinFijar = filasActivas.filter((f) => f.porcentaje == null);
  return filasActivas.map((f) => ({
    persona_id: f.persona_id,
    porcentaje: f.porcentaje != null ? Number(f.porcentaje) : sinFijar.length > 0 ? Math.max(0, 100 - sumaFija) / sinFijar.length : 0,
  }));
}
