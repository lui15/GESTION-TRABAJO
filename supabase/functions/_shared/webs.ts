/**
 * FUENTE ÚNICA de las webs que envían solicitudes.
 *
 * La usan a la vez:
 *  - la app (a través de src/app/datos/webs.ts)
 *  - la Edge Function `notificar-solicitud` (título, color y canal de cada aviso)
 *
 * No debe importar nada: tiene que funcionar igual en Angular y en Deno.
 * Para añadir una web nueva basta con añadirla aquí.
 */

export interface WebInfo {
  /** Valor de la columna requests.source */
  source: string;
  /** Nombre visible completo */
  nombre: string;
  /** Nombre corto para chips y espacios pequeños */
  nombreCorto: string;
  /** Color principal (modo claro) */
  color: string;
  /** Color principal en modo oscuro */
  colorOscuro: string;
  /** Nombre del icono de Ionicons */
  icono: string;
  emoji: string;
  /** Id del canal de notificaciones de Android */
  canal: string;
}

export const WEBS: readonly WebInfo[] = [
  {
    source: 'mudanzas360',
    nombre: 'Mudanzas360',
    nombreCorto: 'Mudanzas360',
    color: '#2563eb',
    colorOscuro: '#60a5fa',
    icono: 'cube-outline',
    emoji: '🚚',
    canal: 'mudanzas360',
  },
  {
    source: 'obralocalmadrid',
    nombre: 'ObraLocal Madrid',
    nombreCorto: 'ObraLocal',
    color: '#e5484d',
    colorOscuro: '#ff6b6f',
    icono: 'business-outline',
    emoji: '🏗️',
    canal: 'obralocalmadrid',
  },
  {
    source: 'armamuebles',
    nombre: 'ArmaMuebles',
    nombreCorto: 'ArmaMuebles',
    color: '#e08a12',
    colorOscuro: '#fbbf24',
    icono: 'hammer-outline',
    emoji: '🛠️',
    canal: 'armamuebles',
  },
  {
    source: 'tramo',
    nombre: 'Tramo',
    nombreCorto: 'Tramo',
    color: '#7c3aed',
    colorOscuro: '#a78bfa',
    icono: 'clipboard-outline',
    emoji: '📋',
    canal: 'tramo',
  },
];

/** Cualquier `source` que no esté en la lista. */
export const WEB_OTRA: WebInfo = {
  source: 'otras',
  nombre: 'Otra web',
  nombreCorto: 'Otra',
  color: '#64748b',
  colorOscuro: '#94a3b8',
  icono: 'mail-outline',
  emoji: '📩',
  canal: 'otras',
};

/** Todas las webs más "Otra web": una entrada por canal de notificaciones. */
export const CANALES: readonly WebInfo[] = [...WEBS, WEB_OTRA];

/** Ids de todos los canales (valor por defecto de device_tokens.webs_activas). */
export const IDS_CANALES: readonly string[] = CANALES.map((web) => web.canal);

export function getWeb(source: string | null | undefined): WebInfo {
  return WEBS.find((web) => web.source === source) ?? WEB_OTRA;
}
