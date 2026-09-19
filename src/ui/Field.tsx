import { type ReactNode, useId } from 'react';
import { cx } from '@/lib/cx';

export const inputClasses = cx(
  'min-h-touch w-full rounded-md border border-border-strong bg-surface px-3 text-base text-text',
  'placeholder:text-text-faint aria-invalid:border-danger disabled:opacity-50',
);

export interface FieldControlProps {
  readonly id: string;
  readonly 'aria-describedby': string | undefined;
  readonly 'aria-invalid': boolean | undefined;
}

interface FieldProps {
  readonly label: string;
  readonly description?: string | undefined;
  readonly error?: string | undefined;
  readonly className?: string;
  readonly children: (props: FieldControlProps) => ReactNode;
}

/** Etiqueta, ayuda y error conectados al control por ARIA. */
export function Field({ label, description, error, className, children }: FieldProps) {
  const id = useId();
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-md font-medium">
        {label}
      </label>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
      {description && (
        <p id={descriptionId} className="text-sm text-text-muted">
          {description}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

interface FieldsetProps {
  readonly legend: string;
  readonly description?: string | undefined;
  readonly error?: string | undefined;
  readonly className?: string;
  readonly children: ReactNode;
}

/** Grupo de controles (radios, casillas) con su leyenda. */
export function Fieldset({ legend, description, error, className, children }: FieldsetProps) {
  const id = useId();
  return (
    <fieldset
      className={cx('flex min-w-0 flex-col gap-1.5', className)}
      aria-describedby={
        [description && `${id}-d`, error && `${id}-e`].filter(Boolean).join(' ') || undefined
      }
    >
      <legend className="mb-1.5 text-md font-medium">{legend}</legend>
      {children}
      {description && (
        <p id={`${id}-d`} className="text-sm text-text-muted">
          {description}
        </p>
      )}
      {error && (
        <p id={`${id}-e`} className="text-sm text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}
