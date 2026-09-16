// Evento compartido para avisarle a BottomNav que se oculte mientras una
// hoja de pantalla completa (ej. el detalle de una tarjeta en /tarjetas)
// está abierta. BottomNav es semi-transparente con blur (bg-white/90
// backdrop-blur-xl), así que aunque el fondo oscuro de la hoja tenga un
// z-index más alto, la barra se seguía viendo borrosa/atenuada por detrás —
// Felipe pidió que quedara completamente oculta mientras la hoja está
// desplegada. Mismo patrón que EVENTO_MOVIMIENTO_GUARDADO en
// MovimientoRapido.tsx: un CustomEvent en window, sin pasar por contexto ni
// props, para que cualquier pantalla lo pueda usar sin acoplarse a BottomNav.
export const EVENTO_HOJA_PANTALLA_COMPLETA = "hoja:pantalla-completa";

export function avisarHojaPantallaCompleta(abierta: boolean) {
  window.dispatchEvent(new CustomEvent(EVENTO_HOJA_PANTALLA_COMPLETA, { detail: { abierta } }));
}
