import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { IonIcon } from '@ionic/angular';

import { colorWeb, getWeb } from '../datos/webs';
import { Solicitud } from '../modelos/solicitud';
import { TemaService } from '../servicios/tema.service';
import { esPrueba, haceCuanto, resumenTarjeta } from '../utilidades/formato';

@Component({
  selector: 'app-tarjeta-solicitud',
  imports: [IonIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './tarjeta-solicitud.component.css',
  host: {
    class: 'tarjeta',
    '[class.nueva]': '!solicitud().reviewed_at',
    '[class.seleccionada]': 'seleccionada()',
    '[style.--web]': 'color()',
  },
  template: `
    @if (seleccionando()) {
      <span class="casilla" [class.marcada]="seleccionada()" aria-hidden="true">
        <ion-icon name="checkmark-circle" />
      </span>
    }

    <div class="avatar" aria-hidden="true">
      <span class="emoji">{{ web().emoji }}</span>
      @if (!solicitud().reviewed_at) {
        <span class="punto-nueva"></span>
      }
    </div>

    <div class="cuerpo">
      <div class="linea-1">
        <strong class="nombre">{{ solicitud().name || 'Cliente sin nombre' }}</strong>
        <time class="hora" [attr.datetime]="solicitud().created_at">
          {{ hace() }}
        </time>
      </div>

      <p class="resumen">{{ resumen() }}</p>

      <div class="linea-3">
        <span class="chip-web">{{ web().nombreCorto }}</span>
        @if (prueba()) {
          <span class="chip-prueba">Prueba</span>
        }
        @if (solicitud().reviewed_at) {
          <span class="estado revisada"><ion-icon name="checkmark-done-outline" /> Revisada</span>
        } @else {
          <span class="estado">Nueva</span>
        }
      </div>
    </div>
  `,
})
export class TarjetaSolicitudComponent {
  private readonly tema = inject(TemaService);

  readonly solicitud = input.required<Solicitud>();
  /** Marca de tiempo para refrescar "hace X min". */
  readonly ahora = input(Date.now());
  readonly seleccionando = input(false);
  readonly seleccionada = input(false);

  protected readonly web = computed(() => getWeb(this.solicitud().source));
  protected readonly color = computed(() => colorWeb(this.solicitud().source, this.tema.oscuro()));
  protected readonly resumen = computed(
    () => resumenTarjeta(this.solicitud()) || 'Solicitud de presupuesto',
  );
  protected readonly hace = computed(() => haceCuanto(this.solicitud().created_at, this.ahora()));
  protected readonly prueba = computed(() => esPrueba(this.solicitud()));
}
