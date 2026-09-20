import { Dialog } from '@base-ui/react/dialog';
import type { ReactNode } from 'react';
import { useShortcutsDialog } from '@/state/shortcutsDialog';
import { buttonClasses } from '@/ui/Button';

function Key({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex min-w-6 items-center justify-center rounded-sm border border-border-strong bg-surface px-1.5 text-sm font-medium">
      {children}
    </kbd>
  );
}

function Row({ keys, children }: { keys: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-4 border-b border-border py-2.5">
      <dt className="flex w-28 shrink-0 flex-wrap items-center gap-1">{keys}</dt>
      <dd className="min-w-0 flex-1 text-md">{children}</dd>
    </div>
  );
}

/** Diálogo con todos los atajos. Se carga bajo demanda: ver `GlobalShortcuts`. */
export default function ShortcutsDialog() {
  const open = useShortcutsDialog((state) => state.open);
  const setOpen = useShortcutsDialog((state) => state.setOpen);

  return (
    <Dialog.Root open={open} onOpenChange={(next) => setOpen(next)}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-scrim transition-opacity duration-(--duration-base) data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-lg bg-surface p-6 shadow-overlay transition-[opacity,scale] duration-(--duration-base) ease-(--ease-out) data-ending-style:scale-[0.97] data-ending-style:opacity-0 data-starting-style:scale-[0.97] data-starting-style:opacity-0">
          <div className="flex flex-col gap-1">
            <Dialog.Title className="text-lg font-semibold">Atajos de teclado</Dialog.Title>
            <Dialog.Description className="text-md text-text-muted">
              Para escritorio. No actúan mientras escribes en un campo.
            </Dialog.Description>
          </div>

          <div>
            <h3 className="label-caps border-b border-border pb-2">Pantalla Hoy</h3>
            <dl>
              <Row
                keys={
                  <>
                    <Key>1</Key>
                    <span aria-hidden="true">–</span>
                    <Key>9</Key>
                  </>
                }
              >
                Marca el hábito con ese número. En cantidades suma un paso; en tiempo inicia o
                detiene el cronómetro; en «a evitar» registra o quita una recaída.
              </Row>
              <Row keys={<Key>←</Key>}>Día anterior.</Row>
              <Row keys={<Key>→</Key>}>Día siguiente.</Row>
            </dl>
          </div>

          <div>
            <h3 className="label-caps border-b border-border pb-2">En cualquier pantalla</h3>
            <dl>
              <Row keys={<Key>N</Key>}>Nuevo hábito.</Row>
              <Row keys={<Key>?</Key>}>Mostrar esta ayuda.</Row>
              <Row keys={<Key>Esc</Key>}>Cerrar un diálogo o un menú.</Row>
            </dl>
          </div>

          <div className="flex justify-end">
            <Dialog.Close className={buttonClasses('secondary')}>Cerrar</Dialog.Close>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
