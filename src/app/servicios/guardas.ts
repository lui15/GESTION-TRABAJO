import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { SupabaseService } from './supabase.service';

/** Solo con sesión iniciada; si no, al login. */
export const conSesion: CanActivateFn = async () => {
  const sb = inject(SupabaseService);
  const router = inject(Router);

  await sb.listoPromesa;

  return sb.usuario() ? true : router.createUrlTree(['/login']);
};

/** El login solo sin sesión; si ya hay, a la lista. */
export const sinSesion: CanActivateFn = async () => {
  const sb = inject(SupabaseService);
  const router = inject(Router);

  await sb.listoPromesa;

  return sb.usuario() ? router.createUrlTree(['/solicitudes']) : true;
};
