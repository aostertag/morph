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

export function NotFound() {
  return (
    <EmptyState title="Esta página no existe." actions={<ButtonLink to="/">Ir a Hoy</ButtonLink>} />
  );
}
