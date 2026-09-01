export interface Persona {
  id: string;
  nombre: string;
  porcentaje_reparto: number | null; // ya no se usa para calcular repartos (queda por compatibilidad histórica)
  activo: boolean;
}

export interface Categoria {
  id: string;
  nombre: string;
  tipo: "fijo" | "variable";
  icono: string | null;
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
  | "supermercado"
  | "transporte"
  | "compras_online"
  | "delivery"
  | "otro";

export interface Marca {
  id: string;
  nombre: string;
  tipo: TipoMarca;
  logo_url: string | null;
  icono: string | null;
}

// Un grupo agrupa varios gastos/compras bajo un mismo reparto (ej: "Casa").
export interface Grupo {
  id: string;
  nombre: string;
  icono: string | null;
}

// Persona participante de un grupo o de un item suelto, con su % (o null =
// partes iguales del resto). Se usa tanto para grupo_participantes como
// para item_participantes (misma forma de dato en el front).
export interface Participante {
  persona_id: string;
  porcentaje: number | null;
}

export interface GrupoParticipante extends Participante {
  id: string;
  grupo_id: string;
}

export type OrigenItem = "compra" | "gasto_fijo";

export interface ItemParticipante extends Participante {
  id: string;
  origen: OrigenItem;
  origen_id: string;
}

export interface Compra {
  id: string;
  descripcion: string;
  monto_total: number;
  n_cuotas: number;
  fecha_primera_cuota: string;
  entidad_id: string | null;
  categoria_id: string | null;
  grupo_id: string | null;
  icono: string | null;
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
// calculado a partir del grupo (si tiene) o del reparto propio del item.
export interface RepartoCuota {
  compra_id: string;
  descripcion: string;
  categoria_id: string | null;
  entidad_id: string | null;
  grupo_id: string | null;
  icono: string | null;
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
  grupo_id: string | null;
  icono: string | null;
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
  grupo_id: string | null;
  icono: string | null;
  monto_estimado: number;
  dia_mes_pago: number | null;
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
