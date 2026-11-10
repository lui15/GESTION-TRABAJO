# Migración del panel a Ionic + Capacitor

Inventario de **todo** lo que hace el panel actual (`src/app/app.ts`, commit `0a58747`),
para comprobar al final que nada se pierde. La columna "Dónde queda" se rellena durante la
migración y la columna "Comprobado" en la fase 6.

## Datos y conexión

| # | Función actual | Método(s) en app.ts | Dónde queda | Comprobado |
|---|---|---|---|---|
| 1 | Cliente Supabase con URL + clave publishable | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `createClient` | | |
| 2 | Aviso si faltan las credenciales ("Configura la URL…") | `ngOnInit` | | |
| 3 | Comprobar la sesión al arrancar, con tiempo límite de 10 s | `ngOnInit` (`TIMEOUT_SUPABASE`) | | |
| 4 | Escuchar cambios de sesión (ignora `INITIAL_SESSION`; recarga solo si cambia el usuario) | `onAuthStateChange` | | |
| 5 | Iniciar sesión con correo y contraseña (valida campos vacíos) | `login` | | |
| 6 | Cerrar sesión (limpia lista, selección y realtime) | `logout` | | |
| 7 | Cargar solicitudes ordenadas por `created_at` desc, tiempo límite 15 s | `loadRequests` | | |
| 8 | Recarga silenciosa (sin indicador) al llegar cambios en tiempo real | `loadRequests(true)` | | |
| 9 | Tiempo real: canal `postgres_changes` sobre `public.requests` (todos los eventos) | `subscribeToChanges`, `removeRealtimeSubscription` | | |
| 10 | Conservar la solicitud abierta tras recargar si sigue existiendo | `loadRequests` | | |
| 11 | Traducir errores a mensajes en español (credenciales, red, RLS, tabla, JWT, timeouts, borrado bloqueado) | `getErrorMessage` | | |

## Lista, filtros y organización

| # | Función actual | Método(s) | Dónde queda | Comprobado |
|---|---|---|---|---|
| 12 | Filtro por estado: Nuevas / Revisadas / Todas | `setFilter`, `activeFilter` | | |
| 13 | Filtro por web: todas, ArmaMuebles, ObraLocalMadrid, Mudanzas360, Tramo (solo si hay) | `setSource`, `activeSource` | | |
| 14 | Búsqueda por nombre, teléfono, email, servicio, descripción y nombre de la web | `filteredRequests` | | |
| 15 | Ordenar: más recientes / más antiguas / por nombre (A-Z), recordado | `setSort`, `sortMode` | | |
| 16 | Agrupar por fecha (Hoy, Ayer, Esta semana, Este mes, mes-año) o por inicial | `groupedRequests`, `getDateGroup` | | |
| 17 | Contadores: pendientes, revisadas, total y por web | `pendingCount` … `obrasCount` | | |
| 18 | Tarjetas de resumen que llevan a cada sección | `goToSection` | | |
| 19 | Esqueletos mientras carga y estado vacío según contexto | plantilla | | |
| 20 | Marca "PRUEBA" si `details.is_test === true`; oculta `is_test` y `test_batch` | `isTest`, `internalDetailKeys` | | |
| 21 | "Hace X min / h / días" y fecha completa en español | `timeAgo`, `formatFullDate` | | |
| 22 | Iniciales del cliente para el avatar | `getInitials` | | |

## Detalle de una solicitud

| # | Función actual | Método(s) | Dónde queda | Comprobado |
|---|---|---|---|---|
| 23 | Abrir el detalle de una solicitud | `selectRequest` | | |
| 24 | Navegar a la anterior / siguiente (botones y flechas ← →), contador "3 / 10" | `goToAdjacent`, `selectedIndex` | | |
| 25 | Cerrar con Esc o tocando fuera | `onKeydown`, `closeModal` | | |
| 26 | Contacto: teléfono, email y fecha, con botón copiar | `copyText` | | |
| 27 | Resumen: servicio, web, estado y referencia corta `#ABCD1234` | `shortId` | | |
| 28 | Descripción del cliente | plantilla | | |
| 29 | Información adicional de `details` (claves legibles, valores formateados: Sí/No, listas, objetos) | `getDetails`, `formatDetailKey`, `formatDetailValue` | | |
| 30 | Fotos adjuntas (abrir en pestaña nueva) | plantilla | | |
| 31 | Seguimiento: recibida → revisada con fechas | plantilla | | |
| 32 | WhatsApp (normaliza a prefijo 34 si tiene 9 cifras, quita `00`) | `getWhatsappUrl` | | |
| 33 | Llamar (`tel:`) y enviar email (`mailto:`) | plantilla | | |
| 34 | Marcar como revisada | `markAsReviewed` | | |
| 35 | Volver a pendientes | `markAsPending` | | |
| 36 | Eliminar con confirmación | `askDelete`, `confirmDelete` | | |

## Acciones múltiples

| # | Función actual | Método(s) | Dónde queda | Comprobado |
|---|---|---|---|---|
| 37 | Modo selección, seleccionar / quitar todas las visibles | `toggleSelectionMode`, `toggleSelectAll` | | |
| 38 | Marcar varias como revisadas | `markSelectedAsReviewed` | | |
| 39 | Eliminar varias con confirmación (detecta borrado bloqueado por RLS) | `askDeleteSelected`, `confirmDelete` | | |

## Apariencia y avisos

| # | Función actual | Método(s) | Dónde queda | Comprobado |
|---|---|---|---|---|
| 40 | Modo claro / oscuro / automático, recordado | `setThemeMode`, `toggleDarkMode` | | |
| 41 | 8 colores principales, recordado | `setAccent`, `accentOptions` | | |
| 42 | Color de la barra del navegador según el modo | `applyDocumentTheme` | | |
| 43 | Avisos de éxito (toast 3,5 s) y de error con cierre | `showSuccess`, `clearMessages` | | |
| 44 | Datos de la cuenta (email, iniciales) | plantilla | | |
