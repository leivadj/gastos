-- ============================================================================
-- Gastos del Hogar — Migración 27: Reparto (opcional) en Gastos diarios
-- ============================================================================
-- Por qué: fase 2 del rediseño UX/UI pedido el 2026-09-05 (ver Novedades en
-- el resumen del proyecto). "Diarios" (pestaña de /gastos, y motor de Auto y
-- Salud) es la única pantalla pensada para cargar un gasto SUELTO del día a
-- día (sin cuenta, sin cuotas) — exactamente lo que hace falta para anotar
-- una compra de Feria o Panadería apenas se hace, en vez de estimarla una
-- vez al mes como un gasto fijo. El problema: hasta ahora "Diarios" no tenía
-- forma de repartir entre personas, así que un gasto de Hogar cargado ahí
-- nunca aparecía en "cuánto le toca a cada persona" ni en el PDF de
-- /personas.
--
-- Qué agrega:
--   1) `grupo_id` en `gastos_diarios` (opcional — sin cambios para quien no
--      lo use, como Auto/Salud hoy).
--   2) `vista_reparto_gastos_diarios`, misma lógica de reparto por grupo que
--      ya usan compras y gastos fijos (ver `vista_grupo_reparto`).
--   3) `vista_resumen_personas_mes` ahora SUMA también este reparto — así el
--      dashboard, /personas y el PDF de cada persona quedan al día sin
--      tocarlos por separado.
--
-- A propósito NO se agrega reparto "por personas sueltas" (sin grupo) para
-- diarios, a diferencia de compras/gastos fijos — la idea es que Diarios
-- siga siendo rápido: o no se reparte (como hoy), o se reparte con un grupo
-- ya armado en una sola elección.
--
-- Segura de correr aunque ya hayas corrido las migraciones anteriores.
-- ============================================================================

alter table gastos_diarios add column if not exists grupo_id uuid references grupos(id);

create or replace view vista_reparto_gastos_diarios
with (security_invoker = true) as
select
  d.id as gasto_diario_id,
  d.descripcion,
  d.categoria_id,
  d.grupo_id,
  d.marca_id,
  d.fecha,
  d.monto,
  r.persona_id,
  r.persona_nombre,
  round(d.monto * r.porcentaje_efectivo / 100, 0) as monto_persona
from gastos_diarios d
join vista_grupo_reparto r on r.grupo_id = d.grupo_id
where d.grupo_id is not null
  and date_trunc('month', d.fecha) = date_trunc('month', current_date);

create or replace view vista_resumen_personas_mes
with (security_invoker = true) as
select persona_id, persona_nombre, sum(monto_persona) as total
from (
  select persona_id, persona_nombre, monto_persona from vista_reparto_cuotas_mes
  union all
  select persona_id, persona_nombre, monto_persona from vista_reparto_gastos_fijos
  union all
  select persona_id, persona_nombre, monto_persona from vista_reparto_gastos_diarios
) t
group by persona_id, persona_nombre;

-- ============================================================================
-- Listo: la pestaña "Diarios" de /gastos ya puede elegir un grupo (opcional)
-- al cargar un gasto suelto, y ese reparto ya se refleja en Inicio,
-- /personas y el PDF de cada persona. No hace falta tocar nada más en
-- Supabase para esto — es puramente una vista + una columna nueva.
-- ============================================================================
