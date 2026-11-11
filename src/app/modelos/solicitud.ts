/** Fila de la tabla `public.requests` (no se modifica: la usan las webs). */
export interface Solicitud {
  id: string;
  source: string;
  name: string;
  phone: string;
  email: string | null;
  service: string | null;
  description: string | null;
  details: Record<string, unknown> | null;
  photos: string[] | null;
  created_at: string;
  reviewed_at: string | null;
}

export type FiltroEstado = 'pending' | 'reviewed' | 'all';

export type Orden = 'newest' | 'oldest' | 'name';

export interface GrupoSolicitudes {
  etiqueta: string;
  items: Solicitud[];
}
