-- ============================================================================
-- Gastos del Hogar — Migración 22: categorías "Auto" y "Salud"
-- ============================================================================
-- Por qué: nuevas pantallas /auto y /salud (gastos sueltos de carga rápida,
-- mismo patrón que la pestaña "Diarios" de /gastos — ver migration_21 y
-- components/gastos/DiariosLista.tsx, ahora parametrizado por categoría).
--
-- /auto: bencina, mecánico, mantención (gastos sueltos, sin fecha de
-- vencimiento). Los documentos del auto con vencimiento anual (permiso de
-- circulación, revisión técnica, seguro) NO van acá — esos quedan para una
-- migración aparte con su propia tabla, pensada para fechas anuales, no
-- para gastos mensuales.
-- /salud: remedios, visita al doctor.
--
-- No hace falta ninguna tabla nueva: ambas reutilizan gastos_diarios (ya
-- existe desde migration_21), que ya tiene categoria_id — por eso ambas
-- categorías participan solas, sin más cambios, en el resumen por
-- categoría de Inicio/Presupuesto y en el historial de Reportes.
--
-- Seguro de correr aunque ya hayas corrido las migraciones anteriores.
-- ============================================================================

insert into categorias (nombre, tipo, tipo_marca_sugerido)
values
  ('Auto', 'variable', null),
  ('Salud', 'variable', null)
on conflict (nombre) do nothing;
