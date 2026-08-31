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
    | "linea_credito"
    | "credito_hipotecario"
    | "transferencia";
  marca_id: string | null;
}

export type TipoMarca = "banco" | "casa_comercial" | "servicio_basico" | "otro";

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

export interface CompraVigente extends Compra {
  monto_cuota: number;
  cuota_actual: number;
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
