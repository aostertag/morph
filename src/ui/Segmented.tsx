import { cx } from '@/lib/cx';

export interface SegmentedOption<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly disabled?: boolean;
}

interface SegmentedProps<T extends string> {
  readonly name: string;
  readonly options: readonly SegmentedOption<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly className?: string;
}

/**
 * Selector de una opción entre pocas. Son radios nativos: flechas para moverse
 * y lectura correcta en lectores de pantalla. Va dentro de un Fieldset con leyenda.
 */
export function Segmented<T extends string>({
  name,
  options,
  value,
  onChange,
  className,
}: SegmentedProps<T>) {
  return (
    <div
      className={cx(
        'grid auto-cols-fr grid-flow-col overflow-hidden rounded-md border border-border-strong',
        className,
      )}
    >
      {options.map((option) => (
        <label
          key={option.value}
          className={cx(
            'flex min-h-touch cursor-pointer items-center justify-center border-border-strong px-2 text-center text-md not-first:border-l',
            'transition-colors duration-(--duration-fast)',
            'has-checked:bg-text has-checked:font-medium has-checked:text-bg',
            'has-focus-visible:relative has-focus-visible:outline-2 has-focus-visible:-outline-offset-4 has-focus-visible:outline-accent',
            'has-disabled:cursor-not-allowed has-disabled:text-text-faint has-disabled:opacity-60',
            'hover:not-has-checked:not-has-disabled:bg-sunken',
          )}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            disabled={option.disabled}
            onChange={() => onChange(option.value)}
            className="sr-only"
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}
