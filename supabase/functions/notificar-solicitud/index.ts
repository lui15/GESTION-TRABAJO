/**
 * Edge Function `notificar-solicitud`
 *
 * 1) Webhook: la llama el trigger de `requests` (migración
 *    20261111100100_notificar_solicitud_trigger.sql) en cada INSERT, con la
 *    cabecera `x-webhook-secret`. Manda un push FCM a los dispositivos cuyo
 *    `webs_activas` incluya la web de la solicitud.
 *
 * 2) Prueba: la app la llama con la sesión del usuario y
 *    `{ "modo": "prueba", "source": "mudanzas360" }`. Manda un push solo a los
 *    dispositivos de ese usuario.
 *
 * Secretos (Supabase → Edge Functions → Secrets):
 *   FIREBASE_SERVICE_ACCOUNT  JSON completo de la cuenta de servicio de Firebase
 *   WEBHOOK_SECRET            el mismo valor guardado en Vault como notificar_solicitud_secret
 * (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los pone Supabase automáticamente.)
 *
 * Los registros nunca incluyen datos del cliente (nombre, teléfono, texto…).
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

import { resumenNotificacion } from '../_shared/resumen.ts';
import { getWeb, type WebInfo } from '../_shared/webs.ts';

interface Solicitud {
  id: string;
  source: string;
  name?: string | null;
  service?: string | null;
  description?: string | null;
  details?: Record<string, unknown> | null;
}

interface CuentaServicio {
  project_id: string;
  client_email: string;
  private_key: string;
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET') ?? '';

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// =====================================================================
// Entrada
// =====================================================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Método no permitido' }, 405);
  }

  try {
    const cuerpo = await req.json().catch(() => ({}));

    if (cuerpo?.modo === 'prueba') {
      return await modoPrueba(req, cuerpo);
    }

    return await modoWebhook(req, cuerpo);
  } catch (error) {
    registrarError('fallo general', error);
    return json({ error: 'Error interno' }, 500);
  }
});

// =====================================================================
// 1) Webhook de la base de datos
// =====================================================================

async function modoWebhook(req: Request, cuerpo: Record<string, unknown>): Promise<Response> {
  const secreto = req.headers.get('x-webhook-secret') ?? '';

  if (!WEBHOOK_SECRET || !igualSeguro(secreto, WEBHOOK_SECRET)) {
    console.warn('notificar-solicitud: webhook rechazado (secreto incorrecto o sin configurar)');
    return json({ error: 'No autorizado' }, 401);
  }

  const registro = cuerpo?.['record'] as Solicitud | undefined;

  if (cuerpo?.['type'] !== 'INSERT' || cuerpo?.['table'] !== 'requests' || !registro?.id) {
    return json({ ok: true, ignorado: true });
  }

  const web = getWeb(registro.source);

  const { data, error } = await admin
    .from('device_tokens')
    .select('token')
    .contains('webs_activas', [web.canal]);

  if (error) {
    registrarError('leer device_tokens', error);
    return json({ error: 'No se pudieron leer los dispositivos' }, 500);
  }

  const tokens = (data ?? []).map((fila) => fila.token as string);
  const resultado = await enviarATodos(tokens, mensajeDeSolicitud(registro, web));

  console.log(
    `notificar-solicitud: canal=${web.canal} dispositivos=${tokens.length} ` +
      `enviadas=${resultado.enviadas} fallidas=${resultado.fallidas} borradas=${resultado.borradas}`,
  );

  return json({ ok: true, ...resultado });
}

// =====================================================================
// 2) Notificación de prueba (botón de Ajustes)
// =====================================================================

async function modoPrueba(req: Request, cuerpo: Record<string, unknown>): Promise<Response> {
  const jwt = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');

  if (!jwt) {
    return json({ error: 'Hace falta iniciar sesión' }, 401);
  }

  const { data: usuario, error: errorUsuario } = await admin.auth.getUser(jwt);

  if (errorUsuario || !usuario?.user) {
    return json({ error: 'Sesión no válida' }, 401);
  }

  const web = getWeb(typeof cuerpo['source'] === 'string' ? cuerpo['source'] : 'mudanzas360');

  const { data, error } = await admin
    .from('device_tokens')
    .select('token')
    .eq('user_id', usuario.user.id);

  if (error) {
    registrarError('leer device_tokens (prueba)', error);
    return json({ error: 'No se pudieron leer los dispositivos' }, 500);
  }

  const tokens = (data ?? []).map((fila) => fila.token as string);

  if (!tokens.length) {
    return json({ ok: false, enviadas: 0, motivo: 'sin_dispositivos' }, 200);
  }

  const mensaje = construirMensaje(web, {
    titulo: `${web.emoji} ${web.nombre} · Nueva solicitud`,
    texto: 'Notificación de prueba · Así te avisaremos de cada trabajo nuevo.',
    datos: { id: '', source: web.source, prueba: '1' },
    etiqueta: 'prueba',
  });

  const resultado = await enviarATodos(tokens, mensaje);

  console.log(
    `notificar-solicitud: prueba canal=${web.canal} dispositivos=${tokens.length} ` +
      `enviadas=${resultado.enviadas} fallidas=${resultado.fallidas}`,
  );

  return json({ ok: resultado.enviadas > 0, ...resultado });
}

// =====================================================================
// Mensajes
// =====================================================================

function mensajeDeSolicitud(s: Solicitud, web: WebInfo): Record<string, unknown> {
  return construirMensaje(web, {
    titulo: `${web.emoji} ${web.nombre} · Nueva solicitud`,
    texto: resumenNotificacion(s, 120),
    datos: { id: s.id, source: s.source ?? '' },
    etiqueta: s.id,
  });
}

function construirMensaje(
  web: WebInfo,
  { titulo, texto, datos, etiqueta }: { titulo: string; texto: string; datos: Record<string, string>; etiqueta: string },
): Record<string, unknown> {
  return {
    notification: { title: titulo, body: texto },
    data: datos,
    android: {
      priority: 'HIGH',
      notification: {
        channel_id: web.canal,
        color: web.color,
        icon: 'ic_stat_notify',
        tag: etiqueta,
        default_sound: true,
        default_vibrate_timings: true,
        notification_priority: 'PRIORITY_HIGH',
        visibility: 'PRIVATE',
      },
    },
  };
}

// =====================================================================
// Envío por FCM (API HTTP v1)
// =====================================================================

interface Resultado {
  enviadas: number;
  fallidas: number;
  borradas: number;
}

async function enviarATodos(tokens: string[], mensaje: Record<string, unknown>): Promise<Resultado> {
  const resultado: Resultado = { enviadas: 0, fallidas: 0, borradas: 0 };

  if (!tokens.length) {
    return resultado;
  }

  const cuenta = leerCuenta();
  const acceso = await tokenDeAcceso(cuenta);
  const url = `https://fcm.googleapis.com/v1/projects/${cuenta.project_id}/messages:send`;

  // En grupos pequeños para no saturar.
  for (let i = 0; i < tokens.length; i += 20) {
    const grupo = tokens.slice(i, i + 20);

    await Promise.all(
      grupo.map(async (token) => {
        const r = await fetch(url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${acceso}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: { ...mensaje, token } }),
        });

        if (r.ok) {
          resultado.enviadas++;
          return;
        }

        resultado.fallidas++;

        const detalle = await r.json().catch(() => ({}));
        const codigo = codigoError(detalle);

        console.warn(`notificar-solicitud: FCM ${r.status} ${codigo}`);

        if (tokenYaNoValido(r.status, codigo)) {
          const { error } = await admin.from('device_tokens').delete().eq('token', token);

          if (!error) {
            resultado.borradas++;
          }
        }
      }),
    );
  }

  return resultado;
}

function codigoError(detalle: Record<string, unknown>): string {
  const error = detalle?.['error'] as { status?: string; details?: { errorCode?: string }[] } | undefined;
  const errorCode = error?.details?.find((d) => d?.errorCode)?.errorCode;

  return errorCode ?? error?.status ?? 'DESCONOCIDO';
}

/** UNREGISTERED / NOT_FOUND = la app se desinstaló o el token caducó. */
function tokenYaNoValido(estado: number, codigo: string): boolean {
  return (
    codigo === 'UNREGISTERED' ||
    codigo === 'NOT_FOUND' ||
    estado === 404 ||
    (estado === 400 && codigo === 'INVALID_ARGUMENT')
  );
}

