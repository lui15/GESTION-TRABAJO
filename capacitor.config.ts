import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'es.gestiontrabajo.app',
  appName: 'Gestión Trabajo',
  webDir: 'dist/gestion-trabajo/browser',
  android: {
    // Permite depurar el WebView desde chrome://inspect en compilaciones de depuración.
    webContentsDebuggingEnabled: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: '#0b0d12',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_notify',
      iconColor: '#4f46e5',
    },
  },
};

export default config;
