import { useLiveQuery } from 'dexie-react-hooks';
import { useParams } from 'react-router';
import { getHabit } from '@/db/repos/habits';
import { ButtonLink } from '@/ui/Button';
import { EmptyState, ScreenHeader } from '@/ui/EmptyState';

/** Secciones que llegan en fases posteriores. */
export function Placeholder({ title, phase }: { title: string; phase: number }) {
  return (
    <div className="max-w-list">
      <ScreenHeader title={title} />
      <EmptyState title="En preparación." text={`Esta sección llega en la fase ${phase}.`} />
    </div>
  );
}

export function HabitDetailPlaceholder() {
  const { id = '' } = useParams();
  const habit = useLiveQuery(async () => (await getHabit(id)) ?? null, [id]);
  if (habit === undefined) return null;
  if (habit === null) {
    return (
      <EmptyState
        title="Este hábito no existe."
        actions={<ButtonLink to="/habitos">Ver hábitos</ButtonLink>}
      />
    );
  }
  return (
    <div className="max-w-list">
      <ScreenHeader
        title={habit.name}
        actions={<ButtonLink to={`/habitos/${habit.id}/editar`}>Editar</ButtonLink>}
      />
      <EmptyState
        title="Detalle en preparación."
        text="El heatmap, las métricas y el historial llegan en la fase 3."
      />
    </div>
  );
}

export function NotFound() {
  return (
    <EmptyState title="Esta página no existe." actions={<ButtonLink to="/">Ir a Hoy</ButtonLink>} />
  );
}
