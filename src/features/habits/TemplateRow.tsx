import { ChevronRight, Plus } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { Link } from 'react-router';
import type { HabitTemplate } from '@/domain/templates';
import type { HabitColor } from '@/domain/types';
import { ColorBar, HabitIconSlot } from '@/ui/HabitMarks';

type LinkClick = ComponentProps<typeof Link>['onClick'];

/** Maqueta única de las filas del selector: barra, columna del icono, texto y flecha. */
function PickerRow({
  to,
  onClick,
  color,
  icon,
  title,
  summary,
}: {
  to: string;
  onClick?: LinkClick;
  color: HabitColor | null;
  icon: ReactNode;
  title: string;
  summary: string;
}) {
  return (
    <li className="border-b border-border">
      <Link to={to} onClick={onClick} className="flex min-h-14 items-stretch gap-3 hover:bg-sunken">
        <ColorBar color={color} />
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
      color={template.input.color}
      icon={<HabitIconSlot name={template.input.icon} />}
      title={template.input.name}
      summary={template.summary}
    />
  );
}

/**
 * Fila de «Empezar en blanco»: una opción más de la lista, con la misma maqueta que las
 * plantillas (barra neutra y «+» en la columna del icono) para que el texto quede alineado.
 */
export function BlankRow({ to, onClick }: { to: string; onClick?: LinkClick }) {
  return (
    <PickerRow
      to={to}
      onClick={onClick}
      color={null}
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
