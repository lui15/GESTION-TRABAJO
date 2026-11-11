/** Traduce los errores de Supabase a mensajes claros en español. */
export function traducirError(error: unknown): string {
  const mensaje = (error as { message?: string } | null)?.message ?? '';

  if (mensaje === 'TIMEOUT_SUPABASE') {
    return 'Supabase está tardando demasiado en responder. Comprueba la conexión.';
  }

  if (mensaje === 'DELETE_BLOCKED') {
    return 'Supabase no ha permitido eliminar. Falta activar el permiso de borrado en la base de datos.';
  }

  if (mensaje === 'TIMEOUT_REQUESTS') {
    return 'Las solicitudes tardan demasiado en cargar. Tira hacia abajo para reintentar.';
  }

  if (mensaje.includes('Invalid login credentials')) {
    return 'Correo o contraseña incorrectos.';
  }

  if (mensaje.includes('Failed to fetch') || mensaje.includes('NetworkError')) {
    return 'No se pudo conectar. Comprueba tu conexión a internet.';
  }

  if (mensaje.includes('relation') || mensaje.includes('does not exist')) {
    return 'No se encuentra la tabla en Supabase. Comprueba que existe.';
  }

  if (mensaje.includes('permission denied') || mensaje.includes('row-level security')) {
    return 'No tienes permisos para acceder a estos datos. Revisa las políticas de seguridad de Supabase.';
  }

  if (mensaje.includes('JWT') || mensaje.includes('Invalid API key')) {
    return 'La clave pública de Supabase no es válida. Comprueba la configuración.';
  }

  return mensaje || 'Ha ocurrido un error inesperado.';
}

/** Promesa que falla con `codigo` si `promesa` tarda más de `ms`. */
export function conTiempoLimite<T>(promesa: PromiseLike<T>, ms: number, codigo: string): Promise<T> {
  let temporizador: ReturnType<typeof setTimeout>;

  const limite = new Promise<never>((_, rechazar) => {
    temporizador = setTimeout(() => rechazar(new Error(codigo)), ms);
  });

  return Promise.race([Promise.resolve(promesa), limite]).finally(() => clearTimeout(temporizador));
}
