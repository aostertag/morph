import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { Toaster } from 'sonner';
import { db } from '@/db/schema';
import { TodayScreen } from '@/features/today/TodayScreen';
import { useSettings } from '@/hooks/useData';
import { applyTheme, type ResolvedTheme, readCachedPreference } from '@/lib/theme';
import { ErrorBoundary } from './ErrorBoundary';
import { Layout } from './Layout';
import { NotFound, Placeholder } from './Placeholder';

// La gestión de hábitos (arrastrar, menús, diálogos) se carga bajo demanda: Hoy abre antes.
const HabitsScreen = lazy(() =>
  import('@/features/habits/HabitsScreen').then((m) => ({ default: m.HabitsScreen })),
);
const NewHabitScreen = lazy(() =>
  import('@/features/habits/HabitFormScreens').then((m) => ({ default: m.NewHabitScreen })),
);
const EditHabitScreen = lazy(() =>
  import('@/features/habits/HabitFormScreens').then((m) => ({ default: m.EditHabitScreen })),
);
// Las estadísticas y el detalle cargan Recharts, que no debe entrar en el bundle de Hoy.
const StatsScreen = lazy(() =>
  import('@/features/stats/StatsScreen').then((m) => ({ default: m.StatsScreen })),
);
const ReviewScreen = lazy(() =>
  import('@/features/review/ReviewScreen').then((m) => ({ default: m.ReviewScreen })),
);
const HabitDetailScreen = lazy(() =>
  import('@/features/habit-detail/HabitDetailScreen').then((m) => ({
    default: m.HabitDetailScreen,
  })),
);

function initialResolvedTheme(): ResolvedTheme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

/** Otra pestaña abrió una versión nueva de la base de datos: esta debe recargarse. */
function useOutdatedDatabase(): boolean {
  const [outdated, setOutdated] = useState(false);
  useEffect(() => {
    const onVersionChange = () => {
      setOutdated(true);
    };
    db.on('versionchange', onVersionChange);
    return () => db.on('versionchange').unsubscribe(onVersionChange);
  }, []);
  return outdated;
}

function AppShell() {
  const settings = useSettings();
  const [theme, setTheme] = useState<ResolvedTheme>(initialResolvedTheme);
  const preference = settings?.theme ?? readCachedPreference();
  const outdated = useOutdatedDatabase();

  useEffect(() => applyTheme(preference, setTheme), [preference]);

  return (
    <>
      {outdated && (
        <div role="alert" className="border-b border-border bg-surface px-gutter py-3 text-md">
          La app se ha actualizado en otra pestaña.{' '}
          <button
            type="button"
            className="font-medium text-accent underline"
            onClick={() => window.location.reload()}
          >
            Recarga esta página
          </button>{' '}
          para seguir guardando cambios.
        </div>
      )}
      <Suspense fallback={null}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<TodayScreen />} />
            <Route path="habitos" element={<HabitsScreen />} />
            <Route path="habitos/nuevo" element={<NewHabitScreen />} />
            <Route path="habitos/:id" element={<HabitDetailScreen />} />
            <Route path="habitos/:id/editar" element={<EditHabitScreen />} />
            <Route path="estadisticas" element={<StatsScreen />} />
            <Route path="revision" element={<ReviewScreen />} />
            <Route path="ajustes" element={<Placeholder title="Ajustes" phase={6} />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
      <Toaster
        theme={theme}
        position="bottom-center"
        visibleToasts={3}
        offset={{ bottom: 32 }}
        mobileOffset={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom) + 12px)' }}
        containerAriaLabel="Notificaciones"
      />
    </>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
