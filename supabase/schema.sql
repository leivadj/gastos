-- ============================================================================
-- Gastos del Hogar — Esquema de base de datos (Supabase / Postgres)
-- ============================================================================
-- Cómo usar: copia TODO este archivo y pégalo en el Editor SQL de tu proyecto
-- de Supabase (dashboard → SQL Editor → New query), luego "Run".
--
-- Este archivo representa el estado ideal para una instalación NUEVA. Si tu
-- base ya está en producción, usa las migraciones numeradas en su lugar
-- (supabase/migration_XX_*.sql) — no vuelvas a correr este archivo completo
-- sobre una base que ya tiene datos.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- PERSONAS
-- owner_id: cada usuario autenticado tiene su propio espacio, totalmente
-- separado del de cualquier otro usuario (ver RLS más abajo).
-- ---------------------------------------------------------------------------
create table personas (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id),
  nombre text not null,
  porcentaje_reparto numeric(5,2), -- ya no se usa para calcular repartos (ver GRUPOS/ITEM_PARTICIPANTES), se deja solo por compatibilidad histórica
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (owner_id, nombre)
);

-- ---------------------------------------------------------------------------
-- CATEGORIAS (luz, agua, gas, supermercado, casa comercial, etc.)
-- ---------------------------------------------------------------------------
create table categorias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  tipo text not null check (tipo in ('fijo', 'variable')),
  icono text, -- emoji corto, ej "🏠" — opcional, editable desde /admin
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- MARCAS — catálogo COMPARTIDO (no tiene owner_id) de bancos, casas
-- comerciales, cajas de compensación, autopistas, internet/móvil y
-- servicios básicos (luz, agua, gas...), con su logo o ícono. Cualquier
-- usuario autenticado puede leerlo, para elegir marca al crear sus propias
-- entidades (tarjetas/cuentas); solo las cuentas admin (ver RLS más abajo)
-- pueden agregar/editar/borrar marcas del catálogo.
-- ---------------------------------------------------------------------------
create table marcas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  tipo text not null check (tipo in (
    'banco', 'casa_comercial', 'caja_compensacion', 'autopista', 'telecom', 'servicio_basico',
    'supermercado', 'transporte', 'compras_online', 'delivery', 'otro'
  )),
  logo_url text,
  icono text, -- emoji corto, alternativa al logo cuando no hay imagen
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- ENTIDADES (medios de pago / tarjetas / créditos: efectivo, Falabella,
-- Paris, Banco Estado, línea de crédito, crédito hipotecario...)
-- ---------------------------------------------------------------------------
create table entidades (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id),
  nombre text not null,
  tipo text not null check (
    tipo in ('efectivo', 'tarjeta_credito', 'tarjeta_debito', 'linea_credito', 'credito_hipotecario', 'transferencia')
  ),
  marca_id uuid references marcas(id), -- opcional: enlaza al catálogo compartido para heredar logo/ícono
  created_at timestamptz not null default now(),
  unique (owner_id, nombre)
);

-- ---------------------------------------------------------------------------
-- GRUPOS — agrupan varios gastos fijos/compras bajo un mismo reparto
-- (ej: "Casa" agrupa luz, agua, gas, supermercado, dividendo, y define UNA
-- vez qué personas participan y en qué proporción — todos los items del
-- grupo heredan ese mismo reparto).
-- ---------------------------------------------------------------------------
create table grupos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id),
  nombre text not null,
  icono text, -- emoji corto, ej "🏠" — lo personaliza el usuario
  created_at timestamptz not null default now(),
  unique (owner_id, nombre)
);

-- Personas que participan del reparto de un grupo, y su % (opcional).
-- porcentaje = null → se reparte en partes iguales el resto que quede
-- después de restar los % fijos de las demás personas del mismo grupo.
create table grupo_participantes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id),
  grupo_id uuid not null references grupos(id) on delete cascade,
  persona_id uuid not null references personas(id) on delete cascade,
  porcentaje numeric(5,2),
  created_at timestamptz not null default now(),
  unique (grupo_id, persona_id)
);

