import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { App as CapApp } from '@capacitor/app';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import {
  PushNotifications,
  type PushNotificationSchema,
} from '@capacitor/push-notifications';
import { Badge } from '@capawesome/capacitor-badge';

import { resumenNotificacion } from '../../../supabase/functions/_shared/resumen';
import { FUNCION_NOTIFICAR } from '../configuracion';
import { CANALES, getWeb, IDS_CANALES } from '../datos/webs';
import { Solicitud } from '../modelos/solicitud';
import { AvisosService } from './avisos.service';
import { SolicitudesService } from './solicitudes.service';
import { SupabaseService } from './supabase.service';

/** Plugin nativo propio (android/.../EstadoFirebasePlugin.java). */
interface EstadoFirebasePlugin {
  estado(): Promise<{ configurado: boolean }>;
}

const EstadoFirebase = registerPlugin<EstadoFirebasePlugin>('EstadoFirebase');

export type EstadoPermiso = 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale';

const CLAVE_TOKEN = 'gt-push-token';
const CLAVE_PREGUNTADO = 'gt-push-preguntado';
const CLAVE_WEBS = 'gt-webs-activas';

/**
 * Notificaciones.
 *
 * App Android: permiso, token FCM en `device_tokens`, un canal por web, abrir el
 * detalle al tocar el aviso, aviso dentro de la app si está abierta, número de
 * pendientes en el icono y webs activas por dispositivo.
 *
 * Web (Netlify): sin push; si el panel está abierto, aviso con sonido al llegar
 * una solicitud por tiempo real.
 */
@Injectable({ providedIn: 'root' })
export class NotificacionesService {
  private readonly sb = inject(SupabaseService);
  private readonly solicitudes = inject(SolicitudesService);
  private readonly avisos = inject(AvisosService);
  private readonly router = inject(Router);

  readonly esNativo = Capacitor.isNativePlatform();

  readonly permiso = signal<EstadoPermiso>('prompt');
  /** null = aún no se sabe; false = la APK se compiló sin google-services.json. */
  readonly firebaseConfigurado = signal<boolean | null>(this.esNativo ? null : false);
  readonly token = signal<string | null>(leer(CLAVE_TOKEN));
  readonly websActivas = signal<string[]>(leerWebs());
  readonly enviandoPrueba = signal(false);

  readonly activas = computed(() => this.esNativo && this.permiso() === 'granted' && !!this.token());

  private iniciado = false;
  private audio: AudioContext | null = null;

  constructor() {
    // Aviso dentro de la app cuando llega una solicitud por tiempo real.
    this.solicitudes.nuevas$.subscribe((s) => void this.alLlegarPorTiempoReal(s));

    // Al iniciar sesión, registrar el dispositivo si ya hay permiso.
    effect(() => {
      const usuario = this.sb.usuario();

      untracked(() => {
        if (usuario) {
          void this.alIniciarSesion();
        }
      });
    });

    // Número de pendientes en el icono de la app.
    effect(() => {
      const pendientes = this.sb.usuario() ? this.solicitudes.pendientes() : 0;

      untracked(() => void this.actualizarGlobo(pendientes));
    });

    if (!this.esNativo && typeof document !== 'undefined') {
      this.prepararSonido();
    }
  }

  // =====================================================
  // ARRANQUE (lo llama App)
  // =====================================================

  async inicializar(): Promise<void> {
    if (this.iniciado || !this.esNativo) {
      return;
    }

    this.iniciado = true;

    try {
      this.firebaseConfigurado.set((await EstadoFirebase.estado()).configurado);
    } catch {
      this.firebaseConfigurado.set(false);
    }

    await this.crearCanales();

    await PushNotifications.addListener('registration', (t) => void this.guardarToken(t.value));
    await PushNotifications.addListener('registrationError', (e) =>
      console.error('Error al registrar las notificaciones:', e.error),
    );
    await PushNotifications.addListener('pushNotificationReceived', (n) => void this.alRecibirEnPrimerPlano(n));
    await PushNotifications.addListener('pushNotificationActionPerformed', (a) =>
      this.abrir(a.notification.data),
    );
    await LocalNotifications.addListener('localNotificationActionPerformed', (a) =>
      this.abrir(a.notification.extra),
    );

    // Al volver a la app (p. ej. tras cambiar el permiso en los ajustes del sistema).
    await CapApp.addListener('resume', () => void this.comprobarPermiso().then(() => this.alIniciarSesion()));

    await this.comprobarPermiso();
  }

