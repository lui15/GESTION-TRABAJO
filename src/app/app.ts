import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { IonApp, IonRouterOutlet } from '@ionic/angular';

import { SolicitudesService } from './servicios/solicitudes.service';
import { SupabaseService } from './servicios/supabase.service';
import { TemaService } from './servicios/tema.service';
import { registrarIconos } from './utilidades/iconos';

@Component({
  selector: 'app-root',
  imports: [IonApp, IonRouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-app>
      <ion-router-outlet />
    </ion-app>
  `,
})
export class App {
  private readonly sb = inject(SupabaseService);
  private readonly router = inject(Router);

  constructor() {
    registrarIconos();

    // Arrancan con la app: tema guardado y lista en tiempo real.
    inject(TemaService);
    inject(SolicitudesService);

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
      void this.sb.listoPromesa.then(() => SplashScreen.hide().catch(() => undefined));
    }
  }
}
