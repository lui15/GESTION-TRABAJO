import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonButton, IonContent, IonIcon, IonInput, IonSpinner } from '@ionic/angular';

import { LogoComponent } from '../../componentes/logo.component';
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

  /** Se sobrescribe en la fase de notificaciones (pantalla previa al permiso). */
  protected destinoTrasEntrar(): string {
    return '/solicitudes';
  }
}
