/**
 * Resumen corto de una solicitud y clasificación de `details` por secciones.
 *
 * Compartido entre la app y la Edge Function para que la tarjeta y la
 * notificación digan lo mismo. Sin imports (Angular + Deno).
 *
 * Las webs no envían siempre las mismas claves en `details`, así que se
 * reconocen por patrones de nombre (en español o inglés, con o sin tildes).
 */

export interface SolicitudResumible {
  name?: string | null;
  service?: string | null;
  description?: string | null;
  details?: Record<string, unknown> | null;
}

export type SeccionDetalle = 'servicio' | 'direcciones' | 'fechas' | 'contacto' | 'origen';

export const SECCIONES: readonly { id: SeccionDetalle; titulo: string }[] = [
  { id: 'servicio', titulo: 'Servicio' },
  { id: 'direcciones', titulo: 'Direcciones' },
  { id: 'fechas', titulo: 'Fechas' },
  { id: 'contacto', titulo: 'Contacto' },
  { id: 'origen', titulo: 'Origen y UTM' },
];

/** Claves internas que nunca se muestran. */
export const CLAVES_INTERNAS: readonly string[] = ['is_test', 'test_batch'];

/** "Código Postal" → "codigo_postal" */
export function normalizarClave(clave: string): string {
  return clave
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function valorATexto(valor: unknown): string {
  if (valor === null || valor === undefined) {
    return '';
  }

  if (typeof valor === 'boolean') {
    return valor ? 'Sí' : 'No';
  }

  if (Array.isArray(valor)) {
    return valor.map((item) => valorATexto(item)).filter(Boolean).join(', ');
  }

  if (typeof valor === 'object') {
    return Object.values(valor as Record<string, unknown>)
      .map((item) => valorATexto(item))
      .filter(Boolean)
      .join(', ');
  }

  return String(valor).trim();
}

// ---------------------------------------------------------------------------
// Patrones por tipo de dato (sobre la clave normalizada)
// ---------------------------------------------------------------------------

const P_UTM = /^(utm|gclid|fbclid|msclkid|ref$|referr?er|landing|pagina|page|url|form|formulario|origen_web|web_origen|canal|campaign|campana|ip$|user_agent|navegador|dispositivo|device|idioma|lang)/;
const P_ORIGEN = /(^|_)(origen|origin|desde|from|recogida|pickup|salida|direccion_origen|calle_origen)($|_)/;
const P_DESTINO = /(^|_)(destino|destination|hasta|to|entrega|llegada|dropoff|direccion_destino|calle_destino)($|_)/;
const P_ZONA = /(^|_)(zona|barrio|distrito|municipio|localidad|ciudad|city|poblacion|provincia|ubicacion|location|direccion|address|calle|codigo_postal|cp|postal|zip)($|_)/;
const P_FECHA = /(^|_)(fecha|date|dia|day|hora|time|cuando|when|plazo|urgencia|urgente|disponibilidad|franja)($|_)/;
const P_CONTACTO = /(^|_)(telefono|tel|movil|phone|email|correo|mail|whatsapp|contacto|contact|nombre|name|apellidos?)($|_)/;
const P_VIVIENDA = /(^|_)(tipo_vivienda|vivienda|tipo_inmueble|inmueble|propiedad|tipo_local|local)($|_)/;
const P_HABITACIONES = /(^|_)(habitaciones|dormitorios|rooms|bedrooms|hab)($|_)/;
const P_TIPO_SERVICIO = /(^|_)(tipo_servicio|servicio|service|tipo_trabajo|trabajo|tipo_obra|obra|tipo)($|_)/;

export function clasificarClave(clave: string): SeccionDetalle {
  const k = normalizarClave(clave);

  if (P_UTM.test(k)) return 'origen';
  if (P_ORIGEN.test(k) || P_DESTINO.test(k) || P_ZONA.test(k)) return 'direcciones';
  if (P_FECHA.test(k)) return 'fechas';
  if (P_CONTACTO.test(k)) return 'contacto';

  return 'servicio';
}

function buscar(
  details: Record<string, unknown> | null | undefined,
  patron: RegExp,
  excluir?: RegExp,
): string {
  if (!details || typeof details !== 'object') {
    return '';
  }

  for (const [clave, valor] of Object.entries(details)) {
    const k = normalizarClave(clave);

    if (CLAVES_INTERNAS.includes(k) || P_UTM.test(k) || excluir?.test(k)) {
      continue;
    }

    if (patron.test(k)) {
      const texto = valorATexto(valor);

      if (texto) {
        return texto;
      }
    }
  }

  return '';
}

export interface CamposClave {
  servicio: string;
  vivienda: string;
  origen: string;
  destino: string;
  zona: string;
  fecha: string;
}

export function extraerCampos(solicitud: SolicitudResumible): CamposClave {
  const d = solicitud.details ?? null;

  const tipoVivienda = buscar(d, P_VIVIENDA);
  const habitaciones = buscar(d, P_HABITACIONES);

  let vivienda = capitalizar(tipoVivienda);

  if (habitaciones) {
    const numero = habitaciones.match(/\d+/)?.[0];
    const hab = numero ? `${numero} hab.` : habitaciones;
    vivienda = vivienda ? `${vivienda} ${hab}` : hab;
  }

  return {
    servicio: (solicitud.service ?? '').trim() || capitalizar(buscar(d, P_TIPO_SERVICIO, P_VIVIENDA)),
    vivienda,
    origen: buscar(d, P_ORIGEN),
    destino: buscar(d, P_DESTINO),
    zona: buscar(d, P_ZONA),
    fecha: buscar(d, P_FECHA),
  };
}

/** "Chamberí → Getafe", o la zona / dirección si no hay origen y destino. */
export function textoLugar(campos: CamposClave): string {
  if (campos.origen && campos.destino) {
    return `${recortar(campos.origen, 28)} → ${recortar(campos.destino, 28)}`;
  }

  return recortar(campos.zona || campos.origen || campos.destino, 40);
}

/**
 * Resumen para la tarjeta: "Piso 3 hab. · Chamberí → Getafe".
 * Si no hay datos estructurados usa el servicio o el principio de la descripción.
 */
export function resumenTarjeta(solicitud: SolicitudResumible, max = 90): string {
  const campos = extraerCampos(solicitud);
  const partes = [campos.vivienda || recortar(campos.servicio, 40), textoLugar(campos)].filter(
    Boolean,
  );

  if (partes.length === 0) {
    return recortar(primeraFrase(solicitud.description), max);
  }

  return recortar(partes.join(' · '), max);
}

/**
 * Texto de la notificación (máx. 120): servicio + zona u origen → destino + cliente.
 */
export function resumenNotificacion(solicitud: SolicitudResumible, max = 120): string {
  const campos = extraerCampos(solicitud);
  const nombre = (solicitud.name ?? '').trim();

  const partes = [
    recortar(campos.servicio || primeraFrase(solicitud.description), 45),
    campos.vivienda && campos.vivienda !== campos.servicio ? campos.vivienda : '',
    textoLugar(campos),
    nombre ? recortar(nombre, 30) : '',
  ].filter(Boolean);

  return recortar(partes.join(' · ') || 'Solicitud de presupuesto', max);
}

/** Dirección para abrir en Maps (o null si no hay ninguna). */
export function lugarParaMapa(solicitud: SolicitudResumible): { origen: string; destino: string } | null {
  const campos = extraerCampos(solicitud);
  const destino = campos.destino || campos.zona;

  if (campos.origen && destino) {
    return { origen: campos.origen, destino };
  }

  const unico = destino || campos.origen;

  return unico ? { origen: '', destino: unico } : null;
}

export function recortar(texto: string | null | undefined, max: number): string {
  const limpio = (texto ?? '').replace(/\s+/g, ' ').trim();

  if (limpio.length <= max) {
    return limpio;
  }

  return limpio.slice(0, Math.max(0, max - 1)).trimEnd() + '…';
}

function primeraFrase(texto: string | null | undefined): string {
  const limpio = (texto ?? '').replace(/\s+/g, ' ').trim();
  const corte = limpio.search(/[.!?\n]/);

  return corte > 10 ? limpio.slice(0, corte) : limpio;
}

function capitalizar(texto: string): string {
  return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : '';
}
