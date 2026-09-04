-- ============================================================================
-- Gastos del Hogar — Migración 23: Documentos del auto con vencimiento
-- ============================================================================
-- Por qué: parte pendiente del pedido original de Auto/Salud — trackear
-- permiso de circulación, revisión técnica y seguro, cada uno con su fecha
-- de vencimiento anual, para avisar cuando se acercan o ya vencieron.
-- Bencina/mecánico/mantención NO van acá: esos son gastos sueltos normales
-- y ya se cargan en /auto con gastos_diarios (categoría "Auto").
--
-- Un documento = un registro con un tipo (uno de los 3 sugeridos, o "otro"
-- para casos como el permiso de circulación municipal si se quiere trackear
-- aparte) y una fecha_vencimiento. Se permite más de uno del mismo tipo por
-- si hay más de un vehículo — no se fuerza a un único registro por tipo.
--
-- Igual que con seguros/permisos: cuando se renueva, se EDITA la fecha de
-- vencimiento del mismo registro (no se crea uno nuevo cada año) — así el
-- historial no se acumula con filas vencidas sin necesidad.
--
-- Seguro de correr aunque ya hayas corrido las migraciones anteriores.
-- ============================================================================

create table if not exists documentos_auto (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id),
  tipo text not null check (tipo in ('permiso_circulacion', 'revision_tecnica', 'seguro', 'otro')),
  nombre text not null, -- etiqueta a mostrar (ej. "Permiso de circulación"); libre cuando tipo = 'otro'
  fecha_vencimiento date not null,
  notas text,
  created_at timestamptz not null default now()
);

alter table documentos_auto enable row level security;

create policy "solo_dueno" on documentos_auto for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ============================================================================
-- Listo: /auto ahora tiene una sección "Documentos con vencimiento" además
-- de la carga rápida de gastos sueltos que ya existía.
-- ============================================================================
