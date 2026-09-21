import { ChevronRight, Plus } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { Link } from 'react-router';
import type { HabitTemplate } from '@/domain/templates';
import { ColorBar, HabitIconSlot } from '@/ui/HabitMarks';

type LinkClick = ComponentProps<typeof Link>['onClick'];

/** Hueco de la barra de color, para que sin ella el resto quede en la misma columna. */
function BarGap() {
  return <span aria-hidden="true" className="w-0.75 shrink-0" />;
}

/** Maqueta única de las filas del selector: barra, columna del icono, texto y flecha. */
function PickerRow({
  to,
  onClick,
  bar,
  icon,
  title,
  summary,
}: {
  to: string;
  onClick?: LinkClick;
  bar: ReactNode;
  icon: ReactNode;
  title: string;
  summary: string;
}) {
  return (
    <li className="border-b border-border">
      <Link to={to} onClick={onClick} className="flex min-h-14 items-stretch gap-3 hover:bg-sunken">
        {bar}
        {icon}
        <span className="flex min-w-0 flex-1 flex-col justify-center py-2">
          <span className="truncate">{title}</span>
          <span className="text-sm text-text-muted">{summary}</span>
        </span>
        <ChevronRight size={18} aria-hidden="true" className="self-center text-text-faint" />
      </Link>
    </li>
  );
}

/** Fila de una plantilla: la misma en el selector de «Nuevo hábito» y en el onboarding. */
export function TemplateRow({
  template,
  to,
  onClick,
}: {
  template: HabitTemplate;
  to: string;
  onClick?: LinkClick;
}) {
  return (
    <PickerRow
      to={to}
      onClick={onClick}
      bar={<ColorBar color={template.input.color} />}
      icon={<HabitIconSlot name={template.input.icon} />}
      title={template.input.name}
      summary={template.summary}
    />
  );
}

/**
 * «Empezar en blanco»: va aparte, encima de las plantillas (no es una plantilla). Sin barra de
 * color, que identifica a un hábito, pero con su hueco y el «+» en la columna del icono, para
 * que el texto quede en la misma X que el de las plantillas.
 */
export function BlankRow({ to, onClick }: { to: string; onClick?: LinkClick }) {
  return (
    <PickerRow
      to={to}
      onClick={onClick}
      bar={<BarGap />}
      icon={
        <HabitIconSlot>
          <Plus size={16} aria-hidden="true" className="shrink-0 text-text-muted" />
        </HabitIconSlot>
      }
      title="Empezar en blanco"
      summary="Define tú cada detalle."
    />
  );
}
