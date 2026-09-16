-- ============================================================================
-- Gastos del Hogar — Migración 40: preferencias_usuario
-- ============================================================================
-- Por qué: Ronda 9, Felipe eligió construir "Vista principal", "Inicio del
-- mes" y "Balance" (antes eran hojas "Próximamente" de solo ejemplo en Mi
-- perfil — SheetInicioMesDemo/SheetBalanceDemo/"Vista principal" en
-- components/PerfilPropioCard.tsx, que no guardaban nada de verdad). Estas 3
-- funciones comparten el mismo lugar (Mi perfil) y el mismo patrón (una
-- preferencia por usuario), así que viven en una sola tabla en vez de tres.
--
-- Qué guarda cada columna — ver el comentario completo en
-- lib/types.ts (interface PreferenciasUsuario):
--   dia_inicio_mes            — día en que arranca tu ciclo (1 = de siempre)
--   balance_incluye_debito/efectivo/cupo_tc — qué cuentas suman al Balance
--   pestana_inicio_defecto    — qué pestaña de Inicio (celular) abre primero
--   orden_resumen             — orden de las tarjetas de la pestaña Resumen
--
-- Los valores por defecto de cada columna reproducen EXACTO el
-- comportamiento actual de la app (nadie nota nada distinto hasta que entra
-- a Mi perfil a cambiar algo a propósito) — ver PREFERENCIAS_DEFECTO en
-- lib/preferenciasUsuario.ts, que se usa en el código mientras no exista
-- fila (no se crea una fila por usuario de entrada, solo cuando guarda algo
-- por primera vez).
-- ============================================================================

create table if not exists preferencias_usuario (
  owner_id uuid primary key default auth.uid() references auth.users(id),
  dia_inicio_mes int not null default 1 check (dia_inicio_mes between 1 and 28),
  balance_incluye_debito boolean not null default true,
  balance_incluye_efectivo boolean not null default true,
  balance_incluye_cupo_tc boolean not null default false,
  pestana_inicio_defecto text not null default 'resumen'
    check (pestana_inicio_defecto in ('resumen', 'ingresos', 'presupuesto')),
  orden_resumen text[] not null default array['categoria', 'presupuesto_categorias', 'actividad_mes'],
  updated_at timestamptz not null default now()
);

alter table preferencias_usuario enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'preferencias_usuario' and policyname = 'solo_dueno'
  ) then
    create policy "solo_dueno" on preferencias_usuario for all
      using (owner_id = auth.uid()) with check (owner_id = auth.uid());
  end if;
end $$;
