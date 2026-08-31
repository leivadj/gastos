-- ============================================================================
-- Gastos del Hogar — Migración 03: cuenta de Marian real + catálogo de
-- marcas/logos administrado por leivadj@gmail.com
-- ============================================================================
-- IMPORTANTE — orden de pasos:
-- 1) Primero crea el usuario de Marian en Supabase: Authentication -> Users
--    -> Add user -> correo marianps.260290@gmail.com -> contraseña -> marca
--    "Auto Confirm User". Esto tiene que existir ANTES de correr este script,
--    porque el script busca su UID por correo.
-- 2) Recién ahí, corre TODO este archivo en el SQL Editor.
--
-- Este script es seguro de correr aunque ya hayas corrido antes
-- migration_02_espacios_separados.sql (todo usa IF NOT EXISTS / es
-- reemplazable) — de hecho lo reemplaza y mejora.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Asegurar columnas owner_id (por si no corriste la migración 02 antes)
-- ---------------------------------------------------------------------------
alter table personas add column if not exists owner_id uuid references auth.users(id);
alter table entidades add column if not exists owner_id uuid references auth.users(id);
alter table compras add column if not exists owner_id uuid references auth.users(id);
alter table gastos_fijos add column if not exists owner_id uuid references auth.users(id);
alter table ingresos add column if not exists owner_id uuid references auth.users(id);
alter table pagos add column if not exists owner_id uuid references auth.users(id);

-- ---------------------------------------------------------------------------
-- 2) Reasignar TODO lo que hoy está cargado (sin dueño, o cargado bajo tu
--    cuenta leivadj@gmail.com) a la cuenta real de Marian.
-- ---------------------------------------------------------------------------
do $$
declare
  marian_id uuid;
begin
  select id into marian_id from auth.users where email = 'marianps.260290@gmail.com';
  if marian_id is null then
    raise exception 'No existe todavía un usuario con el correo marianps.260290@gmail.com. Créalo primero en Authentication -> Users y vuelve a correr este script.';
  end if;

  update personas set owner_id = marian_id where owner_id is null or owner_id <> marian_id;
  update entidades set owner_id = marian_id where owner_id is null or owner_id <> marian_id;
  update compras set owner_id = marian_id where owner_id is null or owner_id <> marian_id;
  update gastos_fijos set owner_id = marian_id where owner_id is null or owner_id <> marian_id;
  update ingresos set owner_id = marian_id where owner_id is null or owner_id <> marian_id;
  update pagos set owner_id = marian_id where owner_id is null or owner_id <> marian_id;
end $$;

-- ---------------------------------------------------------------------------
-- 3) De ahora en adelante, owner_id obligatorio y automático (el usuario que
--    hace el insert queda como dueño de la fila).
-- ---------------------------------------------------------------------------
alter table personas alter column owner_id set not null;
alter table personas alter column owner_id set default auth.uid();
alter table entidades alter column owner_id set not null;
alter table entidades alter column owner_id set default auth.uid();
alter table compras alter column owner_id set not null;
alter table compras alter column owner_id set default auth.uid();
alter table gastos_fijos alter column owner_id set not null;
alter table gastos_fijos alter column owner_id set default auth.uid();
alter table ingresos alter column owner_id set not null;
alter table ingresos alter column owner_id set default auth.uid();
alter table pagos alter column owner_id set not null;
alter table pagos alter column owner_id set default auth.uid();

-- ---------------------------------------------------------------------------
-- 4) Reglas de seguridad: cada usuario ve y edita solo lo suyo.
-- ---------------------------------------------------------------------------
drop policy if exists "solo_autenticados" on personas;
drop policy if exists "solo_dueno" on personas;
create policy "solo_dueno" on personas for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "solo_autenticados" on entidades;
drop policy if exists "solo_dueno" on entidades;
create policy "solo_dueno" on entidades for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "solo_autenticados" on compras;
drop policy if exists "solo_dueno" on compras;
create policy "solo_dueno" on compras for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "solo_autenticados" on gastos_fijos;
drop policy if exists "solo_dueno" on gastos_fijos;
create policy "solo_dueno" on gastos_fijos for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "solo_autenticados" on ingresos;
drop policy if exists "solo_dueno" on ingresos;
create policy "solo_dueno" on ingresos for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "solo_autenticados" on pagos;
drop policy if exists "solo_dueno" on pagos;
create policy "solo_dueno" on pagos for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 5) MARCAS — catálogo compartido de bancos, casas comerciales, cajas de
--    compensación, autopistas, internet/móvil y servicios básicos (luz,
--    agua, gas...), con su logo. Lo administra SOLO leivadj@gmail.com;
--    cualquier usuario autenticado puede leerlo para elegir marca al crear
--    sus propias tarjetas/entidades.
-- ---------------------------------------------------------------------------
create table if not exists marcas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  tipo text not null check (tipo in (
    'banco', 'casa_comercial', 'caja_compensacion', 'autopista', 'telecom', 'servicio_basico', 'otro'
  )),
  logo_url text,
  created_at timestamptz not null default now()
);

alter table marcas enable row level security;

drop policy if exists "lectura_todos" on marcas;
create policy "lectura_todos" on marcas for select
  using (auth.role() = 'authenticated');

drop policy if exists "escritura_solo_admin" on marcas;
create policy "escritura_solo_admin" on marcas for insert
  with check ((auth.jwt() ->> 'email') = 'leivadj@gmail.com');

drop policy if exists "actualizacion_solo_admin" on marcas;
create policy "actualizacion_solo_admin" on marcas for update
  using ((auth.jwt() ->> 'email') = 'leivadj@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'leivadj@gmail.com');

drop policy if exists "borrado_solo_admin" on marcas;
create policy "borrado_solo_admin" on marcas for delete
  using ((auth.jwt() ->> 'email') = 'leivadj@gmail.com');

-- Cada tarjeta/entidad puede (opcionalmente) enlazar a una marca del catálogo
alter table entidades add column if not exists marca_id uuid references marcas(id);

-- ---------------------------------------------------------------------------
-- 6) Almacenamiento para los archivos de logo (Supabase Storage)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('marcas-logos', 'marcas-logos', true)
on conflict (id) do nothing;

drop policy if exists "marcas_logos_lectura_publica" on storage.objects;
create policy "marcas_logos_lectura_publica" on storage.objects for select
  using (bucket_id = 'marcas-logos');

drop policy if exists "marcas_logos_admin_insert" on storage.objects;
create policy "marcas_logos_admin_insert" on storage.objects for insert
  with check (bucket_id = 'marcas-logos' and (auth.jwt() ->> 'email') = 'leivadj@gmail.com');

drop policy if exists "marcas_logos_admin_update" on storage.objects;
create policy "marcas_logos_admin_update" on storage.objects for update
  using (bucket_id = 'marcas-logos' and (auth.jwt() ->> 'email') = 'leivadj@gmail.com');

drop policy if exists "marcas_logos_admin_delete" on storage.objects;
create policy "marcas_logos_admin_delete" on storage.objects for delete
  using (bucket_id = 'marcas-logos' and (auth.jwt() ->> 'email') = 'leivadj@gmail.com');

-- ============================================================================
-- Listo:
-- - Todo lo que ya estaba cargado ahora es de marianps.260290@gmail.com.
-- - leivadj@gmail.com queda como cuenta admin + tu propio espacio limpio.
-- - Cualquier usuario nuevo arranca vacío.
-- - Solo leivadj@gmail.com puede crear/editar/borrar marcas y subir logos;
--   todos los usuarios autenticados pueden leer el catálogo.
-- ============================================================================
