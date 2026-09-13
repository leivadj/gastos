-- ============================================================================
-- Gastos del Hogar — Migración 31: Presupuesto mensual por categoría
-- ============================================================================
-- Por qué: Felipe pidió, en Inicio, barras de "gasto vs. presupuesto" por
-- categoría (ej. "Comida: coloco $100.000, llevo gastado $20.000 → barra en
-- 20%"). Hoy no existe ningún dato de "cuánto quiero gastar como máximo en
-- esta categoría cada mes" en el esquema — solo se sabe cuánto se gastó
-- (compras/gastos_fijos/gastos_diarios), nunca cuánto se PLANEÓ gastar.
--
-- Igual que categoria_grupo_preferido (migration_26): `categorias` es un
-- catálogo COMPARTIDO entre todas las cuentas (no tiene owner_id), así que
-- el presupuesto de "Comida" de Felipe y el de otra cuenta son objetivos
-- totalmente distintos — de ahí la tabla aparte con su propio owner_id, en
-- vez de una columna en `categorias`.
--
-- Un presupuesto es "por mes" pero NO por mes calendario específico: es el
-- objetivo recurrente de esa categoría (como monto_estimado en
-- gastos_fijos) — se compara siempre contra lo gastado en el mes que se
-- esté viendo, no hay que cargarlo de nuevo cada mes. Si en el futuro hace
-- falta variar el objetivo mes a mes, se puede agregar una columna `mes`
-- después sin romper esto.
--
-- Segura de correr aunque ya hayas corrido las migraciones anteriores.
-- ============================================================================

create table if not exists presupuestos_categoria (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id),
  categoria_id uuid not null references categorias(id) on delete cascade,
  monto_mensual numeric not null check (monto_mensual > 0),
  created_at timestamptz not null default now(),
  unique (owner_id, categoria_id)
);

alter table presupuestos_categoria enable row level security;

create policy "solo_dueno" on presupuestos_categoria for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ============================================================================
-- Listo: Inicio (app/page.tsx) ya puede leer/escribir esta tabla para
-- mostrar y editar el objetivo mensual de cada categoría, con una barra de
-- progreso contra lo efectivamente gastado ese mes.
-- ============================================================================
