import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
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
  IonTitle,
  IonToggle,
  IonToolbar,
} from '@ionic/angular';

import { LogoComponent } from '../../componentes/logo.component';
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

  protected readonly colores = COLORES;

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

  /** Se amplía en la fase de notificaciones (borrar el token del dispositivo). */
  protected async antesDeSalir(): Promise<void> {
    return;
  }
}
