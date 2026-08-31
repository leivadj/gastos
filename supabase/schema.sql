-- ============================================================================
-- Gastos del Hogar — Esquema de base de datos (Supabase / Postgres)
-- ============================================================================
-- Cómo usar: copia TODO este archivo y pégalo en el Editor SQL de tu proyecto
-- de Supabase (dashboard → SQL Editor → New query), luego "Run".
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- PERSONAS
-- porcentaje_reparto: se usa solo si algún gasto/compra se reparte en modo
-- "automatico". Puede quedar en null para personas que solo reciben gastos
-- asignados manualmente (ej. un hijo/a al que se le asigna una cuota directa).
-- ---------------------------------------------------------------------------
create table personas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  porcentaje_reparto numeric(5,2),
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- CATEGORIAS (luz, agua, gas, supermercado, casa comercial, etc.)
-- ---------------------------------------------------------------------------
create table categorias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  tipo text not null check (tipo in ('fijo', 'variable')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- ENTIDADES (medios de pago / tarjetas / créditos: efectivo, Falabella,
-- Paris, Banco Estado, línea de crédito, crédito hipotecario...)
-- ---------------------------------------------------------------------------
create table entidades (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  tipo text not null check (
    tipo in ('efectivo', 'tarjeta_credito', 'linea_credito', 'credito_hipotecario', 'transferencia')
  ),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- COMPRAS — EL MOTOR DE CUOTAS AUTOMÁTICO
-- En vez de guardar "en qué cuota voy" (texto que se edita a mano cada mes),
-- se guarda CUÁNDO empezó la compra y CUÁNTAS cuotas tiene en total.
-- La cuota vigente se calcula sola con la fecha de hoy (ver vista más abajo).
-- ---------------------------------------------------------------------------
create table compras (
  id uuid primary key default gen_random_uuid(),
  descripcion text not null,
  monto_total numeric(12, 2) not null check (monto_total > 0),
  n_cuotas int not null check (n_cuotas > 0),
  fecha_primera_cuota date not null,
  entidad_id uuid references entidades(id),
  categoria_id uuid references categorias(id),
  modo_reparto text not null check (modo_reparto in ('manual', 'automatico')),
  persona_id uuid references personas(id), -- obligatorio solo si modo_reparto = 'manual'
  notas text,
  created_at timestamptz not null default now(),
  constraint chk_manual_requiere_persona
    check (modo_reparto <> 'manual' or persona_id is not null)
);

-- ---------------------------------------------------------------------------
-- GASTOS FIJOS — recurrentes cada mes, NO son cuotas (luz, agua, gas, etc.)
-- ---------------------------------------------------------------------------
create table gastos_fijos (
  id uuid primary key default gen_random_uuid(),
  descripcion text not null,
  categoria_id uuid references categorias(id),
  entidad_id uuid references entidades(id),
  monto_estimado numeric(12, 2) not null check (monto_estimado >= 0),
  dia_mes_pago int check (dia_mes_pago between 1 and 31),
  modo_reparto text not null check (modo_reparto in ('manual', 'automatico')),
  persona_id uuid references personas(id),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  constraint chk_gf_manual_requiere_persona
    check (modo_reparto <> 'manual' or persona_id is not null)
);

-- ---------------------------------------------------------------------------
-- INGRESOS
-- ---------------------------------------------------------------------------
create table ingresos (
  id uuid primary key default gen_random_uuid(),
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
-- VISTAS — aquí vive la automatización de las cuotas
-- ============================================================================

-- Para cada compra, calcula en qué cuota va HOY y si sigue vigente este mes.
-- No requiere ningún proceso mensual ni edición manual: siempre es correcta
-- porque se recalcula cada vez que se consulta, usando current_date.
create or replace view vista_cuotas_vigentes as
select
  c.id as compra_id,
  c.descripcion,
  c.monto_total,
  c.n_cuotas,
  c.fecha_primera_cuota,
  c.entidad_id,
  c.categoria_id,
  c.modo_reparto,
  c.persona_id,
  c.notas,
  round(c.monto_total / c.n_cuotas, 0) as monto_cuota,
  (
    (extract(year from age(date_trunc('month', current_date), date_trunc('month', c.fecha_primera_cuota))) * 12
     + extract(month from age(date_trunc('month', current_date), date_trunc('month', c.fecha_primera_cuota))))
    + 1
  )::int as cuota_actual
from compras c;

-- Solo las cuotas activas este mes (cuota_actual entre 1 y n_cuotas)
create or replace view vista_cuotas_mes_actual as
select *
from vista_cuotas_vigentes
where cuota_actual between 1 and n_cuotas;

-- Reparto por persona de las cuotas de este mes (maneja manual y automático)
create or replace view vista_reparto_cuotas_mes as
select
  v.compra_id,
  v.descripcion,
  v.categoria_id,
  v.entidad_id,
  v.monto_cuota,
  v.cuota_actual,
  v.n_cuotas,
  p.id as persona_id,
  p.nombre as persona_nombre,
  case
    when v.modo_reparto = 'manual' then v.monto_cuota
    else round(v.monto_cuota * coalesce(p.porcentaje_reparto, 0) / 100, 0)
  end as monto_persona
from vista_cuotas_mes_actual v
join personas p on p.activo = true
  and (
    (v.modo_reparto = 'manual' and p.id = v.persona_id)
    or (v.modo_reparto = 'automatico' and p.porcentaje_reparto is not null)
  );

-- Reparto por persona de los gastos fijos de este mes
create or replace view vista_reparto_gastos_fijos as
select
  g.id as gasto_fijo_id,
  g.descripcion,
  g.categoria_id,
  g.entidad_id,
  g.monto_estimado,
  p.id as persona_id,
  p.nombre as persona_nombre,
  case
    when g.modo_reparto = 'manual' then g.monto_estimado
    else round(g.monto_estimado * coalesce(p.porcentaje_reparto, 0) / 100, 0)
  end as monto_persona
from gastos_fijos g
join personas p on p.activo = true
  and (
    (g.modo_reparto = 'manual' and p.id = g.persona_id)
    or (g.modo_reparto = 'automatico' and p.porcentaje_reparto is not null)
  )
where g.activo = true;

-- Resumen del mes por categoría (para el gráfico de torta del dashboard)
create or replace view vista_resumen_categorias_mes as
select categoria_id, sum(monto_cuota) as total
from vista_cuotas_mes_actual
group by categoria_id
union all
select categoria_id, sum(monto_estimado) as total
from gastos_fijos
where activo = true
group by categoria_id;

-- Resumen del mes por persona (para las barras del dashboard)
create or replace view vista_resumen_personas_mes as
select persona_id, persona_nombre, sum(monto_persona) as total
from (
  select persona_id, persona_nombre, monto_persona from vista_reparto_cuotas_mes
  union all
  select persona_id, persona_nombre, monto_persona from vista_reparto_gastos_fijos
) t
group by persona_id, persona_nombre;

-- ============================================================================
-- SEGURIDAD (RLS) — solo un usuario autenticado (tú) puede leer/escribir.
-- Los datos son del hogar, no hay separación por usuario dentro de la app.
-- ============================================================================
alter table personas enable row level security;
alter table categorias enable row level security;
alter table entidades enable row level security;
alter table compras enable row level security;
alter table gastos_fijos enable row level security;
alter table ingresos enable row level security;
alter table pagos enable row level security;

create policy "solo_autenticados" on personas for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "solo_autenticados" on categorias for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "solo_autenticados" on entidades for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "solo_autenticados" on compras for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "solo_autenticados" on gastos_fijos for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "solo_autenticados" on ingresos for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "solo_autenticados" on pagos for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
