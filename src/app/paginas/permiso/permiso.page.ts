import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonButton, IonContent, IonIcon, IonSpinner } from '@ionic/angular';

import { LogoComponent } from '../../componentes/logo.component';
import { WEBS } from '../../datos/webs';
import { NotificacionesService } from '../../servicios/notificaciones.service';

/** Pantalla previa al permiso de notificaciones (se muestra una vez tras el login). */
@Component({
  selector: 'app-permiso',
  imports: [IonContent, IonButton, IonIcon, IonSpinner, LogoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './permiso.page.css',
  template: `
    <ion-content [fullscreen]="true" class="fondo">
      <main class="contenedor">
        <div class="ilustracion" aria-hidden="true">
          <app-logo [tamano]="88" />
          <span class="campana"><ion-icon name="notifications-outline" /></span>
        </div>

        <h1>Entérate al momento de cada trabajo</h1>
        <p class="sub">
          Te avisaremos en cuanto un cliente pida presupuesto en tus webs, aunque tengas la
          app cerrada.
        </p>

        <ul class="ejemplos">
          @for (w of webs; track w.source; let i = $index) {
            <li [style.--web]="w.color" [style.--retraso]="i * 90 + 'ms'">
              <span class="emoji">{{ w.emoji }}</span>
              <div>
                <strong>{{ w.nombre }} · Nueva solicitud</strong>
                <span>{{ ejemplos[i] }}</span>
              </div>
            </li>
          }
        </ul>

        <p class="nota">
          Podrás elegir de qué webs quieres avisos, o desactivarlos, desde Ajustes.
        </p>

        <ion-button expand="block" size="large" (click)="activar()" [disabled]="pidiendo()">
          @if (pidiendo()) {
            <ion-spinner name="crescent" />
          } @else {
            <ion-icon slot="start" name="notifications-outline" />
            Activar notificaciones
          }
        </ion-button>
        <ion-button expand="block" fill="clear" color="medium" (click)="ahoraNo()">
          Ahora no
        </ion-button>
      </main>
    </ion-content>
  `,
})
export class PermisoPage {
  private readonly noti = inject(NotificacionesService);
  private readonly router = inject(Router);

  protected readonly webs = WEBS.filter((w) => w.source !== 'tramo');
  protected readonly ejemplos = [
    'Piso 3 hab. · Chamberí → Getafe · Laura',
    'Reforma de baño · Carabanchel · Carlos',
    'Montaje de armario · Calle Alcalá · Marta',
  ];
  protected readonly pidiendo = signal(false);

  async activar(): Promise<void> {
    this.pidiendo.set(true);

    try {
      await this.noti.activar();
    } finally {
      this.pidiendo.set(false);
      void this.router.navigateByUrl('/solicitudes', { replaceUrl: true });
    }
  }

  ahoraNo(): void {
    this.noti.marcarPreguntado();
    void this.router.navigateByUrl('/solicitudes', { replaceUrl: true });
  }
}
