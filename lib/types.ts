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
  // migration_36_color_categoria.sql. Color propio de la categoría (ej. en
  // las barras verticales de "Presupuesto por categoría" y los anillos de
  // Presupuesto). null = se usa el color determinístico por nombre de
  // lib/avatarColor.ts (colorFor), no un valor elegido a mano.
  color: string | null;
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
  // Color hex opcional para el texto/íconos superpuestos en la cara de la
  // tarjeta — null = blanco (el de siempre). Ver
  // migration_35_color_texto_tarjeta.sql. Pensado para tarjetas con
  // color/imagen de fondo muy claros donde el texto blanco no se lee.
  color_texto: string | null;
  imagen_fondo_url: string | null;
  // Saldo actual, editado a mano por el usuario (null = todavía no lo puso).
  saldo: number | null;
  // Límite de crédito (solo tiene sentido para tipo "tarjeta_credito") — con
  // esto puesto, /tarjetas calcula solo el cupo disponible. null = todavía
  // no lo puso. Ver migration_28_cupo_tarjetas.sql.
  cupo: number | null;
  // Últimos 4 dígitos de la tarjeta/cuenta, para reconocerla de un vistazo
  // (ej. "•••• 5344") — opcional, texto (no número: puede empezar con "0").
  // Ver migration_32_ultimos_digitos.sql.
  ultimos_digitos: string | null;
  // De quién es esta tarjeta/cuenta (el titular no necesariamente es quien
  // debe asumir el gasto — eso lo define "Asignar a" en cada movimiento). null
  // = sin titular asignado (no se agrupa bajo nadie en Compromisos). Ver
  // migration_33_compromisos_fundacion.sql.
  titular_persona_id: string | null;
}

// Hasta migration_39_tipos_marca_libres.sql, esto era una unión cerrada de
// 17 valores fijos (Banco/Casa comercial/Supermercado/...), calcada de un
// `check` de la base de datos — Felipe reportó que al crear una categoría
// nueva (ej. "Mascotas") no había forma de que apareciera como opción "Tipo"
// al crear una marca, porque la lista de tipos nunca podía crecer. Ahora es
// texto libre: app/admin/page.tsx sigue ofreciendo los 17 de siempre como
// catálogo base (con sus labels en español), más "+ Nuevo tipo…" para
// agregar uno propio, que queda disponible de inmediato para categorías Y
// marcas — ver ese archivo para la lista base y el generador de labels.
export type TipoMarca = string;

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
  // Marca el grupo que representa a "Hogar" en Compromisos — a lo más uno por
  // cuenta (índice único parcial). false para cualquier otro grupo de reparto
  // que el usuario cree (ej. uno para dividir Falabella con alguien). Ver
  // migration_33_compromisos_fundacion.sql.
  es_principal: boolean;
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

// Movimiento detectado leyendo el correo del banco (ver
// migration_29_sugerencias_correo.sql y app/api/sugerencias-correo), pendiente
// de revisión manual en /sugerencias. "gasto" y "transferencia_tercero" se
// confirman igual (como gasto diario) — la diferencia es solo informativa
// (si fue una compra a un comercio o plata que le mandaste a una persona).
// "transferencia_propia" se confirma como "↔ Transferencia" entre tus
// propias cuentas, no es gasto ni ingreso.
export type TipoSugerenciaCorreo = "gasto" | "transferencia_propia" | "transferencia_tercero";
export type EstadoSugerenciaCorreo = "pendiente" | "confirmada" | "descartada";

export interface SugerenciaCorreo {
  id: string;
  tipo: TipoSugerenciaCorreo;
  monto: number;
  descripcion: string;
  fecha: string;
  estado: EstadoSugerenciaCorreo;
  // Campos crudos sacados del correo (comercio, cuenta, comentario…), tal
  // cual se guardaron — solo para poder revisar cómo se interpretó.
  datos_originales: Record<string, unknown> | null;
  created_at: string;
}

export interface ResumenPersonaMes {
  persona_id: string;
  persona_nombre: string;
  total: number;
}

