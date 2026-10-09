import { useCallback, useSyncExternalStore } from 'react';

/** Anchura desde la que Tailwind aplica `lg:` (64 rem; las media queries en rem miden contra 16 px). */
export const LG_QUERY = '(min-width: 64rem)';

/** `true` mientras se cumple la media query; se actualiza al cambiar. Sin `matchMedia`, `false`. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (notify: () => void) => {
      const list = window.matchMedia?.(query);
      list?.addEventListener('change', notify);
      return () => list?.removeEventListener('change', notify);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia?.(query).matches ?? false,
    () => false,
  );
}
