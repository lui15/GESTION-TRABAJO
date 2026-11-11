import { inject, Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { AlertController, ToastController } from '@ionic/angular';

/** Avisos (toasts), confirmaciones y vibración ligera. */
@Injectable({ providedIn: 'root' })
export class AvisosService {
  private readonly toasts = inject(ToastController);
  private readonly alertas = inject(AlertController);

  async exito(mensaje: string): Promise<void> {
    await this.mostrar(mensaje, 'success', 'checkmark-circle');
  }

  async error(mensaje: string): Promise<void> {
    await this.mostrar(mensaje, 'danger', 'alert-circle', 5000);
  }

  /** Aviso con un botón de acción (p. ej. "Ver" al llegar una solicitud). */
  async conAccion(
    titulo: string,
    mensaje: string,
    textoBoton: string,
    alPulsar: () => void,
  ): Promise<void> {
    await this.toasts.dismiss().catch(() => undefined);

    const toast = await this.toasts.create({
      header: titulo,
      message: mensaje,
      duration: 8000,
      position: 'top',
      cssClass: 'aviso-nueva',
      swipeGesture: 'vertical',
      buttons: [
        { text: textoBoton, role: 'info', handler: alPulsar },
        { icon: 'close', role: 'cancel' },
      ],
    });

    await toast.present();
  }

  /** Confirmación con botón destructivo. Devuelve true si se acepta. */
  async confirmar(titulo: string, mensaje: string, textoAceptar: string): Promise<boolean> {
    const alerta = await this.alertas.create({
      header: titulo,
      message: mensaje,
      cssClass: 'alerta-confirmar',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: textoAceptar, role: 'destructive', cssClass: 'boton-peligro' },
      ],
    });

    await alerta.present();

    const { role } = await alerta.onDidDismiss();

    return role === 'destructive';
  }

  /** Vibración ligera (al revisar, al deslizar…). En la web no hace nada si no se puede. */
  async vibrar(tipo: 'ligera' | 'exito' | 'aviso' = 'ligera'): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    try {
      if (tipo === 'ligera') {
        await Haptics.impact({ style: ImpactStyle.Light });
      } else {
        await Haptics.notification({
          type: tipo === 'exito' ? NotificationType.Success : NotificationType.Warning,
        });
      }
    } catch {
      // Sin vibración disponible.
    }
  }

  private async mostrar(mensaje: string, color: string, icono: string, duracion = 3000): Promise<void> {
    await this.toasts.dismiss().catch(() => undefined);

    const toast = await this.toasts.create({
      message: mensaje,
      color,
      icon: icono,
      duration: duracion,
      position: 'bottom',
      positionAnchor: 'barra-pestanas',
      cssClass: 'aviso',
      buttons: [{ icon: 'close', role: 'cancel' }],
    });

    await toast.present();
  }
}
