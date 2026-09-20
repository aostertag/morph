import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addDays, type LocalDay } from '@/domain/day';
import { formatDate, formatRelativeDay, formatWeekday } from '@/lib/format';
import { Button, IconButton } from '@/ui/Button';
import { ScreenHeader } from '@/ui/ScreenHeader';

/**
 * Encabezado de Hoy: mismo patrón que el resto de pantallas. El día de la semana hace de
 * sobretítulo, la fecha de título y el cambio de día de acciones. Al cambiar de día se anuncia
 * la fecha nueva a los lectores de pantalla.
 */
export function DayHeader({
  day,
  today,
  onChange,
}: {
  day: LocalDay;
  today: LocalDay;
  onChange: (day: LocalDay) => void;
}) {
  const isToday = day === today;
  return (
    <ScreenHeader
      live
      eyebrow={`${formatWeekday(day)}${isToday ? '' : ` · ${formatRelativeDay(day, today)}`}`}
      title={formatDate(day, today)}
      actions={
        <nav aria-label="Cambiar de día" className="-mr-2 flex shrink-0 items-center">
          {!isToday && (
            <Button variant="ghost" className="px-3" onClick={() => onChange(today)}>
              Hoy
            </Button>
          )}
          <IconButton
            label="Día anterior"
            icon={<ChevronLeft size={20} aria-hidden="true" />}
            onClick={() => onChange(addDays(day, -1))}
          />
          <IconButton
            label="Día siguiente"
            icon={<ChevronRight size={20} aria-hidden="true" />}
            disabled={isToday}
            onClick={() => onChange(addDays(day, 1))}
          />
        </nav>
      }
    />
  );
}
