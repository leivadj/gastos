-- ============================================================================
-- Gastos del Hogar — Migración 16: elimina restricción vieja de nombre único
-- global en "entidades"
-- ============================================================================
-- Por qué: la base tenía (de una versión muy anterior del esquema, previa a
-- separar los datos por owner_id) una restricción "entidades_nombre_key" que
-- exige que "nombre" sea único en TODA la tabla, sin importar la cuenta.
-- Nunca la reemplazó ninguna migración posterior — la migration_13 solo
-- eliminó "entidades_owner_id_nombre_key" (owner_id + nombre) para agregar
-- "entidades_owner_id_nombre_tipo_key" (owner_id + nombre + tipo), pero esta
-- otra restricción vieja seguía ahí sin que se notara, porque solo se activa
-- cuando dos CUENTAS DISTINTAS usan el mismo nombre (ej. "Banco Estado" en
-- la cuenta de Felipe y en la de Marian) — no aparecía en pruebas dentro de
-- una sola cuenta.
--
-- Efecto: sin esta restricción vieja, cada cuenta puede tener sus propias
-- tarjetas/cuentas con cualquier nombre, sin chocar con lo que haya en otras
-- cuentas — que es como debería funcionar, dado que ya existe la RLS de
-- "solo_dueno" y la restricción correcta unique(owner_id, nombre, tipo).
--
-- Seguro de correr aunque ya hayas corrido las migraciones anteriores.
-- ============================================================================

alter table entidades drop constraint if exists entidades_nombre_key;

-- ============================================================================
-- Listo: ya puedes crear una tarjeta/cuenta con un nombre que otra cuenta
-- (la tuya u otra) también use.
-- ============================================================================
