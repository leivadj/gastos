-- ============================================================================
-- Gastos del Hogar — Migración 24: Preferencias de menú (personalizar la
-- barra lateral de escritorio)
-- ============================================================================
-- Por qué: el usuario pidió poder ocultar y reordenar los ítems del menú
-- lateral de escritorio que no usa seguido. Una fila por cuenta (owner_id
-- único) guarda el orden elegido a mano y qué ítems ocultar — ligado a la
-- cuenta (no al navegador), a propósito, para que se vea igual en cualquier
-- dispositivo donde inicie sesión (Mac, otra compu, etc.).
--
-- `orden` y `ocultos` guardan las CLAVES estables de cada ítem del menú (ver
-- DesktopSidebar.tsx: "inicio", "cuentas", "presupuestos", "fijos", "metas",
-- "cuotas", "reportes", "personas", "grupos" — "mas" y "admin" no son
-- personalizables, quedan siempre fijos), no el href (que en algún caso
-- trae query string, ej. "/gastos?tab=fijos").
--
-- Sin fila (cuenta que nunca personalizó el menú) = la app usa el orden por
-- defecto del código y no oculta nada — no hace falta sembrar una fila por
-- cuenta existente.
--
-- Seguro de correr aunque ya hayas corrido las migraciones anteriores.
-- ============================================================================

create table if not exists preferencias_menu (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) unique,
  orden text[] not null default '{}',
  ocultos text[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table preferencias_menu enable row level security;

create policy "solo_dueno" on preferencias_menu for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ============================================================================
-- Listo: DesktopSidebar ya puede leer/guardar la personalización del menú
-- desde el botón "Personalizar menú" al fondo de la barra lateral.
-- ============================================================================
