import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IonBadge, IonIcon, IonLabel, IonTabBar, IonTabButton, IonTabs } from '@ionic/angular';

import { SolicitudesService } from '../../servicios/solicitudes.service';

@Component({
  selector: 'app-pestanas',
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, IonBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './pestanas.page.css',
  template: `
    <ion-tabs>
      <ion-tab-bar slot="bottom" id="barra-pestanas">
        <ion-tab-button tab="solicitudes">
          <ion-icon name="file-tray-full-outline" aria-hidden="true" />
          <ion-label>Solicitudes</ion-label>
          @if (solicitudes.pendientes() > 0) {
            <ion-badge color="danger">{{ solicitudes.pendientes() > 99 ? '99+' : solicitudes.pendientes() }}</ion-badge>
          }
        </ion-tab-button>

        <ion-tab-button tab="por-web">
          <ion-icon name="grid-outline" aria-hidden="true" />
          <ion-label>Por web</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="ajustes">
          <ion-icon name="settings-outline" aria-hidden="true" />
          <ion-label>Ajustes</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  `,
})
export class PestanasPage {
  protected readonly solicitudes = inject(SolicitudesService);
}
