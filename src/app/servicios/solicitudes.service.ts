import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Subject } from 'rxjs';

import { CANALES, getWeb } from '../datos/webs';
import { Solicitud } from '../modelos/solicitud';
import { conTiempoLimite, traducirError } from '../utilidades/errores';
import { esDeEstaSemana, esDeHoy } from '../utilidades/formato';
import { SupabaseService } from './supabase.service';

export interface ResumenWeb {
  canal: string;
  total: number;
  pendientes: number;
  hoy: number;
  semana: number;
  ultima: string | null;
}

/**
 * Solicitudes de la tabla `requests`: carga, tiempo real, revisar y eliminar.
 * Se carga sola al iniciar sesión y se vacía al cerrarla.
 */
@Injectable({ providedIn: 'root' })
export class SolicitudesService {
  private readonly sb = inject(SupabaseService);

  readonly solicitudes = signal<Solicitud[]>([]);
  readonly cargando = signal(false);
  readonly cargadoUnaVez = signal(false);
  readonly error = signal('');

  /** Solicitud nueva recibida por tiempo real (para avisos dentro de la app). */
  readonly nuevas$ = new Subject<Solicitud>();

  /** Ids en el orden que muestra la lista (para anterior / siguiente en el detalle). */
  readonly ordenVisible = signal<string[]>([]);

  readonly pendientes = computed(() => this.solicitudes().filter((s) => !s.reviewed_at).length);
  readonly revisadas = computed(() => this.solicitudes().filter((s) => !!s.reviewed_at).length);
  readonly total = computed(() => this.solicitudes().length);

  /** Contadores por canal (una entrada por web + "otras"). */
  readonly porWeb = computed<Map<string, ResumenWeb>>(() => {
    const ahora = new Date();
    const mapa = new Map<string, ResumenWeb>(
      CANALES.map((web) => [
        web.canal,
        { canal: web.canal, total: 0, pendientes: 0, hoy: 0, semana: 0, ultima: null },
      ]),
    );

    for (const s of this.solicitudes()) {
      const r = mapa.get(getWeb(s.source).canal)!;

      r.total++;
      if (!s.reviewed_at) r.pendientes++;
      if (esDeHoy(s.created_at, ahora)) r.hoy++;
      if (esDeEstaSemana(s.created_at, ahora)) r.semana++;
      if (!r.ultima || s.created_at > r.ultima) r.ultima = s.created_at;
    }

    return mapa;
  });

  private canal: RealtimeChannel | null = null;

  constructor() {
    // Cargar al iniciar sesión, vaciar al cerrarla.
    effect(() => {
      const usuario = this.sb.usuario();

      untracked(() => {
        if (usuario) {
          void this.cargar();
          this.suscribir();
        } else {
          this.quitarSuscripcion();
          this.solicitudes.set([]);
          this.cargadoUnaVez.set(false);
          this.error.set('');
        }
      });
    });
  }

  buscar(id: string): Solicitud | undefined {
    return this.solicitudes().find((s) => s.id === id);
  }

  // =====================================================
  // CARGA
  // =====================================================

  /** `silencioso`: sin indicador de carga (recargas por tiempo real). */
  async cargar(silencioso = false): Promise<void> {
    if (!this.sb.usuario()) {
      return;
    }

    if (!silencioso) {
      this.cargando.set(true);
      this.error.set('');
    }

    try {
      const consulta = this.sb.cliente
        .from('requests')
        .select('*')
        .order('created_at', { ascending: false });

      const { data, error } = await conTiempoLimite(consulta, 15000, 'TIMEOUT_REQUESTS');

      if (error) {
        throw error;
      }

      this.solicitudes.set((data ?? []) as Solicitud[]);
      this.cargadoUnaVez.set(true);
    } catch (error) {
      console.error('ERROR AL CARGAR SOLICITUDES:', error);
      this.error.set(traducirError(error));
    } finally {
      this.cargando.set(false);
    }
  }

  /** Para abrir una solicitud que aún no está en la lista (p. ej. desde una notificación). */
  async cargarUna(id: string): Promise<Solicitud | null> {
    const existente = this.buscar(id);

    if (existente) {
      return existente;
    }

    const { data, error } = await this.sb.cliente.from('requests').select('*').eq('id', id).maybeSingle();

    if (error || !data) {
      return null;
    }

    const solicitud = data as Solicitud;

    this.solicitudes.update((lista) =>
      lista.some((s) => s.id === id)
        ? lista
        : [solicitud, ...lista].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    );

    return solicitud;
  }

  // =====================================================
  // TIEMPO REAL
  // =====================================================

  private suscribir(): void {
    this.quitarSuscripcion();

    this.canal = this.sb.cliente
      .channel('central-requests-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, (cambio) => {
        if (cambio.eventType === 'INSERT' && cambio.new) {
          this.nuevas$.next(cambio.new as Solicitud);
        }

        void this.cargar(true);
      })
      .subscribe((estado) => console.log('Realtime:', estado));
  }

  private quitarSuscripcion(): void {
    if (this.canal) {
      void this.sb.cliente.removeChannel(this.canal);
      this.canal = null;
    }
  }

  // =====================================================
  // REVISAR
  // =====================================================

  /** Marca como revisadas las que aún no lo están. Devuelve cuántas cambió. */
  async marcarRevisadas(ids: string[]): Promise<number> {
    const objetivo = this.solicitudes()
      .filter((s) => ids.includes(s.id) && !s.reviewed_at)
      .map((s) => s.id);

    if (!objetivo.length) {
      return 0;
    }

    const revisadaEn = new Date().toISOString();

    const { error } = await this.sb.cliente
      .from('requests')
      .update({ reviewed_at: revisadaEn })
      .in('id', objetivo);

    if (error) {
      throw new Error(
        objetivo.length === 1
          ? 'No se pudo marcar la solicitud como revisada.'
          : 'No se pudieron marcar las solicitudes como revisadas.',
      );
    }

    const cambiadas = new Set(objetivo);

    this.solicitudes.update((lista) =>
      lista.map((s) => (cambiadas.has(s.id) ? { ...s, reviewed_at: revisadaEn } : s)),
    );

    return objetivo.length;
  }

  async marcarPendiente(id: string): Promise<void> {
    const { error } = await this.sb.cliente.from('requests').update({ reviewed_at: null }).eq('id', id);

    if (error) {
      throw new Error('No se pudo devolver la solicitud a pendientes.');
    }

    this.solicitudes.update((lista) => lista.map((s) => (s.id === id ? { ...s, reviewed_at: null } : s)));
  }

  // =====================================================
  // ELIMINAR
  // =====================================================

  /** Elimina y devuelve cuántas se borraron. Lanza un error traducido si falla. */
  async eliminar(ids: string[]): Promise<number> {
    if (!ids.length) {
      return 0;
    }

    try {
      const { data, error } = await this.sb.cliente.from('requests').delete().in('id', ids).select('id');

      if (error) {
        throw error;
      }

      const borradas = new Set(((data ?? []) as { id: string }[]).map((fila) => fila.id));

      // Con RLS, si no hay permiso de borrado no hay error: simplemente no borra nada.
      if (borradas.size === 0) {
        throw new Error('DELETE_BLOCKED');
      }

      this.solicitudes.update((lista) => lista.filter((s) => !borradas.has(s.id)));

      return borradas.size;
    } catch (error) {
      console.error('ERROR AL ELIMINAR:', error);
      throw new Error(traducirError(error));
    }
  }
}
