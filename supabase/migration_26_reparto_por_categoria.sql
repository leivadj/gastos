-- ============================================================================
-- Gastos del Hogar — Migración 26: Reparto automático por categoría +
-- categorías nuevas (Feria, Panadería, Educación)
-- ============================================================================
-- Por qué: a pedido del usuario, tras revisar su Excel de control manual.
-- Hoy "Grupos" ya permite armar un reparto por % (ej. "Hogar" → Marian 40% /
-- Felipe 60%), pero hay que elegirlo A MANO cada vez que se crea un gasto
-- fijo, variable o compra en cuotas. Esta migración agrega una tabla chica
-- de preferencia (por cuenta) que dice "esta categoría usa este grupo por
-- defecto" — el formulario la lee y precarga el grupo solo, sin que el
-- usuario tenga que elegirlo (igual se puede cambiar a mano en ese momento).
--
-- Por qué una tabla aparte y no una columna en `categorias`: `categorias`
-- es un catálogo COMPARTIDO entre todas las cuentas (no tiene owner_id, ver
-- schema.sql), pero `grupos` es privado de cada cuenta — el grupo "Hogar"
-- de Felipe y el de Marian son filas totalmente distintas. Guardar un solo
-- grupo_id fijo en `categorias` solo serviría para UNA cuenta. Con esta
-- tabla, cada cuenta arma su propia preferencia (misma categoría
-- compartida, pero apuntando a SU PROPIO grupo).
--
-- Se administra desde /grupos (al crear/editar un grupo, elegís a qué
-- categorías se les aplica por defecto).
--
-- Segura de correr aunque ya hayas corrido las migraciones anteriores.
-- ============================================================================

create table if not exists categoria_grupo_preferido (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id),
  categoria_id uuid not null references categorias(id) on delete cascade,
  grupo_id uuid not null references grupos(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (owner_id, categoria_id)
);

alter table categoria_grupo_preferido enable row level security;

create policy "solo_dueno" on categoria_grupo_preferido for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Categorías nuevas que aparecieron en el Excel y todavía no existían en el
-- catálogo: Feria y Panadería (compras en efectivo del día a día, hoy caían
-- genéricas en "Supermercado" u "Otro") y Educación (colegio, cursos —
-- "cuota gira de estudio", "cuotas de curso" del Excel). Quedan sin marca
-- sugerida (no hace falta un catálogo de "marcas" para esto). Cada cuenta
-- decide después, desde /grupos, si las quiere atadas al reparto de "Hogar"
-- o a otro grupo.
-- ---------------------------------------------------------------------------
insert into categorias (nombre, tipo, icono, tipo_marca_sugerido) values
  ('Feria', 'variable', '🧺', null),
  ('Panadería', 'variable', '🍞', null),
  ('Educación (colegio, cursos)', 'fijo', '🎒', null)
on conflict (nombre) do nothing;

-- ============================================================================
-- Listo: /grupos ya puede ofrecer "categorías con este reparto por
-- defecto" al crear/editar un grupo, y GastosFijosLista.tsx / CuotasLista.tsx
-- ya precargan el grupo sugerido apenas se elige la categoría.
-- ============================================================================
