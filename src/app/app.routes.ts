import { Routes } from '@angular/router';

import { conSesion, sinSesion } from './servicios/guardas';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [sinSesion],
    loadComponent: () => import('./paginas/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'solicitud/:id',
    canActivate: [conSesion],
    loadComponent: () => import('./paginas/solicitud/solicitud.page').then((m) => m.SolicitudPage),
  },
  {
    path: '',
    canActivate: [conSesion],
    loadComponent: () => import('./paginas/pestanas/pestanas.page').then((m) => m.PestanasPage),
    children: [
      {
        path: 'solicitudes',
        loadComponent: () =>
          import('./paginas/solicitudes/solicitudes.page').then((m) => m.SolicitudesPage),
      },
      {
        path: 'por-web',
        loadComponent: () => import('./paginas/por-web/por-web.page').then((m) => m.PorWebPage),
      },
      {
        path: 'ajustes',
        loadComponent: () => import('./paginas/ajustes/ajustes.page').then((m) => m.AjustesPage),
      },
      { path: '', pathMatch: 'full', redirectTo: 'solicitudes' },
    ],
  },
  { path: '**', redirectTo: 'solicitudes' },
];
