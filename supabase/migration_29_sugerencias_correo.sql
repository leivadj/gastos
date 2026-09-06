-- ============================================================================
-- Gastos del Hogar — Migración 29: Sugerencias desde el correo del banco
-- ============================================================================
-- Por qué: a pedido del usuario, que preguntó si se podía automatizar la
-- carga de gastos leyendo el correo que le manda BancoEstado. Antes de
-- construir se resolvieron 3 preguntas de diseño con AskUserQuestion: cómo
-- guarda datos una tarea programada que corre sola, sin sesión de usuario →
-- un endpoint propio y protegido (esta migración + app/api/sugerencias-correo),
-- nunca la service role key suelta en la tarea; si se cargan solos o se
-- proponen primero → SIEMPRE se proponen, nada se guarda como gasto real sin
-- que el usuario confirme; qué hacer con las transferencias entre sus propias
-- cuentas de BancoEstado (Corriente <-> Cuenta RUT) → igual quedan como
-- sugerencia, para que el usuario decida guardarlas como "↔ Transferencia".
--
-- Qué agrega:
--   1) `sugerencias_correo` — una fila por movimiento detectado en un correo
--      del banco, pendiente de revisión manual. `tipo` distingue qué formulario
--      de confirmación mostrar en /sugerencias: 'gasto' (compra o pago a un
--      comercio — se confirma como gasto diario), 'transferencia_tercero'
--      (le mandaste plata a otra persona — se confirma igual que 'gasto', la
--      plata salió de tu bolsillo) o 'transferencia_propia' (moviste plata
--      entre tus propias cuentas del mismo banco — se confirma como "↔
--      Transferencia", no es gasto ni ingreso). `datos_originales` guarda el
--      texto/campos crudos que se pudieron sacar del correo, por si hace
--      falta revisar cómo se interpretó.
--   2) RLS `solo_dueno`, igual que el resto de las tablas propias de cada
--      cuenta — el endpoint que inserta acá corre con la service role key
--      (que no respeta RLS) pero siempre fija `owner_id` a una sola cuenta
--      configurada de antemano (variable de entorno BOT_OWNER_ID), nunca a
--      lo que venga en el pedido.
--
-- Segura de correr aunque ya hayas corrido las migraciones anteriores.
-- ============================================================================

create table if not exists sugerencias_correo (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  tipo text not null check (tipo in ('gasto', 'transferencia_propia', 'transferencia_tercero')),
  monto numeric(12, 2) not null check (monto > 0),
  descripcion text not null,
  fecha date not null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'confirmada', 'descartada')),
  -- Texto/campos crudos sacados del correo (comercio, cuenta, comentario…),
  -- guardados tal cual para poder revisar cómo se interpretó — no se usa
  -- para nada más.
  datos_originales jsonb,
  created_at timestamptz not null default now()
);

alter table sugerencias_correo enable row level security;

create policy "solo_dueno" on sugerencias_correo for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ============================================================================
-- Listo: correr esto en Supabase es la mitad del trabajo — la otra mitad es
-- configurar en Vercel las variables de entorno que usa
-- app/api/sugerencias-correo/route.ts (BOT_SHARED_SECRET, BOT_OWNER_ID,
-- SUPABASE_SERVICE_ROLE_KEY) y, cuando el usuario conecte Gmail, armar la
-- tarea programada que lee el correo y le pega a ese endpoint. Ver el
-- resumen del proyecto (Novedades) para el detalle completo de esos pasos.
-- ============================================================================
