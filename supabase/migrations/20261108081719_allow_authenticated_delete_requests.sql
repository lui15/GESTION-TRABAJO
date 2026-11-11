-- Ya aplicada en el proyecto (copiada del historial de migraciones de Supabase).
-- Permite que el panel (usuarios con sesión) elimine solicitudes.
grant delete on table public.requests to authenticated;
create policy "Authenticated can delete requests" on public.requests for delete to authenticated using (true);
