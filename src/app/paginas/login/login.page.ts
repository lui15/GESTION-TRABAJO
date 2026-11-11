import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonButton, IonContent, IonIcon, IonInput, IonSpinner } from '@ionic/angular';

import { LogoComponent } from '../../componentes/logo.component';
import { NotificacionesService } from '../../servicios/notificaciones.service';
import { SupabaseService } from '../../servicios/supabase.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule, IonContent, IonInput, IonButton, IonIcon, IonSpinner, LogoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './login.page.css',
  templateUrl: './login.page.html',
})
export class LoginPage {
  protected readonly sb = inject(SupabaseService);
  private readonly router = inject(Router);
  private readonly noti = inject(NotificacionesService);

  protected email = '';
  protected contrasena = '';
  protected readonly enviando = signal(false);
  protected readonly error = signal('');

  async entrar(): Promise<void> {
    if (this.enviando()) {
      return;
    }

    this.error.set('');
    this.enviando.set(true);

    const error = await this.sb.iniciarSesion(this.email, this.contrasena);

    this.enviando.set(false);

    if (error) {
      this.error.set(error);
      return;
    }

    this.contrasena = '';

    await this.router.navigateByUrl(this.destinoTrasEntrar(), { replaceUrl: true });
  }

  /** En Android, la primera vez se explica para qué sirven las notificaciones. */
  protected destinoTrasEntrar(): string {
    return this.noti.necesitaPantallaPrevia() ? '/permiso-notificaciones' : '/solicitudes';
  }
}
