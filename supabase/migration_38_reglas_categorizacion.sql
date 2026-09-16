-- ============================================================================
-- Gastos del Hogar — Migración 38: reglas de categorización aprendidas
-- ============================================================================
-- Por qué: es la única función de "Reglas de categorización"
-- (/reglas-categorizacion) que Felipe confirmó como funcionalidad NUEVA de
-- verdad (ver claude/mockup-v2-decisiones.md, sección "Pedido del usuario
-- que SÍ es funcionalidad nueva") — hasta ahora esa pantalla era solo una
-- demo con datos de ejemplo fijos, marcada "Próximamente". Felipe pidió
-- ahora "termina los pendientes... para poder revisar sus funciones".
--
-- Qué agrega:
--   `reglas_categorizacion` — una fila por "patrón de texto de comercio →
--   categoría" que el usuario ya confirmó al menos una vez, por cuenta
--   (owner_id). `patron` se guarda normalizado (mayúsculas, sin espacios de
--   sobra) para que "Pza Vespucio" y "PZA VESPUCIO" cuenten como la misma
--   regla. `veces_usada` es solo informativo (para ordenar "más usadas"
--   primero en /reglas-categorizacion). `unique(owner_id, patron)`: como
--   máximo una regla vigente por patrón — si el usuario confirma con una
--   categoría distinta a la sugerida, la regla existente se actualiza
--   (upsert), no se duplica.
--
-- Segura de correr aunque ya hayas corrido las migraciones anteriores.
-- ============================================================================

create table if not exists reglas_categorizacion (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id),
  patron text not null,
  categoria_id uuid not null references categorias(id),
  marca_id uuid references marcas(id),
  entidad_id uuid references entidades(id),
  veces_usada int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, patron)
);

alter table reglas_categorizacion enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'reglas_categorizacion' and policyname = 'solo_dueno'
  ) then
    create policy "solo_dueno" on reglas_categorizacion for all
      using (owner_id = auth.uid()) with check (owner_id = auth.uid());
  end if;
end $$;

-- ============================================================================
-- Listo: /sugerencias ahora consulta esta tabla al abrir el formulario de
-- confirmar un "gasto" (autocompleta categoría/marca/cuenta si el texto del
-- correo coincide con una regla aprendida) y la actualiza (crea o refuerza)
-- al confirmar. /reglas-categorizacion deja de ser una demo: muestra las
-- reglas reales del usuario, con opción de borrarlas.
-- ============================================================================
