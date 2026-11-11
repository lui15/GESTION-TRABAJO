-- =====================================================================
-- Aviso a la Edge Function `notificar-solicitud` en cada INSERT de requests.
--
-- - Usa pg_net (asíncrono): la inserción de las webs no espera ni falla
--   aunque la función esté caída o sin configurar.
-- - La URL y la cabecera secreta se leen de Supabase Vault (no van en git):
--     notificar_solicitud_url     → https://<proyecto>.supabase.co/functions/v1/notificar-solicitud
--     notificar_solicitud_secret  → el mismo valor que el secreto WEBHOOK_SECRET de la función
--   Si falta alguno de los dos, no se envía nada.
-- - No modifica la tabla `requests` ni sus columnas: solo añade un trigger.
-- =====================================================================

create extension if not exists pg_net with schema extensions;

create or replace function public.notificar_nueva_solicitud()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url     text;
  v_secreto text;
begin
  select decrypted_secret into v_url
    from vault.decrypted_secrets
   where name = 'notificar_solicitud_url'
   limit 1;

  select decrypted_secret into v_secreto
    from vault.decrypted_secrets
   where name = 'notificar_solicitud_secret'
   limit 1;

  if v_url is null or v_secreto is null then
    return new;
  end if;

  -- Mismo formato que los Database Webhooks de Supabase.
  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-webhook-secret', v_secreto
               ),
    body    := jsonb_build_object(
                 'type', 'INSERT',
                 'schema', 'public',
                 'table', 'requests',
                 'record', to_jsonb(new)
               ),
    timeout_milliseconds := 5000
  );

  return new;
exception
  when others then
    -- Nunca bloquear la inserción de una solicitud por culpa del aviso.
    raise warning 'notificar_nueva_solicitud: %', sqlerrm;
    return new;
end;
$$;

revoke all on function public.notificar_nueva_solicitud() from public, anon, authenticated;

drop trigger if exists requests_notificar_nueva on public.requests;
create trigger requests_notificar_nueva
  after insert on public.requests
  for each row execute function public.notificar_nueva_solicitud();
