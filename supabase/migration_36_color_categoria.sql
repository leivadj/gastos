-- ============================================================================
-- Gastos del Hogar — Migración 36: Color propio por categoría
-- ============================================================================
-- Por qué: Felipe pidió (ronda 6 del rediseño) que el gráfico de barras
-- verticales de "Presupuesto por categoría" (Inicio) y los anillos de
-- progreso de Presupuesto usen un color PROPIO de cada categoría (en vez de
-- un color genérico/binario según si está excedida o no) — calcado de una
-- captura real de la app Not Pato, donde cada categoría (Comida, Compras,
-- Hogar, Transporte...) tiene su propio color distintivo.
--
-- Qué agrega:
--   `categorias.color` — color hex opcional (ej. "#E2584B"). null = se sigue
--   usando el color determinístico por nombre que ya existía
--   (`lib/avatarColor.ts` → colorFor()), así que ninguna categoría existente
--   se ve "sin color" — simplemente no es su color elegido a mano todavía.
--
-- Segura de correr aunque ya hayas corrido las migraciones anteriores.
-- ============================================================================

alter table categorias add column if not exists color varchar(7);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'categorias_color_formato'
  ) then
    alter table categorias add constraint categorias_color_formato
      check (color is null or color ~ '^#[0-9a-fA-F]{6}$');
  end if;
end $$;

-- ============================================================================
-- Listo: en el panel de administración (/admin, solo tu cuenta), al crear o
-- editar una categoría aparece un selector de color junto al ícono. Sin
-- elegirlo, se sigue viendo con el color determinístico de siempre.
-- ============================================================================
