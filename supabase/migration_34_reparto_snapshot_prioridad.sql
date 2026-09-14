-- ============================================================================
-- Gastos del Hogar — Migración 34: el reparto ya guardado manda sobre el
-- grupo en vivo (vistas de mes actual)
-- ============================================================================
-- Continúa migration_33_compromisos_fundacion.sql: esa migración congeló
-- (backfill) el % vigente en `item_participantes` para todo ítem con grupo
-- que todavía no tuviera su propio reparto, y el código de la app (commit
-- que acompaña esta migración) ahora SIEMPRE graba ese snapshot al guardar
-- una compra/gasto fijo con grupo, en vez de dejarlo sin filas propias.
--
-- Pero las vistas `vista_reparto_cuotas_mes` / `vista_reparto_gastos_fijos`
-- (usadas por /personas y por cualquier otra pantalla que lea el mes ACTUAL)
-- todavía tenían la prioridad al revés: si el ítem tenía `grupo_id`, miraban
-- SIEMPRE el grupo en vivo (`vista_grupo_reparto`) e ignoraban por completo
-- lo que hubiera en `item_participantes`. Esta migración invierte esa
-- prioridad — igual que ya se hizo en el cálculo en cliente de /reportes —
-- para que un mes ya reflejado en item_participantes deje de moverse si el
-- % del grupo cambia después. El grupo en vivo queda solo como respaldo,
-- para el caso (no debería darse tras el backfill) de un ítem con grupo que
-- todavía no tenga ninguna fila propia.
--
-- Segura de correr aunque ya hayas corrido las migraciones anteriores.
-- ============================================================================

drop view if exists vista_resumen_personas_mes;
drop view if exists vista_reparto_cuotas_mes;
drop view if exists vista_reparto_gastos_fijos;

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
  from vista_item_reparto ir
  where ir.origen = 'compra' and ir.origen_id = v.compra_id
  union all
  select persona_id, persona_nombre, porcentaje_efectivo
  from vista_grupo_reparto gr
  where gr.grupo_id = v.grupo_id and v.grupo_id is not null
    and not exists (
      select 1 from vista_item_reparto ir2 where ir2.origen = 'compra' and ir2.origen_id = v.compra_id
    )
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
  from vista_item_reparto ir
  where ir.origen = 'gasto_fijo' and ir.origen_id = g.id
  union all
  select persona_id, persona_nombre, porcentaje_efectivo
  from vista_grupo_reparto gr
  where gr.grupo_id = g.grupo_id and g.grupo_id is not null
    and not exists (
      select 1 from vista_item_reparto ir2 where ir2.origen = 'gasto_fijo' and ir2.origen_id = g.id
    )
) r on true
where g.activo = true;

create view vista_resumen_personas_mes
with (security_invoker = true) as
select persona_id, persona_nombre, sum(monto_persona) as total
from (
  select persona_id, persona_nombre, monto_persona from vista_reparto_cuotas_mes
  union all
  select persona_id, persona_nombre, monto_persona from vista_reparto_gastos_fijos
) t
group by persona_id, persona_nombre;

-- ============================================================================
-- Listo: /personas (y cualquier otra pantalla que use estas 2 vistas) ahora
-- muestra, para el mes actual, el mismo reparto congelado que ya calcula
-- /reportes para meses pasados — consistente en toda la app.
-- ============================================================================
