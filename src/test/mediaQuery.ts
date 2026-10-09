import { LG_QUERY } from '@/hooks/useMediaQuery';

/** Una `MediaQueryList` mínima. Con `listeners`, guarda los avisos de cambio para que el test los dispare. */
export function mediaQueryList(
  query: string,
  matches: boolean,
  listeners?: Set<() => void>,
): MediaQueryList {
  return {
    matches,
    media: query,
    onchange: null,
    addEventListener: (_type: string, listener: unknown) => {
      if (typeof listener === 'function') listeners?.add(listener as () => void);
    },
    removeEventListener: (_type: string, listener: unknown) => {
      if (typeof listener === 'function') listeners?.delete(listener as () => void);
    },
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  } as MediaQueryList;
}

/** Los tests de UI corren «en escritorio»: cumplen `lg` y nada más (ni tema oscuro ni movimiento reducido). */
export function desktopMatchMedia(query: string): MediaQueryList {
  return mediaQueryList(query, query === LG_QUERY);
}
