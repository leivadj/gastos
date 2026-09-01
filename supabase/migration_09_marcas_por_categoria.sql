-- ============================================================================
-- Gastos del Hogar — Migración 09: catálogo de marcas por categoría
-- (productos/servicios, no solo medios de pago) + suscripciones
-- ============================================================================
-- Por qué: hasta ahora el catálogo de marcas (`marcas`) solo se usaba para
-- elegir el MEDIO DE PAGO (con qué tarjeta/cuenta se paga). El usuario pidió
-- que, al elegir una categoría como "Supermercado" en un gasto/compra, la
-- app ofrezca directamente las marcas de esa categoría (Jumbo, Líder...)
-- para elegir cuál es y que el item herede su logo/ícono — igual para
-- Transporte (Turbus, LATAM), Casa comercial (Falabella, Ripley), etc.
-- También pidió agregar una categoría de Suscripciones (Netflix, Disney+,
-- HBO Max, iCloud, ChatGPT, Claude...).
--
-- Seguro de correr aunque ya hayas corrido las migraciones anteriores.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Nueva categoría de marca: suscripción (streaming, apps, membresías).
-- ---------------------------------------------------------------------------
alter table marcas drop constraint if exists marcas_tipo_check;
alter table marcas add constraint marcas_tipo_check check (tipo in (
  'banco', 'casa_comercial', 'caja_compensacion', 'autopista', 'telecom', 'servicio_basico',
  'supermercado', 'transporte', 'compras_online', 'delivery', 'suscripcion', 'otro'
));

insert into marcas (nombre, tipo) values
  ('Netflix', 'suscripcion'),
  ('Disney+', 'suscripcion'),
  ('HBO Max', 'suscripcion'),
  ('Amazon Prime Video', 'suscripcion'),
  ('Spotify', 'suscripcion'),
  ('YouTube Premium', 'suscripcion'),
  ('iCloud', 'suscripcion'),
  ('ChatGPT Plus', 'suscripcion'),
  ('Claude Pro', 'suscripcion'),
  ('Paramount+', 'suscripcion'),
  ('Star+', 'suscripcion')
on conflict (nombre) do nothing;

-- ---------------------------------------------------------------------------
-- 2) categorias.tipo_marca_sugerido: qué tipo de marca ofrecer al elegir
--    esta categoría en un item. null = no se sugiere ninguna.
-- ---------------------------------------------------------------------------
alter table categorias add column if not exists tipo_marca_sugerido text;
alter table categorias drop constraint if exists categorias_tipo_marca_sugerido_check;
alter table categorias add constraint categorias_tipo_marca_sugerido_check check (tipo_marca_sugerido in (
  'banco', 'casa_comercial', 'caja_compensacion', 'autopista', 'telecom', 'servicio_basico',
  'supermercado', 'transporte', 'compras_online', 'delivery', 'suscripcion', 'otro'
) or tipo_marca_sugerido is null);

-- Mapeo para las categorías que ya existen en tu base (si el nombre no
-- coincide exactamente no pasa nada, ese update simplemente no encuentra
-- fila y sigue con el resto).
update categorias set tipo_marca_sugerido = 'servicio_basico' where nombre = 'Vivienda';
update categorias set tipo_marca_sugerido = 'supermercado' where nombre = 'Supermercado';
update categorias set tipo_marca_sugerido = 'casa_comercial' where nombre = 'Casa comercial';
update categorias set tipo_marca_sugerido = 'transporte' where nombre = 'Transporte';

-- Categoría nueva "Suscripciones" (por si tu Excel/seed original no la
-- tenía — el pedido original de "luz, agua, gas, supermercado,
-- suscripciones" la mencionaba pero nunca se creó como categoría real).
insert into categorias (nombre, tipo, tipo_marca_sugerido)
values ('Suscripciones', 'fijo', 'suscripcion')
on conflict (nombre) do update set tipo_marca_sugerido = 'suscripcion';

-- ---------------------------------------------------------------------------
-- 3) marca_id en compras y gastos_fijos: el producto/servicio específico
--    del item (ej. "Jumbo", "Netflix"), DISTINTO de entidad_id (que es el
--    medio de pago, ej. la tarjeta con la que se paga).
-- ---------------------------------------------------------------------------
alter table compras add column if not exists marca_id uuid references marcas(id);
alter table gastos_fijos add column if not exists marca_id uuid references marcas(id);

-- ---------------------------------------------------------------------------
-- 4) Vistas: pasan marca_id para que el frontend pueda resolver su logo.
-- ---------------------------------------------------------------------------
create or replace view vista_cuotas_vigentes
with (security_invoker = true) as
select
  c.id as compra_id,
  c.descripcion,
  c.monto_total,
  c.n_cuotas,
  c.fecha_primera_cuota,
  c.entidad_id,
  c.categoria_id,
  c.grupo_id,
  c.icono,
  c.notas,
  round(c.monto_total / c.n_cuotas, 0) as monto_cuota,
  (
    (extract(year from age(date_trunc('month', current_date), date_trunc('month', c.fecha_primera_cuota))) * 12
     + extract(month from age(date_trunc('month', current_date), date_trunc('month', c.fecha_primera_cuota))))
    + 1
  )::int as cuota_actual,
  c.marca_id
from compras c;

create or replace view vista_cuotas_mes_actual
with (security_invoker = true) as
select *
from vista_cuotas_vigentes
where cuota_actual between 1 and n_cuotas;

create or replace view vista_reparto_cuotas_mes
with (security_invoker = true) as
select
  v.compra_id,
  v.descripcion,
  v.categoria_id,
  v.entidad_id,
  v.grupo_id,
  v.icono,
  v.monto_cuota,
  v.cuota_actual,
  v.n_cuotas,
  r.persona_id,
  r.persona_nombre,
  round(v.monto_cuota * r.porcentaje_efectivo / 100, 0) as monto_persona,
  v.marca_id
from vista_cuotas_mes_actual v
join lateral (
  select persona_id, persona_nombre, porcentaje_efectivo
  from vista_grupo_reparto gr
  where gr.grupo_id = v.grupo_id and v.grupo_id is not null
  union all
  select persona_id, persona_nombre, porcentaje_efectivo
  from vista_item_reparto ir
  where ir.origen = 'compra' and ir.origen_id = v.compra_id and v.grupo_id is null
) r on true;

create or replace view vista_reparto_gastos_fijos
with (security_invoker = true) as
select
  g.id as gasto_fijo_id,
  g.descripcion,
  g.categoria_id,
  g.entidad_id,
  g.grupo_id,
  g.icono,
  g.monto_estimado,
  r.persona_id,
  r.persona_nombre,
  round(g.monto_estimado * r.porcentaje_efectivo / 100, 0) as monto_persona,
  g.marca_id
from gastos_fijos g
join lateral (
  select persona_id, persona_nombre, porcentaje_efectivo
  from vista_grupo_reparto gr
  where gr.grupo_id = g.grupo_id and g.grupo_id is not null
  union all
  select persona_id, persona_nombre, porcentaje_efectivo
  from vista_item_reparto ir
  where ir.origen = 'gasto_fijo' and ir.origen_id = g.id and g.grupo_id is null
) r on true
where g.activo = true;

-- ============================================================================
-- Listo: al elegir "Supermercado" en un gasto/compra, ahora aparece un
-- selector con las marcas de tipo "supermercado" (Jumbo, Líder, etc.) —
-- igual para Transporte, Casa comercial, Vivienda (servicios básicos) y
-- Suscripciones. Elegir una marca ahí le da al item su logo/ícono.
-- ============================================================================
