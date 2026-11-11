# Gestión Trabajo

Panel privado donde llegan las solicitudes de presupuesto de **Mudanzas360**,
**ObraLocal Madrid** y **ArmaMuebles**. Es una app Android (Ionic + Capacitor) y
también una web estática publicada en Netlify.

- **Puesta en marcha** (Firebase, secretos, despliegue, APK, iOS): [GUIA.md](GUIA.md)
- **Funciones del panel y cómo se comprobó cada una:** [MIGRACION.md](MIGRACION.md)

## Comandos

| Comando | Qué hace |
|---|---|
| `npm start` | Web en local (http://localhost:4200) |
| `npm run build` | Compilación web (lo que publica Netlify) |
| `npm run build:android` | Compila y copia la web al proyecto Android |
| `npm run android` | Abre el proyecto en Android Studio |
| `npm run assets` | Regenera logo, iconos y splash desde `scripts/generar-logo.mjs` |

## Estructura

```
src/app/
  datos/webs.ts           → reexporta la fuente única de webs
  servicios/              → supabase, solicitudes, notificaciones, tema, avisos
  paginas/                → login, solicitudes, solicitud/:id, por-web, ajustes, permiso
  componentes/            → logo, tarjeta de solicitud
supabase/
  functions/_shared/      → webs.ts y resumen.ts (compartidos con la app)
  functions/notificar-solicitud/
  migrations/
```

Stack: Angular 20 (standalone, signals, zoneless) · Ionic 9 · Capacitor 8 · Supabase.
