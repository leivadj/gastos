-- ============================================================================
-- Gastos del Hogar — Migración 41: solicitudes_logo
-- ============================================================================
-- Por qué: Ronda 9, "Sugerir un logo" (Felipe la eligió en la lista de
-- pendientes). Antes era una fila deshabilitada "Próximamente" en Mi perfil
-- — distinta de "Logos de marca" (que ya apuntaba a /admin, donde el ADMIN
-- sube el logo): esto es para que CUALQUIER usuario pida el logo de una
-- marca que todavía no lo tiene, y que el admin vea esos pedidos en un solo
-- lugar en vez de tener que adivinar cuáles faltan.
--
-- Quién puede ver qué: cualquier usuario autenticado puede crear una
-- solicitud y ver las suyas; solo las cuentas admin (mismo criterio que
-- marcas/marcas-logos en schema.sql) pueden ver TODAS las solicitudes,
-- marcarlas resueltas o borrarlas.
-- ============================================================================

create table if not exists solicitudes_logo (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id),
  marca_id uuid not null references marcas(id) on delete cascade,
  nota text,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'resuelta')),
  created_at timestamptz not null default now()
);

alter table solicitudes_logo enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'solicitudes_logo' and policyname = 'crear_propia'
  ) then
    create policy "crear_propia" on solicitudes_logo for insert
      with check (owner_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies where tablename = 'solicitudes_logo' and policyname = 'ver_propias_o_admin'
  ) then
    create policy "ver_propias_o_admin" on solicitudes_logo for select
      using (
        owner_id = auth.uid()
        or (auth.jwt() ->> 'email') in ('leivadj@gmail.com', 'marianps.260290@gmail.com')
      );
  end if;

  if not exists (
    select 1 from pg_policies where tablename = 'solicitudes_logo' and policyname = 'actualizar_admin'
  ) then
    create policy "actualizar_admin" on solicitudes_logo for update
      using ((auth.jwt() ->> 'email') in ('leivadj@gmail.com', 'marianps.260290@gmail.com'))
      with check ((auth.jwt() ->> 'email') in ('leivadj@gmail.com', 'marianps.260290@gmail.com'));
  end if;

  if not exists (
    select 1 from pg_policies where tablename = 'solicitudes_logo' and policyname = 'borrar_admin'
  ) then
    create policy "borrar_admin" on solicitudes_logo for delete
      using ((auth.jwt() ->> 'email') in ('leivadj@gmail.com', 'marianps.260290@gmail.com'));
  end if;
end $$;
