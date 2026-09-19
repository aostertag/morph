import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addDays, type LocalDay } from '@/domain/day';
import { formatDate, formatRelativeDay, formatWeekday } from '@/lib/format';
import { Button, IconButton } from '@/ui/Button';

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
    <header className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm text-text-muted">
          {formatWeekday(day)}
          {!isToday && ` · ${formatRelativeDay(day, today)}`}
        </p>
        <h1 className="text-xl font-semibold">{formatDate(day, today)}</h1>
      </div>
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
    </header>
  );
}
