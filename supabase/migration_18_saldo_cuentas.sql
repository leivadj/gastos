-- ============================================================================
-- Gastos del Hogar — Migración 18: saldo manual por cuenta/tarjeta
-- ============================================================================
-- Por qué: siguiendo el mockup "monai" (fase 2: "Mis cuentas" / "Detalle de
-- cuenta"), cada tarjeta/cuenta en /tarjetas ahora puede tener un saldo
-- actual, para responder "¿cuánto dinero tengo?" de un vistazo. Como se
-- acordó, es un saldo MANUAL simple (lo actualiza el usuario a mano cuando
-- quiere) y no un cálculo automático a partir de los movimientos.
--
-- Seguro de correr aunque ya hayas corrido las migraciones anteriores.
-- ============================================================================

alter table entidades add column if not exists saldo numeric(12, 2);

-- ============================================================================
-- Listo: en /tarjetas puedes ponerle un saldo a cada cuenta al crearla o
-- editarla, y se muestra en la tarjeta y en el total arriba del carrusel.
-- ============================================================================