// =====================================================================
// OAuth de Google con la cuenta de servicio (JWT firmado con RS256)
// =====================================================================

let cache: { token: string; caduca: number } | null = null;

function leerCuenta(): CuentaServicio {
  const crudo = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');

  if (!crudo) {
    throw new Error('Falta el secreto FIREBASE_SERVICE_ACCOUNT');
  }

  const cuenta = JSON.parse(crudo) as CuentaServicio;

  if (!cuenta.project_id || !cuenta.client_email || !cuenta.private_key) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT incompleto');
  }

  return cuenta;
}

async function tokenDeAcceso(cuenta: CuentaServicio): Promise<string> {
  if (cache && cache.caduca > Date.now()) {
    return cache.token;
  }

  const ahora = Math.floor(Date.now() / 1000);
  const cabecera = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const carga = base64url(
    JSON.stringify({
      iss: cuenta.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: ahora,
      exp: ahora + 3600,
    }),
  );

  const clave = await crypto.subtle.importKey(
    'pkcs8',
    pemABytes(cuenta.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const firma = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    clave,
    new TextEncoder().encode(`${cabecera}.${carga}`),
  );

  const respuesta = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${cabecera}.${carga}.${base64url(new Uint8Array(firma))}`,
    }),
  });

  if (!respuesta.ok) {
    throw new Error(`OAuth de Google respondió ${respuesta.status}`);
  }

  const datos = (await respuesta.json()) as { access_token: string; expires_in: number };

  cache = { token: datos.access_token, caduca: Date.now() + (datos.expires_in - 120) * 1000 };

  return datos.access_token;
}

function pemABytes(pem: string): ArrayBuffer {
  const base64 = pem
    .replace(/-----BEGIN [^-]+-----/, '')
    .replace(/-----END [^-]+-----/, '')
    .replace(/\\n/g, '')
    .replace(/\s+/g, '');

  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);

  for (let i = 0; i < binario.length; i++) {
    bytes[i] = binario.charCodeAt(i);
  }

  return bytes.buffer;
}

function base64url(entrada: string | Uint8Array): string {
  const bytes = typeof entrada === 'string' ? new TextEncoder().encode(entrada) : entrada;
  let binario = '';

  for (const b of bytes) {
    binario += String.fromCharCode(b);
  }

  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// =====================================================================
// Utilidades
// =====================================================================

/** Comparación en tiempo constante (evita adivinar el secreto por tiempos). */
function igualSeguro(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diferencia = x.length ^ y.length;

  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    diferencia |= (x[i] ?? 0) ^ (y[i] ?? 0);
  }

  return diferencia === 0;
}

/** Solo el mensaje técnico, nunca el cuerpo de la solicitud. */
function registrarError(contexto: string, error: unknown): void {
  const mensaje = error instanceof Error ? error.message : String((error as { message?: string })?.message ?? error);

  console.error(`notificar-solicitud: ${contexto}: ${mensaje.slice(0, 200)}`);
}

function json(cuerpo: unknown, estado = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
