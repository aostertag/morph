import { Link } from 'react-router';
import type { Habit } from '@/domain/types';
import {
  type NotificationSupport,
  showReminder,
  useNotificationSupport,
} from '@/features/reminders/notifications';
import { Button } from '@/ui/Button';
import { ColorBar } from '@/ui/HabitMarks';

function describeSupport(support: NotificationSupport): string {
  switch (support) {
    case 'granted':
      return 'Las notificaciones están activadas.';
    case 'denied':
      return 'Has bloqueado las notificaciones de esta página. Para recibir avisos, permítelas desde los ajustes del navegador (suele estar en el icono junto a la dirección) y vuelve aquí.';
    case 'default':
      return 'Las notificaciones aún no están activadas.';
    case 'unsupported':
      return 'Este navegador no permite notificaciones.';
  }
}

/** Permiso de notificaciones y resumen de los recordatorios; la hora se fija en cada hábito. */
export function RemindersSection({ habits }: { habits: readonly Habit[] }) {
  const [support, request] = useNotificationSupport();
  const withReminder = habits.filter((h) => h.archivedOn === null && h.reminder?.enabled);
  const sample = withReminder[0] ?? habits.find((h) => h.archivedOn === null);

  return (
    <section aria-labelledby="recordatorios" className="mt-12">
      <h2 id="recordatorios" className="label-caps border-b border-border pb-2">
        Recordatorios
      </h2>

      <p className="mt-3 max-w-prose text-md">{describeSupport(support)}</p>
      <p className="mt-2 max-w-prose text-sm text-text-muted">
        La app no tiene servidor: los avisos solo salen mientras esté abierta o el navegador la
        mantenga activa en segundo plano. Si la cierras del todo, no habrá aviso.
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        {support === 'default' && (
          <Button variant="primary" onClick={() => void request()}>
            Activar notificaciones
          </Button>
        )}
        {support === 'granted' && sample && (
          <Button onClick={() => void showReminder(sample)}>Enviar un aviso de prueba</Button>
        )}
      </div>

      {withReminder.length === 0 ? (
        <p className="mt-4 text-md text-text-muted">
          Ningún hábito tiene recordatorio. Se fija al crear o editar un hábito.
        </p>
      ) : (
        <ul className="mt-4 border-t border-border">
          {withReminder.map((habit) => (
            <li key={habit.id} className="flex min-h-14 items-stretch gap-3 border-b border-border">
              <ColorBar color={habit.color} />
              <div className="flex min-w-0 flex-1 items-center justify-between gap-3 py-2">
                <Link
                  to={`/habitos/${habit.id}/editar`}
                  className="truncate underline-offset-4 hover:underline"
                >
                  {habit.name}
                </Link>
                <span className="shrink-0 whitespace-nowrap font-medium">
                  {habit.reminder?.time}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
