-- Ya aplicada en el proyecto (copiada del historial de migraciones de Supabase).
-- Se guarda aquí para que `supabase db push` reconozca el historial remoto.

-- 1) Fuentes permitidas: las tres nuevas; 'tramo' se conserva solo como histórico
alter table public.requests drop constraint if exists requests_source_check;
alter table public.requests add constraint requests_source_check
  check (source in ('armamuebles','obralocalmadrid','mudanzas360','tramo'));

-- 2) Inserción desde las webs: solo las tres fuentes nuevas y siempre pendientes
drop policy if exists "Public can insert requests" on public.requests;
create policy "Public can insert requests" on public.requests
  for insert to anon, authenticated
  with check (
    source in ('armamuebles','obralocalmadrid','mudanzas360')
    and reviewed_at is null
  );

-- 3) Permisos de tabla mínimos (RLS sigue activo)
revoke all on public.requests from anon;
grant insert on public.requests to anon;

revoke all on public.requests from authenticated;
grant select, insert on public.requests to authenticated;
grant update (reviewed_at) on public.requests to authenticated;

-- 4) Realtime: ya incluida; solo se añade si faltara
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='requests'
  ) then
    alter publication supabase_realtime add table public.requests;
  end if;
end $$;
