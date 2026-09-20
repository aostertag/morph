import { AlertDialog } from '@base-ui/react/alert-dialog';
import { type ReactNode, useId, useState } from 'react';
import { buttonClasses } from './Button';
import { inputClasses } from './Field';

interface ConfirmDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly description: ReactNode;
  readonly confirmLabel: string;
  readonly onConfirm: () => void;
  readonly destructive?: boolean;
  /** Contenido extra bajo la descripción (un resumen, una acción alternativa). */
  readonly children?: ReactNode;
  /** Si se indica, hay que escribirla tal cual para poder confirmar. */
  readonly confirmPhrase?: string;
}

/** Confirmación modal. El foco empieza en "Cancelar" para que la acción no se dispare sin querer. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  destructive = false,
  children,
  confirmPhrase,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('');
  const phraseId = useId();
  const blocked = confirmPhrase !== undefined && typed.trim() !== confirmPhrase;
  const change = (next: boolean) => {
    if (!next) setTyped('');
    onOpenChange(next);
  };

  return (
    <AlertDialog.Root open={open} onOpenChange={(next) => change(next)}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 bg-scrim transition-opacity duration-(--duration-base) data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <AlertDialog.Popup className="fixed top-1/2 left-1/2 flex w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-6 rounded-lg bg-surface p-6 shadow-overlay transition-[opacity,scale] duration-(--duration-base) ease-(--ease-out) data-ending-style:scale-[0.97] data-ending-style:opacity-0 data-starting-style:scale-[0.97] data-starting-style:opacity-0">
          <div className="flex flex-col gap-2">
            <AlertDialog.Title className="text-lg font-semibold">{title}</AlertDialog.Title>
            <AlertDialog.Description className="text-md text-text-muted">
              {description}
            </AlertDialog.Description>
          </div>
          {children}
          {confirmPhrase !== undefined && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={phraseId} className="text-md font-medium">
                Escribe «{confirmPhrase}» para confirmar
              </label>
              <input
                id={phraseId}
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                className={inputClasses}
              />
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-3">
            <AlertDialog.Close className={buttonClasses('secondary')}>Cancelar</AlertDialog.Close>
            <button
              type="button"
              className={buttonClasses(destructive ? 'danger' : 'primary')}
              disabled={blocked}
              onClick={() => {
                onConfirm();
                change(false);
              }}
            >
              {confirmLabel}
            </button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
