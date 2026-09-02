-- ============================================================================
-- Gastos del Hogar — Migración 19: gastos fijos "obligatorio, monto variable"
-- ============================================================================
-- Por qué: siguiendo el rediseño "cuotas" (fase 2 — Hogar / Calendario de
-- pagos), luz, agua y gas tienen fecha de vencimiento FIJA pero su MONTO
-- cambia cada mes — a diferencia de un gasto fijo real (arriendo, una
-- suscripción) que siempre cobra lo mismo. Esta migración agrega esa
-- clasificación a gastos_fijos, y marca como "variable" los que ya existen
-- bajo la categoría "Servicio básico" con nombre luz/agua/gas — corrige
-- cualquiera a mano desde /gastos-fijos si quedó mal clasificado.
--
-- Seguro de correr aunque ya hayas corrido las migraciones anteriores.
-- ============================================================================

alter table gastos_fijos add column if not exists tipo_monto text not null default 'fijo'
  check (tipo_monto in ('fijo', 'variable'));

update gastos_fijos
set tipo_monto = 'variable'
where categoria_id = (select id from categorias where nombre = 'Servicio básico (luz, agua, gas...)')
  and descripcion ~* '^(luz|agua|gas|abastible)'
  and tipo_monto = 'fijo';

-- ============================================================================
-- Listo: en /gastos-fijos cada item ahora elige "Monto fijo cada mes" u
-- "Obligatorio, el monto cambia cada mes" — los variables muestran el
-- promedio móvil de los últimos pagos reales registrados (ver Calendario de
-- pagos, /calendario-pagos) en vez de un monto fijo.
-- ============================================================================
