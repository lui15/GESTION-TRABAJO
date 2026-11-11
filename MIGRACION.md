# Migración del panel a Ionic + Capacitor

Inventario de **todo** lo que hacía el panel anterior (`src/app/app.ts`, commit `0a58747`) y
dónde queda ahora, con cómo se ha comprobado cada punto.

**Cómo se comprobó**

- **Recorrido**: prueba automática en Chrome que pulsa la interfaz y verifica las peticiones
  que llegarían a Supabase. Supabase está **simulado**: no se leyó, creó ni borró ninguna
  solicitud real. Resultado: 46 de 46 comprobaciones correctas.
- **APK**: el APK de depuración instalado en el emulador Pixel 7 (Android 17), con Supabase
  simulado desde las herramientas de depuración del WebView.
- **Código**: revisado en el código, sin prueba automática. Casi siempre es porque depende
  del tiempo real o de la red de verdad.

## Datos y conexión

| # | Función | Antes | Ahora | Comprobado |
|---|---|---|---|---|
| 1 | Cliente Supabase con URL + clave publishable | `SUPABASE_URL`, `createClient` | `configuracion.ts`, `servicios/supabase.service.ts` | Recorrido, APK |
| 2 | Aviso si faltan las credenciales | `ngOnInit` | `SupabaseService.configurado` / `errorInicio`, mostrado en el login | Código |
| 3 | Comprobar la sesión al arrancar (máx. 10 s) | `ngOnInit` | `SupabaseService.iniciar()` + `conTiempoLimite` | Recorrido (arranca con sesión) |
| 4 | Escuchar cambios de sesión sin recargar por renovar el token | `onAuthStateChange` | `usuario` es un signal que solo cambia si cambia el id | Código |
| 5 | Iniciar sesión (valida campos vacíos) | `login` | `LoginPage` + `SupabaseService.iniciarSesion` | Recorrido |
| 6 | Cerrar sesión (limpia lista y tiempo real) | `logout` | Ajustes → `cerrarSesion`. Además borra el token del dispositivo | Recorrido |
| 7 | Cargar solicitudes (`created_at` desc, máx. 15 s) | `loadRequests` | `SolicitudesService.cargar()` | Recorrido, APK |
| 8 | Recarga silenciosa al llegar cambios | `loadRequests(true)` | `cargar(true)` desde el canal de tiempo real | Código |
| 9 | Tiempo real `postgres_changes` sobre `requests` | `subscribeToChanges` | `SolicitudesService.suscribir()` (mismo canal) | Código ⚠️ |
| 10 | Mantener abierta la solicitud tras recargar | `loadRequests` | El detalle es una ruta: `/solicitud/:id` se recalcula sola | Código |
| 11 | Errores traducidos al español | `getErrorMessage` | `utilidades/errores.ts` (mismos mensajes) | Código |

⚠️ El tiempo real no se puede simular con el método usado. Pruébalo con una solicitud de
prueba real (ver GUIA.md, apartado 6).

## Lista, filtros y organización

| # | Función | Antes | Ahora | Comprobado |
|---|---|---|---|---|
| 12 | Filtro por estado Nuevas / Revisadas / Todas | `setFilter` | Segmento en la lista | Recorrido |
| 13 | Filtro por web (Tramo solo si hay) | `setSource` | Chips con contador + pantalla "Por web" | Recorrido |
| 14 | Búsqueda por nombre, teléfono, email, servicio, descripción y web | `filteredRequests` | Igual, y **también busca en `details`** (zona, direcciones…) | Recorrido |
| 15 | Ordenar (recientes / antiguas / A-Z), recordado | `setSort` | Selector en la cabecera (misma clave `central-sort`) | Recorrido |
| 16 | Agrupar por fecha o por inicial | `groupedRequests` | `SolicitudesPage.grupos` | Recorrido |
| 17 | Contadores (pendientes, revisadas, total, por web) | getters | Segmento, chips, globo en la pestaña y "Por web" | Recorrido, APK |
| 18 | Tarjetas de resumen que llevan a cada sección | `goToSection` | Pantalla "Por web": cada tarjeta abre la lista filtrada | Recorrido |
| 19 | Esqueletos de carga y estado vacío | plantilla | `ion-skeleton-text` y estado vacío según contexto | Recorrido (vacío) |
| 20 | Marca "PRUEBA" (`is_test`), ocultando `is_test`/`test_batch` | `isTest` | Tarjeta y detalle; `CLAVES_INTERNAS` | Recorrido |
| 21 | "Hace X min" y fecha completa | `timeAgo`, `formatFullDate` | `utilidades/formato.ts` (se refresca cada minuto) | APK |
| 22 | Iniciales para el avatar | `getInitials` | Avatar de la cuenta. En las tarjetas ahora va el emoji de la web | APK |