  private async comprobarPermiso(): Promise<void> {
    if (!this.esNativo) {
      return;
    }

    try {
      const estado = await PushNotifications.checkPermissions();
      this.permiso.set(estado.receive as EstadoPermiso);
    } catch {
      this.permiso.set('denied');
    }
  }

  /** Tras el login: ¿mostrar la pantalla que explica para qué sirve el permiso? */
  necesitaPantallaPrevia(): boolean {
    return (
      this.esNativo &&
      this.firebaseConfigurado() !== false &&
      this.permiso().startsWith('prompt') &&
      !leer(CLAVE_PREGUNTADO)
    );
  }

  marcarPreguntado(): void {
    guardar(CLAVE_PREGUNTADO, '1');
  }

  // =====================================================
  // PERMISO Y TOKEN
  // =====================================================

  /** Pide el permiso (si hace falta) y registra el dispositivo. */
  async activar(): Promise<boolean> {
    this.marcarPreguntado();

    if (!this.esNativo) {
      return false;
    }

    let estado = await PushNotifications.checkPermissions();

    if (estado.receive.startsWith('prompt')) {
      estado = await PushNotifications.requestPermissions();
    }

    this.permiso.set(estado.receive as EstadoPermiso);

    if (estado.receive !== 'granted') {
      return false;
    }

    await this.registrar();

    return true;
  }

  private async alIniciarSesion(): Promise<void> {
    if (!this.esNativo || !this.sb.usuario()) {
      return;
    }

    await this.inicializar();

    if (this.permiso() === 'granted') {
      await this.registrar();
    }
  }

  private async registrar(): Promise<void> {
    // Sin google-services.json, register() cerraría la app.
    if (!this.firebaseConfigurado()) {
      return;
    }

    try {
      await PushNotifications.register();
    } catch (error) {
      console.error('No se pudo registrar el dispositivo:', error);
    }
  }

  /** Guarda (upsert) el token. Si cambió, borra el anterior. */
  private async guardarToken(nuevo: string): Promise<void> {
    if (!this.sb.usuario()) {
      return;
    }

    const anterior = this.token();

    const { data, error } = await this.sb.cliente.rpc('registrar_token', {
      p_token: nuevo,
      p_plataforma: Capacitor.getPlatform(),
    });

    if (error) {
      console.error('No se pudo guardar el token de notificaciones:', error.message);
      return;
    }

    if (anterior && anterior !== nuevo) {
      await this.sb.cliente.from('device_tokens').delete().eq('token', anterior);
    }

    this.token.set(nuevo);
    guardar(CLAVE_TOKEN, nuevo);

    const fila = (Array.isArray(data) ? data[0] : data) as { webs_activas?: string[] } | null;

    if (fila?.webs_activas) {
      this.websActivas.set(fila.webs_activas);
      guardar(CLAVE_WEBS, JSON.stringify(fila.webs_activas));
    }
  }

  /** Antes de cerrar sesión: este dispositivo deja de recibir avisos. */
  async antesDeCerrarSesion(): Promise<void> {
    const token = this.token();

    if (token) {
      const { error } = await this.sb.cliente.from('device_tokens').delete().eq('token', token);

      if (error) {
        console.error('No se pudo borrar el token:', error.message);
      }
    }

    this.token.set(null);
    borrar(CLAVE_TOKEN);

    if (this.esNativo && this.firebaseConfigurado()) {
      await PushNotifications.unregister().catch(() => undefined);
    }

    await this.actualizarGlobo(0);
  }

  // =====================================================
  // WEBS ACTIVAS
  // =====================================================

