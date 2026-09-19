import { ChartColumn, CircleCheck, ListChecks, Settings } from 'lucide-react';
import { NavLink, Outlet } from 'react-router';
import { cx } from '@/lib/cx';

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

export function Layout() {
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
        className="mx-auto w-full max-w-6xl px-gutter pt-6 pb-[calc(3.5rem+env(safe-area-inset-bottom)+2rem)] lg:px-gutter-desktop lg:pt-10 lg:pb-16"
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
