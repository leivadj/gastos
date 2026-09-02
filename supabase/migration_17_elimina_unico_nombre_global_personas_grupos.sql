-- ============================================================================
-- Gastos del Hogar — Migración 17: elimina restricciones viejas de nombre
-- único global en "personas" y "grupos"
-- ============================================================================
-- Por qué: el mismo problema que ya se encontró y se corrigió en "entidades"
-- (migration_16) — restricciones "<tabla>_nombre_key" que quedaron de una
-- versión muy anterior del esquema, previa a separar los datos por
-- owner_id, y que exigen que "nombre" sea único en TODA la tabla sin
-- importar la cuenta. Solo se notan cuando dos cuentas distintas usan el
-- mismo nombre (ej. tu persona "Felipe" con el mismo nombre que alguien usó
-- en otra cuenta, o un grupo "Casa" que ya existe en otra cuenta), así que
-- no aparecían en pruebas dentro de una sola cuenta.
--
-- "personas" y "grupos" son las otras dos tablas con esta misma forma
-- (unique(owner_id, nombre) como restricción correcta), así que es el mismo
-- riesgo — se eliminan las dos de una vez en vez de esperar a que aparezcan
-- una por una.
--
-- Seguro de correr aunque ya hayas corrido las migraciones anteriores, y
-- aunque estas restricciones viejas no existan en tu base (el "if exists"
-- hace que no falle).
-- ============================================================================

alter table personas drop constraint if exists personas_nombre_key;
alter table grupos drop constraint if exists grupos_nombre_key;

-- ============================================================================
-- Listo: ya puedes usar en tu cuenta el mismo nombre de persona o de grupo
-- que exista en otra cuenta (la tuya u otra), sin que choque.
-- ============================================================================
