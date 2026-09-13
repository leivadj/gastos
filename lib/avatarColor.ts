// Colores para el "avatar" de respaldo cuando una marca todavía no tiene
// logo cargado — determinístico por nombre, para que cada marca siempre
// se vea con el mismo color en vez de un gris genérico.
//
// Rediseño v2: la paleta de colores (morado/rosado/celeste/verde/ámbar...)
// quedó reemplazada por tonos de gris — el texto encima es siempre blanco
// (ver EntidadAvatar/PersonaAvatar/TarjetaVisual), así que se mantienen
// oscuros/medios para el contraste. La variedad entre marcas se ve en el
// tono de gris, no en el color — mismo espíritu que la paleta de la dona de
// categorías en PresupuestoContenido.tsx.
const PALETTE = [
  "#111112",
  "#242428",
  "#38383D",
  "#4C4C52",
  "#606066",
  "#6E6E72",
  "#54585C",
  "#3F4448",
];

export function colorFor(nombre: string): string {
  let hash = 0;
  for (let i = 0; i < nombre.length; i++) {
    hash = nombre.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}
