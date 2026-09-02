-- ============================================================================
-- Gastos del Hogar — Migración 11: Categoría = mismos grupos que el
-- catálogo de marcas (/admin)
-- ============================================================================
-- Por qué: el usuario pidió que el listado de "Categoría" (al crear una
-- cuota o un gasto fijo) tenga exactamente los mismos grupos que ve en el
-- catálogo de marcas en /admin (Banco, Casa comercial, Caja de
-- compensación, Autopista/TAG, Internet/Móvil, Servicio básico,
-- Supermercado, Pasajes (bus, avión), Compras online, Delivery,
-- Suscripción, Otro) — ni más ni menos. Se decidió, junto con el usuario,
-- ELIMINAR las categorías generales que no correspondían a ningún grupo
-- del catálogo (Educación, Ahorro, Salud), reasignando primero a "Otro"
-- cualquier gasto que ya las estuviera usando (para no perder datos ni
-- romper la relación con compras/gastos_fijos).
--
-- Seguro de correr aunque ya hayas corrido las migraciones anteriores, y
-- seguro de correr más de una vez (usa nombres para encontrar filas; si ya
-- no existen, cada paso simplemente no hace nada).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Categorías nuevas que faltan del catálogo de marcas.
-- ---------------------------------------------------------------------------
insert into categorias (nombre, tipo, tipo_marca_sugerido) values
  ('Banco', 'variable', 'banco'),
  ('Caja de compensación', 'variable', 'caja_compensacion'),
  ('Autopista / TAG', 'variable', 'autopista'),
  ('Internet / Móvil', 'fijo', 'telecom'),
  ('Compras online', 'variable', 'compras_online'),
  ('Delivery (comida, encargos)', 'variable', 'delivery')
on conflict (nombre) do nothing;

-- ---------------------------------------------------------------------------
-- 2) Renombrar categorías existentes para que calcen exactamente con la
--    etiqueta del grupo en el catálogo de marcas.
-- ---------------------------------------------------------------------------
update categorias set nombre = 'Pasajes (bus, avión)', tipo_marca_sugerido = 'transporte'
where nombre = 'Transporte';

update categorias set nombre = 'Suscripción (streaming, apps...)', tipo_marca_sugerido = 'suscripcion'
where nombre = 'Suscripciones';

-- "Otro" ya existía pero sin marca sugerida — la conecta al grupo "Otro"
-- del catálogo.
update categorias set tipo_marca_sugerido = 'otro' where nombre = 'Otro';

-- ---------------------------------------------------------------------------
-- 3) Educación / Ahorro / Salud no tienen grupo en el catálogo de marcas
--    -> se eliminan. Antes, reasigna a "Otro" cualquier gasto/cuota que
--    ya las estuviera usando, para no dejar nada huérfano.
-- ---------------------------------------------------------------------------
do $$
declare
  otro_id uuid;
  vieja_id uuid;
  nombre_vieja text;
begin
  select id into otro_id from categorias where nombre = 'Otro';

  foreach nombre_vieja in array array['Educación', 'Ahorro', 'Salud']
  loop
    select id into vieja_id from categorias where nombre = nombre_vieja;
    if vieja_id is not null then
      update gastos_fijos set categoria_id = otro_id where categoria_id = vieja_id;
      update compras set categoria_id = otro_id where categoria_id = vieja_id;
      delete from categorias where id = vieja_id;
    end if;
  end loop;
end $$;

-- ============================================================================
-- Listo: "Categoría" ahora tiene exactamente los mismos 12 grupos que el
-- catálogo de marcas en /admin, en el mismo orden y con el mismo nombre.
-- ============================================================================
