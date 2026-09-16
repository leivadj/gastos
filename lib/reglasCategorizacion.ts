// Reglas de categorización aprendidas (ver migration_38_reglas_categorizacion
// y /reglas-categorizacion) — la única función del mockup ImportarCorreo.dc.html
// que Felipe confirmó como funcionalidad nueva de verdad (ver
// claude/mockup-v2-decisiones.md). Se usa desde /sugerencias (para
// autosugerir y aprender) y desde /reglas-categorizacion (para listar).

// Normaliza el texto de un comercio para que "Pza Vespucio", "PZA VESPUCIO "
// y "pza  vespucio" cuenten como el mismo patrón: mayúsculas, sin espacios
// de sobra al borde ni dobles espacios en el medio.
export function normalizarPatron(texto: string): string {
  return texto.trim().toUpperCase().replace(/\s+/g, " ");
}

export type ReglaCategorizacionLite = {
  patron: string;
  categoria_id: string;
  marca_id: string | null;
  entidad_id: string | null;
};

// Busca, entre las reglas aprendidas, la que mejor calce con una descripción
// (normalizada) — coincidencia exacta primero, si no la regla cuyo patrón
// esté CONTENIDO en la descripción (ej. regla "PZA VESPUCIO" calza con
// "PZA VESPUCIO ESTACIONAMIENTO $3.500" si el correo trae texto extra). Si
// hay más de una que contiene, se prefiere la más larga (más específica).
export function buscarReglaQueCalce<T extends ReglaCategorizacionLite>(
  descripcionNormalizada: string,
  reglas: T[]
): T | null {
  const exacta = reglas.find((r) => r.patron === descripcionNormalizada);
  if (exacta) return exacta;
  const contenidas = reglas.filter((r) => descripcionNormalizada.includes(r.patron));
  if (contenidas.length === 0) return null;
  return contenidas.reduce((mejor, r) => (r.patron.length > mejor.patron.length ? r : mejor));
}