  async setWebActiva(canal: string, activa: boolean): Promise<void> {
    const antes = this.websActivas();
    const despues = activa
      ? [...new Set([...antes, canal])]
      : antes.filter((c) => c !== canal);

    this.websActivas.set(despues);
    guardar(CLAVE_WEBS, JSON.stringify(despues));

    const token = this.token();

    if (!this.esNativo || !token) {
      return;
    }

    const { error } = await this.sb.cliente
      .from('device_tokens')
      .update({ webs_activas: despues })
      .eq('token', token);

    if (error) {
      this.websActivas.set(antes);
      guardar(CLAVE_WEBS, JSON.stringify(antes));
      throw new Error('No se pudo guardar la preferencia. Inténtalo de nuevo.');
    }
  }

  // =====================================================
  // PRUEBAS
  // =====================================================

  /** Pide a la Edge Function un push de prueba a todos los móviles de esta cuenta. */
  async enviarPrueba(source = 'mudanzas360'): Promise<string> {
    this.enviandoPrueba.set(true);

    try {
      const { data, error } = await this.sb.cliente.functions.invoke(FUNCION_NOTIFICAR, {
        body: { modo: 'prueba', source },
      });

      if (error) {
        throw error;
      }

      if (data?.motivo === 'sin_dispositivos') {
        throw new Error(
          'No hay ningún móvil registrado. Abre la app Android, inicia sesión y activa las notificaciones.',
        );
      }

      const n = Number(data?.enviadas ?? 0);

      if (n === 0) {
        throw new Error('Firebase no aceptó el envío. Revisa la configuración (ver GUIA.md).');
      }

      return n === 1 ? 'Notificación de prueba enviada.' : `Notificación de prueba enviada a ${n} dispositivos.`;
    } catch (error) {
      const mensaje = (error as Error)?.message ?? '';

      if (/Failed to send a request|FunctionsFetchError|404|not found/i.test(mensaje)) {
        throw new Error(
          'La función notificar-solicitud no está desplegada todavía (ver GUIA.md).',
        );
      }

      if (/FunctionsHttpError|non-2xx/i.test(mensaje)) {
        throw new Error('La función respondió con un error. Revisa sus secretos y registros en Supabase.');
      }

      throw error instanceof Error ? error : new Error('No se pudo enviar la prueba.');
    } finally {
      this.enviandoPrueba.set(false);
    }
  }

