import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTitle,
  IonToggle,
  IonToolbar,
} from '@ionic/angular';

import { LogoComponent } from '../../componentes/logo.component';
import { CANALES } from '../../datos/webs';
import { NotificacionesService } from '../../servicios/notificaciones.service';
import { AvisosService } from '../../servicios/avisos.service';
import { SupabaseService } from '../../servicios/supabase.service';
import { COLORES, TemaService } from '../../servicios/tema.service';
import { iniciales } from '../../utilidades/formato';

@Component({
  selector: 'app-ajustes',
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonList,
    IonListHeader,
    IonItem,
    IonLabel,
    IonNote,
    IonSelect,
    IonSelectOption,
    IonSpinner,
    IonToggle,
    IonIcon,
    IonButton,
    LogoComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './ajustes.page.css',
  templateUrl: './ajustes.page.html',
})
export class AjustesPage {
  protected readonly sb = inject(SupabaseService);
  protected readonly tema = inject(TemaService);
  protected readonly avisos = inject(AvisosService);

  protected readonly noti = inject(NotificacionesService);

  protected readonly colores = COLORES;
  protected readonly canales = CANALES;
  protected readonly webPrueba = signal('mudanzas360');
  protected readonly activando = signal(false);

  /** Texto del estado de las notificaciones en este dispositivo. */
  protected readonly estado = computed<{ tipo: 'ok' | 'mal' | 'info'; texto: string }>(() => {
    if (!this.noti.esNativo) {
      return {
        tipo: 'info',
        texto:
          'En la web te avisamos con un sonido mientras el panel esté abierto. ' +
          'Las notificaciones push llegan a la app Android.',
      };
    }

    if (this.noti.firebaseConfigurado() === false) {
      return {
        tipo: 'mal',
        texto: 'Esta versión de la app se compiló sin Firebase (google-services.json). Ver la guía.',
      };
    }

    if (this.noti.permiso() === 'denied') {
      return {
        tipo: 'mal',
        texto: 'Las notificaciones están bloqueadas. Actívalas en Ajustes de Android → Apps → Gestión Trabajo.',
      };
    }

    if (this.noti.activas()) {
      return { tipo: 'ok', texto: 'Activadas. Este móvil recibirá un aviso por cada solicitud nueva.' };
    }

    return { tipo: 'info', texto: 'Aún no están activadas en este móvil.' };
  });

  protected readonly email = computed(() => this.sb.usuario()?.email ?? '');
  protected readonly iniciales = computed(() => iniciales(this.email()));

  protected async salir(): Promise<void> {
    const ok = await this.avisos.confirmar(
      '¿Cerrar sesión?',
      'Dejarás de recibir avisos en este dispositivo hasta que vuelvas a entrar.',
      'Cerrar sesión',
    );

    if (!ok) {
      return;
    }

    await this.antesDeSalir();

    const error = await this.sb.cerrarSesion();

    if (error) {
      await this.avisos.error(error);
    }
  }

  protected async antesDeSalir(): Promise<void> {
    await this.noti.antesDeCerrarSesion();
  }

  protected async activar(): Promise<void> {
    this.activando.set(true);

    try {
      const ok = await this.noti.activar();

      if (ok) {
        await this.avisos.exito('Notificaciones activadas.');
      } else if (this.noti.permiso() === 'denied') {
        await this.avisos.error('Permiso denegado. Puedes activarlo en los ajustes de Android.');
      }
    } finally {
      this.activando.set(false);
    }
  }

  protected async cambiarWeb(canal: string, activa: boolean): Promise<void> {
    try {
      await this.noti.setWebActiva(canal, activa);
    } catch (error) {
      await this.avisos.error((error as Error).message);
    }
  }

  protected async enviarPrueba(): Promise<void> {
    try {
      await this.avisos.exito(await this.noti.enviarPrueba(this.webPrueba()));
    } catch (error) {
      await this.avisos.error((error as Error).message);
    }
  }

  protected async avisoLocal(): Promise<void> {
    try {
      await this.noti.avisoLocalDePrueba(this.webPrueba());
      await this.avisos.exito('Aviso enviado: míralo en la barra de notificaciones y tócalo.');
    } catch (error) {
      await this.avisos.error((error as Error).message);
    }
  }
}
