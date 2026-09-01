-- ============================================================================
-- Gastos del Hogar — Migración 10: renombrar categoría "Vivienda"
-- ============================================================================
-- Por qué: la categoría "Vivienda" ya estaba enlazada al tipo de marca
-- "servicio_basico" (así que al elegirla se ofrecen CGE, Enel, Aguas
-- Andinas, Esval, Lipigas, Metrogas...), pero el nombre "Vivienda" en el
-- dropdown de Categoría no deja claro que ahí es donde se elige el
-- servicio básico — el usuario esperaba ver literalmente "Servicio básico
-- (luz, agua, gas...)", que es como se llama ese grupo en el catálogo de
-- marcas (/admin). Se renombra la categoría para que coincida.
--
-- Solo cambia el nombre (mismo id) — no afecta los gastos/cuotas ya
-- creados con esa categoría, ni requiere tocar entidades ni marcas.
--
-- Seguro de correr aunque ya hayas corrido las migraciones anteriores, y
-- seguro de correr más de una vez (si ya no existe una categoría llamada
-- "Vivienda", este update simplemente no encuentra fila y no hace nada).
-- ============================================================================

update categorias
set nombre = 'Servicio básico (luz, agua, gas...)'
where nombre = 'Vivienda';
