export type ModoReparto = "manual" | "automatico";

export interface Persona {
  id: string;
  nombre: string;
  porcentaje_reparto: number | null;
  activo: boolean;
}

export interface Categoria {
  id: string;
  nombre: string;
  tipo: "fijo" | "variable";
}

export interface Entidad {
  id: string;
  nombre: string;
  tipo:
    | "efectivo"
    | "tarjeta_credito"
    | "tarjeta_debito"
    | "linea_credito"
    | "credito_hipotecario"
    | "transferencia";
  marca_id: string | null;
}

export type TipoMarca =
  | "banco"
  | "casa_comercial"
  | "caja_compensacion"
  | "autopista"
  | "telecom"
  | "servicio_basico"
  | "otro";

export interface Marca {
  id: string;
  nombre: string;
  tipo: TipoMarca;
  logo_url: string | null;
}

export interface Compra {
  id: string;
  descripcion: string;
  monto_total: number;
  n_cuotas: number;
  fecha_primera_cuota: string;
  entidad_id: string | null;
  categoria_id: string | null;
  modo_reparto: ModoReparto;
  persona_id: string | null;
  notas: string | null;
}

// Viene de las vistas vista_cuotas_vigentes / vista_cuotas_mes_actual, que
// renombran `compras.id` a `compra_id` (para no chocar con otros ids si se
// llegan a hacer joins). Ojo: NO tiene `id`, solo `compra_id`.
export interface CompraVigente extends Omit<Compra, "id"> {
  compra_id: string;
  monto_cuota: number;
  cuota_actual: number;
}

// Reparto por persona de una cuota este mes (vista_reparto_cuotas_mes):
// ya viene con el monto que le corresponde a ESA persona (monto_persona),
// sea reparto manual o por porcentaje.
export interface RepartoCuota {
  compra_id: string;
  descripcion: string;
  categoria_id: string | null;
  entidad_id: string | null;
  monto_cuota: number;
  cuota_actual: number;
  n_cuotas: number;
  persona_id: string;
  persona_nombre: string;
  monto_persona: number;
}

// Reparto por persona de un gasto fijo este mes (vista_reparto_gastos_fijos).
export interface RepartoGastoFijo {
  gasto_fijo_id: string;
  descripcion: string;
  categoria_id: string | null;
  entidad_id: string | null;
  monto_estimado: number;
  persona_id: string;
  persona_nombre: string;
  monto_persona: number;
}

export interface GastoFijo {
  id: string;
  descripcion: string;
  categoria_id: string | null;
  entidad_id: string | null;
  monto_estimado: number;
  dia_mes_pago: number | null;
  modo_reparto: ModoReparto;
  persona_id: string | null;
  activo: boolean;
}

export interface Ingreso {
  id: string;
  persona_id: string | null;
  monto: number;
  mes: string;
  descripcion: string | null;
}

export interface ResumenPersonaMes {
  persona_id: string;
  persona_nombre: string;
  total: number;
}
