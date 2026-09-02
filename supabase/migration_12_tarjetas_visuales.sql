-- ============================================================================
-- Gastos del Hogar — Migración 12: tarjetas con diseño visual (estilo wallet)
-- ============================================================================
-- Por qué: el usuario pidió que "Tus tarjetas y cuentas" se vea como una
-- billetera digital (carrusel de tarjetas deslizable, con el gasto del mes
-- de cada una), y poder personalizar el diseño de cada tarjeta (color, o
-- subir una imagen real del diseño de su banco cuando no hay logo en el
-- catálogo). Esto agrega las columnas para esa personalización y el bucket
-- de Storage donde se guardan las imágenes que suba.
--
-- Seguro de correr aunque ya hayas corrido las migraciones anteriores.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) entidades: color base del degradado + imagen de fondo personalizada.
-- ---------------------------------------------------------------------------
alter table entidades add column if not exists color_hex text;
alter table entidades add column if not exists imagen_fondo_url text;

-- ---------------------------------------------------------------------------
-- 2) Storage: bucket "tarjetas-fondos", personal por usuario (a diferencia
--    de "marcas-logos" que es del catálogo compartido y solo admin escribe).
--    Cada usuario sube sus imágenes bajo una carpeta con su propio user id
--    (auth.uid()/archivo.ext); la política exige que esa carpeta coincida
--    con el usuario autenticado. Lectura pública para poder mostrarla.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('tarjetas-fondos', 'tarjetas-fondos', true)
on conflict (id) do nothing;

drop policy if exists "tarjetas_fondos_lectura_publica" on storage.objects;
create policy "tarjetas_fondos_lectura_publica" on storage.objects for select
  using (bucket_id = 'tarjetas-fondos');

drop policy if exists "tarjetas_fondos_dueno_insert" on storage.objects;
create policy "tarjetas_fondos_dueno_insert" on storage.objects for insert
  with check (bucket_id = 'tarjetas-fondos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "tarjetas_fondos_dueno_update" on storage.objects;
create policy "tarjetas_fondos_dueno_update" on storage.objects for update
  using (bucket_id = 'tarjetas-fondos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "tarjetas_fondos_dueno_delete" on storage.objects;
create policy "tarjetas_fondos_dueno_delete" on storage.objects for delete
  using (bucket_id = 'tarjetas-fondos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================================
-- Listo: en /tarjetas, cada tarjeta/cuenta puede tener su propio color o una
-- imagen real subida por ti, y se ve en un carrusel deslizable con el gasto
-- del mes de cada una.
-- ============================================================================
