-- ============================================================================
-- Gastos del Hogar — Migración 39: tipos de marca ya no son una lista fija
-- ============================================================================
-- Por qué: Felipe reportó "al agregar una categoría, en marcas no me aparece
-- la categoría recién creada". Causa raíz: `categorias.tipo_marca_sugerido`
-- y `marcas.tipo` compartían la MISMA lista cerrada de 17 valores fijos
-- (check constraint) — crear una categoría nueva (ej. "Mascotas") nunca
-- podía agregar un tipo de marca nuevo a esa lista, así que jamás iba a
-- aparecer como opción "Tipo" al crear una marca. La lista de 17 (Banco,
-- Casa comercial, Supermercado...) sigue existiendo como catálogo BASE en
-- el código (app/admin/page.tsx) — esto solo quita el candado de la base de
-- datos para que se puedan agregar tipos nuevos sin migración.
--
-- Qué cambia:
--   Se sacan los `check` de `categorias.tipo_marca_sugerido` y `marcas.tipo`
--   — pasan a ser texto libre. `/admin` ahora ofrece "+ Nuevo tipo…" en
--   ambos selectores: el tipo que se escriba ahí (normalizado a minúsculas
--   y guiones bajos) queda disponible de inmediato para categorías Y marcas,
--   sin tocar la base de datos de nuevo.
--
-- Segura de correr aunque ya hayas corrido las migraciones anteriores — no
-- borra ni cambia ningún dato existente, todos los valores actuales ya
-- cumplían el check de todas formas.
-- ============================================================================

-- Se busca el constraint por su DEFINICIÓN (no por nombre) porque, al
-- haberse declarado en línea dentro de la columna en schema.sql, Postgres le
-- puso un nombre autogenerado — más seguro que asumir el nombre exacto que
-- confiar en que coincida.
do $$
declare
  r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'categorias'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%tipo_marca_sugerido%'
  loop
    execute format('alter table categorias drop constraint %I', r.conname);
  end loop;

  for r in
    select conname from pg_constraint
    where conrelid = 'marcas'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%tipo%' and pg_get_constraintdef(oid) ilike '%casa_comercial%'
  loop
    execute format('alter table marcas drop constraint %I', r.conname);
  end loop;
end $$;

-- ============================================================================
-- Listo: crear una categoría nueva permite, en el mismo formulario, definir
-- (o reutilizar) el tipo de marca que le corresponde — ese tipo aparece de
-- inmediato como opción "Tipo" al agregar una marca nueva.
-- ============================================================================