  /**
   * Aviso local en este móvil (sin Firebase): comprueba canales, icono, color y
   * que al tocarlo se abre el detalle de la solicitud más reciente.
   */
  async avisoLocalDePrueba(source = 'mudanzas360'): Promise<void> {
    const permiso = await LocalNotifications.requestPermissions();

    if (permiso.display !== 'granted') {
      throw new Error('Sin permiso para mostrar notificaciones en este móvil.');
    }

    const web = getWeb(source);
    const ultima = this.solicitudes.solicitudes().find((s) => getWeb(s.source).canal === web.canal)
      ?? this.solicitudes.solicitudes()[0];

    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Date.now() % 2_000_000_000),
          title: `${web.emoji} ${web.nombre} · Nueva solicitud`,
          body: ultima ? resumenNotificacion(ultima, 120) : 'Aviso local de prueba',
          channelId: web.canal,
          smallIcon: 'ic_stat_notify',
          iconColor: web.color,
          schedule: { at: new Date(Date.now() + 3000), allowWhileIdle: true },
          extra: { id: ultima?.id ?? '', source: web.source },
        },
      ],
    });
  }

  // =====================================================
  // RECEPCIÓN
  // =====================================================

  /** App abierta: Android no muestra el aviso, así que se enseña dentro de la app. */
  private async alRecibirEnPrimerPlano(n: PushNotificationSchema): Promise<void> {
    void this.solicitudes.cargar(true);
    void this.avisos.vibrar('aviso');

    await this.avisos.conAccion(n.title ?? 'Nueva solicitud', n.body ?? '', 'Ver', () =>
      this.abrir(n.data),
    );
  }

  private async alLlegarPorTiempoReal(s: Solicitud): Promise<void> {
    const web = getWeb(s.source);

    if (!this.websActivas().includes(web.canal)) {
      return;
    }

    // En el móvil con push activo el aviso ya llega por FCM: evitar duplicados.
    if (this.activas() && this.firebaseConfigurado()) {
      return;
    }

    this.sonar();
    void this.avisos.vibrar('aviso');

    await this.avisos.conAccion(
      `${web.emoji} ${web.nombre} · Nueva solicitud`,
      resumenNotificacion(s, 120),
      'Ver',
      () => void this.router.navigate(['/solicitud', s.id]),
    );
  }

  private abrir(datos: Record<string, unknown> | null | undefined): void {
    const id = typeof datos?.['id'] === 'string' ? datos['id'] : '';

    void this.router.navigateByUrl(id ? `/solicitud/${id}` : '/solicitudes');
  }

  // =====================================================
  // CANALES, ICONO Y SONIDO
  // =====================================================

  /** Un canal por web, con importancia alta, su color y vibración. */
  private async crearCanales(): Promise<void> {
    for (const web of CANALES) {
      try {
        await PushNotifications.createChannel({
          id: web.canal,
          name: web.nombre,
          description: `Nuevas solicitudes de ${web.nombre}`,
          importance: 5,
          visibility: 0,
          lights: true,
          lightColor: web.color,
          vibration: true,
        });
      } catch (error) {
        console.error('No se pudo crear el canal', web.canal, error);
      }
    }
  }

  private async actualizarGlobo(cuantas: number): Promise<void> {
    try {
      if (this.esNativo) {
        const { isSupported } = await Badge.isSupported();

        if (isSupported) {
          await (cuantas > 0 ? Badge.set({ count: cuantas }) : Badge.clear());
        }
      } else if (typeof navigator !== 'undefined' && 'setAppBadge' in navigator) {
        // Web instalada como app (PWA) en navegadores que lo permiten.
        await (cuantas > 0
          ? (navigator as Navigator & { setAppBadge(n: number): Promise<void> }).setAppBadge(cuantas)
          : (navigator as Navigator & { clearAppBadge(): Promise<void> }).clearAppBadge());
      }
    } catch {
      // El dispositivo no lo permite.
    }
  }

  /** Los navegadores solo dejan sonar audio tras una interacción: se prepara al primer toque. */
  private prepararSonido(): void {
    const desbloquear = () => {
      try {
        this.audio ??= new AudioContext();
        void this.audio.resume();
      } catch {
        // Sin audio.
      }
    };

    document.addEventListener('pointerdown', desbloquear, { once: true, passive: true });
    document.addEventListener('keydown', desbloquear, { once: true, passive: true });
  }

  /** Dos notas cortas (tipo "ding-dong"), sin archivos de audio. */
  private sonar(): void {
    if (!this.audio || this.audio.state !== 'running') {
      return;
    }

    const ahora = this.audio.currentTime;

    [
      { frecuencia: 880, inicio: 0 },
      { frecuencia: 1318.5, inicio: 0.16 },
    ].forEach(({ frecuencia, inicio }) => {
      const osc = this.audio!.createOscillator();
      const vol = this.audio!.createGain();

      osc.type = 'sine';
      osc.frequency.value = frecuencia;
      vol.gain.setValueAtTime(0.0001, ahora + inicio);
      vol.gain.exponentialRampToValueAtTime(0.25, ahora + inicio + 0.02);
      vol.gain.exponentialRampToValueAtTime(0.0001, ahora + inicio + 0.45);
      osc.connect(vol).connect(this.audio!.destination);
      osc.start(ahora + inicio);
      osc.stop(ahora + inicio + 0.5);
    });
  }
}

function leerWebs(): string[] {
  try {
    const valor = JSON.parse(leer(CLAVE_WEBS) ?? 'null');

    return Array.isArray(valor) ? valor : [...IDS_CANALES];
  } catch {
    return [...IDS_CANALES];
  }
}

function leer(clave: string): string | null {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}

function guardar(clave: string, valor: string): void {
  try {
    localStorage.setItem(clave, valor);
  } catch {
    // Sin almacenamiento.
  }
}

function borrar(clave: string): void {
  try {
    localStorage.removeItem(clave);
  } catch {
    // Sin almacenamiento.
  }
}
