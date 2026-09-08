-- Notificaciones push nativas (Web Push) para avisar en el celular apenas
-- llega una sugerencia nueva desde el correo del banco (ver /sugerencias y
-- app/api/sugerencias-correo). Guarda la "suscripción" que entrega el
-- navegador/PWA al aceptar notificaciones (un endpoint único por
-- dispositivo/navegador + 2 claves de cifrado) para poder mandarle un push
-- más adelante desde el servidor con la librería `web-push`.
--
-- Una cuenta puede tener varios dispositivos suscriptos a la vez (ej. el
-- iPhone y una compu) — por eso es una tabla con varias filas por owner_id,
-- no una columna más en otra tabla.
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;

create policy "solo_dueno" on push_subscriptions
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
