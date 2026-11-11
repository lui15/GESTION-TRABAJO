/**
 * Conexión con Supabase.
 *
 * La clave publishable (anon) es pública por diseño: la seguridad la ponen las
 * políticas RLS de la base de datos. Ningún secreto (service role, Firebase,
 * WEBHOOK_SECRET) debe ir en este archivo: esos viven en los secretos de Supabase.
 */
export const SUPABASE_URL = 'https://obdetimymgchgqnlxbew.supabase.co';

export const SUPABASE_ANON_KEY = 'sb_publishable_vGYxgkMKDNJr1G0aq7vBMQ_lLUQfJqn';

export const FUNCION_NOTIFICAR = 'notificar-solicitud';
