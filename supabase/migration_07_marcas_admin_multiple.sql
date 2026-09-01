-- ============================================================================
-- Gastos del Hogar — Migración 07: ícono para marcas + admin del catálogo
-- también para Marian (no solo Felipe)
-- ============================================================================
-- Por qué: la migración 03 dejó las políticas de escritura del catálogo de
-- marcas (y del bucket de logos) codeadas SOLO para leivadj@gmail.com. La
-- sección "Admin" de la app ya mostraba el acceso como si fuera de ambos,
-- pero cualquier intento de Marian de agregar una marca o subir un logo
-- fallaba silenciosamente contra la base de datos (RLS). Esta migración lo
-- corrige, y además agrega la columna `icono` para poder elegir un emoji en
-- vez de subir una imagen al crear una marca nueva.
--
-- Seguro de correr aunque ya hayas corrido las migraciones anteriores.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Ícono (emoji) opcional para marcas, alternativa al logo con imagen.
-- ---------------------------------------------------------------------------
alter table marcas add column if not exists icono text;

-- ---------------------------------------------------------------------------
-- 2) Políticas de escritura del catálogo de marcas: ahora ambas cuentas
--    (leivadj@gmail.com y marianps.260290@gmail.com) pueden crear, editar y
--    borrar marcas.
-- ---------------------------------------------------------------------------
drop policy if exists "escritura_solo_admin" on marcas;
create policy "escritura_solo_admin" on marcas for insert
  with check ((auth.jwt() ->> 'email') in ('leivadj@gmail.com', 'marianps.260290@gmail.com'));

drop policy if exists "actualizacion_solo_admin" on marcas;
create policy "actualizacion_solo_admin" on marcas for update
  using ((auth.jwt() ->> 'email') in ('leivadj@gmail.com', 'marianps.260290@gmail.com'))
  with check ((auth.jwt() ->> 'email') in ('leivadj@gmail.com', 'marianps.260290@gmail.com'));

drop policy if exists "borrado_solo_admin" on marcas;
create policy "borrado_solo_admin" on marcas for delete
  using ((auth.jwt() ->> 'email') in ('leivadj@gmail.com', 'marianps.260290@gmail.com'));

-- ---------------------------------------------------------------------------
-- 3) Mismo arreglo para el bucket de Storage donde se guardan los logos.
-- ---------------------------------------------------------------------------
drop policy if exists "marcas_logos_admin_insert" on storage.objects;
create policy "marcas_logos_admin_insert" on storage.objects for insert
  with check (bucket_id = 'marcas-logos' and (auth.jwt() ->> 'email') in ('leivadj@gmail.com', 'marianps.260290@gmail.com'));

drop policy if exists "marcas_logos_admin_update" on storage.objects;
create policy "marcas_logos_admin_update" on storage.objects for update
  using (bucket_id = 'marcas-logos' and (auth.jwt() ->> 'email') in ('leivadj@gmail.com', 'marianps.260290@gmail.com'));

drop policy if exists "marcas_logos_admin_delete" on storage.objects;
create policy "marcas_logos_admin_delete" on storage.objects for delete
  using (bucket_id = 'marcas-logos' and (auth.jwt() ->> 'email') in ('leivadj@gmail.com', 'marianps.260290@gmail.com'));

-- ============================================================================
-- Listo:
-- - Puedes elegir un ícono (emoji) para una marca en vez de subir un logo.
-- - Marian ahora puede agregar/editar marcas y subir logos igual que Felipe.
-- ============================================================================
