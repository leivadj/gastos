-- ============================================================================
-- Gastos del Hogar — Catálogo inicial de marcas (Chile)
-- ============================================================================
-- Un listado simple de bancos, casas comerciales, cajas de compensación,
-- autopistas, internet/móvil y servicios básicos comunes en Chile, para no
-- tener que ir agregando uno por uno desde /admin. Quedan SIN logo (logo_url
-- vacío) — mientras no le subas una imagen a una marca, la app le pone un
-- círculo de color con la inicial, así que igual se ve prolijo.
--
-- Corre esto DESPUÉS de migration_03_admin_marcas.sql (esa es la que crea la
-- tabla `marcas`). Es seguro de correr más de una vez: si una marca ya
-- existe, no la duplica ni la pisa (`on conflict (nombre) do nothing`).
--
-- Para agregarle el logo real a una marca ya creada: entra a /admin en la
-- app, toca "cambiar logo" en su tarjeta y sube la imagen (por ejemplo,
-- buscando "<nombre de la marca> logo png" en Google Imágenes desde tu
-- celular y guardándola) — no hace falta borrarla y crearla de nuevo.
-- ============================================================================

insert into marcas (nombre, tipo) values
  -- Bancos
  ('Banco Estado', 'banco'),
  ('Banco de Chile', 'banco'),
  ('Banco Santander', 'banco'),
  ('BCI', 'banco'),
  ('Banco Falabella', 'banco'),
  ('Scotiabank', 'banco'),
  ('Banco Security', 'banco'),
  ('Coopeuch', 'banco'),

  -- Casas comerciales
  ('Falabella', 'casa_comercial'),
  ('Ripley', 'casa_comercial'),
  ('Paris', 'casa_comercial'),
  ('La Polar', 'casa_comercial'),
  ('Hites', 'casa_comercial'),

  -- Cajas de compensación
  ('Caja Los Andes', 'caja_compensacion'),
  ('Caja Los Héroes', 'caja_compensacion'),
  ('Caja La Araucana', 'caja_compensacion'),

  -- Autopistas / TAG
  ('Autopista Central', 'autopista'),
  ('Costanera Norte', 'autopista'),
  ('Vespucio Norte', 'autopista'),
  ('Vespucio Sur', 'autopista'),

  -- Internet / móvil
  ('Movistar', 'telecom'),
  ('Entel', 'telecom'),
  ('WOM', 'telecom'),
  ('Claro', 'telecom'),
  ('VTR', 'telecom'),

  -- Servicios básicos (luz, agua, gas)
  ('Enel', 'servicio_basico'),
  ('CGE', 'servicio_basico'),
  ('Aguas Andinas', 'servicio_basico'),
  ('Esval', 'servicio_basico'),
  ('Metrogas', 'servicio_basico'),
  ('Lipigas', 'servicio_basico'),

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
  ('Cornershop', 'delivery'),

  -- Suscripciones (streaming, apps, membresías)
  ('Netflix', 'suscripcion'),
  ('Disney+', 'suscripcion'),
  ('HBO Max', 'suscripcion'),
  ('Amazon Prime Video', 'suscripcion'),
  ('Spotify', 'suscripcion'),
  ('YouTube Premium', 'suscripcion'),
  ('iCloud', 'suscripcion'),
  ('ChatGPT Plus', 'suscripcion'),
  ('Claude Pro', 'suscripcion'),
  ('Paramount+', 'suscripcion'),
  ('Star+', 'suscripcion'),

  -- Otro (pago de cuentas, varios)
  ('Unired', 'otro'),
  ('Servipag', 'otro')
on conflict (nombre) do nothing;
