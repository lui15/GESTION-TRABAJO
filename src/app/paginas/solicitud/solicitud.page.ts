import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  HostListener,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { Router } from '@angular/router';
import { Clipboard } from '@capacitor/clipboard';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonSpinner,
  IonTitle,
  IonToolbar,
  NavController,
} from '@ionic/angular';

import { colorWeb, getWeb } from '../../datos/webs';
import { Solicitud } from '../../modelos/solicitud';
import { AvisosService } from '../../servicios/avisos.service';
import { SolicitudesService } from '../../servicios/solicitudes.service';
import { TemaService } from '../../servicios/tema.service';
import {
  esPrueba,
  extraerCampos,
  fechaCompleta,
  haceCuanto,
  referenciaCorta,
  resumenTarjeta,
  seccionesDetalle,
  textoParaCopiar,
  urlMaps,
  urlTelefono,
  urlWhatsapp,
} from '../../utilidades/formato';

@Component({
  selector: 'app-solicitud',
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonBackButton,
    IonIcon,
    IonContent,
    IonFooter,
    IonSpinner,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './solicitud.page.css',
  templateUrl: './solicitud.page.html',
})
export class SolicitudPage {
  private readonly datos = inject(SolicitudesService);
  private readonly avisos = inject(AvisosService);
  private readonly tema = inject(TemaService);
  private readonly router = inject(Router);
  private readonly nav = inject(NavController);

  /** Parámetro :id de la ruta. */
  readonly id = input.required<string>();

  protected readonly buscando = signal(false);
  protected readonly ocupado = signal(false);
  protected readonly direccion = signal<'' | 'siguiente' | 'anterior'>('');

  protected readonly s = computed<Solicitud | undefined>(() => this.datos.buscar(this.id()));
  protected readonly datosCargados = this.datos.cargadoUnaVez;

  protected readonly web = computed(() => getWeb(this.s()?.source));
  protected readonly color = computed(() => colorWeb(this.s()?.source, this.tema.oscuro()));
  protected readonly resumen = computed(() => (this.s() ? resumenTarjeta(this.s()!) : ''));
  protected readonly campos = computed(() => (this.s() ? extraerCampos(this.s()!) : null));
  protected readonly secciones = computed(() => (this.s() ? seccionesDetalle(this.s()!) : []));
  protected readonly seccion = (id: string) => this.secciones().find((x) => x.id === id)?.filas ?? [];

  protected readonly enlaceWhatsapp = computed(() => (this.s() ? urlWhatsapp(this.s()!) : ''));
  protected readonly enlaceTelefono = computed(() => urlTelefono(this.s()?.phone));
  protected readonly enlaceMaps = computed(() => (this.s() ? urlMaps(this.s()!) : ''));
  protected readonly prueba = computed(() => (this.s() ? esPrueba(this.s()!) : false));

  // Anterior / siguiente según el orden de la lista
  // (si se abre directamente, p. ej. desde una notificación, se usa el orden completo)
  private readonly orden = computed(() => {
    const visible = this.datos.ordenVisible();

    return visible.includes(this.id()) ? visible : this.datos.solicitudes().map((x) => x.id);
  });
  private readonly posicion = computed(() => this.orden().indexOf(this.id()));
  protected readonly contador = computed(() =>
    this.posicion() >= 0 ? `${this.posicion() + 1} / ${this.orden().length}` : '',
  );
  protected readonly anteriorId = computed(() =>
    this.posicion() > 0 ? this.orden()[this.posicion() - 1] : undefined,
  );
  protected readonly siguienteId = computed(() =>
    this.posicion() >= 0 ? this.orden()[this.posicion() + 1] : undefined,
  );

  protected readonly fechaCompleta = fechaCompleta;
  protected readonly haceCuanto = haceCuanto;
  protected readonly referenciaCorta = referenciaCorta;

  constructor() {
    // Si se abre desde una notificación y aún no está en la lista, cargarla.
    effect(() => {
      const id = this.id();
      const cargado = this.datos.cargadoUnaVez();

      untracked(() => {
        if (!this.datos.buscar(id) && cargado && !this.buscando()) {
          this.buscando.set(true);
          void this.datos.cargarUna(id).finally(() => this.buscando.set(false));
        }
      });
    });
  }

  // =====================================================
  // TECLADO (escritorio): ← → para navegar, Esc para volver
  // =====================================================

  @HostListener('document:keydown', ['$event'])
  protected alTeclear(evento: KeyboardEvent): void {
    const destino = evento.target as HTMLElement | null;

    if (destino?.closest('input, textarea, ion-alert')) {
      return;
    }

    if (evento.key === 'ArrowRight') this.ir(1);
    else if (evento.key === 'ArrowLeft') this.ir(-1);
    else if (evento.key === 'Escape') this.volver();
  }

  protected ir(sentido: 1 | -1): void {
    const id = sentido === 1 ? this.siguienteId() : this.anteriorId();

    if (!id) {
      return;
    }

    this.direccion.set(sentido === 1 ? 'siguiente' : 'anterior');
    void this.router.navigate(['/solicitud', id], { replaceUrl: true });
  }

  protected volver(): void {
    void this.nav.navigateBack('/solicitudes');
  }

  // =====================================================
  // ACCIONES
  // =====================================================

  protected async copiar(texto: string | null | undefined, mensaje: string): Promise<void> {
    if (!texto) {
      return;
    }

    try {
      await Clipboard.write({ string: texto });
      await this.avisos.vibrar();
      await this.avisos.exito(mensaje);
    } catch {
      await this.avisos.error('No se pudo copiar al portapapeles.');
    }
  }

  protected copiarTodo(): void {
    const s = this.s();

    if (s) {
      void this.copiar(textoParaCopiar(s), 'Datos copiados.');
    }
  }

  protected async alternarRevisada(): Promise<void> {
    const s = this.s();

    if (!s || this.ocupado()) {
      return;
    }

    this.ocupado.set(true);

    try {
      if (s.reviewed_at) {
        await this.datos.marcarPendiente(s.id);
        await this.avisos.vibrar();
        await this.avisos.exito('Solicitud devuelta a pendientes.');
      } else {
        await this.datos.marcarRevisadas([s.id]);
        await this.avisos.vibrar('exito');
        await this.avisos.exito('Solicitud marcada como revisada.');
      }
    } catch (error) {
      await this.avisos.error((error as Error).message);
    } finally {
      this.ocupado.set(false);
    }
  }

  protected async eliminar(): Promise<void> {
    const s = this.s();

    if (!s) {
      return;
    }

    const ok = await this.avisos.confirmar(
      '¿Eliminar esta solicitud?',
      `Se eliminará la solicitud de ${s.name || 'este cliente'}. Esta acción no se puede deshacer.`,
      'Eliminar',
    );

    if (!ok) {
      return;
    }

    // Ir a la siguiente (o anterior) antes de borrar, como en una bandeja de correo.
    const siguiente = this.siguienteId() ?? this.anteriorId();

    this.ocupado.set(true);

    try {
      await this.datos.eliminar([s.id]);
      await this.avisos.vibrar('aviso');
      await this.avisos.exito('Solicitud eliminada.');

      if (siguiente) {
        void this.router.navigate(['/solicitud', siguiente], { replaceUrl: true });
      } else {
        this.volver();
      }
    } catch (error) {
      await this.avisos.error((error as Error).message);
    } finally {
      this.ocupado.set(false);
    }
  }
}
