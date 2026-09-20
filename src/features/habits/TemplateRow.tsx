import { ChevronRight } from 'lucide-react';
import type { ComponentProps } from 'react';
import { Link } from 'react-router';
import type { HabitTemplate } from '@/domain/templates';
import { ColorBar, HabitIconSlot } from '@/ui/HabitMarks';

/** Fila de una plantilla: la misma en el selector de «Nuevo hábito» y en el onboarding. */
export function TemplateRow({
  template,
  to,
  onClick,
}: {
  template: HabitTemplate;
  to: string;
  onClick?: ComponentProps<typeof Link>['onClick'];
}) {
  return (
    <li className="border-b border-border">
      <Link to={to} onClick={onClick} className="flex min-h-14 items-stretch gap-3 hover:bg-sunken">
        <ColorBar color={template.input.color} />
        <HabitIconSlot name={template.input.icon} />
        <span className="flex min-w-0 flex-1 flex-col justify-center py-2">
          <span className="truncate">{template.input.name}</span>
          <span className="text-sm text-text-muted">{template.summary}</span>
        </span>
        <ChevronRight size={18} aria-hidden="true" className="self-center text-text-faint" />
      </Link>
    </li>
  );
}
