import { toast } from 'sonner';
import { describeStorageError } from '@/db/errors';

/*
 * Notificaciones con "deshacer". Se usan toasts headless de Sonner para que el
 * aspecto salga de nuestros tokens (plano, con borde, sin color por tipo).
 */

type Undo = () => Promise<void>;

/**
 * Deshacer agrupado por clave: si llegan varias acciones seguidas sobre lo mismo
 * (pulsar + tres veces), el toast se actualiza y "Deshacer" vuelve al estado
 * anterior a la primera, no solo a la última.
 */
const undoAnchors = new Map<string, Undo>();

interface NotifyOptions {
  /** Agrupa notificaciones sobre el mismo objeto en un único toast. */
  readonly key?: string;
  readonly undo?: Undo;
  /** Acción propia (p. ej. "Recargar"); si hay `undo`, manda `undo`. */
  readonly action?: { readonly label: string; readonly run: () => void };
  /** El aviso no desaparece solo. */
  readonly persist?: boolean;
}

function ToastCard({
  id,
  message,
  tone,
  undo,
  action,
  onSettled,
}: {
  id: string | number;
  message: string;
  tone: 'neutral' | 'error';
  undo: Undo | undefined;
  action?: NotifyOptions['action'];
  onSettled: () => void;
}) {
  return (
    <div className="flex w-[min(22rem,calc(100vw-2rem))] items-center gap-3 rounded-md border border-border bg-surface py-2 pr-2 pl-4 text-md shadow-overlay">
      <p className={tone === 'error' ? 'flex-1 py-1.5 text-danger' : 'flex-1 py-1.5'}>{message}</p>
      {!undo && action && (
        <button
          type="button"
          className="pressable min-h-touch shrink-0 rounded-md px-3 font-medium text-accent hover:bg-sunken"
          onClick={() => {
            toast.dismiss(id);
            action.run();
          }}
        >
          {action.label}
        </button>
      )}
      {undo && (
        <button
          type="button"
          className="pressable min-h-touch shrink-0 rounded-md px-3 font-medium text-accent hover:bg-sunken"
          onClick={() => {
            toast.dismiss(id);
            onSettled();
            undo().catch(notifyError);
          }}
        >
          Deshacer
        </button>
      )}
    </div>
  );
}

export function notify(message: string, options: NotifyOptions = {}): void {
  const { key } = options;
  let undo = options.undo;
  if (key && undo) {
    const anchor = undoAnchors.get(key);
    if (anchor) undo = anchor;
    else undoAnchors.set(key, undo);
  }
  const settle = () => {
    if (key) undoAnchors.delete(key);
  };
  toast.custom(
    (id) => (
      <ToastCard
        id={id}
        message={message}
        tone="neutral"
        undo={undo}
        {...(options.action ? { action: options.action } : {})}
        onSettled={settle}
      />
    ),
    {
      ...(key ? { id: key } : {}),
      duration: options.persist ? Number.POSITIVE_INFINITY : undo ? 6000 : 3500,
      onDismiss: settle,
      onAutoClose: settle,
    },
  );
}

/** Muestra un error con un mensaje claro (nunca el técnico). */
export function notifyError(error: unknown): void {
  const message =
    error instanceof Error && error.name === 'ValidationError'
      ? error.message
      : describeStorageError(error);
  toast.custom(
    (id) => (
      <ToastCard id={id} message={message} tone="error" undo={undefined} onSettled={() => {}} />
    ),
    { duration: 8000 },
  );
}