// Una suscripción a notificaciones push (un dispositivo/navegador que
// aceptó notificaciones) — ver migration_30_push_subscriptions.sql y
// components/NotificacionesPush.tsx. El navegador la genera sola al
// suscribirse; acá solo se guarda tal cual para poder mandarle un push
// después desde el servidor.
export interface PushSubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
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
// `entidad_id` es opcional (null = efectivo/sin cuenta, el comportamiento de
// siempre) — ver migration_37_entidad_gastos_diarios.sql. Se agregó porque
// /sugerencias confirma TODO acá (también las compras con tarjeta real que
// llegan del correo del banco), no solo los diarios en efectivo cargados a
// mano.
export interface GastoDiario {
  id: string;
  descripcion: string;
  monto: number;
  categoria_id: string | null;
  marca_id: string | null;
  grupo_id: string | null;
  entidad_id: string | null;
  fecha: string;
}

// Una regla de categorización aprendida (ver
// migration_38_reglas_categorizacion.sql y /reglas-categorizacion): "cuando
// el texto del correo se parece a `patron`, sugerir esta categoría (y de
// paso la marca/cuenta, si también se aprendieron)". `patron` se guarda
// normalizado (mayúsculas, sin espacios de sobra). `veces_usada` es solo
// para ordenar "más usadas" primero en la pantalla.
export interface ReglaCategorizacion {
  id: string;
  patron: string;
  categoria_id: string;
  marca_id: string | null;
  entidad_id: string | null;
  veces_usada: number;
  created_at: string;
  updated_at: string;
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

// Objetivo mensual de gasto por categoría (ver migration_31_presupuesto_
// categorias.sql) — para las barras "gasto vs. presupuesto" de Inicio. No es
// por mes calendario: es el objetivo recurrente de esa categoría (como
// monto_estimado en GastoFijo), se compara siempre contra el mes que se esté
// viendo.
export interface PresupuestoCategoria {
  id: string;
  categoria_id: string;
  monto_mensual: number;
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

// Preferencias de "Mi perfil" (Ronda 9, pedido de Felipe: "Vista principal",
// "Inicio del mes" y "Balance") — una fila por usuario (owner_id es la
// llave primaria, ver migration_40_preferencias_usuario.sql). No existe
// fila todavía para nadie que no haya entrado a configurar algo: en ese
// caso se usa PREFERENCIAS_DEFECTO (lib/preferenciasUsuario.ts), que
// reproduce EXACTO el comportamiento de siempre (día 1, todas las cuentas
// no-tarjeta-crédito suman al balance, pestaña "Resumen" primero).
export interface PreferenciasUsuario {
  owner_id: string;
  // Día del mes en que arranca tu ciclo (1-28). 1 = como siempre (mes
  // calendario). Hoy solo lo usa Inicio (balance/ingresos/gastos del
  // resumen) — /movimientos, /reportes, /tarjetas y el calendario de
  // "Actividad del mes" siguen agrupando por mes calendario (día 1) sin
  // importar este valor; ver lib/cicloMes.ts.
  dia_inicio_mes: number;
  // Qué cuentas suman al "Balance"/"Apertura del mes" de Inicio (antes
  // siempre sumaba TODO menos tarjetas de crédito — eso sigue siendo lo que
  // pasa por defecto con estos 3 en true/true/false).
  balance_incluye_debito: boolean;
  balance_incluye_efectivo: boolean;
  // A diferencia de débito/efectivo (que suman el saldo), una tarjeta de
  // crédito no tiene "saldo" en el mismo sentido — esto suma su CUPO
  // DISPONIBLE (cupo - usado) en vez de un saldo.
  balance_incluye_cupo_tc: boolean;
  // Qué pestaña de Inicio (celular) se abre primero.
  pestana_inicio_defecto: "resumen" | "ingresos" | "presupuesto";
  // Orden de las 3 tarjetas de la pestaña "Resumen" (celular): "categoria"
  // (dona de gastos por categoría), "presupuesto_categorias" (barras de
  // presupuesto) y "actividad_mes" (calendario). En escritorio no hay
  // pestañas, pero el mismo orden decide si "Presupuesto por categoría" o
  // "Cuentas y tarjetas" va primero en la fila de abajo.
  orden_resumen: string[];
  updated_at: string;
}

// Una solicitud de logo (Ronda 9, "Sugerir un logo" — distinto del panel de
// admin en /admin, que sube el logo; esto es para que cualquier usuario
// PIDA el logo de una marca que todavía no lo tiene). Ver
// migration_41_solicitudes_logo.sql. `estado` pasa a "resuelta" cuando el
// admin sube el logo y la marca listo (o decide que no corresponde).
export interface SolicitudLogo {
  id: string;
  owner_id: string;
  marca_id: string;
  nota: string | null;
  estado: "pendiente" | "resuelta";
  created_at: string;
}
