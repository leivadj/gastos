-- ============================================================================
-- Gastos del Hogar — Migración 20: Metas de ahorro
-- ============================================================================
-- Por qué: última pieza de la fase 2 del rediseño "cuotas". Es una función
-- nueva de punta a punta — no existía nada de esto en la base — para
-- definir metas con un monto objetivo (ej. "Viaje a Cancún", "Fondo de
-- emergencia") e ir registrando aportes sueltos hasta completarlas.
--
-- Distinto de la categoría "Ahorro" que ya existe (para gastos fijos o
-- compras recurrentes tipo "ahorro programado mensual"): una meta es un
-- objetivo puntual con progreso propio, no un gasto del mes. Por eso, igual
-- que las transferencias, los aportes NO se muestran como gasto en el
-- dashboard.
--
-- metas_ahorro_aportes.monto no tiene restricción de signo a propósito: un
-- aporte normal es positivo, pero un monto negativo registra un retiro de
-- la meta (ej. tuviste que usar parte del fondo de emergencia).
--
-- monto_actual NO se guarda en metas_ahorro: se calcula siempre sumando sus
-- aportes (vista_metas_ahorro_progreso), para que nunca pueda desincronizarse.
--
-- Seguro de correr aunque ya hayas corrido las migraciones anteriores.
-- ============================================================================

create table if not exists metas_ahorro (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id),
  nombre text not null,
  monto_objetivo numeric(12, 2) not null check (monto_objetivo > 0),
  fecha_objetivo date, -- opcional
  icono text, -- emoji corto, mismo patrón que grupos/categorías (ver components/IconoPicker.tsx)
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists metas_ahorro_aportes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id),
  meta_id uuid not null references metas_ahorro(id) on delete cascade,
  monto numeric(12, 2) not null, -- negativo = retiro
  fecha date not null default current_date,
  notas text,
  created_at timestamptz not null default now()
);

create or replace view vista_metas_ahorro_progreso
with (security_invoker = true) as
select
  m.id as meta_id,
  m.nombre,
  m.monto_objetivo,
  m.fecha_objetivo,
  m.icono,
  m.activa,
  coalesce(sum(a.monto), 0) as monto_actual
from metas_ahorro m
left join metas_ahorro_aportes a on a.meta_id = m.id
group by m.id, m.nombre, m.monto_objetivo, m.fecha_objetivo, m.icono, m.activa;

alter table metas_ahorro enable row level security;
alter table metas_ahorro_aportes enable row level security;

create policy "solo_dueno" on metas_ahorro for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "solo_dueno" on metas_ahorro_aportes for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ============================================================================
-- Listo: /metas-ahorro (agrupada en "Más") ya permite crear metas y
-- registrar aportes contra ellas.
-- ============================================================================
