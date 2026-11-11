import { effect, inject, Injectable, signal } from '@angular/core';
import { BiometricAuth, BiometryError, BiometryErrorType } from '@aparajita/capacitor-biometric-auth';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

import { SupabaseService } from './supabase.service';

const CLAVE = 'gt-huella';

/** Si la app pasa más de este tiempo en segundo plano, vuelve a pedir la huella. */
const MARGEN_MS = 60_000;

/**
 * Entrar con huella (solo en la app Android / iOS).
 *
 * La contraseña solo se usa la primera vez: la sesión de Supabase ya queda
 * guardada en el móvil, y la huella es el candado que la protege. No se
 * guarda ninguna contraseña.
 *
 * - Al abrir la app, o al volver tras más de 1 minuto fuera, se bloquea.
 * - Si la huella falla, se puede usar el PIN o patrón del móvil, o entrar
 *   con la contraseña (cierra la sesión).
 */
@Injectable({ providedIn: 'root' })
export class HuellaService {
  private readonly sb = inject(SupabaseService);

  readonly esNativo = Capacitor.isNativePlatform();

  /** El usuario ha activado "Entrar con huella" en este móvil. */
  readonly activa = signal(this.esNativo && leer() === '1');

  /** La pantalla de bloqueo está delante de la app. */
  readonly bloqueada = signal(this.activa());

  /** Hay un diálogo de huella abierto. */
  readonly pidiendo = signal(false);

  private enSegundoPlanoDesde = 0;

  constructor() {
    if (!this.esNativo) {
      return;
    }

    // Sin sesión no hay nada que proteger: el login ya pide la contraseña.
    effect(() => {
      if (this.sb.listo() && !this.sb.usuario()) {
        this.bloqueada.set(false);
      }
    });

    void App.addListener('pause', () => {
      this.enSegundoPlanoDesde = Date.now();
    });

    void App.addListener('resume', () => {
      // El propio diálogo de la huella puede pausar la app: no volver a bloquear.
      if (this.pidiendo() || !this.activa() || !this.sb.usuario()) {
        return;
      }

      if (this.enSegundoPlanoDesde && Date.now() - this.enSegundoPlanoDesde > MARGEN_MS) {
        this.bloqueada.set(true);
        void this.desbloquear();
      }
    });
  }

  /** ¿Tiene el móvil huella (o cara) configurada? Devuelve el motivo si no. */
  async disponible(): Promise<{ ok: boolean; motivo: string }> {
    if (!this.esNativo) {
      return { ok: false, motivo: 'La huella solo está disponible en la app del móvil.' };
    }

    try {
      const r = await BiometricAuth.checkBiometry();

      if (r.isAvailable) {
        return { ok: true, motivo: '' };
      }

      if (r.code === BiometryErrorType.biometryNotEnrolled) {
        return { ok: false, motivo: 'Primero registra tu huella en los ajustes de Android (Seguridad).' };
      }

      return { ok: false, motivo: 'Este móvil no tiene lector de huella disponible.' };
    } catch {
      return { ok: false, motivo: 'No se pudo comprobar el lector de huella.' };
    }
  }

  /** Activa la huella tras comprobarla una vez. Devuelve un error o null. */
  async activar(): Promise<string | null> {
    const { ok, motivo } = await this.disponible();

    if (!ok) {
      return motivo;
    }

    const resultado = await this.pedir('Confirma tu huella para activarla');

    if (resultado !== 'ok') {
      return resultado === 'cancelado' ? 'No se ha activado la huella.' : resultado;
    }

    guardar('1');
    this.activa.set(true);

    return null;
  }

  desactivar(): void {
    guardar('0');
    this.activa.set(false);
    this.bloqueada.set(false);
  }

  /** Pide la huella y, si es correcta, quita el bloqueo. */
  async desbloquear(): Promise<string | null> {
    if (this.pidiendo()) {
      return null;
    }

    const resultado = await this.pedir('Entra en Gestión Trabajo');

    if (resultado === 'ok') {
      this.bloqueada.set(false);
      return null;
    }

    return resultado === 'cancelado' ? null : resultado;
  }

  private async pedir(subtitulo: string): Promise<'ok' | 'cancelado' | string> {
    this.pidiendo.set(true);

    try {
      await BiometricAuth.authenticate({
        reason: subtitulo,
        androidTitle: 'Gestión Trabajo',
        androidSubtitle: subtitulo,
        cancelTitle: 'Cancelar',
        // Si la huella falla varias veces, deja usar el PIN o patrón del móvil.
        allowDeviceCredential: true,
        androidConfirmationRequired: false,
      });

      return 'ok';
    } catch (error) {
      const codigo = error instanceof BiometryError ? error.code : BiometryErrorType.none;

      if (
        codigo === BiometryErrorType.userCancel ||
        codigo === BiometryErrorType.appCancel ||
        codigo === BiometryErrorType.systemCancel
      ) {
        return 'cancelado';
      }

      if (codigo === BiometryErrorType.biometryLockout) {
        return 'Demasiados intentos. Espera un poco o entra con la contraseña.';
      }

      return 'No se ha reconocido. Inténtalo otra vez.';
    } finally {
      // Deja pasar el "resume" que provoca el propio diálogo.
      setTimeout(() => this.pidiendo.set(false), 800);
    }
  }
}

function leer(): string | null {
  try {
    return localStorage.getItem(CLAVE);
  } catch {
    return null;
  }
}

function guardar(valor: string): void {
  try {
    localStorage.setItem(CLAVE, valor);
  } catch {
    // Sin almacenamiento: la preferencia dura hasta cerrar la app.
  }
}
