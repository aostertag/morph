import { AlertDialog } from '@base-ui/react/alert-dialog';
import type { ReactNode } from 'react';
import { buttonClasses } from './Button';

interface ConfirmDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly description: ReactNode;
  readonly confirmLabel: string;
  readonly onConfirm: () => void;
  readonly destructive?: boolean;
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
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={(next) => onOpenChange(next)}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 bg-scrim transition-opacity duration-(--duration-base) data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <AlertDialog.Popup className="fixed top-1/2 left-1/2 flex w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-6 rounded-lg bg-surface p-6 shadow-overlay transition-[opacity,scale] duration-(--duration-base) ease-(--ease-out) data-ending-style:scale-[0.97] data-ending-style:opacity-0 data-starting-style:scale-[0.97] data-starting-style:opacity-0">
          <div className="flex flex-col gap-2">
            <AlertDialog.Title className="text-lg font-semibold">{title}</AlertDialog.Title>
            <AlertDialog.Description className="text-md text-text-muted">
              {description}
            </AlertDialog.Description>
          </div>
          <div className="flex flex-wrap justify-end gap-3">
            <AlertDialog.Close className={buttonClasses('secondary')}>Cancelar</AlertDialog.Close>
            <button
              type="button"
              className={buttonClasses(destructive ? 'danger' : 'primary')}
              onClick={() => {
                onConfirm();
                onOpenChange(false);
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
