import { Menu } from '@base-ui/react/menu';
import { Ellipsis } from 'lucide-react';
import { cx } from '@/lib/cx';

export interface MenuAction {
  readonly label: string;
  readonly onSelect: () => void;
  readonly destructive?: boolean;
  readonly disabled?: boolean;
}

interface ActionsMenuProps {
  /** Texto accesible del botón, p. ej. "Acciones de Leer". */
  readonly label: string;
  readonly actions: readonly MenuAction[];
}

export function ActionsMenu({ label, actions }: ActionsMenuProps) {
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={label}
        title={label}
        className="pressable inline-flex size-touch shrink-0 items-center justify-center rounded-md text-text-muted transition-colors duration-(--duration-fast) hover:bg-sunken hover:text-text data-popup-open:bg-sunken"
      >
        <Ellipsis size={20} aria-hidden="true" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={4} align="end" className="z-40 outline-none">
          <Menu.Popup className="min-w-44 origin-(--transform-origin) rounded-md bg-surface py-1 shadow-overlay outline-none transition-[opacity,scale] duration-(--duration-fast) ease-(--ease-out) data-ending-style:scale-[0.97] data-ending-style:opacity-0 data-starting-style:scale-[0.97] data-starting-style:opacity-0">
            {actions.map((action) => (
              <Menu.Item
                key={action.label}
                disabled={action.disabled}
                onClick={action.onSelect}
                className={cx(
                  'flex min-h-touch cursor-default items-center px-4 text-md outline-none select-none',
                  'data-highlighted:bg-sunken data-disabled:opacity-50',
                  action.destructive && 'text-danger',
                )}
              >
                {action.label}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
