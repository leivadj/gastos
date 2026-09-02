-- ============================================================================
-- Gastos del Hogar — Migración 13: permitir el mismo nombre con distinto tipo
-- en "Tus tarjetas y cuentas"
-- ============================================================================
-- Por qué: la restricción de "no repetir nombre" era unique(owner_id,
-- nombre) — sin importar el tipo. Eso impedía tener, por ejemplo, "Banco
-- Estado" como Tarjeta de débito Y como Tarjeta de crédito a la vez (dos
-- entidades reales y distintas, con logo y gasto propios). Se cambia a
-- unique(owner_id, nombre, tipo): dos entidades pueden compartir nombre si
-- son de tipo distinto, pero se sigue evitando crear la misma dos veces.
--
-- Seguro de correr aunque ya hayas corrido las migraciones anteriores.
-- ============================================================================

alter table entidades drop constraint if exists entidades_owner_id_nombre_key;
alter table entidades drop constraint if exists entidades_owner_id_nombre_tipo_key;
alter table entidades add constraint entidades_owner_id_nombre_tipo_key unique (owner_id, nombre, tipo);
