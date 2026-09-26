import { ChartColumn, CircleCheck, ListChecks, Settings } from 'lucide-react';
import { type RefObject, useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation, useNavigationType } from 'react-router';
import { cx } from '@/lib/cx';
import { routeTitle } from './routeTitle';
import { readScroll, writeScroll } from './scrollMemory';

const NAV = [
  { to: '/', label: 'Hoy', icon: CircleCheck, end: true },
  { to: '/estadisticas', label: 'Estadísticas', icon: ChartColumn, end: false },
  { to: '/habitos', label: 'Hábitos', icon: ListChecks, end: false },
  { to: '/ajustes', label: 'Ajustes', icon: Settings, end: false },
] as const;

function NavItems({ orientation }: { orientation: 'bar' | 'rail' }) {
  return (
    <ul className={orientation === 'bar' ? 'grid grid-cols-4' : 'flex flex-col gap-1'}>
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <li key={to}>
          <NavLink
            to={to}
            end={end}
            className={({ isActive }) =>
              cx(
                'flex flex-col items-center justify-center gap-1 text-xs transition-colors duration-(--duration-fast)',
                orientation === 'bar' ? 'h-14' : 'h-16 rounded-md hover:bg-sunken',
                isActive ? 'font-semibold text-text' : 'text-text-muted hover:text-text',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={20} strokeWidth={isActive ? 2.25 : 1.75} aria-hidden="true" />
                {label}
              </>
            )}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

/**
 * Al cambiar de pantalla: pone el título de la pestaña y lleva el foco al contenido,
 * para que quien navega con teclado o lector de pantalla no se quede en el menú. Al
 * cargar la página solo se pone el título; los cambios de día (solo la URL de
 * búsqueda) no mueven el foco.
 */
function useRouteAnnouncement(main: RefObject<HTMLElement | null>): void {
  const { pathname } = useLocation();
  const first = useRef(true);
  useEffect(() => {
    document.title = routeTitle(pathname);
    if (first.current) {
      first.current = false;
      return;
    }
    main.current?.focus({ preventScroll: true });
  }, [pathname, main]);
}

/** La carga actual es una recarga o una vuelta atrás desde otro sitio (no una visita nueva). */
function isReload(): boolean {
  const [nav] = performance.getEntriesByType('navigation');
  const kind = (nav as PerformanceNavigationTiming | undefined)?.type;
  return kind === 'reload' || kind === 'back_forward';
}

/**
 * Posición de desplazamiento entre pantallas. Una navegación del cliente no recarga la
 * página, así que sin esto el `scrollY` de la pantalla anterior se hereda y el navegador
 * lo recorta al alto de la nueva (Ajustes al final → Privacidad abría abajo).
 *
 * - Ir a otra ruta (enlace, pestaña, `navigate`) empieza arriba.
 * - Los cambios que solo tocan la URL de búsqueda (`?dia=`, rango) no mueven nada.
 * - Atrás/adelante (`POP`) recupera la posición guardada de esa entrada del historial. Se
 *   hace a mano: la restauración nativa pierde la carrera contra las pantallas `lazy()`,
 *   que aún no existen (documento corto) cuando el navegador intenta restaurar.
 *
 * La posición se guarda al **iniciar** la navegación (clic, tecla o `popstate`, en fase de
 * captura, antes de que el router cambie nada), no escuchando `scroll`: al montarse la
 * pantalla nueva el documento se encoge y el navegador recorta el desplazamiento —a 0
 * incluso—, y ese evento llegaba a pisar lo guardado antes de limpiar el listener.
 */
function useRouteScroll(): void {
  const { pathname, key } = useLocation();
  const type = useNavigationType();
  const previous = useRef<string | null>(null);
  const current = useRef({ key, pathname });
  current.current = { key, pathname };
  const restoring = useRef(false);

  useEffect(() => {
    if (typeof history !== 'undefined') history.scrollRestoration = 'manual';
    const snapshot = () => {
      // Mientras se restaura, el `scrollY` es parcial: lo guardado sigue siendo el objetivo.
      if (!restoring.current)
        writeScroll(current.current.key, current.current.pathname, window.scrollY);
    };
    const events = ['click', 'keydown', 'popstate', 'pagehide'] as const;
    for (const ev of events) window.addEventListener(ev, snapshot, { capture: true });
    return () => {
      for (const ev of events) window.removeEventListener(ev, snapshot, { capture: true });
    };
  }, []);

  useEffect(() => {
    const firstLoad = previous.current === null;
    const changedRoute = !firstLoad && previous.current !== pathname;
    previous.current = pathname;
    const fresh = type !== 'POP' || (firstLoad && !isReload());
    const target = fresh ? (changedRoute ? 0 : null) : readScroll(key, pathname);
    if (target === null) return;

    window.scrollTo({ top: target, behavior: 'instant' });
    if (target === 0) return;

    // La pantalla puede tardar en tener alto (carga `lazy()`, datos): se reintenta unos instantes.
    restoring.current = true;
    const until = performance.now() + 1500;
    let frame = 0;
    const settle = () => {
      if (Math.abs(window.scrollY - target) < 2 || performance.now() > until) {
        restoring.current = false;
        return;
      }
      if (document.documentElement.scrollHeight - window.innerHeight >= target) {
        window.scrollTo({ top: target, behavior: 'instant' });
      }
      frame = requestAnimationFrame(settle);
    };
    frame = requestAnimationFrame(settle);
    // Si la persona se pone a desplazar, se deja de forzar.
    const stop = () => {
      cancelAnimationFrame(frame);
      restoring.current = false;
    };
    const inputs = ['wheel', 'touchstart', 'keydown'] as const;
    for (const ev of inputs) window.addEventListener(ev, stop, { once: true, passive: true });
    return () => {
      stop();
      for (const ev of inputs) window.removeEventListener(ev, stop);
    };
  }, [pathname, key, type]);
}

export function Layout() {
  const main = useRef<HTMLElement>(null);
  useRouteAnnouncement(main);
  useRouteScroll();
  return (
    <div className="min-h-dvh lg:flex">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2 focus:shadow-overlay"
      >
        Saltar al contenido
      </a>

      <nav
        aria-label="Principal"
        className="sticky top-0 hidden h-dvh w-24 shrink-0 border-r border-border px-2 py-6 lg:block"
      >
        <NavItems orientation="rail" />
      </nav>

      <main
        id="contenido"
        ref={main}
        tabIndex={-1}
        className="outline-none mx-auto w-full max-w-6xl px-gutter pt-6 pb-[calc(3.5rem+env(safe-area-inset-bottom)+2rem)] lg:px-gutter-desktop lg:pt-10 lg:pb-16"
      >
        <Outlet />
      </main>

      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <NavItems orientation="bar" />
      </nav>
    </div>
  );
}
