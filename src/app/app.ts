import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { IonApp, IonRouterOutlet } from '@ionic/angular';

import { BloqueoComponent } from './componentes/bloqueo.component';
import { HuellaService } from './servicios/huella.service';
import { NotificacionesService } from './servicios/notificaciones.service';
import { SolicitudesService } from './servicios/solicitudes.service';
import { SupabaseService } from './servicios/supabase.service';
import { TemaService } from './servicios/tema.service';
import { registrarIconos } from './utilidades/iconos';

@Component({
  selector: 'app-root',
  imports: [IonApp, IonRouterOutlet, BloqueoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-app>
      <ion-router-outlet [attr.aria-hidden]="tapada() ? 'true' : null" [attr.inert]="tapada() ? '' : null" />
      @if (tapada()) {
        <app-bloqueo />
      }
    </ion-app>
  `,
})
export class App {
  private readonly sb = inject(SupabaseService);
  private readonly router = inject(Router);
  private readonly huella = inject(HuellaService);

  /** La huella está activada, hay sesión y aún no se ha puesto. */
  protected readonly tapada = computed(
    () => this.huella.bloqueada() && (!this.sb.listo() || !!this.sb.usuario()),
  );

  constructor() {
    registrarIconos();

    // Arrancan con la app: tema guardado y lista en tiempo real.
    inject(TemaService);
    inject(SolicitudesService);

    // Notificaciones: canales, permisos y escucha de avisos (solo en Android).
    void inject(NotificacionesService).inicializar();

    // Al cerrar sesión (aquí o en otro dispositivo), volver al login.
    let habiaUsuario = false;

    effect(() => {
      const usuario = this.sb.usuario();

      if (!this.sb.listo()) {
        return;
      }

      if (habiaUsuario && !usuario) {
        void this.router.navigateByUrl('/login', { replaceUrl: true });
      }

      habiaUsuario = !!usuario;
    });

    if (Capacitor.isNativePlatform()) {
      void this.sb.listoPromesa.then(async () => {
        await SplashScreen.hide().catch(() => undefined);

        // Al abrir la app con la huella activada, pedirla directamente.
        if (this.tapada()) {
          await this.huella.desbloquear();
        }
      });
    }
  }
}
