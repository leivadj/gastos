-- ============================================================================
-- Gastos del Hogar — Migración 04: hacer que las vistas respeten RLS
-- ============================================================================
-- QUÉ PROBLEMA RESUELVE:
-- En Postgres, una vista creada desde el Editor SQL de Supabase corre por
-- defecto con los permisos de quien la CREÓ (normalmente un rol con permisos
-- totales), no con los permisos de quien la está consultando desde la app.
-- Eso significa que aunque las tablas reales (compras, entidades, etc.) sí
-- tienen activado "cada quien ve solo lo suyo" (RLS), las VISTAS que arma el
-- dashboard (vista_cuotas_vigentes, vista_resumen_categorias_mes, etc.)
-- estaban ignorando esa regla y mostrando los datos de TODOS los usuarios.
--
-- Por eso, aunque "Personas" y "Tarjetas" ya se veían vacíos correctamente
-- para una cuenta nueva, el dashboard y "Compras en cuotas" seguían
-- mostrando los montos y categorías de otra cuenta — y al tocar "eliminar"
-- no pasaba nada, porque el borrado sí respeta RLS (no borra filas que no
-- son tuyas) pero la vista seguía mostrando la fila igual.
--
-- Este script agrega "security_invoker = true" a las 6 vistas, para que a
-- partir de ahora respeten exactamente los mismos permisos que las tablas.
-- Es seguro de correr en cualquier momento, y no borra ni modifica datos.
-- ============================================================================

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
  c.modo_reparto,
  c.persona_id,
  c.notas,
  round(c.monto_total / c.n_cuotas, 0) as monto_cuota,
  (
    (extract(year from age(date_trunc('month', current_date), date_trunc('month', c.fecha_primera_cuota))) * 12
     + extract(month from age(date_trunc('month', current_date), date_trunc('month', c.fecha_primera_cuota))))
    + 1
  )::int as cuota_actual
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
  v.monto_cuota,
  v.cuota_actual,
  v.n_cuotas,
  p.id as persona_id,
  p.nombre as persona_nombre,
  case
    when v.modo_reparto = 'manual' then v.monto_cuota
    else round(v.monto_cuota * coalesce(p.porcentaje_reparto, 0) / 100, 0)
  end as monto_persona
from vista_cuotas_mes_actual v
join personas p on p.activo = true
  and (
    (v.modo_reparto = 'manual' and p.id = v.persona_id)
    or (v.modo_reparto = 'automatico' and p.porcentaje_reparto is not null)
  );

create or replace view vista_reparto_gastos_fijos
with (security_invoker = true) as
select
  g.id as gasto_fijo_id,
  g.descripcion,
  g.categoria_id,
  g.entidad_id,
  g.monto_estimado,
  p.id as persona_id,
  p.nombre as persona_nombre,
  case
    when g.modo_reparto = 'manual' then g.monto_estimado
    else round(g.monto_estimado * coalesce(p.porcentaje_reparto, 0) / 100, 0)
  end as monto_persona
from gastos_fijos g
join personas p on p.activo = true
  and (
    (g.modo_reparto = 'manual' and p.id = g.persona_id)
    or (g.modo_reparto = 'automatico' and p.porcentaje_reparto is not null)
  )
where g.activo = true;

create or replace view vista_resumen_categorias_mes
with (security_invoker = true) as
select categoria_id, sum(monto_cuota) as total
from vista_cuotas_mes_actual
group by categoria_id
union all
select categoria_id, sum(monto_estimado) as total
from gastos_fijos
where activo = true
group by categoria_id;

create or replace view vista_resumen_personas_mes
with (security_invoker = true) as
select persona_id, persona_nombre, sum(monto_persona) as total
from (
  select persona_id, persona_nombre, monto_persona from vista_reparto_cuotas_mes
  union all
  select persona_id, persona_nombre, monto_persona from vista_reparto_gastos_fijos
) t
group by persona_id, persona_nombre;

-- ============================================================================
-- Listo. Después de correr esto:
-- - Si YA corriste migration_03_admin_marcas.sql (que crea la cuenta real de
--   Marian y separa los espacios): cada cuenta ve solo lo suyo, en todas
--   partes de la app (dashboard, compras, gastos fijos, ingresos, personas).
-- - Si TODAVÍA NO corres migration_03: vas a notar que el dashboard y
--   "Compras en cuotas" pasan a verse VACÍOS para cualquier cuenta (incluida
--   la tuya), porque ningún usuario real es todavía el dueño de esas filas.
--   Es esperado y momentáneo — en cuanto crees el usuario de Marian y corras
--   migration_03, esos datos vuelven a aparecer, pero SOLO en la cuenta de
--   ella.
-- ============================================================================
