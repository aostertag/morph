import { ButtonLink } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';

export function NotFound() {
  return (
    <EmptyState
      standalone
      title="Esta página no existe."
      actions={<ButtonLink to="/">Ir a Hoy</ButtonLink>}
    />
  );
}
