import { useEffect, useEffectEvent } from 'react';
import { overlayOpen, parseShortcut, type Shortcut, targetBlocksShortcut } from '@/lib/shortcuts';

/**
 * Escucha los atajos de teclado mientras el componente está montado. El manejador
 * recibe el atajo ya filtrado: no llega nada si se escribe en un campo, si hay un
 * diálogo o un menú abierto o si se pulsa con Ctrl, Alt o Meta.
 */
export function useShortcuts(handler: (shortcut: Shortcut) => void): void {
  const onShortcut = useEffectEvent(handler);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const shortcut = parseShortcut(event);
      if (!shortcut) return;
      if (overlayOpen(document)) return;
      if (targetBlocksShortcut(event.target as Element | null, shortcut)) return;
      onShortcut(shortcut);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);
}
