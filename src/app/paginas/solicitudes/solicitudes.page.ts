import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonList,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent,
} from '@ionic/angular';

import { TarjetaSolicitudComponent } from '../../componentes/tarjeta-solicitud.component';
import { colorWeb, getWeb, WEBS } from '../../datos/webs';
import { FiltroEstado, GrupoSolicitudes, Orden, Solicitud } from '../../modelos/solicitud';
import { AvisosService } from '../../servicios/avisos.service';
import { SolicitudesService } from '../../servicios/solicitudes.service';
import { TemaService } from '../../servicios/tema.service';
import {
  detallesVisibles,
  formatearValor,
  grupoFecha,
  urlTelefono,
  urlWhatsapp,
} from '../../utilidades/formato';

const CLAVE_ORDEN = 'central-sort';

@Component({
  selector: 'app-solicitudes',
  imports: [
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonIcon,
    IonContent,
    IonFooter,
    IonList,
    IonItem,
    IonItemSliding,
    IonItemOptions,
    IonItemOption,
    IonLabel,
    IonRefresher,
    IonRefresherContent,
    IonSearchbar,
    IonSegment,
    IonSegmentButton,
    IonSelect,
    IonSelectOption,
    IonSkeletonText,
    TarjetaSolicitudComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './solicitudes.page.css',
  templateUrl: './solicitudes.page.html',
})
export class SolicitudesPage {
  protected readonly datos = inject(SolicitudesService);
  private readonly avisos = inject(AvisosService);
  private readonly tema = inject(TemaService);
  private readonly router = inject(Router);

  protected readonly webs = WEBS;

  // Filtros
  protected readonly filtro = signal<FiltroEstado>('pending');
  protected readonly web = signal<string>('all');
  protected readonly busqueda = signal('');
  protected readonly orden = signal<Orden>(leerOrden());

  // Selección múltiple
  protected readonly seleccionando = signal(false);
  protected readonly seleccion = signal<ReadonlySet<string>>(new Set());

  /** Se actualiza cada minuto para refrescar los "hace X min". */
  protected readonly ahora = signal(Date.now());

  /** Hay solicitudes de Tramo (web antigua): solo entonces se muestra su chip. */
  protected readonly hayTramo = computed(() => (this.datos.porWeb().get('tramo')?.total ?? 0) > 0);

  protected readonly chips = computed(() => {
    const porWeb = this.datos.porWeb();
    const oscuro = this.tema.oscuro();

    return this.webs
      .filter((w) => w.source !== 'tramo' || this.hayTramo())
      .map((w) => ({
        source: w.source,
        nombre: w.nombreCorto,
        emoji: w.emoji,
        color: oscuro ? w.colorOscuro : w.color,
        total: this.contarEnFiltro(w.source, porWeb.get(w.canal)?.total ?? 0),
      }));
  });

  /** Lista filtrada, buscada y ordenada. */
  protected readonly filtradas = computed<Solicitud[]>(() => {
    const filtro = this.filtro();
    const web = this.web();
    const termino = this.busqueda().trim().toLowerCase();

    let lista = this.datos.solicitudes().filter((s) => {
      if (filtro === 'pending' && s.reviewed_at) return false;
      if (filtro === 'reviewed' && !s.reviewed_at) return false;
      if (web !== 'all' && s.source !== web) return false;

      if (termino) {
        // Igual que el panel anterior, más los datos de `details` (zona, direcciones…).
        const texto = [
          s.name,
          s.phone,
          s.email,
          s.service,
          s.description,
          getWeb(s.source).nombre,
          ...detallesVisibles(s.details).map(([, valor]) => formatearValor(valor)),
        ]
          .join(' ')
          .toLowerCase();

        if (!texto.includes(termino)) return false;
      }

      return true;
    });

    // La consulta ya viene de más reciente a más antigua.
    if (this.orden() === 'oldest') {
      lista = [...lista].reverse();
    } else if (this.orden() === 'name') {
      lista = [...lista].sort((a, b) =>
        (a.name || '').localeCompare(b.name || '', 'es', { sensitivity: 'base' }),
      );
    }

    return lista;
  });

  /** Agrupadas por fecha (o por inicial si se ordena por nombre). */
  protected readonly grupos = computed<GrupoSolicitudes[]>(() => {
    const grupos: GrupoSolicitudes[] = [];
    const ahora = new Date(this.ahora());

    for (const s of this.filtradas()) {
      const etiqueta =
        this.orden() === 'name'
          ? (s.name || '#').trim().charAt(0).toUpperCase() || '#'
          : grupoFecha(s.created_at, ahora);

      let grupo = grupos.at(-1);

      if (grupo?.etiqueta !== etiqueta) {
        grupo = { etiqueta, items: [] };
        grupos.push(grupo);
      }

      grupo.items.push(s);
    }

    return grupos;
  });

  protected readonly todasSeleccionadas = computed(() => {
    const visibles = this.filtradas();
    const sel = this.seleccion();

    return visibles.length > 0 && visibles.every((s) => sel.has(s.id));
  });

  protected readonly titulo = computed(() =>
    this.filtro() === 'pending'
      ? 'Solicitudes nuevas'
      : this.filtro() === 'reviewed'
        ? 'Revisadas'
        : 'Todas las solicitudes',
  );

  protected readonly esqueletos = [1, 2, 3, 4, 5];

  constructor() {
    const ruta = inject(ActivatedRoute);
    const destruir = inject(DestroyRef);

    // "Por web" abre esta pestaña con ?web=mudanzas360
    ruta.queryParamMap.pipe(takeUntilDestroyed(destruir)).subscribe((params) => {
      const web = params.get('web');

      if (web) {
        this.web.set(web);
        this.filtro.set(params.get('estado') === 'pending' ? 'pending' : 'all');
        this.limpiarSeleccion();
      }
    });

    // Orden visible → anterior / siguiente en el detalle.
    effect(() => this.datos.ordenVisible.set(this.filtradas().map((s) => s.id)));

    const reloj = setInterval(() => this.ahora.set(Date.now()), 60000);
    destruir.onDestroy(() => clearInterval(reloj));
  }

  // =====================================================
  // FILTROS
  // =====================================================

  protected setFiltro(valor: unknown): void {
    if (valor === 'pending' || valor === 'reviewed' || valor === 'all') {
      this.filtro.set(valor);
      this.limpiarSeleccion();
    }
  }

  protected setWeb(source: string): void {
    this.web.set(this.web() === source ? 'all' : source);
    this.limpiarSeleccion();
  }

  protected setOrden(valor: Orden): void {
    this.orden.set(valor);

    try {
      localStorage.setItem(CLAVE_ORDEN, valor);
    } catch {
      // Sin almacenamiento.
    }
  }

  protected colorDe(source: string): string {
    return colorWeb(source, this.tema.oscuro());
  }

  private contarEnFiltro(source: string, total: number): number {
    if (this.filtro() === 'all') {
      return total;
    }

    const pendiente = this.filtro() === 'pending';

    return this.datos.solicitudes().filter((s) => s.source === source && !s.reviewed_at === pendiente)
      .length;
  }

  // =====================================================
  // ACCIONES
  // =====================================================

  protected async recargar(evento: RefresherCustomEvent): Promise<void> {
    await this.datos.cargar(true);
    await evento.target.complete();
    await this.avisos.vibrar();
  }

  protected abrir(s: Solicitud): void {
    if (this.seleccionando()) {
      this.alternar(s.id);
      return;
    }

    void this.router.navigate(['/solicitud', s.id]);
  }

  protected async revisar(s: Solicitud, deslizable?: IonItemSliding): Promise<void> {
    await deslizable?.close();

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
    }
  }

  protected whatsapp(s: Solicitud): string {
    return urlWhatsapp(s);
  }

  protected llamar(s: Solicitud): string {
    return urlTelefono(s.phone);
  }

  protected async cerrar(deslizable: IonItemSliding): Promise<void> {
    await deslizable.close();
  }

  // =====================================================
  // SELECCIÓN MÚLTIPLE
  // =====================================================

  protected alternarModoSeleccion(): void {
    this.seleccionando.update((v) => !v);
    this.seleccion.set(new Set());
  }

  protected alternar(id: string): void {
    this.seleccion.update((actual) => {
      const nueva = new Set(actual);

      if (nueva.has(id)) {
        nueva.delete(id);
      } else {
        nueva.add(id);
      }

      return nueva;
    });

    void this.avisos.vibrar();
  }

  protected alternarTodas(): void {
    this.seleccion.set(
      this.todasSeleccionadas() ? new Set() : new Set(this.filtradas().map((s) => s.id)),
    );
  }

  protected async revisarSeleccionadas(): Promise<void> {
    try {
      const n = await this.datos.marcarRevisadas([...this.seleccion()]);

      await this.avisos.vibrar('exito');
      await this.avisos.exito(
        n === 0
          ? 'Las solicitudes seleccionadas ya estaban revisadas.'
          : n === 1
            ? 'Solicitud marcada como revisada.'
            : `${n} solicitudes revisadas.`,
      );

      this.limpiarSeleccion(true);
    } catch (error) {
      await this.avisos.error((error as Error).message);
    }
  }

  protected async eliminarSeleccionadas(): Promise<void> {
    const ids = [...this.seleccion()];

    if (!ids.length) {
      return;
    }

    const ok = await this.avisos.confirmar(
      ids.length === 1 ? '¿Eliminar esta solicitud?' : `¿Eliminar ${ids.length} solicitudes?`,
      'Esta acción no se puede deshacer.',
      'Eliminar',
    );

    if (!ok) {
      return;
    }

    try {
      const n = await this.datos.eliminar(ids);

      await this.avisos.vibrar('aviso');
      await this.avisos.exito(n === 1 ? 'Solicitud eliminada.' : `${n} solicitudes eliminadas.`);

      if (n < ids.length) {
        await this.avisos.error('Algunas solicitudes no se pudieron eliminar.');
      }

      this.limpiarSeleccion(true);
    } catch (error) {
      await this.avisos.error((error as Error).message);
    }
  }

  private limpiarSeleccion(salir = false): void {
    this.seleccion.set(new Set());

    if (salir) {
      this.seleccionando.set(false);
    }
  }
}

function leerOrden(): Orden {
  try {
    const valor = localStorage.getItem(CLAVE_ORDEN);

    return valor === 'oldest' || valor === 'name' ? valor : 'newest';
  } catch {
    return 'newest';
  }
}
