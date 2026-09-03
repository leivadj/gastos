-- ============================================================================
-- Gastos del Hogar — Migración 21: Gastos diarios + pantalla "Gastos" unificada
-- ============================================================================
-- Por qué: la pantalla "Gastos fijos" pasa a llamarse "Gastos" y agrupa 4
-- pestañas (Fijos, Variables, Cuotas, Diarios) — Fijos/Variables/Cuotas ya
-- existían (gastos_fijos y compras), esta migración solo agrega lo que falta
-- para la pestaña "Diarios": compras chicas/improvisadas del día a día (pan,
-- queso, algo que faltaba...), sin medio de pago ni reparto — carga rápida:
-- monto, descripción y fecha.
--
-- Todas caen bajo una categoría "Hogar" nueva en el catálogo compartido de
-- categorías (igual que "Otro", "Supermercado", etc. — ver categorias en
-- schema.sql). El usuario no la elige a mano: el formulario de "Diarios" la
-- busca por nombre y la usa siempre. `on conflict` evita duplicarla si por
-- algún motivo ya existiera.
--
-- Seguro de correr aunque ya hayas corrido las migraciones anteriores.
-- ============================================================================

insert into categorias (nombre, tipo, tipo_marca_sugerido)
values ('Hogar', 'variable', null)
on conflict (nombre) do nothing;

create table if not exists gastos_diarios (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id),
  descripcion text not null,
  monto numeric(12, 2) not null check (monto > 0),
  categoria_id uuid references categorias(id),
  fecha date not null default current_date,
  created_at timestamptz not null default now()
);

alter table gastos_diarios enable row level security;

create policy "solo_dueno" on gastos_diarios for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ============================================================================
-- Listo: /gastos (antes /gastos-fijos y /compras, ahora fusionadas ahí, con
-- redirect automático desde esas rutas viejas) ya permite cargar gastos
-- diarios bajo "Hogar".
-- ============================================================================
