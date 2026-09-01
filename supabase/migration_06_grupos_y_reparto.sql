-- ============================================================================
-- Migración 06 — Grupos de gastos + nuevo reparto por item (por cantidad de
-- personas o por %, con auto-cálculo del resto), íconos personalizados.
--
-- IMPORTANTE: corre esto ANTES de usar la versión nueva de la app (la que
-- agrega Grupos, íconos por item, y el picker de personas en compras/gastos
-- fijos) — si abres esa versión de la app sin haber corrido esto primero,
-- vas a ver errores al guardar/editar cuotas o gastos fijos.
--
-- Este script:
--  1. Crea las tablas nuevas: grupos, grupo_participantes, item_participantes.
--  2. Agrega columnas nuevas a categorias/compras/gastos_fijos.
--  3. TRASPASA el reparto que ya tenías configurado (manual o automático,
--     con el % global de cada persona) a la tabla nueva item_participantes,
--     para que NADA de lo que ya está cargado cambie de monto al pasar al
--     nuevo sistema.
--  4. Relaja las reglas viejas de modo_reparto/persona_id (dejan de ser
--     obligatorias — ya no se usan para calcular el reparto, pero se dejan
--     en la tabla sin borrar nada, por si acaso).
--  5. Recrea las vistas con la lógica de reparto nueva.
-- ============================================================================

-- 1. Tablas nuevas -----------------------------------------------------------

create table if not exists grupos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id),
  nombre text not null,
  icono text,
  created_at timestamptz not null default now(),
  unique (owner_id, nombre)
);

create table if not exists grupo_participantes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id),
  grupo_id uuid not null references grupos(id) on delete cascade,
  persona_id uuid not null references personas(id) on delete cascade,
  porcentaje numeric(5,2),
  created_at timestamptz not null default now(),
  unique (grupo_id, persona_id)
);

create table if not exists item_participantes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id),
  origen text not null check (origen in ('compra', 'gasto_fijo')),
  origen_id uuid not null,
  persona_id uuid not null references personas(id) on delete cascade,
  porcentaje numeric(5,2),
  created_at timestamptz not null default now(),
  unique (origen, origen_id, persona_id)
);

-- 2. Columnas nuevas ----------------------------------------------------------

alter table categorias add column if not exists icono text;

alter table compras add column if not exists grupo_id uuid references grupos(id);
alter table compras add column if not exists icono text;

alter table gastos_fijos add column if not exists grupo_id uuid references grupos(id);
alter table gastos_fijos add column if not exists icono text;

-- 3. Traspaso del reparto existente a item_participantes ---------------------
-- (usa el modo_reparto/persona_id/porcentaje_reparto de ANTES de este cambio,
-- así que tiene que correr antes de tocar esas columnas/constraints)

insert into item_participantes (owner_id, origen, origen_id, persona_id, porcentaje)
select c.owner_id, 'compra', c.id, c.persona_id, null
from compras c
where c.modo_reparto = 'manual' and c.persona_id is not null
on conflict (origen, origen_id, persona_id) do nothing;

insert into item_participantes (owner_id, origen, origen_id, persona_id, porcentaje)
select c.owner_id, 'compra', c.id, p.id, p.porcentaje_reparto
from compras c
join personas p on p.owner_id = c.owner_id and p.activo = true and p.porcentaje_reparto is not null
where c.modo_reparto = 'automatico'
on conflict (origen, origen_id, persona_id) do nothing;

insert into item_participantes (owner_id, origen, origen_id, persona_id, porcentaje)
select g.owner_id, 'gasto_fijo', g.id, g.persona_id, null
from gastos_fijos g
where g.modo_reparto = 'manual' and g.persona_id is not null
on conflict (origen, origen_id, persona_id) do nothing;

insert into item_participantes (owner_id, origen, origen_id, persona_id, porcentaje)
select g.owner_id, 'gasto_fijo', g.id, p.id, p.porcentaje_reparto
from gastos_fijos g
join personas p on p.owner_id = g.owner_id and p.activo = true and p.porcentaje_reparto is not null
where g.modo_reparto = 'automatico'
on conflict (origen, origen_id, persona_id) do nothing;

