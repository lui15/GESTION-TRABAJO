import { Injectable, signal } from '@angular/core';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../configuracion';
import { conTiempoLimite, traducirError } from '../utilidades/errores';

/**
 * Cliente de Supabase y sesión del usuario.
 *
 * - Comprueba la sesión al arrancar (máx. 10 s, como el panel original).
 * - `usuario` solo cambia cuando cambia el usuario (no al renovar el token),
 *   así las recargas y el tiempo real no se disparan de más.
 */
@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly configurado = !SUPABASE_URL.includes('PEGA_AQUI') && !SUPABASE_ANON_KEY.includes('PEGA_AQUI');

  readonly cliente: SupabaseClient;

  readonly usuario = signal<User | null>(null, {
    equal: (a, b) => (a?.id ?? null) === (b?.id ?? null),
  });

  /** true cuando ya se sabe si hay sesión o no. */
  readonly listo = signal(false);

  readonly errorInicio = signal('');

  private resolverListo!: () => void;

  readonly listoPromesa = new Promise<void>((resolver) => (this.resolverListo = resolver));

  constructor() {
    this.cliente = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    if (!this.configurado) {
      this.errorInicio.set('Configura la URL y la clave pública de Supabase en configuracion.ts.');
      this.marcarListo();
      return;
    }

    void this.iniciar();
  }

  private async iniciar(): Promise<void> {
    try {
      const { data, error } = await conTiempoLimite(
        this.cliente.auth.getSession(),
        10000,
        'TIMEOUT_SUPABASE',
      );

      if (error) {
        throw error;
      }

      this.usuario.set(data.session?.user ?? null);

      this.cliente.auth.onAuthStateChange((evento, sesion) => {
        // La sesión inicial ya se comprobó con getSession().
        if (evento === 'INITIAL_SESSION') {
          return;
        }

        // No llamar a Supabase dentro de este callback (puede bloquearse):
        // los efectos que dependen de `usuario` se ejecutan después.
        this.usuario.set(sesion?.user ?? null);
      });
    } catch (error) {
      console.error('ERROR AL INICIAR:', error);
      this.errorInicio.set(traducirError(error));
    } finally {
      this.marcarListo();
    }
  }

  private marcarListo(): void {
    this.listo.set(true);
    this.resolverListo();
  }

  /** Devuelve un mensaje de error, o null si ha ido bien. */
  async iniciarSesion(email: string, contrasena: string): Promise<string | null> {
    if (!email.trim() || !contrasena) {
      return 'Introduce tu correo y contraseña.';
    }

    try {
      const { data, error } = await this.cliente.auth.signInWithPassword({
        email: email.trim(),
        password: contrasena,
      });

      if (error) {
        throw error;
      }

      this.errorInicio.set('');
      this.usuario.set(data.user);

      return null;
    } catch (error) {
      return traducirError(error);
    }
  }

  async cerrarSesion(): Promise<string | null> {
    const { error } = await this.cliente.auth.signOut();

    if (error) {
      return 'No se pudo cerrar la sesión.';
    }

    this.usuario.set(null);

    return null;
  }
}