-- ---------------------------------------------------------------------------
-- COMPRAS — EL MOTOR DE CUOTAS AUTOMÁTICO
-- En vez de guardar "en qué cuota voy" (texto que se edita a mano cada mes),
-- se guarda CUÁNDO empezó la compra y CUÁNTAS cuotas tiene en total.
-- La cuota vigente se calcula sola con la fecha de hoy (ver vista más abajo).
--
-- El reparto entre personas ya NO se guarda en esta tabla: si `grupo_id` está
-- definido, el reparto lo hereda del grupo; si no, se define en la tabla
-- ITEM_PARTICIPANTES (ver más abajo), con las mismas reglas de % / partes
-- iguales que un grupo.
-- ---------------------------------------------------------------------------
create table compras (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id),
  descripcion text not null,
  monto_total numeric(12, 2) not null check (monto_total > 0),
  n_cuotas int not null check (n_cuotas > 0),
  fecha_primera_cuota date not null,
  entidad_id uuid references entidades(id),
  categoria_id uuid references categorias(id),
  grupo_id uuid references grupos(id),
  icono text, -- emoji propio del item (opcional) — si está, se muestra antes que el logo de la entidad
  notas text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- GASTOS FIJOS — recurrentes cada mes, NO son cuotas (luz, agua, gas, etc.)
-- ---------------------------------------------------------------------------
create table gastos_fijos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id),
  descripcion text not null,
  categoria_id uuid references categorias(id),
  entidad_id uuid references entidades(id),
  grupo_id uuid references grupos(id),
  icono text,
  monto_estimado numeric(12, 2) not null check (monto_estimado >= 0),
  dia_mes_pago int check (dia_mes_pago between 1 and 31),
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- ITEM_PARTICIPANTES — reparto propio de una compra o gasto fijo que NO
-- pertenece a un grupo (si pertenece a un grupo, el reparto viene de
-- GRUPO_PARTICIPANTES en su lugar y esta tabla no se usa para ese item).
-- Mismo formato que GRUPO_PARTICIPANTES: porcentaje null = partes iguales
-- del resto.
-- ---------------------------------------------------------------------------
create table item_participantes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id),
  origen text not null check (origen in ('compra', 'gasto_fijo')),
  origen_id uuid not null,
  persona_id uuid not null references personas(id) on delete cascade,
  porcentaje numeric(5,2),
  created_at timestamptz not null default now(),
  unique (origen, origen_id, persona_id)
);

-- ---------------------------------------------------------------------------
-- INGRESOS
-- ---------------------------------------------------------------------------
create table ingresos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id),
  persona_id uuid references personas(id),
  monto numeric(12, 2) not null check (monto >= 0),
  mes date not null, -- usar siempre el día 1 del mes, ej '2026-08-01'
  descripcion text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- PAGOS — marca si el cargo del mes (cuota o gasto fijo) ya se pagó, y
-- permite ajustar el monto real si difiere del estimado (ej. interés).
-- Opcional: la app funciona igual sin esto, es solo para llevar el check.
-- ---------------------------------------------------------------------------
create table pagos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id),
  origen text not null check (origen in ('compra', 'gasto_fijo')),
  origen_id uuid not null,
  mes date not null,
  monto_real numeric(12, 2),
  pagado boolean not null default false,
  fecha_pago date,
  created_at timestamptz not null default now(),
  unique (origen, origen_id, mes)
);

-- ============================================================================
-- VISTAS — aquí vive la automatización de las cuotas y del reparto
-- ============================================================================

-- Para cada compra, calcula en qué cuota va HOY y si sigue vigente este mes.
-- No requiere ningún proceso mensual ni edición manual: siempre es correcta
-- porque se recalcula cada vez que se consulta, usando current_date.
create or replace view vista_cuotas_vigentes
with (security_invoker = true) as
select
  c.id as compra_id,
  c.descripcion,
  c.monto_total,
  c.n_cuotas,
  c.fecha_primera_cuota,
  c.entidad_id,
  c.categoria_id,
  c.grupo_id,
  c.icono,
  c.notas,
  round(c.monto_total / c.n_cuotas, 0) as monto_cuota,
  (
    (extract(year from age(date_trunc('month', current_date), date_trunc('month', c.fecha_primera_cuota))) * 12
     + extract(month from age(date_trunc('month', current_date), date_trunc('month', c.fecha_primera_cuota))))
    + 1
  )::int as cuota_actual