-- 4. Relajar las reglas viejas (ya no se usan, pero no se borran) ------------

alter table compras alter column modo_reparto drop not null;
alter table compras drop constraint if exists chk_manual_requiere_persona;

alter table gastos_fijos alter column modo_reparto drop not null;
alter table gastos_fijos drop constraint if exists chk_gf_manual_requiere_persona;

-- 5. Recrear las vistas con la lógica de reparto nueva -----------------------
-- (hay que borrarlas en orden porque unas dependen de otras)

drop view if exists vista_resumen_personas_mes;
drop view if exists vista_resumen_categorias_mes;
drop view if exists vista_reparto_cuotas_mes;
drop view if exists vista_reparto_gastos_fijos;
drop view if exists vista_cuotas_mes_actual;
drop view if exists vista_cuotas_vigentes;
drop view if exists vista_grupo_reparto;
drop view if exists vista_item_reparto;

create view vista_cuotas_vigentes
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
  )::int as cuota_actual
from compras c;

create view vista_cuotas_mes_actual
with (security_invoker = true) as
select *
from vista_cuotas_vigentes
where cuota_actual between 1 and n_cuotas;

create view vista_grupo_reparto
with (security_invoker = true) as
select
  gp.grupo_id,
  p.id as persona_id,
  p.nombre as persona_nombre,
  coalesce(
    gp.porcentaje,
    greatest(0, 100 - coalesce(sum(gp.porcentaje) filter (where gp.porcentaje is not null) over (partition by gp.grupo_id), 0))
      / nullif(count(*) filter (where gp.porcentaje is null) over (partition by gp.grupo_id), 0)
  ) as porcentaje_efectivo
from grupo_participantes gp
join personas p on p.id = gp.persona_id and p.activo = true;

create view vista_item_reparto
with (security_invoker = true) as
select
  ip.origen,
  ip.origen_id,
  p.id as persona_id,
  p.nombre as persona_nombre,
  coalesce(
    ip.porcentaje,
    greatest(0, 100 - coalesce(sum(ip.porcentaje) filter (where ip.porcentaje is not null) over (partition by ip.origen, ip.origen_id), 0))
      / nullif(count(*) filter (where ip.porcentaje is null) over (partition by ip.origen, ip.origen_id), 0)
  ) as porcentaje_efectivo
from item_participantes ip
join personas p on p.id = ip.persona_id and p.activo = true;

create view vista_reparto_cuotas_mes
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
  round(v.monto_cuota * r.porcentaje_efectivo / 100, 0) as monto_persona
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

create view vista_reparto_gastos_fijos
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
  round(g.monto_estimado * r.porcentaje_efectivo / 100, 0) as monto_persona
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

create view vista_resumen_categorias_mes
with (security_invoker = true) as
select categoria_id, sum(monto_cuota) as total
from vista_cuotas_mes_actual
group by categoria_id
union all
select categoria_id, sum(monto_estimado) as total
from gastos_fijos
where activo = true
group by categoria_id;

create view vista_resumen_personas_mes
with (security_invoker = true) as
select persona_id, persona_nombre, sum(monto_persona) as total
from (
  select persona_id, persona_nombre, monto_persona from vista_reparto_cuotas_mes
  union all
  select persona_id, persona_nombre, monto_persona from vista_reparto_gastos_fijos
) t
group by persona_id, persona_nombre;

-- 6. RLS de las tablas nuevas -------------------------------------------------

alter table grupos enable row level security;
alter table grupo_participantes enable row level security;
alter table item_participantes enable row level security;

drop policy if exists "solo_dueno" on grupos;
create policy "solo_dueno" on grupos for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "solo_dueno" on grupo_participantes;
create policy "solo_dueno" on grupo_participantes for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "solo_dueno" on item_participantes;
create policy "solo_dueno" on item_participantes for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
