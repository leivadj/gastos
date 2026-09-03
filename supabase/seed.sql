-- ============================================================================
-- Gastos del Hogar — Datos de ejemplo (seed)
-- ============================================================================
-- IMPORTANTE: estos son datos de partida leídos de forma aproximada desde tu
-- Excel "CUENTASRecuperado automáticamente.xlsx". Algunos montos por persona
-- no calzaban exactamente con una división simple (probablemente por interés
-- o ajustes manuales que hiciste en su momento), así que se tomó el criterio
-- más razonable. TODO esto se edita en 2 minutos desde la app una vez
-- desplegada — no hace falta que quede perfecto acá.
--
-- Corre este archivo DESPUÉS de schema.sql, en el mismo Editor SQL de Supabase.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- PERSONAS
-- Papá / Marian / Felipe: reparto automático por defecto en gastos comunes
-- de la casa (ajusta el % en la pantalla "Personas" de la app).
-- Nicolás / Madi: solo reciben cargos asignados manualmente (ej. cuotas de
-- estudios, ahorro), no participan del reparto automático.
-- ---------------------------------------------------------------------------
insert into personas (nombre, porcentaje_reparto, activo) values
  ('Papá', 34, true),
  ('Marian', 33, true),
  ('Felipe', 33, true),
  ('Nicolás', null, true),
  ('Madi', null, true);

-- ---------------------------------------------------------------------------
-- CATEGORIAS
-- ---------------------------------------------------------------------------
-- Los mismos 12 grupos que el catálogo de marcas en /admin, en el mismo
-- orden — cada categoría enlaza a su tipo de marca, así el formulario
-- ofrece directamente las marcas de ese grupo (ej. "Supermercado" -> Jumbo,
-- Líder...).
insert into categorias (nombre, tipo, tipo_marca_sugerido) values
  ('Banco', 'variable', 'banco'),
  ('Casa comercial', 'variable', 'casa_comercial'),
  ('Caja de compensación', 'variable', 'caja_compensacion'),
  ('Autopista / TAG', 'variable', 'autopista'),
  ('Internet / Móvil', 'fijo', 'telecom'),
  ('Servicio básico (luz, agua, gas...)', 'fijo', 'servicio_basico'),
  ('Supermercado', 'variable', 'supermercado'),
  ('Pasajes (bus, avión)', 'variable', 'transporte'),
  ('Compras online', 'variable', 'compras_online'),
  ('Delivery (comida, encargos)', 'variable', 'delivery'),
  ('Suscripción (streaming, apps...)', 'fijo', 'suscripcion'),
  ('Otro', 'variable', 'otro'),
  ('Hogar', 'variable', null);

-- ---------------------------------------------------------------------------
-- ENTIDADES (medios de pago / tarjetas / créditos)
-- ---------------------------------------------------------------------------
insert into entidades (nombre, tipo) values
  ('Efectivo', 'efectivo'),
  ('Falabella', 'tarjeta_credito'),
  ('Paris', 'tarjeta_credito'),
  ('Banco Estado', 'tarjeta_credito'),
  ('Crédito Hipotecario', 'credito_hipotecario');

-- ---------------------------------------------------------------------------
-- GASTOS FIJOS — recurrentes cada mes, reparto automático por %
-- ---------------------------------------------------------------------------
-- Luz/Agua/Gas: 'variable' — la fecha de vencimiento es fija pero el monto
-- cambia cada mes (ver migration_19). El resto queda 'fijo' (default).
insert into gastos_fijos (descripcion, categoria_id, entidad_id, monto_estimado, dia_mes_pago, tipo_monto, modo_reparto, activo)
select 'Luz', (select id from categorias where nombre = 'Servicio básico (luz, agua, gas...)'), (select id from entidades where nombre = 'Efectivo'), 71100, 5, 'variable', 'automatico', true
union all
select 'Agua', (select id from categorias where nombre = 'Servicio básico (luz, agua, gas...)'), (select id from entidades where nombre = 'Efectivo'), 22000, 5, 'variable', 'automatico', true
union all
select 'Gas', (select id from categorias where nombre = 'Servicio básico (luz, agua, gas...)'), (select id from entidades where nombre = 'Efectivo'), 46400, 5, 'variable', 'automatico', true
union all
select 'Crédito hipotecario', (select id from categorias where nombre = 'Servicio básico (luz, agua, gas...)'), (select id from entidades where nombre = 'Crédito Hipotecario'), 150000, 5, 'fijo', 'automatico', true
union all
select 'Mercadería (supermercado)', (select id from categorias where nombre = 'Supermercado'), (select id from entidades where nombre = 'Efectivo'), 250000, 1, 'fijo', 'automatico', true
union all
select 'Carnicería', (select id from categorias where nombre = 'Supermercado'), (select id from entidades where nombre = 'Efectivo'), 20000, 1, 'automatico', true;

