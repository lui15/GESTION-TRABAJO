import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { IonButton, IonIcon, IonSpinner } from '@ionic/angular';

import { AvisosService } from '../servicios/avisos.service';
import { HuellaService } from '../servicios/huella.service';
import { NotificacionesService } from '../servicios/notificaciones.service';
import { SupabaseService } from '../servicios/supabase.service';
import { LogoComponent } from './logo.component';

/** Pantalla que tapa la app hasta que se pone la huella. */
@Component({
  selector: 'app-bloqueo',
  imports: [IonButton, IonIcon, IonSpinner, LogoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bloqueo" role="dialog" aria-modal="true" aria-labelledby="bloqueo-titulo">
      <div class="centro">
        <app-logo [tamano]="72" />
        <h1 id="bloqueo-titulo">Gestión Trabajo</h1>
        <p class="email">{{ sb.usuario()?.email }}</p>

        <button
          type="button"
          class="huella"
          (click)="entrar()"
          [disabled]="huella.pidiendo()"
          aria-label="Entrar con huella"
        >
          @if (huella.pidiendo()) {
            <ion-spinner name="crescent" />
          } @else {
            <ion-icon name="finger-print" />
          }
        </button>
        <p class="ayuda">Toca para entrar con tu huella</p>

        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }
      </div>

      <ion-button fill="clear" class="contrasena" (click)="usarContrasena()">
        Entrar con contraseña
      </ion-button>
    </div>
  `,
  styles: `
    .bloqueo {
      position: fixed;
      inset: 0;
      /* Por encima de la app, por debajo de las alertas de Ionic (20000+). */
      z-index: 15000;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      padding: calc(48px + env(safe-area-inset-top)) 16px calc(24px + env(safe-area-inset-bottom));
      background:
        radial-gradient(700px 420px at 50% -10%, color-mix(in srgb, var(--ion-color-primary) 22%, transparent), transparent 65%),
        var(--gt-fondo);
      color: var(--gt-texto);
      animation: gt-aparecer 0.25s ease-out;
    }

    .centro {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      text-align: center;
      max-width: 360px;
    }

    h1 {
      margin: 14px 0 0;
      font-size: 1.5rem;
      font-weight: 750;
      letter-spacing: -0.02em;
    }

    .email {
      margin: 0 0 36px;
      color: var(--gt-tenue);
      font-size: 0.95rem;
    }

    .huella {
      display: grid;
      place-items: center;
      width: 96px;
      height: 96px;
      border: none;
      border-radius: 50%;
      background: color-mix(in srgb, var(--ion-color-primary) 14%, var(--gt-superficie));
      color: var(--ion-color-primary);
      box-shadow: 0 0 0 8px color-mix(in srgb, var(--ion-color-primary) 7%, transparent), var(--gt-sombra-md);
      cursor: pointer;
      transition: transform 0.15s ease;
    }

    .huella:active {
      transform: scale(0.94);
    }

    .huella:focus-visible {
      outline: 3px solid var(--ion-color-primary);
      outline-offset: 4px;
    }

    .huella ion-icon {
      font-size: 54px;
    }

    .ayuda {
      margin: 16px 0 0;
      color: var(--gt-texto-2);
      font-weight: 600;
    }

    .error {
      margin: 12px 0 0;
      padding: 8px 14px;
      border-radius: 12px;
      background: var(--gt-rojo-suave);
      color: var(--gt-rojo);
      font-size: 0.9rem;
    }

    .contrasena {
      --color: var(--gt-texto-2);
      font-weight: 600;
    }

    @media (prefers-reduced-motion: reduce) {
      .bloqueo {
        animation: none;
      }
    }
  `,
})
export class BloqueoComponent {
  protected readonly huella = inject(HuellaService);
  protected readonly sb = inject(SupabaseService);
  private readonly noti = inject(NotificacionesService);
  private readonly avisos = inject(AvisosService);

  protected readonly error = signal('');

  protected async entrar(): Promise<void> {
    this.error.set('');
    this.error.set((await this.huella.desbloquear()) ?? '');
  }

  /** Cierra la sesión para volver a entrar con email y contraseña. */
  protected async usarContrasena(): Promise<void> {
    const ok = await this.avisos.confirmar(
      '¿Entrar con contraseña?',
      'Se cerrará la sesión y tendrás que escribir tu email y contraseña. La huella seguirá activada para la próxima vez.',
      'Continuar',
    );

    if (!ok) {
      return;
    }

    await this.noti.antesDeCerrarSesion().catch(() => undefined);
    await this.sb.cerrarSesion();
    this.huella.bloqueada.set(false);
  }
}
