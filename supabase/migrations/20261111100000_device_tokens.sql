-- =====================================================================
-- Tokens de notificaciones push (FCM) de cada dispositivo.
--
-- - Cada usuario autenticado solo ve y modifica sus propios tokens (RLS).
-- - La Edge Function `notificar-solicitud` los lee con la service role.
-- - No toca la tabla `requests`.
-- =====================================================================

create table if not exists public.device_tokens (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  token         text not null unique,
  plataforma    text not null default 'android'
                check (plataforma in ('android', 'ios', 'web')),
  -- Canales (webs) de los que este dispositivo quiere avisos. Por defecto, todas.
  -- Mismos ids que supabase/functions/_shared/webs.ts
  webs_activas  text[] not null
                default array['mudanzas360', 'obralocalmadrid', 'armamuebles', 'tramo', 'otras'],
  creado        timestamptz not null default now(),
  actualizado   timestamptz not null default now()
);

comment on table public.device_tokens is
  'Tokens FCM de los dispositivos del panel. Lo usa la Edge Function notificar-solicitud.';

create index if not exists device_tokens_user_id_idx on public.device_tokens (user_id);
create index if not exists device_tokens_webs_activas_idx on public.device_tokens using gin (webs_activas);

-- `actualizado` al día en cada cambio
create or replace function public.device_tokens_tocar_actualizado()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.actualizado := now();
  return new;
end;
$$;

drop trigger if exists device_tokens_actualizado on public.device_tokens;
create trigger device_tokens_actualizado
  before update on public.device_tokens
  for each row execute function public.device_tokens_tocar_actualizado();

-- ---------------------------------------------------------------------
-- Seguridad
-- ---------------------------------------------------------------------

alter table public.device_tokens enable row level security;

revoke all on public.device_tokens from anon;
revoke all on public.device_tokens from authenticated;
grant select, insert, update, delete on public.device_tokens to authenticated;

drop policy if exists "Cada usuario ve sus tokens" on public.device_tokens;
create policy "Cada usuario ve sus tokens" on public.device_tokens
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Cada usuario crea sus tokens" on public.device_tokens;
create policy "Cada usuario crea sus tokens" on public.device_tokens
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Cada usuario cambia sus tokens" on public.device_tokens;
create policy "Cada usuario cambia sus tokens" on public.device_tokens
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Cada usuario borra sus tokens" on public.device_tokens;
create policy "Cada usuario borra sus tokens" on public.device_tokens
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- Registrar un token (upsert).
--
-- Un mismo teléfono conserva su token aunque cambie de cuenta: si el token
-- ya existe con otro usuario, RLS impediría actualizarlo, así que esta
-- función (security definer) lo reasigna al usuario actual. Conserva las
-- webs_activas que ya tuviera.
-- ---------------------------------------------------------------------

create or replace function public.registrar_token(p_token text, p_plataforma text default 'android')
returns public.device_tokens
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := auth.uid();
  v_fila public.device_tokens;
begin
  if v_usuario is null then
    raise exception 'Hace falta iniciar sesión' using errcode = '42501';
  end if;

  if p_token is null or length(p_token) < 20 or length(p_token) > 4096 then
    raise exception 'Token no válido' using errcode = '22023';
  end if;

  insert into public.device_tokens (user_id, token, plataforma)
  values (v_usuario, p_token, coalesce(p_plataforma, 'android'))
  on conflict (token) do update
    set user_id    = excluded.user_id,
        plataforma = excluded.plataforma,
        actualizado = now()
  returning * into v_fila;

  return v_fila;
end;
$$;

revoke all on function public.registrar_token(text, text) from public, anon;
grant execute on function public.registrar_token(text, text) to authenticated;
