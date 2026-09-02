-- ============================================================================
-- Gastos del Hogar — Migración 14: registro rápido de movimientos
-- ============================================================================
-- Por qué: fase 1 del rediseño pedido por el usuario (app de referencia
-- "monai"). Agrega la tabla que falta para el botón "+ Movimiento" ->
-- "↔ Transferencia" (mover plata entre tus propias cuentas, no es gasto ni
-- ingreso). Los otros dos ("+ Gasto" y "+ Ingreso") reusan las tablas que
-- ya existen (compras con n_cuotas=1, e ingresos) — no necesitan tabla
-- nueva.
--
-- Seguro de correr aunque ya hayas corrido las migraciones anteriores.
-- ============================================================================

create table if not exists transferencias (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id),
  monto numeric(12, 2) not null check (monto > 0),
  cuenta_origen_id uuid references entidades(id),
  cuenta_destino_id uuid references entidades(id),
  fecha date not null default current_date,
  notas text,
  created_at timestamptz not null default now()
);

alter table transferencias enable row level security;

drop policy if exists "solo_dueno" on transferencias;
create policy "solo_dueno" on transferencias for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ============================================================================
-- Listo: el botón "+ Movimiento" (visible en toda la app) ya puede guardar
-- Gasto, Ingreso y Transferencia.
-- ============================================================================