from compras c;

-- Solo las cuotas activas este mes (cuota_actual entre 1 y n_cuotas)
create or replace view vista_cuotas_mes_actual
with (security_invoker = true) as
select *
from vista_cuotas_vigentes
where cuota_actual between 1 and n_cuotas;

-- Resuelve, para cada persona de cada grupo, su % EFECTIVO de reparto: usa
-- su % fijo si lo tiene, y si no, reparte en partes iguales lo que queda
-- del 100% entre quienes no tienen % fijo dentro del mismo grupo.
create or replace view vista_grupo_reparto
with (security_invoker = true) as
select
  gp.grupo_id,
  p.id as persona_id,
  p.nombre as persona_nombre,
  coalesce(
    gp.porcentaje,
    greatest(0, 100 - coalesce(sum(gp.porcentaje) filter (where gp.porcentaje is not null) over (partition by gp.grupo_id), 0))
      / nullif(count(*) filter (where gp.porcentaje is null) over (partition by gp.grupo_id), 0)
  ) as porcentaje_efectivo
from grupo_participantes gp
join personas p on p.id = gp.persona_id and p.activo = true;

-- Igual que la anterior, pero para el reparto propio de un item suelto
-- (compra o gasto fijo que no pertenece a ningún grupo).
create or replace view vista_item_reparto
with (security_invoker = true) as
select
  ip.origen,
  ip.origen_id,
  p.id as persona_id,
  p.nombre as persona_nombre,
  coalesce(
    ip.porcentaje,
    greatest(0, 100 - coalesce(sum(ip.porcentaje) filter (where ip.porcentaje is not null) over (partition by ip.origen, ip.origen_id), 0))
      / nullif(count(*) filter (where ip.porcentaje is null) over (partition by ip.origen, ip.origen_id), 0)
  ) as porcentaje_efectivo
from item_participantes ip
join personas p on p.id = ip.persona_id and p.activo = true;

-- Reparto por persona de las cuotas de este mes: si la compra pertenece a
-- un grupo, usa el reparto del grupo; si no, usa su propio reparto de item.
create or replace view vista_reparto_cuotas_mes
with (security_invoker = true) as
select
  v.compra_id,
  v.descripcion,
  v.categoria_id,
  v.entidad_id,
  v.grupo_id,
  v.icono,
  v.monto_cuota,
  v.cuota_actual,
  v.n_cuotas,
  r.persona_id,
  r.persona_nombre,
  round(v.monto_cuota * r.porcentaje_efectivo / 100, 0) as monto_persona
from vista_cuotas_mes_actual v
join lateral (
  select persona_id, persona_nombre, porcentaje_efectivo
  from vista_grupo_reparto gr
  where gr.grupo_id = v.grupo_id and v.grupo_id is not null
  union all
  select persona_id, persona_nombre, porcentaje_efectivo
  from vista_item_reparto ir
  where ir.origen = 'compra' and ir.origen_id = v.compra_id and v.grupo_id is null
) r on true;

-- Reparto por persona de los gastos fijos de este mes (misma lógica).
create or replace view vista_reparto_gastos_fijos
with (security_invoker = true) as
select
  g.id as gasto_fijo_id,
  g.descripcion,
  g.categoria_id,
  g.entidad_id,
  g.grupo_id,
  g.icono,
  g.monto_estimado,
  r.persona_id,
  r.persona_nombre,
  round(g.monto_estimado * r.porcentaje_efectivo / 100, 0) as monto_persona
from gastos_fijos g
join lateral (
  select persona_id, persona_nombre, porcentaje_efectivo
  from vista_grupo_reparto gr
  where gr.grupo_id = g.grupo_id and g.grupo_id is not null
  union all
  select persona_id, persona_nombre, porcentaje_efectivo
  from vista_item_reparto ir
  where ir.origen = 'gasto_fijo' and ir.origen_id = g.id and g.grupo_id is null
) r on true
where g.activo = true;

