/**
 * Traducción de errores de IndexedDB/Dexie a mensajes claros para el usuario.
 */

export class StorageError extends Error {
  override readonly name = 'StorageError';

  constructor(
    readonly userMessage: string,
    options?: { cause?: unknown },
  ) {
    super(userMessage, options);
  }
}

const MESSAGES: Readonly<Record<string, string>> = {
  QuotaExceededError:
    'No queda espacio en este dispositivo para guardar datos. Libera espacio o exporta un backup y borra registros antiguos.',
  MissingAPIError:
    'Este navegador no permite guardar datos locales. Si estás en una ventana privada, abre la app en una ventana normal.',
  OpenFailedError:
    'No se pudo abrir la base de datos local. Puede que el navegador la tenga bloqueada o esté en modo privado.',
  InvalidStateError:
    'No se pudo abrir la base de datos local. Puede que el navegador la tenga bloqueada o esté en modo privado.',
  VersionError:
    'Los datos guardados son de una versión más reciente de la app. Recarga la página para actualizarla.',
  UpgradeError:
    'No se pudieron actualizar los datos guardados a la nueva versión. Tus datos siguen intactos; recarga la página.',
  DatabaseClosedError: 'Se cerró la conexión con los datos locales. Recarga la página.',
  ConstraintError: 'Ese registro ya existe. Recarga la página e inténtalo de nuevo.',
  AbortError: 'La operación se interrumpió y no se guardó nada. Inténtalo de nuevo.',
  TimeoutError: 'La operación tardó demasiado y no se guardó nada. Inténtalo de nuevo.',
  TransactionInactiveError: 'La operación se interrumpió y no se guardó nada. Inténtalo de nuevo.',
};

const FALLBACK = 'No se pudo guardar el cambio en el almacenamiento local. Inténtalo de nuevo.';

/** Nombre del error más concreto conocido. Dexie envuelve el error nativo en `inner`. */
function errorName(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const inner = 'inner' in error ? errorName(error.inner) : undefined;
  if (inner && inner in MESSAGES) return inner;
  const name = 'name' in error && typeof error.name === 'string' ? error.name : undefined;
  return name && name in MESSAGES ? name : inner;
}

export function describeStorageError(error: unknown): string {
  if (error instanceof StorageError) return error.userMessage;
  const name = errorName(error);
  return (name && MESSAGES[name]) || FALLBACK;
}

/** Ejecuta una operación de almacenamiento y convierte cualquier fallo en `StorageError`. */
export async function withStorage<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof StorageError || error instanceof ValidationError) throw error;
    throw new StorageError(describeStorageError(error), { cause: error });
  }
}

/** Datos rechazados por las reglas del dominio antes de llegar a guardarse. */
export class ValidationError extends Error {
  override readonly name = 'ValidationError';

  constructor(
    message: string,
    readonly fields: Readonly<Record<string, string>> = {},
  ) {
    super(message);
  }
}
