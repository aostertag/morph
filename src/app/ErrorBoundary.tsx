import { Component, type ErrorInfo, type ReactNode } from 'react';
import { describeStorageError } from '@/db/errors';

interface State {
  readonly error: unknown;
}

/** Último recurso: muestra un mensaje claro en lugar de una pantalla en blanco. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error(error, info.componentStack);
  }

  override render() {
    if (this.state.error === null) return this.props.children;
    return (
      <div role="alert" className="mx-auto max-w-list px-gutter py-16">
        <p className="label-caps">Algo ha fallado</p>
        <p className="mt-2 text-xl font-medium">{describeStorageError(this.state.error)}</p>
        <p className="mt-4 text-md text-text-muted">
          Tus datos guardados no se han tocado. Recargar la página suele resolverlo.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="pressable mt-6 min-h-touch rounded-md bg-accent px-4 font-medium text-on-accent"
        >
          Recargar
        </button>
      </div>
    );
  }
}
