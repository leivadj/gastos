import { PreferenciasUsuario } from "./types";

// Valores por defecto (Ronda 9) — se usan mientras no exista una fila en
// `preferencias_usuario` para el usuario (no se crea una fila de entrada
// para cada uno, solo la primera vez que guarda algo desde Mi perfil). A
// propósito reproducen EXACTO el comportamiento de siempre de la app, para
// que nadie note un cambio hasta que entra a configurar algo.
export const PREFERENCIAS_DEFECTO: Omit<PreferenciasUsuario, "owner_id" | "updated_at"> = {
  dia_inicio_mes: 1,
  balance_incluye_debito: true,
  balance_incluye_efectivo: true,
  balance_incluye_cupo_tc: false,
  pestana_inicio_defecto: "resumen",
  orden_resumen: ["categoria", "presupuesto_categorias", "actividad_mes"],
};

// Completa una fila cargada (o null, si todavía no existe) con los valores
// por defecto que falten — así ningún lugar del código tiene que acordarse
// de chequear null antes de leer una preferencia.
export function conDefectos(fila: Partial<PreferenciasUsuario> | null): PreferenciasUsuario {
  return {
    owner_id: fila?.owner_id ?? "",
    updated_at: fila?.updated_at ?? "",
    dia_inicio_mes: fila?.dia_inicio_mes ?? PREFERENCIAS_DEFECTO.dia_inicio_mes,
    balance_incluye_debito: fila?.balance_incluye_debito ?? PREFERENCIAS_DEFECTO.balance_incluye_debito,
    balance_incluye_efectivo: fila?.balance_incluye_efectivo ?? PREFERENCIAS_DEFECTO.balance_incluye_efectivo,
    balance_incluye_cupo_tc: fila?.balance_incluye_cupo_tc ?? PREFERENCIAS_DEFECTO.balance_incluye_cupo_tc,
    pestana_inicio_defecto: fila?.pestana_inicio_defecto ?? PREFERENCIAS_DEFECTO.pestana_inicio_defecto,
    orden_resumen:
      fila?.orden_resumen && fila.orden_resumen.length > 0 ? fila.orden_resumen : PREFERENCIAS_DEFECTO.orden_resumen,
  };
}

// Claves válidas de "orden_resumen" en su orden por defecto — se usa para
// completar/filtrar un valor guardado que haya quedado corrupto o
// incompleto (ej. si en el futuro se agrega o se quita una tarjeta), así
// nunca desaparece una sección por un dato raro guardado antes.
export const CLAVES_RESUMEN_DEFECTO = ["categoria", "presupuesto_categorias", "actividad_mes"] as const;

export function ordenResumenValido(orden: string[]): string[] {
  const filtrado = orden.filter((k) => (CLAVES_RESUMEN_DEFECTO as readonly string[]).includes(k));
  return [...filtrado, ...CLAVES_RESUMEN_DEFECTO.filter((k) => !filtrado.includes(k))];
}
