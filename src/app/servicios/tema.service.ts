import { computed, effect, Injectable, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

export type ModoTema = 'light' | 'dark' | 'auto';

export interface OpcionColor {
  id: string;
  nombre: string;
  claro: string;
  oscuro: string;
}

/** Mismos 8 colores del panel anterior. */
export const COLORES: readonly OpcionColor[] = [
  { id: 'indigo', nombre: 'Índigo', claro: '#4f46e5', oscuro: '#7c74ff' },
  { id: 'blue', nombre: 'Azul', claro: '#2563eb', oscuro: '#4f8dff' },
  { id: 'teal', nombre: 'Turquesa', claro: '#0d9488', oscuro: '#2dd4bf' },
  { id: 'green', nombre: 'Verde', claro: '#16a34a', oscuro: '#4ade80' },
  { id: 'orange', nombre: 'Naranja', claro: '#ea580c', oscuro: '#fb923c' },
  { id: 'rose', nombre: 'Rosa', claro: '#e11d48', oscuro: '#fb7185' },
  { id: 'violet', nombre: 'Violeta', claro: '#7c3aed', oscuro: '#a78bfa' },
  { id: 'slate', nombre: 'Grafito', claro: '#334155', oscuro: '#94a3b8' },
];

// Mismas claves que el panel anterior: se conservan las preferencias guardadas.
const CLAVE_MODO = 'central-theme';
const CLAVE_COLOR = 'central-accent';

const FONDO_CLARO = '#f4f5f9';
const FONDO_OSCURO = '#0b0d12';

@Injectable({ providedIn: 'root' })
export class TemaService {
  readonly modo = signal<ModoTema>(leerModo());
  readonly color = signal<string>(leerColor());
  private readonly sistemaOscuro = signal(false);

  readonly oscuro = computed(
    () => this.modo() === 'dark' || (this.modo() === 'auto' && this.sistemaOscuro()),
  );

  readonly opcionColor = computed(() => COLORES.find((c) => c.id === this.color()) ?? COLORES[0]);

  constructor() {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const consulta = window.matchMedia('(prefers-color-scheme: dark)');

      this.sistemaOscuro.set(consulta.matches);
      consulta.addEventListener?.('change', (e) => this.sistemaOscuro.set(e.matches));
    }

    effect(() => this.aplicar(this.oscuro(), this.opcionColor()));
  }

  setModo(modo: ModoTema): void {
    this.modo.set(modo);
    guardar(CLAVE_MODO, modo);
  }

  /** Interruptor de Ajustes: fija claro u oscuro (deja de seguir al sistema). */
  setOscuro(oscuro: boolean): void {
    this.setModo(oscuro ? 'dark' : 'light');
  }

  setColor(id: string): void {
    this.color.set(id);
    guardar(CLAVE_COLOR, id);
  }

  private aplicar(oscuro: boolean, opcion: OpcionColor): void {
    if (typeof document === 'undefined') {
      return;
    }

    const raiz = document.documentElement;

    raiz.classList.toggle('ion-palette-dark', oscuro);
    raiz.dataset['theme'] = oscuro ? 'dark' : 'light';

    // Color principal de Ionic (--ion-color-primary y variantes).
    const base = oscuro ? opcion.oscuro : opcion.claro;
    const rgb = hexARgb(base);

    raiz.style.setProperty('--ion-color-primary', base);
    raiz.style.setProperty('--ion-color-primary-rgb', rgb.join(', '));
    raiz.style.setProperty('--ion-color-primary-contrast', contraste(rgb));
    raiz.style.setProperty('--ion-color-primary-contrast-rgb', contraste(rgb) === '#ffffff' ? '255, 255, 255' : '0, 0, 0');
    raiz.style.setProperty('--ion-color-primary-shade', mezclar(rgb, [0, 0, 0], 0.12));
    raiz.style.setProperty('--ion-color-primary-tint', mezclar(rgb, [255, 255, 255], 0.1));

    const fondo = oscuro ? FONDO_OSCURO : FONDO_CLARO;

    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
      meta.setAttribute('content', fondo);
    });

    if (Capacitor.isNativePlatform()) {
      void StatusBar.setStyle({ style: oscuro ? Style.Dark : Style.Light }).catch(() => undefined);
      void StatusBar.setBackgroundColor({ color: fondo }).catch(() => undefined);
    }
  }
}

function leerModo(): ModoTema {
  const valor = leer(CLAVE_MODO);

  return valor === 'light' || valor === 'dark' || valor === 'auto' ? valor : 'auto';
}

function leerColor(): string {
  const valor = leer(CLAVE_COLOR);

  return valor && COLORES.some((c) => c.id === valor) ? valor : 'indigo';
}

function leer(clave: string): string | null {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}

function guardar(clave: string, valor: string): void {
  try {
    localStorage.setItem(clave, valor);
  } catch {
    // Almacenamiento no disponible.
  }
}

function hexARgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);

  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mezclar(rgb: [number, number, number], con: [number, number, number], p: number): string {
  const r = rgb.map((v, i) => Math.round(v * (1 - p) + con[i] * p));

  return '#' + r.map((v) => v.toString(16).padStart(2, '0')).join('');
}

function contraste([r, g, b]: [number, number, number]): string {
  return (r * 299 + g * 587 + b * 114) / 1000 > 160 ? '#000000' : '#ffffff';
}
