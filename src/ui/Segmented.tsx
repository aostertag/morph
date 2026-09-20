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
  /** En pantallas estrechas reparte las opciones en dos columnas en vez de una fila. */
  readonly wrap?: boolean;
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
  wrap = false,
}: SegmentedProps<T>) {
  return (
    <div
      className={cx(
        // Las divisorias son el hueco de 1px sobre el color del borde: así todas las líneas
        // (exterior e interiores) tienen el mismo grosor, también cuando pasa a dos filas.
        'grid auto-cols-fr grid-flow-col gap-px overflow-hidden rounded-md border border-border-strong bg-border-strong',
        wrap && 'max-sm:grid-flow-row max-sm:grid-cols-2',
        className,
      )}
    >
      {options.map((option) => (
        <label
          key={option.value}
          className={cx(
            'flex min-h-touch cursor-pointer items-center justify-center bg-bg px-2 text-center text-md',
            wrap && 'max-sm:last:odd:col-span-2',
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
