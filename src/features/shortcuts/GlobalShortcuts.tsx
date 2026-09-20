import { lazy, Suspense, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useShortcuts } from '@/hooks/useShortcuts';
import { useShortcutsDialog } from '@/state/shortcutsDialog';

// El diálogo arrastra Base UI: no debe entrar en el chunk de Hoy.
const ShortcutsDialog = lazy(() => import('./ShortcutsDialog'));

/**
 * Atajos que valen en cualquier pantalla (`N` y `?`). Los de la pantalla Hoy
 * (números y flechas) los gestiona esa pantalla.
 */
export function GlobalShortcuts() {
  const navigate = useNavigate();
  const location = useLocation();
  const open = useShortcutsDialog((state) => state.open);
  const setOpen = useShortcutsDialog((state) => state.setOpen);
  // Una vez cargado, el diálogo se queda montado para poder animar el cierre.
  const [loaded, setLoaded] = useState(false);
  if (open && !loaded) setLoaded(true);

  useShortcuts((shortcut) => {
    if (shortcut.type === 'help') setOpen(true);
    if (shortcut.type === 'newHabit') {
      navigate(location.pathname === '/' ? '/habitos/nuevo?volver=hoy' : '/habitos/nuevo');
    }
  });

  return loaded ? (
    <Suspense fallback={null}>
      <ShortcutsDialog />
    </Suspense>
  ) : null;
}
