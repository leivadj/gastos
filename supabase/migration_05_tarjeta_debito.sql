-- ============================================================================
-- Gastos del Hogar — Agrega "Tarjeta de débito" como tipo de entidad
-- ============================================================================
-- La tabla `entidades` (tus tarjetas/cuentas) ya existía en producción con un
-- check constraint que solo permitía: efectivo, tarjeta_credito, linea_credito,
-- credito_hipotecario, transferencia. Como esa tabla ya está creada, hace
-- falta este ALTER TABLE para agregar 'tarjeta_debito' a la lista permitida
-- (crear la tabla de nuevo con `create table if not exists` no la actualiza).
--
-- Corre esto en el SQL Editor de Supabase. Es seguro de correr más de una
-- vez (drop + add del mismo constraint).
-- ============================================================================

alter table entidades drop constraint entidades_tipo_check;
alter table entidades add constraint entidades_tipo_check check (
  tipo in ('efectivo', 'tarjeta_credito', 'tarjeta_debito', 'linea_credito', 'credito_hipotecario', 'transferencia')
);
