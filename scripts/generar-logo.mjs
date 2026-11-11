/**
 * Genera el logo y las imágenes de origen de los iconos.
 *
 *   node scripts/generar-logo.mjs
 *   npx @capacitor/assets generate --android --pwa ...   (ver package.json → "assets")
 *
 * Logo: monograma "GT" en un cuadrado redondeado + tres puntos con los colores
 * de Mudanzas360, ObraLocal Madrid y ArmaMuebles (de supabase/functions/_shared/webs.ts).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = path.join(RAIZ, 'assets');
const PUBLIC = path.join(RAIZ, 'public');

// Colores de las tres webs (mismos que en _shared/webs.ts)
const PUNTOS = ['#2563eb', '#e5484d', '#e08a12'];

// ---------------------------------------------------------------------------
// Piezas del dibujo (lienzo de 1024 × 1024)
// ---------------------------------------------------------------------------

const DEFS = `
  <defs>
    <linearGradient id="fondo" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#6366f1"/>
      <stop offset="1" stop-color="#4338ca"/>
    </linearGradient>
    <radialGradient id="brillo" cx="0.25" cy="0.1" r="0.9">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.28"/>
      <stop offset="0.6" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>`;

/** "GT" + puntos. `color` de las letras; `puntosColor` null = colores de las webs. */
function monograma({ color = '#ffffff', puntosColor = null, borde = '#ffffff' } = {}) {
  const puntos = [388, 512, 636]
    .map(
      (cx, i) =>
        `<circle cx="${cx}" cy="784" r="54" fill="${puntosColor ?? PUNTOS[i]}"${
          borde ? ` stroke="${borde}" stroke-width="14"` : ''
        }/>`,
    )
    .join('');

  return `
  <g fill="none" stroke="${color}" stroke-width="104" stroke-linecap="round" stroke-linejoin="round">
    <path d="M455.8 329.4A172 172 0 1 0 496 440H356"/>
    <path d="M620 268H860M740 268V612"/>
  </g>
  <g>${puntos}</g>`;
}

const FONDO = `
  <rect width="1024" height="1024" rx="232" fill="url(#fondo)"/>
  <rect width="1024" height="1024" rx="232" fill="url(#brillo)"/>`;

const FONDO_CUADRADO = `
  <rect width="1024" height="1024" fill="url(#fondo)"/>
  <rect width="1024" height="1024" fill="url(#brillo)"/>`;

const svg = (contenido, ancho = 1024, alto = 1024, vista = '0 0 1024 1024') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}" viewBox="${vista}">${DEFS}${contenido}</svg>`;

// Logo completo
const LOGO = svg(FONDO + monograma());

// Icono adaptativo de Android: el primer plano tiene que caber en la zona segura
// (66 % central). @capacitor/assets ya lo encoge (inset 16,7 %), así que aquí solo se reduce un poco más (90 %) para que la G no roce la máscara redonda.
const ESCALA_ADAPTATIVO = 0.9;
const PRIMER_PLANO = svg(
  `<g transform="translate(512 512) scale(${ESCALA_ADAPTATIVO}) translate(-512 -512)">${monograma()}</g>`,
);
const FONDO_ADAPTATIVO = svg(FONDO_CUADRADO);

// Splash: logo centrado sobre el fondo de la app
function splash(fondo, texto) {
  const lado = 2732;
  const tam = 560;
  const x = (lado - tam) / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}" viewBox="0 0 ${lado} ${lado}">
    ${DEFS}
    <rect width="${lado}" height="${lado}" fill="${fondo}"/>
    <g transform="translate(${x} ${x - 60}) scale(${tam / 1024})">${FONDO}${monograma()}</g>
    <text x="${lado / 2}" y="${x + tam + 150}" text-anchor="middle" font-family="Segoe UI, Roboto, Arial, sans-serif"
      font-size="120" font-weight="700" fill="${texto}" letter-spacing="-2">Gestión Trabajo</text>
  </svg>`;
}

// Icono de notificaciones (monocromo blanco, sin fondo)
const NOTIFICACION = svg(monograma({ color: '#ffffff', puntosColor: '#ffffff', borde: null }));

// Favicon pequeño: trazos un poco más gruesos para que se lea a 16-32 px
const FAVICON = LOGO.replace('stroke-width="104"', 'stroke-width="116"');

// ---------------------------------------------------------------------------

fs.mkdirSync(ASSETS, { recursive: true });

const archivos = {
  'logo.svg': LOGO,
  'icon-foreground.svg': PRIMER_PLANO,
  'icon-background.svg': FONDO_ADAPTATIVO,
  'splash.svg': splash('#f4f5f9', '#121826'),
  'splash-dark.svg': splash('#0b0d12', '#eef0f6'),
  'notificacion.svg': NOTIFICACION,
};

for (const [nombre, contenido] of Object.entries(archivos)) {
  fs.writeFileSync(path.join(ASSETS, nombre), contenido.trim() + '\n');
}

// PNG de origen para @capacitor/assets
await sharp(Buffer.from(LOGO)).png().toFile(path.join(ASSETS, 'icon-only.png'));
await sharp(Buffer.from(PRIMER_PLANO)).png().toFile(path.join(ASSETS, 'icon-foreground.png'));
await sharp(Buffer.from(FONDO_ADAPTATIVO)).png().toFile(path.join(ASSETS, 'icon-background.png'));
await sharp(Buffer.from(archivos['splash.svg'])).png().toFile(path.join(ASSETS, 'splash.png'));
await sharp(Buffer.from(archivos['splash-dark.svg'])).png().toFile(path.join(ASSETS, 'splash-dark.png'));

// Web: favicon SVG + PNG
fs.writeFileSync(path.join(PUBLIC, 'favicon.svg'), FAVICON.trim() + '\n');
await sharp(Buffer.from(FAVICON)).resize(180, 180).png().toFile(path.join(PUBLIC, 'apple-touch-icon.png'));

// Iconos de la web (manifest.webmanifest)
fs.mkdirSync(path.join(PUBLIC, 'icons'), { recursive: true });
for (const lado of [48, 72, 96, 128, 192, 256, 512]) {
  await sharp(Buffer.from(lado <= 96 ? FAVICON : LOGO))
    .resize(lado, lado)
    .webp({ quality: 92 })
    .toFile(path.join(PUBLIC, 'icons', `icon-${lado}.webp`));
}

console.log('Logo e imágenes de origen generados en assets/ y public/.');
