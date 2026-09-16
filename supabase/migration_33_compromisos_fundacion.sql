-- ============================================================================
-- Gastos del Hogar — Migración 33: fundación de datos para "Compromisos"
-- ============================================================================
-- Por qué: Felipe pidió un módulo nuevo ("Compromisos") para calcular cuánto
-- debe pagar cada persona a fin de mes — por tarjetas de terceros, casas
-- comerciales, cuotas, gastos asignados y gastos de Hogar, con PDF individual
-- por persona. Antes de programar la pantalla, se auditó la arquitectura
-- (ver el documento de propuesta en el proyecto de Claude) y se encontraron
-- 2 cosas que faltaban a nivel de datos, más un bug de fondo que Felipe pidió
-- corregir explícitamente:
--
--   1) No existía forma de decir "esta tarjeta es de tal persona" (titular).
--   2) No existía forma de decir "este grupo es EL grupo Hogar" (a diferencia
--      de cualquier otro grupo de reparto que el usuario cree, ej. uno para
--      dividir Falabella con alguien).
--   3) BUG DE FONDO: cuando una compra/gasto fijo tiene `grupo_id` puesto (así
--      se cargan hoy arriendo, luz, agua, etc. desde /gastos), el reparto NO
--      quedaba fijo al guardarse — se resolvía EN VIVO contra el % actual del
--      grupo cada vez que se mira un reporte. Si más adelante cambias el % de
--      Grupo Hogar, TODOS los meses pasados recalculaban con el % nuevo.
--      Felipe confirmó que esto se corrija de forma GLOBAL (no solo dentro de
--      Compromisos) y que se haga backfill completo (congelar el % vigente
--      HOY en todo lo ya cargado, para que nada vuelva a moverse).
--
-- Qué agrega:
--   1) `entidades.titular_persona_id` — a quién pertenece la tarjeta/cuenta.
--      Nullable: una tarjeta sin titular asignado no se agrupa bajo nadie.
--   2) `grupos.es_principal` — marca el grupo que representa a "Hogar", con
--      un índice único parcial (como `personas.es_self`) que garantiza como
--      máximo uno por cuenta.
--   3) Backfill: por cada compra/gasto_fijo con `grupo_id` que TODAVÍA no
--      tenga ninguna fila propia en `item_participantes`, se insertan filas
--      con el `porcentaje_efectivo` que el grupo tiene HOY (vista
--      `vista_grupo_reparto`, ya existente) — quedando ese reparto congelado
--      para siempre en ese ítem, sin tocar `grupo_id` (se conserva para saber
--      "esto es de Hogar" y para que la UI siga precargando el grupo al
--      editar).
--
-- Cambio de comportamiento IMPORTANTE (a propósito, confirmado por Felipe):
-- después de esta migración, el reparto de un ítem con grupo YA NO se
-- resuelve contra `grupo_id` en vivo — el código de la app (siguiente commit)
-- pasa a mirar SIEMPRE `item_participantes` primero. Si un ítem con grupo
-- llegara a existir sin filas en `item_participantes` (no debería, tras este
-- backfill, salvo que se cree uno nuevo con un bug), su reparto mostraría
-- $0 en vez de recalcularse solo — se prefiere eso a volver a quedar
-- "vivo" por accidente.
--
-- Segura de correr aunque ya hayas corrido las migraciones anteriores; el
-- backfill usa `on conflict do nothing`, así que correrla dos veces no
-- duplica ni cambia nada.
-- ============================================================================

-- 1. Titular de la tarjeta/cuenta -----------------------------------------

alter table entidades add column if not exists titular_persona_id uuid references personas(id);

-- 2. Marca del grupo "Hogar" ------------------------------------------------

alter table grupos add column if not exists es_principal boolean not null default false;

drop index if exists grupos_owner_principal_idx;
create unique index grupos_owner_principal_idx on grupos (owner_id) where es_principal;

-- 3. Backfill: congela el % vigente hoy en los ítems con grupo que todavía
--    no tengan su propio snapshot en item_participantes ------------------
-- (vista_grupo_reparto ya resuelve porcentaje_efectivo con null = partes
-- iguales del resto, igual que hace hoy el reporte en vivo — este backfill
-- simplemente copia ese mismo resultado UNA VEZ, en vez de recalcularlo cada
-- vez que se abre un reporte.)

insert into item_participantes (owner_id, origen, origen_id, persona_id, porcentaje)
select c.owner_id, 'compra', c.id, gr.persona_id, gr.porcentaje_efectivo
from compras c
join vista_grupo_reparto gr on gr.grupo_id = c.grupo_id
where c.grupo_id is not null
  and not exists (
    select 1 from item_participantes ip where ip.origen = 'compra' and ip.origen_id = c.id
  )
on conflict (origen, origen_id, persona_id) do nothing;

insert into item_participantes (owner_id, origen, origen_id, persona_id, porcentaje)
select g.owner_id, 'gasto_fijo', g.id, gr.persona_id, gr.porcentaje_efectivo
from gastos_fijos g
join vista_grupo_reparto gr on gr.grupo_id = g.grupo_id
where g.grupo_id is not null
  and not exists (
    select 1 from item_participantes ip where ip.origen = 'gasto_fijo' and ip.origen_id = g.id
  )
on conflict (origen, origen_id, persona_id) do nothing;

-- gastos_diarios usa su propia tabla de reparto por vista
-- (vista_reparto_gastos_diarios, migration_27) que YA resuelve solo contra
-- grupo_id en vivo, sin pasar por item_participantes (los diarios no tienen
-- fila propia ahí) — se deja fuera de este backfill a propósito: es un
-- cambio de esquema más grande (agregarles origen "gasto_diario" a
-- item_participantes) que no se justifica por ahora, ya que Compromisos no
-- necesita incluir gastos diarios de carga rápida (Auto/Salud/Diarios) en
-- sus secciones de casas comerciales/tarjetas ni de Hogar según el pedido
-- original. Si más adelante hace falta, se retoma en una migración aparte.

-- ============================================================================
-- Listo: cada tarjeta/cuenta puede marcar un titular (opcional), existe un
-- grupo marcado como "Hogar" (a elegir en /grupos, ver el commit de código
-- que sigue) y todos los gastos de Hogar ya cargados quedaron con su % de
-- esa fecha congelado para siempre.
-- ============================================================================
