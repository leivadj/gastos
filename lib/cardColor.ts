// Genera el degradado de una tarjeta a partir de UN color base (el que
// elige el usuario, o si no eligió ninguno, el color determinístico por
// nombre de lib/avatarColor.ts) — así cada tarjeta se ve como una tarjeta
// de verdad (con volumen/brillo) sin tener que pedirle al usuario que
// elija 2 o 3 colores a mano.

function ajustarColor(hex: string, cantidad: number): string {
  const limpio = hex.replace("#", "");
  const num = parseInt(limpio.length === 3 ? limpio.replace(/(.)/g, "$1$1") : limpio, 16);
  if (Number.isNaN(num)) return hex;
  const ajustar = (canal: number) => Math.max(0, Math.min(255, canal + cantidad));
  const r = ajustar((num >> 16) & 0xff);
  const g = ajustar((num >> 8) & 0xff);
  const b = ajustar(num & 0xff);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

export function gradienteTarjeta(colorBase: string): string {
  const claro = ajustarColor(colorBase, 40);
  const oscuro = ajustarColor(colorBase, -45);
  return `linear-gradient(135deg, ${claro} 0%, ${colorBase} 55%, ${oscuro} 100%)`;
}
