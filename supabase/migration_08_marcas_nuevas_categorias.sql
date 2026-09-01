-- ============================================================================
-- Gastos del Hogar — Migración 08: nuevas categorías de marcas (supermercados,
-- pasajes, compras online, delivery) + catálogo inicial de cada una
-- ============================================================================
-- Por qué: el catálogo de marcas (`marcas.tipo`) solo tenía banco, casa
-- comercial, caja de compensación, autopista, internet/móvil, servicio
-- básico y otro. A pedido del usuario se agregan 4 categorías nuevas y se
-- precargan algunas marcas típicas de cada una (quedan sin logo, igual que
-- el resto del catálogo — se les puede subir uno después desde /admin).
--
-- Seguro de correr aunque ya hayas corrido las migraciones anteriores.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Ampliar el check constraint de marcas.tipo.
-- ---------------------------------------------------------------------------
alter table marcas drop constraint if exists marcas_tipo_check;
alter table marcas add constraint marcas_tipo_check check (tipo in (
  'banco', 'casa_comercial', 'caja_compensacion', 'autopista', 'telecom', 'servicio_basico',
  'supermercado', 'transporte', 'compras_online', 'delivery', 'otro'
));

-- ---------------------------------------------------------------------------
-- 2) Catálogo inicial de las categorías nuevas (idempotente).
-- ---------------------------------------------------------------------------
insert into marcas (nombre, tipo) values
  -- Supermercados
  ('Jumbo', 'supermercado'),
  ('Líder', 'supermercado'),
  ('Santa Isabel', 'supermercado'),
  ('Tottus', 'supermercado'),
  ('Unimarc', 'supermercado'),
  ('Ekono', 'supermercado'),

  -- Pasajes (bus, avión)
  ('Turbus', 'transporte'),
  ('Pullman Bus', 'transporte'),
  ('LATAM', 'transporte'),
  ('Sky Airline', 'transporte'),
  ('JetSmart', 'transporte'),

  -- Compras online
  ('Mercado Libre', 'compras_online'),
  ('AliExpress', 'compras_online'),
  ('Shein', 'compras_online'),
  ('Amazon', 'compras_online'),
  ('Temu', 'compras_online'),

  -- Delivery (comida, encargos)
  ('Uber Eats', 'delivery'),
  ('Rappi', 'delivery'),
  ('PedidosYa', 'delivery'),
  ('Cornershop', 'delivery')
on conflict (nombre) do nothing;

-- ============================================================================
-- Listo: al crear un gasto/compra, en "Medio de pago" -> "+ Buscar" ya se
-- puede elegir (o agregar si falta) una marca de supermercado, pasajes,
-- compras online o delivery, igual que con bancos o servicios básicos.
-- ============================================================================
