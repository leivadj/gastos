-- ============================================================================
-- Gastos del Hogar — Migración 15: perfil propio en Personas
-- ============================================================================
-- Por qué: al iniciar sesión, la app ahora crea automáticamente una Persona
-- que te representa a ti (con foto de perfil), separada de las demás
-- personas que agregas a mano solo para repartos (ej. Marian). Desde tu
-- perfil hay un acceso directo para agregar tarjetas, que siguen siendo la
-- misma lista de siempre (no están ligadas a una persona en particular).
--
-- Seguro de correr aunque ya hayas corrido las migraciones anteriores.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) personas: foto de perfil + marca de "persona propia de la cuenta".
-- ---------------------------------------------------------------------------
alter table personas add column if not exists foto_url text;
alter table personas add column if not exists es_self boolean not null default false;

-- Como máximo una persona "propia" por cuenta.
drop index if exists personas_owner_self_idx;
create unique index personas_owner_self_idx on personas (owner_id) where es_self;

-- ---------------------------------------------------------------------------
-- 2) Storage: bucket "personas-fotos", personal por usuario (mismo patrón
--    que "tarjetas-fondos": cada usuario sube y administra solo sus propias
--    fotos, bajo una carpeta con su propio user id).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('personas-fotos', 'personas-fotos', true)
on conflict (id) do nothing;

drop policy if exists "personas_fotos_lectura_publica" on storage.objects;
create policy "personas_fotos_lectura_publica" on storage.objects for select
  using (bucket_id = 'personas-fotos');

drop policy if exists "personas_fotos_dueno_insert" on storage.objects;
create policy "personas_fotos_dueno_insert" on storage.objects for insert
  with check (bucket_id = 'personas-fotos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "personas_fotos_dueno_update" on storage.objects;
create policy "personas_fotos_dueno_update" on storage.objects for update
  using (bucket_id = 'personas-fotos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "personas_fotos_dueno_delete" on storage.objects;
create policy "personas_fotos_dueno_delete" on storage.objects for delete
  using (bucket_id = 'personas-fotos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================================
-- Listo: al abrir /personas por primera vez se crea sola tu persona propia
-- (con un nombre adivinado desde tu correo, que puedes cambiar al toque), con
-- foto opcional y un acceso directo para agregar tarjetas.
-- ============================================================================