-- Resumen del mes por categoría (para el gráfico de torta del dashboard)
create or replace view vista_resumen_categorias_mes
with (security_invoker = true) as
select categoria_id, sum(monto_cuota) as total
from vista_cuotas_mes_actual
group by categoria_id
union all
select categoria_id, sum(monto_estimado) as total
from gastos_fijos
where activo = true
group by categoria_id;

-- Resumen del mes por persona (para las barras del dashboard)
create or replace view vista_resumen_personas_mes
with (security_invoker = true) as
select persona_id, persona_nombre, sum(monto_persona) as total
from (
  select persona_id, persona_nombre, monto_persona from vista_reparto_cuotas_mes
  union all
  select persona_id, persona_nombre, monto_persona from vista_reparto_gastos_fijos
) t
group by persona_id, persona_nombre;

-- ============================================================================
-- SEGURIDAD (RLS) — cada usuario autenticado tiene su propio espacio,
-- totalmente separado del de cualquier otro usuario (Felipe, Marian, etc.
-- cada uno con su login, sin ver los datos del otro). `categorias` es la
-- única tabla compartida entre todos: es solo una lista de nombres, sin
-- información privada.
-- ============================================================================
alter table personas enable row level security;
alter table categorias enable row level security;
alter table marcas enable row level security;
alter table entidades enable row level security;
alter table grupos enable row level security;
alter table grupo_participantes enable row level security;
alter table compras enable row level security;
alter table gastos_fijos enable row level security;
alter table item_participantes enable row level security;
alter table ingresos enable row level security;
alter table pagos enable row level security;

create policy "solo_dueno" on personas for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "solo_autenticados" on categorias for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- MARCAS: cualquier usuario autenticado puede leer el catálogo; solo las
-- cuentas admin (leivadj@gmail.com y marianps.260290@gmail.com) pueden
-- crear/editar/borrar marcas.
create policy "lectura_todos" on marcas for select
  using (auth.role() = 'authenticated');
create policy "escritura_solo_admin" on marcas for insert
  with check ((auth.jwt() ->> 'email') in ('leivadj@gmail.com', 'marianps.260290@gmail.com'));
create policy "actualizacion_solo_admin" on marcas for update
  using ((auth.jwt() ->> 'email') in ('leivadj@gmail.com', 'marianps.260290@gmail.com'))
  with check ((auth.jwt() ->> 'email') in ('leivadj@gmail.com', 'marianps.260290@gmail.com'));
create policy "borrado_solo_admin" on marcas for delete
  using ((auth.jwt() ->> 'email') in ('leivadj@gmail.com', 'marianps.260290@gmail.com'));

create policy "solo_dueno" on entidades for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "solo_dueno" on grupos for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "solo_dueno" on grupo_participantes for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "solo_dueno" on compras for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "solo_dueno" on gastos_fijos for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "solo_dueno" on item_participantes for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "solo_dueno" on ingresos for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "solo_dueno" on pagos for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ============================================================================
-- ALMACENAMIENTO (Supabase Storage) — logos del catálogo de marcas.
-- Lectura pública (para poder mostrar el logo sin sesión), escritura solo
-- para las cuentas admin.
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('marcas-logos', 'marcas-logos', true)
on conflict (id) do nothing;

create policy "marcas_logos_lectura_publica" on storage.objects for select
  using (bucket_id = 'marcas-logos');
create policy "marcas_logos_admin_insert" on storage.objects for insert
  with check (bucket_id = 'marcas-logos' and (auth.jwt() ->> 'email') in ('leivadj@gmail.com', 'marianps.260290@gmail.com'));
create policy "marcas_logos_admin_update" on storage.objects for update
  using (bucket_id = 'marcas-logos' and (auth.jwt() ->> 'email') in ('leivadj@gmail.com', 'marianps.260290@gmail.com'));
create policy "marcas_logos_admin_delete" on storage.objects for delete
  using (bucket_id = 'marcas-logos' and (auth.jwt() ->> 'email') in ('leivadj@gmail.com', 'marianps.260290@gmail.com'));
