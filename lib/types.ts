export interface Persona {
  id: string;
  nombre: string;
  porcentaje_reparto: number | null; // ya no se usa para calcular repartos (queda por compatibilidad histórica)
  activo: boolean;
  foto_url: string | null;
  // true = la persona que se crea sola al iniciar sesión y representa al
  // dueño de la cuenta; false = agregada a mano solo para repartos.
  es_self: boolean;
}

export interface Categoria {
  id: string;
  nombre: string;
  tipo: "fijo" | "variable";
  icono: string | null;
  // Tipo de marca que se sugiere al elegir esta categoría en un item (ej:
  // "Supermercado" -> "supermercado", así se ofrecen Jumbo/Líder/etc.).
  // null = no se sugiere ninguna.
  tipo_marca_sugerido: TipoMarca | null;
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
  // Personalización visual de la tarjeta en /tarjetas. color_hex: color base
  // del degradado (si es null, se usa un color determinístico por nombre,
  // ver lib/avatarColor.ts). imagen_fondo_url: foto/diseño real de la
  // tarjeta que el usuario sube (ej. una captura del diseño de su banco) —
  // si existe, se usa como fondo en vez del degradado.
  color_hex: string | null;
  imagen_fondo_url: string | null;
  // Saldo actual, editado a mano por el usuario (null = todavía no lo puso).
  saldo: number | null;
  // Límite de crédito (solo tiene sentido para tipo "tarjeta_credito") — con
  // esto puesto, /tarjetas calcula solo el cupo disponible. null = todavía
  // no lo puso. Ver migration_28_cupo_tarjetas.sql.
  cupo: number | null;
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
  | "suscripcion"
  // Auto y Salud (ver migration_25_marcas_auto_salud.sql) — a diferencia de
  // los demás tipos, estos dos se agrupan de a varios por categoría (Auto:
  // bencina+mecanico+repuestos; Salud: centro_medico+farmacia), por eso el
  // selector de /auto y /salud usa MarcaAgrupadaPicker en vez de
  // MarcaSugeridaPicker (pensado para UN tipo por categoría).
  | "bencina"
  | "mecanico"
  | "repuestos"
  | "centro_medico"
  | "farmacia"
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

// "Esta categoría usa este grupo mío por defecto" (ver
// migration_26_reparto_por_categoria.sql) — una fila por cuenta y por
// categoría; el formulario de gastos la usa para precargar el grupo apenas
// se elige la categoría, sin tener que elegirlo a mano cada vez.
export interface CategoriaGrupoPreferido {
  id: string;
  categoria_id: string;
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
  // Marca/servicio específico del item (ej: "Jumbo", "Netflix") — distinto
  // de entidad_id (el MEDIO DE PAGO, ej. la tarjeta con la que se paga).
  marca_id: string | null;
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
  marca_id: string | null;
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
  marca_id: string | null;
  icono: string | null;
  monto_estimado: number;
  persona_id: string;
  persona_nombre: string;
  monto_persona: number;
}

// Reparto por persona de un gasto diario QUE tenga un grupo elegido (ver
// migration_27_reparto_gastos_diarios.sql) — los diarios sin grupo (Auto,
// Salud hoy) simplemente no aparecen acá, como siempre.
export interface RepartoGastoDiario {
  gasto_diario_id: string;
  descripcion: string;
  categoria_id: string | null;
  grupo_id: string | null;
  marca_id: string | null;
  fecha: string;
  monto: number;
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
  marca_id: string | null;
  icono: string | null;
  monto_estimado: number;
  dia_mes_pago: number | null;
  // 'fijo' = siempre cobra lo mismo (arriendo, suscripción). 'variable' =
  // fecha de vencimiento fija pero el monto cambia cada mes (luz, agua,
  // gas) — ver lib/promedioMovil.ts.
  tipo_monto: "fijo" | "variable";
  activo: boolean;
}

// Marca si el cargo del mes (cuota o gasto fijo) ya se pagó, y el monto
// real si difiere del estimado — de acá sale el promedio móvil de los
// gastos fijos de monto variable (ver lib/promedioMovil.ts) y el estado
// pagado/pendiente del Calendario de pagos (/calendario-pagos).
export interface Pago {
  id: string;
  origen: OrigenItem;
  origen_id: string;
  mes: string; // primer día del mes, ej. "2026-09-01"
  monto_real: number | null;
  pagado: boolean;
  fecha_pago: string | null;
}

export interface Ingreso {
  id: string;
  persona_id: string | null;
  monto: number;
  mes: string;
  descripcion: string | null;
}

// Mover plata entre tus propias cuentas (ej. BancoEstado -> Mercado Pago).
// No es gasto ni ingreso, así que no afecta "Disponible este mes" — por
// ahora es solo un registro/historial.
export interface Transferencia {
  id: string;
  monto: number;
  cuenta_origen_id: string | null;
  cuenta_destino_id: string | null;
  fecha: string;
  notas: string | null;
}

export interface ResumenPersonaMes {
  persona_id: string;
  persona_nombre: string;
  total: number;
}

// Meta de ahorro (ej. "Viaje a Cancún", "Fondo de emergencia") — distinta de
// la categoría "Ahorro" (para gastos recurrentes): es un objetivo puntual
// con progreso propio, no un gasto del mes.
export interface MetaAhorro {
  id: string;
  nombre: string;
  monto_objetivo: number;
  fecha_objetivo: string | null;
  icono: string | null;
  activa: boolean;
}

// Aporte suelto contra una meta. monto sin restricción de signo a
// propósito: positivo = aporte, negativo = retiro.
export interface MetaAhorroAporte {
  id: string;
  meta_id: string;
  monto: number;
  fecha: string;
  notas: string | null;
}

// Viene de vista_metas_ahorro_progreso: monto_actual es la suma de los
// aportes de la meta, calculada siempre en la base (nunca se guarda suelta).
export interface MetaAhorroProgreso {
  meta_id: string;
  nombre: string;
  monto_objetivo: number;
  fecha_objetivo: string | null;
  icono: string | null;
  activa: boolean;
  monto_actual: number;
}

// Gasto suelto de carga rápida: solo monto, descripción y fecha, sin medio
// de pago. Lo usan 3 pantallas, cada una atada a su propia categoría fija
// (categoria_id se completa solo al guardar, no lo elige el usuario):
// "Diarios" de /gastos (Hogar y otras categorías del día a día), /auto
// (Auto) y /salud (Salud) — ver components/gastos/DiariosLista.tsx.
// `marca_id` es opcional y solo lo completan /auto y /salud (bencinera,
// centro médico, farmacia...), ver migration_25_marcas_auto_salud.sql;
// "Diarios" de /gastos no lo usa. `grupo_id` es opcional (null = sin
// reparto, como siempre) — ver migration_27_reparto_gastos_diarios.sql.
export interface GastoDiario {
  id: string;
  descripcion: string;
  monto: number;
  categoria_id: string | null;
  marca_id: string | null;
  grupo_id: string | null;
  fecha: string;
}

// Personalización del menú lateral de escritorio (DesktopSidebar.tsx): una
// fila por cuenta. `orden`/`ocultos` guardan claves estables de ítem (ej.
// "inicio", "fijos"), no el href — ver migration_24_preferencias_menu.sql.
// Ausente (cuenta que nunca personalizó) = usar el orden por defecto del
// código, nada oculto.
export interface PreferenciasMenu {
  orden: string[];
  ocultos: string[];
}

export type TipoDocumentoAuto = "permiso_circulacion" | "revision_tecnica" | "seguro" | "otro";

// Documento del auto con vencimiento anual (permiso de circulación, revisión
// técnica, seguro, u "otro" libre). Al renovar se edita fecha_vencimiento
// del mismo registro en vez de crear uno nuevo. Pantalla /auto.
export interface DocumentoAuto {
  id: string;
  tipo: TipoDocumentoAuto;
  nombre: string;
  fecha_vencimiento: string;
  notas: string | null;
}
