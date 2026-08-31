// Colores para el "avatar" de respaldo cuando una marca todavía no tiene
// logo cargado — determinístico por nombre, para que cada marca siempre
// se vea con el mismo color en vez de un gris genérico.
const PALETTE = [
  "#7C3AED",
  "#EC4899",
  "#0EA5E9",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#14B8A6",
  "#F97316",
  "#6366F1",
];

export function colorFor(nombre: string): string {
  let hash = 0;
  for (let i = 0; i < nombre.length; i++) {
    hash = nombre.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}