## Detalle de una solicitud

| # | Función | Antes | Ahora | Comprobado |
|---|---|---|---|---|
| 23 | Abrir el detalle | `selectRequest` (ventana) | Página `/solicitud/:id` | Recorrido, APK |
| 24 | Anterior / siguiente, flechas ← →, contador | `goToAdjacent` | Botones de la cabecera y teclado | Recorrido |
| 25 | Cerrar con Esc | `onKeydown` | Esc vuelve a la lista; en Android, el botón o gesto Atrás | Recorrido |
| 26 | Copiar teléfono y correo | `copyText` | Igual + **"Copiar"** con todos los datos | Código ⚠️ |
| 27 | Servicio, web, estado y referencia | plantilla | Secciones Servicio y Origen y UTM, más la cabecera | Recorrido, APK |
| 28 | Descripción del cliente | plantilla | Sección Servicio | APK |
| 29 | Información adicional de `details` formateada | `getDetails` | Repartida en Servicio, Direcciones, Fechas, Contacto y Origen y UTM | Recorrido |
| 30 | Fotos adjuntas | plantilla | Sección Fotografías | Código |
| 31 | Seguimiento recibida → revisada | plantilla | Sección Fechas | APK |
| 32 | WhatsApp (añade 34 con 9 cifras, quita 00) | `getWhatsappUrl` | `urlWhatsapp`: igual, más un saludo con nombre y servicio | Recorrido |
| 33 | Llamar y email | plantilla | Botones grandes, más **Abrir en Maps** si hay dirección o zona | Recorrido |
| 34 | Marcar como revisada | `markAsReviewed` | Botón del pie y deslizar → en la lista | Recorrido |
| 35 | Volver a pendientes | `markAsPending` | Botón del pie | Recorrido |
| 36 | Eliminar con confirmación | `confirmDelete` | Papelera del pie con alerta. Después pasa a la siguiente | Recorrido |

⚠️ El portapapeles no se puede probar en Chrome sin interfaz. Usa el plugin `@capacitor/clipboard`.

## Acciones múltiples

| # | Función | Antes | Ahora | Comprobado |
|---|---|---|---|---|
| 37 | Modo selección y seleccionar todas | `toggleSelectionMode`, `toggleSelectAll` | Botón de la cabecera, "Todas" / "Ninguna" | Recorrido |
| 38 | Marcar varias como revisadas | `markSelectedAsReviewed` | Pie de la selección, un solo PATCH | Recorrido |
| 39 | Eliminar varias (detecta borrado bloqueado por RLS) | `confirmDelete` | Pie de la selección, un solo DELETE con `select=id` | Recorrido |

## Apariencia y avisos

| # | Función | Antes | Ahora | Comprobado |
|---|---|---|---|---|
| 40 | Modo claro / oscuro / automático, recordado | `setThemeMode` | Ajustes: interruptor "Modo oscuro" y "Automático" (misma clave `central-theme`) | Recorrido |
| 41 | 8 colores principales, recordado | `setAccent` | Ajustes → Color principal (misma clave `central-accent`) | Recorrido |
| 42 | Color de la barra del navegador | `applyDocumentTheme` | `TemaService`, y en Android la barra de estado | Código |
| 43 | Avisos de éxito y error | `showSuccess` | `AvisosService` (toasts de Ionic) | Recorrido |
| 44 | Datos de la cuenta | plantilla | Ajustes → tarjeta de la cuenta | APK |

**Resultado: ninguna función se ha perdido.** Las preferencias guardadas (tema, color y orden)
usan las mismas claves, así que se conservan al pasar a la versión nueva.

## Novedades

- Notificaciones push por web en Android, con un interruptor por web y un botón de prueba.
- En la web, aviso con sonido al llegar una solicitud mientras el panel está abierto.
- Deslizar → para revisar y ← para WhatsApp o llamar; tirar hacia abajo para recargar.
- Vibración ligera al revisar.
- Pantalla "Por web" con las solicitudes de hoy, de la semana y las pendientes.
- Resumen corto en cada tarjeta ("Piso 3 hab. · Chamberí → Getafe").
- Botones de Maps y "Copiar datos" en el detalle.
- Número de pendientes en el icono de la app, si el móvil lo permite.