-- ---------------------------------------------------------------------------
-- COMPRAS EN CUOTAS — el motor automático
-- fecha_primera_cuota se calculó hacia atrás desde la cuota en la que ibas
-- en tu Excel (ej. "06|24" con fecha de hoy 31-ago-2026 -> empezó en marzo).
-- A partir de aquí, cada mes la cuota vigente se calcula sola.
-- ---------------------------------------------------------------------------
insert into compras (descripcion, monto_total, n_cuotas, fecha_primera_cuota, entidad_id, categoria_id, modo_reparto, persona_id, notas)
select 'Reestructuración deuda Falabella', 4839109, 24, '2026-03-01'::date,
  (select id from entidades where nombre = 'Falabella'),
  (select id from categorias where nombre = 'Casa comercial'),
  'manual', (select id from personas where nombre = 'Marian'),
  'Iba en cuota 6 de 24 en agosto 2026'
union all
select 'Pago auto Papá', 2700000, 48, '2026-07-01'::date,
  (select id from entidades where nombre = 'Banco Estado'),
  (select id from categorias where nombre = 'Otro'),
  'manual', (select id from personas where nombre = 'Papá'),
  'Iba en cuota 2 de 48 en agosto 2026'
union all
select 'Chile pasajes', 24000, 3, '2026-08-01'::date,
  (select id from entidades where nombre = 'Paris'),
  (select id from categorias where nombre = 'Casa comercial'),
  'manual', (select id from personas where nombre = 'Papá'), null
union all
select 'Ripley', 25480, 2, '2026-08-01'::date,
  (select id from entidades where nombre = 'Paris'),
  (select id from categorias where nombre = 'Casa comercial'),
  'manual', (select id from personas where nombre = 'Marian'), null
union all
select 'Zapatillas Madi', 144990, 3, '2026-08-01'::date,
  (select id from entidades where nombre = 'Paris'),
  (select id from categorias where nombre = 'Casa comercial'),
  'manual', (select id from personas where nombre = 'Marian'), null
union all
select 'Lentes', 89990, 3, '2026-08-01'::date,
  (select id from entidades where nombre = 'Banco Estado'),
  (select id from categorias where nombre = 'Otro'),
  'manual', (select id from personas where nombre = 'Papá'),
  'Asignación de persona aproximada, revisar'
union all
select 'Cuota gira de estudio', 50000, 15, '2025-11-01'::date,
  (select id from entidades where nombre = 'Efectivo'),
  (select id from categorias where nombre = 'Otro'),
  'manual', (select id from personas where nombre = 'Nicolás'),
  'Iba en cuota 10 de 15 en agosto 2026'
union all
select 'Ahorro Madi', 30000, 10, '2026-02-01'::date,
  (select id from entidades where nombre = 'Efectivo'),
  (select id from categorias where nombre = 'Otro'),
  'manual', (select id from personas where nombre = 'Madi'),
  'Iba en cuota 7 de 10 en agosto 2026';

-- Listo. Prueba: SELECT * FROM vista_cuotas_mes_actual; te debería mostrar
-- todas las compras que siguen vigentes en el mes actual, ya calculadas.
