import type { ComponentProps, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import { cx } from '@/lib/cx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-ghost';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent hover:bg-accent/90',
  secondary: 'border border-border-strong text-text hover:bg-sunken',
  ghost: 'text-text hover:bg-sunken',
  danger: 'bg-danger text-on-danger hover:bg-danger/90',
  'danger-ghost': 'text-danger hover:bg-sunken',
};

export function buttonClasses(variant: ButtonVariant = 'secondary', className?: string): string {
  return cx(
    'pressable inline-flex min-h-touch select-none items-center justify-center gap-2 rounded-md px-4 text-md font-medium',
    'transition-[background-color,color,transform] duration-(--duration-fast) ease-(--ease-out)',
    'disabled:cursor-not-allowed disabled:opacity-50',
    VARIANTS[variant],
    className,
  );
}

interface ButtonProps extends ComponentProps<'button'> {
  readonly variant?: ButtonVariant;
}

export function Button({ variant, className, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses(variant, className)} {...props} />;
}

interface ButtonLinkProps extends LinkProps {
  readonly variant?: ButtonVariant;
}

export function ButtonLink({ variant, className, ...props }: ButtonLinkProps) {
  return (
    <Link
      className={buttonClasses(variant, typeof className === 'string' ? className : undefined)}
      {...props}
    />
  );
}

interface IconButtonProps extends Omit<ComponentProps<'button'>, 'children'> {
  /** Texto accesible obligatorio: el botón solo muestra un icono. */
  readonly label: string;
  readonly icon: ReactNode;
}

export function IconButton({ label, icon, className, type = 'button', ...props }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cx(
        'pressable inline-flex size-touch shrink-0 items-center justify-center rounded-md text-text-muted',
        'transition-[background-color,color,transform] duration-(--duration-fast) hover:bg-sunken hover:text-text',
        'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent',
        className,
      )}
      {...props}
    >
      {icon}
    </button>
  );
}
