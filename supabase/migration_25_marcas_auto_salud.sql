-- ============================================================================
-- Gastos del Hogar — Migración 25: marcas para Auto y Salud + selector de
-- marca en los gastos sueltos de esas dos pantallas
-- ============================================================================
-- Por qué: el usuario pidió poder elegir marca al cargar un gasto de Auto
-- (bencina: Copec/Shell/..., mecánico, repuestos) o de Salud (centro médico,
-- medicamentos: farmacias), igual que ya se puede al crear una Compra en
-- cuotas o un Gasto fijo — hasta ahora /auto y /salud usaban gastos_diarios
-- (ver migration_21/22), que solo pedía monto + descripción, sin marca.
--
-- Cada categoría (Auto, Salud) agrupa VARIOS tipos de marca a la vez (Auto:
-- bencina/mecánico/repuestos; Salud: centro_medico/farmacia) — por eso esto
-- no usa `categorias.tipo_marca_sugerido` (que solo guarda UN tipo por
-- categoría, pensado para Compras/Gastos fijos): DiariosLista ahora recibe
-- directamente la lista de grupos a mostrar (ver
-- components/MarcaAgrupadaPicker.tsx), sin tocar esa columna.
--
-- Seguro de correr aunque ya hayas corrido las migraciones anteriores.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Ampliar el catálogo de tipos de marca con los 5 nuevos.
-- ---------------------------------------------------------------------------
alter table marcas drop constraint if exists marcas_tipo_check;
alter table marcas add constraint marcas_tipo_check check (tipo in (
  'banco', 'casa_comercial', 'caja_compensacion', 'autopista', 'telecom', 'servicio_basico',
  'supermercado', 'transporte', 'compras_online', 'delivery', 'suscripcion',
  'bencina', 'mecanico', 'repuestos', 'centro_medico', 'farmacia', 'otro'
));

alter table categorias drop constraint if exists categorias_tipo_marca_sugerido_check;
alter table categorias add constraint categorias_tipo_marca_sugerido_check check (tipo_marca_sugerido in (
  'banco', 'casa_comercial', 'caja_compensacion', 'autopista', 'telecom', 'servicio_basico',
  'supermercado', 'transporte', 'compras_online', 'delivery', 'suscripcion',
  'bencina', 'mecanico', 'repuestos', 'centro_medico', 'farmacia', 'otro'
) or tipo_marca_sugerido is null);

-- ---------------------------------------------------------------------------
-- 2) Catálogo inicial (idempotente). "Mecánico" y "Repuestos" quedan sin
--    marcas precargadas a propósito: no hay un puñado de nombres genéricos
--    para Chile como sí lo hay para bencineras/farmacias — se agregan desde
--    el picker mismo la primera vez que se necesiten (o desde /admin).
-- ---------------------------------------------------------------------------
insert into marcas (nombre, tipo) values
  -- Bencina
  ('Copec', 'bencina'),
  ('Shell', 'bencina'),
  ('Aramco', 'bencina'),
  ('Petrobras', 'bencina'),

  -- Centro médico
  ('Red Salud', 'centro_medico'),
  ('Integramédica', 'centro_medico'),
  ('Poli Center', 'centro_medico'),

  -- Farmacias (medicamentos)
  ('Cruz Verde', 'farmacia'),
  ('Salcobrand', 'farmacia'),
  ('Farmacias Ahumada', 'farmacia'),
  ('Dr. Simi', 'farmacia')
on conflict (nombre) do nothing;

-- ---------------------------------------------------------------------------
-- 3) marca_id en gastos_diarios: opcional, solo lo completan las pantallas
--    que lo ofrecen (por ahora /auto y /salud).
-- ---------------------------------------------------------------------------
alter table gastos_diarios add column if not exists marca_id uuid references marcas(id);

-- ============================================================================
-- Listo: en /auto, al cargar un gasto suelto aparece un selector agrupado
-- (Bencina / Mecánico / Repuestos); en /salud, otro (Centro médico /
-- Medicamentos) — con la opción de agregar una marca nueva ahí mismo si no
-- está en el catálogo.
-- ============================================================================
