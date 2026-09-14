-- ============================================================================
-- Gastos del Hogar — Migración 35: Color de texto de la tarjeta
-- ============================================================================
-- Por qué: Felipe reportó que en algunas tarjetas con colores muy claros (o
-- imágenes de fondo claras) el texto blanco fijo no se alcanza a leer — hacía
-- falta poder elegir también el color del texto, no solo el color de fondo
-- (`color_hex`, ver migration_12_tarjetas_visuales.sql).
--
-- Qué agrega:
--   `entidades.color_texto` — color hex opcional (ej. "#111113") para el
--   texto/íconos superpuestos en la cara de la tarjeta en /tarjetas. null =
--   se sigue usando blanco (el comportamiento de siempre).
--
-- Segura de correr aunque ya hayas corrido las migraciones anteriores.
-- ============================================================================

alter table entidades add column if not exists color_texto varchar(7);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'entidades_color_texto_formato'
  ) then
    alter table entidades add constraint entidades_color_texto_formato
      check (color_texto is null or color_texto ~ '^#[0-9a-fA-F]{6}$');
  end if;
end $$;

-- ============================================================================
-- Listo: en /tarjetas, al crear o editar una tarjeta/cuenta aparece un
-- selector opcional "Color de texto" junto al de color de fondo. Sin
-- elegirlo, el texto sigue saliendo blanco como siempre.
-- ============================================================================
