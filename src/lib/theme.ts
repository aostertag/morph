import type { ThemePreference } from '@/domain/types';

export type ResolvedTheme = 'light' | 'dark';

/**
 * Copia local de la preferencia para aplicarla antes del primer pintado
 * (los ajustes viven en IndexedDB, que es asíncrono). Si el almacenamiento no está
 * disponible, simplemente se sigue el tema del sistema.
 */
export const THEME_STORAGE_KEY = 'tracker:theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference === 'system') return systemPrefersDark ? 'dark' : 'light';
  return preference;
}

export function readCachedPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    if (value === 'light' || value === 'dark' || value === 'system') return value;
  } catch {
    // Almacenamiento bloqueado (modo privado, permisos): se usa el sistema.
  }
  return 'system';
}

function cachePreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Sin almacenamiento el tema se aplica igual durante la sesión.
  }
}

/**
 * Aplica la preferencia en `<html data-theme>` y, si es "sistema", sigue los
 * cambios del sistema operativo. Devuelve la función que deja de escuchar.
 */
export function applyTheme(
  preference: ThemePreference,
  onResolved?: (theme: ResolvedTheme) => void,
): () => void {
  cachePreference(preference);
  const media = window.matchMedia(DARK_QUERY);
  const update = () => {
    const theme = resolveTheme(preference, media.matches);
    document.documentElement.dataset.theme = theme;
    onResolved?.(theme);
  };
  update();
  if (preference !== 'system') return () => {};
  media.addEventListener('change', update);
  return () => media.removeEventListener('change', update);
}
