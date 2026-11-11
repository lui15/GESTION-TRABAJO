import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonIcon,
  IonRefresher,
  IonRefresherContent,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent,
} from '@ionic/angular';

import { CANALES } from '../../datos/webs';
import { SolicitudesService } from '../../servicios/solicitudes.service';
import { TemaService } from '../../servicios/tema.service';
import { haceCuanto } from '../../utilidades/formato';

@Component({
  selector: 'app-por-web',
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonIcon, IonRefresher, IonRefresherContent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './por-web.page.css',
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar>
        <ion-title><span class="titulo-grande">Por web</span></ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content [fullscreen]="true">
      <ion-refresher slot="fixed" (ionRefresh)="recargar($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="ancho">
        <section class="totales">
          <div class="total">
            <strong>{{ totales().hoy }}</strong>
            <span>Hoy</span>
          </div>
          <div class="total">
            <strong>{{ totales().semana }}</strong>
            <span>Esta semana</span>
          </div>
          <div class="total destacado">
            <strong>{{ datos.pendientes() }}</strong>
            <span>Pendientes</span>
          </div>
        </section>

        <div class="rejilla">
          @for (t of tarjetas(); track t.web.canal; let i = $index) {
            <button
              type="button"
              class="tarjeta-web"
              [style.--web]="t.color"
              [style.--retraso]="i * 60 + 'ms'"
              (click)="abrir(t.web.source)"
            >
              <div class="cabeza">
                <span class="emoji" aria-hidden="true">{{ t.web.emoji }}</span>
                <div class="nombre">
                  <strong>{{ t.web.nombre }}</strong>
                  <span>{{ t.ultima ? 'Última: ' + t.ultima : 'Sin solicitudes aún' }}</span>
                </div>
                @if (t.r.pendientes > 0) {
                  <span class="globo">{{ t.r.pendientes }}</span>
                }
                <ion-icon name="chevron-forward" class="flecha" />
              </div>

              <div class="cifras">
                <div><strong>{{ t.r.hoy }}</strong><span>Hoy</span></div>
                <div><strong>{{ t.r.semana }}</strong><span>Semana</span></div>
                <div class="pend"><strong>{{ t.r.pendientes }}</strong><span>Pendientes</span></div>
                <div><strong>{{ t.r.total }}</strong><span>Total</span></div>
              </div>

              <div class="barra" aria-hidden="true">
                <span [style.width.%]="t.r.total ? (t.r.pendientes / t.r.total) * 100 : 0"></span>
              </div>
            </button>
          }
        </div>
      </div>
    </ion-content>
  `,
})
export class PorWebPage {
  protected readonly datos = inject(SolicitudesService);
  private readonly tema = inject(TemaService);
  private readonly router = inject(Router);

  /** Una tarjeta por web (Tramo y "Otra web" solo si tienen solicitudes). */
  protected readonly tarjetas = computed(() => {
    const porWeb = this.datos.porWeb();
    const oscuro = this.tema.oscuro();

    return CANALES.map((web) => {
      const r = porWeb.get(web.canal)!;

      return {
        web,
        r,
        color: oscuro ? web.colorOscuro : web.color,
        ultima: r.ultima ? haceCuanto(r.ultima).toLowerCase() : '',
      };
    }).filter((t) => t.r.total > 0 || (t.web.canal !== 'tramo' && t.web.canal !== 'otras'));
  });

  protected readonly totales = computed(() => {
    let hoy = 0;
    let semana = 0;

    for (const r of this.datos.porWeb().values()) {
      hoy += r.hoy;
      semana += r.semana;
    }

    return { hoy, semana };
  });

  protected abrir(source: string): void {
    // "Otra web" agrupa varios source: se abre la lista completa.
    const web = source === 'otras' ? null : source;

    void this.router.navigate(['/solicitudes'], {
      queryParams: web ? { web, t: Date.now() } : {},
    });
  }

  protected async recargar(evento: RefresherCustomEvent): Promise<void> {
    await this.datos.cargar(true);
    await evento.target.complete();
  }
}
