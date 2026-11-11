import {
  CLAVES_INTERNAS,
  SECCIONES,
  clasificarClave,
  extraerCampos,
  lugarParaMapa,
  normalizarClave,
  resumenTarjeta,
  valorATexto,
  type SeccionDetalle,
} from '../../../supabase/functions/_shared/resumen';
import { getWeb } from '../datos/webs';
import { Solicitud } from '../modelos/solicitud';

export { resumenTarjeta, extraerCampos };

// ---------------------------------------------------------------------------
// Fechas
// ---------------------------------------------------------------------------

export function fechaCompleta(fecha: string | null | undefined): string {
  if (!fecha) {
    return '';
  }

  return new Date(fecha).toLocaleString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function haceCuanto(fecha: string | null | undefined, ahora = Date.now()): string {
  if (!fecha) {
    return '';
  }

  const minutos = Math.floor((ahora - new Date(fecha).getTime()) / 60000);

  if (minutos < 1) return 'Ahora mismo';
  if (minutos < 60) return `Hace ${minutos} min`;

  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `Hace ${horas} h`;

  const dias = Math.floor(horas / 24);
  if (dias < 7) return `Hace ${dias} ${dias === 1 ? 'día' : 'días'}`;

  return new Date(fecha).toLocaleDateString('es-ES');
}

const DIA_MS = 86400000;

export function inicioDeHoy(ahora = new Date()): number {
  return new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()).getTime();
}

/** Hoy, Ayer, Esta semana, Este mes o "Marzo 2026". */
export function grupoFecha(fecha: string, ahora = new Date()): string {
  const creada = new Date(fecha);
  const hoy = inicioDeHoy(ahora);
  const t = creada.getTime();

  if (t >= hoy) return 'Hoy';
  if (t >= hoy - DIA_MS) return 'Ayer';
  if (t >= hoy - 6 * DIA_MS) return 'Esta semana';
  if (creada.getFullYear() === ahora.getFullYear() && creada.getMonth() === ahora.getMonth()) {
    return 'Este mes';
  }

  const etiqueta = creada.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

  return etiqueta.charAt(0).toUpperCase() + etiqueta.slice(1);
}

export function esDeHoy(fecha: string, ahora = new Date()): boolean {
  return new Date(fecha).getTime() >= inicioDeHoy(ahora);
}

export function esDeEstaSemana(fecha: string, ahora = new Date()): boolean {
  return new Date(fecha).getTime() >= inicioDeHoy(ahora) - 6 * DIA_MS;
}

// ---------------------------------------------------------------------------
// Textos
// ---------------------------------------------------------------------------

export function iniciales(nombre: string | null | undefined): string {
  if (!nombre) {
    return 'CL';
  }

  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte.charAt(0).toUpperCase())
    .join('');
}

export function referenciaCorta(id: string): string {
  return id ? id.substring(0, 8).toUpperCase() : '';
}

export function formatearClave(clave: string): string {
  const espaciada = clave
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim()
    .toLowerCase();

  return espaciada.charAt(0).toUpperCase() + espaciada.slice(1);
}

export function formatearValor(valor: unknown): string {
  if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
    return JSON.stringify(valor);
  }

  return valorATexto(valor);
}

export function esPrueba(solicitud: Solicitud): boolean {
  return solicitud.details?.['is_test'] === true;
}

/** Pares [clave, valor] visibles (sin claves internas ni valores vacíos). */
export function detallesVisibles(details: Record<string, unknown> | null): [string, unknown][] {
  if (!details || typeof details !== 'object') {
    return [];
  }

  return Object.entries(details).filter(
    ([clave, valor]) =>
      !CLAVES_INTERNAS.includes(normalizarClave(clave)) &&
      valor !== null &&
      valor !== undefined &&
      valor !== '',
  );
}

export interface FilaDetalle {
  etiqueta: string;
  valor: string;
}

export interface SeccionVista {
  id: SeccionDetalle;
  titulo: string;
  filas: FilaDetalle[];
}

/** Datos de `details` repartidos en Servicio, Direcciones, Fechas, Contacto y Origen y UTM. */
export function seccionesDetalle(solicitud: Solicitud): SeccionVista[] {
  const porSeccion = new Map<SeccionDetalle, FilaDetalle[]>();

  for (const [clave, valor] of detallesVisibles(solicitud.details)) {
    const id = clasificarClave(clave);
    const filas = porSeccion.get(id) ?? [];

    filas.push({ etiqueta: formatearClave(clave), valor: formatearValor(valor) });
    porSeccion.set(id, filas);
  }

  return SECCIONES.map((seccion) => ({ ...seccion, filas: porSeccion.get(seccion.id) ?? [] }));
}

// ---------------------------------------------------------------------------
// Contacto
// ---------------------------------------------------------------------------

/** Número en formato internacional para wa.me (añade 34 si tiene 9 cifras). */
export function telefonoInternacional(telefono: string | null | undefined): string {
  if (!telefono) {
    return '';
  }

  let numero = telefono.replace(/\D/g, '');

  if (numero.startsWith('00')) {
    numero = numero.substring(2);
  }

  if (numero.length === 9) {
    numero = '34' + numero;
  }

  return numero;
}

export function urlWhatsapp(solicitud: Solicitud): string {
  const numero = telefonoInternacional(solicitud.phone);

  if (!numero) {
    return '';
  }

  const nombre = (solicitud.name ?? '').trim().split(/\s+/)[0];
  const servicio = extraerCampos(solicitud).servicio || 'presupuesto';
  const web = getWeb(solicitud.source).nombre;

  const saludo =
    `Hola${nombre ? ' ' + nombre : ''}, te escribo por tu solicitud de ` +
    `${servicio.toLowerCase()} en ${web}.`;

  return `https://wa.me/${numero}?text=${encodeURIComponent(saludo)}`;
}

export function urlTelefono(telefono: string | null | undefined): string {
  const limpio = (telefono ?? '').replace(/[^\d+]/g, '');

  return limpio ? `tel:${limpio}` : '';
}

export function urlMaps(solicitud: Solicitud): string {
  const lugar = lugarParaMapa(solicitud);

  if (!lugar) {
    return '';
  }

  if (lugar.origen) {
    return (
      'https://www.google.com/maps/dir/?api=1' +
      `&origin=${encodeURIComponent(lugar.origen)}` +
      `&destination=${encodeURIComponent(lugar.destino)}`
    );
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lugar.destino)}`;
}

/** Texto plano con todos los datos, para copiar y pegar. */
export function textoParaCopiar(solicitud: Solicitud): string {
  const web = getWeb(solicitud.source);
  const bloques: string[] = [
    [
      `${web.emoji} ${web.nombre} · #${referenciaCorta(solicitud.id)}`,
      `Cliente: ${solicitud.name || 'Sin nombre'}`,
      solicitud.phone ? `Teléfono: ${solicitud.phone}` : '',
      solicitud.email ? `Email: ${solicitud.email}` : '',
      solicitud.service ? `Servicio: ${solicitud.service}` : '',
      `Recibida: ${fechaCompleta(solicitud.created_at)}`,
    ]
      .filter(Boolean)
      .join('\n'),
  ];

  if (solicitud.description) {
    bloques.push(solicitud.description.trim());
  }

  const detalles = detallesVisibles(solicitud.details).map(
    ([clave, valor]) => `${formatearClave(clave)}: ${formatearValor(valor)}`,
  );

  if (detalles.length) {
    bloques.push(detalles.join('\n'));
  }

  return bloques.join('\n\n');
}
