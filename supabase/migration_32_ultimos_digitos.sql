-- ============================================================================
-- Gastos del Hogar — Migración 32: Últimos 4 dígitos de la tarjeta/cuenta
-- ============================================================================
-- Por qué: Felipe pidió poder distinguir sus cuentas de un vistazo ("los que
-- salen Banco Estado debería indicar si es débito, crédito, etc, con los 4
-- números de la tarjeta para identificar") — el nombre + tipo ya alcanzaba
-- para no confundirlas al pagar (ver migration_16), pero en el carrusel de
-- /tarjetas y en el detalle de cuenta seguía sin verse el dato real que
-- Felipe usa para reconocer la tarjeta físicamente.
--
-- Qué agrega:
--   `entidades.ultimos_digitos` — texto corto (4 dígitos), opcional (null =
--   no lo puso). Se guarda como texto y no numeric/int porque puede empezar
--   con 0 (ej. "0344") y no es un número con el que se opera.
--
-- Segura de correr aunque ya hayas corrido las migraciones anteriores.
-- ============================================================================

alter table entidades add column if not exists ultimos_digitos varchar(4);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'entidades_ultimos_digitos_formato'
  ) then
    alter table entidades add constraint entidades_ultimos_digitos_formato
      check (ultimos_digitos is null or ultimos_digitos ~ '^[0-9]{4}$');
  end if;
end $$;

-- ============================================================================
-- Listo: en /tarjetas, al crear o editar una tarjeta/cuenta aparece un campo
-- opcional "Últimos 4 dígitos". Con eso puesto, se muestra "•••• 1234" junto
-- al tipo (Débito/Crédito/etc.) en el carrusel y en el detalle de la cuenta.
-- ============================================================================
