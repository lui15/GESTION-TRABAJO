-- Permite que los usuarios con sesión iniciada (el panel) eliminen solicitudes.
-- Ejecutar una sola vez en Supabase > SQL Editor.

grant delete on table public.requests to authenticated;

create policy "Authenticated can delete requests"
  on public.requests
  for delete
  to authenticated
  using (true);
