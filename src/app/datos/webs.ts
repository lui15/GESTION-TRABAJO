/**
 * Webs que envían solicitudes.
 *
 * Los datos (nombre, color, icono, emoji y canal) viven en un único archivo,
 * supabase/functions/_shared/webs.ts, porque la Edge Function de las
 * notificaciones también los necesita. Aquí solo se re-exportan.
 */
export {
  CANALES,
  IDS_CANALES,
  WEBS,
  WEB_OTRA,
  getWeb,
  type WebInfo,
} from '../../../supabase/functions/_shared/webs';

import { getWeb } from '../../../supabase/functions/_shared/webs';

/** Color de la web según el modo (claro / oscuro). */
export function colorWeb(source: string | null | undefined, oscuro: boolean): string {
  const web = getWeb(source);

  return oscuro ? web.colorOscuro : web.color;
}
