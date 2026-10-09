import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { addDays, dayOfMonth, eachDay, type LocalDay, minDay, weekdayOf } from '@/domain/day';
import { type DayProgress, dayProgress, type HabitAnalysis, viewForDay } from '@/domain/today';
import { LG_QUERY, useMediaQuery } from '@/hooks/useMediaQuery';
import { cx } from '@/lib/cx';
import { formatDate, formatWeekday, weekdayLetter } from '@/lib/format';

/**
 * Hasta dónde llega la tira hacia atrás: un año desde hoy, haya o no hábitos ese día (como el
 * año del heatmap). Un día sin hábitos es un día más, sin marca de cumplimiento.
 */
const PAST_DAYS = 365;
/** Si hay que recorrer más de tantos anchos de tira, el centrado es instantáneo, no animado. */
const SMOOTH_MAX_WIDTHS = 3;

/** Marca de cumplimiento bajo el número: anillo si va a medias, punto si está completo. */
function DayMark({ done, complete }: { done: number; complete: boolean }) {
  if (done === 0) return null;
  return (
    <span
      aria-hidden="true"
      className={cx('block size-1.5 rounded-full', complete ? 'bg-text' : 'border border-text')}
    />
  );
}

/**
 * Un día de la tira. Va en `memo` con props primitivas: elegir un día solo repinta las dos
 * celdas que cambian (la que se deja y la nueva), no los ~366 días de la tira.
 */
const DayCell = memo(function DayCell({
  day,
  today,
  selected,
  done,
  total,
  complete,
  onSelect,
}: {
  day: LocalDay;
  today: LocalDay;
  selected: boolean;
  /** Hábitos hechos y programados ese día (sueltos: un objeto nuevo rompería el `memo`). */
  done: number;
  total: number;
  complete: boolean;
  onSelect: (day: LocalDay) => void;
}) {
  const isToday = day === today;
  const state = total === 0 ? ': nada programado' : `: ${done} de ${total} hábitos`;
  return (
    // `content-visibility`: el navegador no maqueta ni pinta las celdas fuera de pantalla, que son
    // casi todas (366). Reserva el alto real de la celda para que la tira no salte al desplazarla.
    <li className="w-[calc(100%/7)] min-w-touch shrink-0 snap-center [contain-intrinsic-block-size:auto_5.125rem] [content-visibility:auto]">
      <button
        type="button"
        data-day={day}
        tabIndex={selected ? 0 : -1}
        aria-current={selected ? 'date' : undefined}
        aria-label={`${formatWeekday(day)} ${formatDate(day, today)}${isToday ? ', hoy' : ''}${state}`}
        onClick={() => onSelect(day)}
        className="flex min-h-touch w-full flex-col items-center gap-1.5 rounded-md py-2 hover:bg-sunken"
      >
        <span className={cx('label-caps', isToday && 'text-accent')}>
          {weekdayLetter(weekdayOf(day))}
        </span>
        <span
          className={cx(
            'grid size-8 place-items-center rounded-sm text-base',
            selected
              ? 'bg-text font-semibold text-bg'
              : isToday
                ? 'font-medium text-accent ring-1 ring-accent ring-inset'
                : 'font-medium',
          )}
        >
          {dayOfMonth(day)}
        </span>
        <span className="flex h-1.5 items-center">
          <DayMark done={done} complete={complete} />
        </span>
      </button>
    </li>
  );
});

/**
 * Tira de días de Hoy, solo en móvil (en escritorio ya está el panel lateral). Es una línea
 * continua que se desliza con el dedo y encaja día a día (`scroll-snap`); al elegir un día
 * (tocando, con las flechas o por la URL) se centra. Arrastrarla solo navega: no cambia el
 * día elegido. Llega hasta hoy (el último día, a la derecha) y {@link PAST_DAYS} hacia atrás,
 * con independencia de cuándo se creó cada hábito. No usa `weekStartsOn`: no hay semanas, solo
 * una ventana de siete días visibles. Un solo punto de tabulación (el día elegido); las flechas
 * son los atajos de siempre y el foco sigue al día nuevo.
 */
export function WeekStrip({
  analyses,
  day,
  today,
  onSelectDay,
}: {
  analyses: readonly HabitAnalysis[];
  day: LocalDay;
  today: LocalDay;
  onSelectDay: (day: LocalDay) => void;
}) {
  const wide = useMediaQuery(LG_QUERY);
  const from = minDay(addDays(today, -PAST_DAYS), day);
  const days = useMemo(() => eachDay(from, today), [from, today]);

  const listRef = useRef<HTMLOListElement>(null);
  const placed = useRef(false);

  // Misma función en todos los renders (`onSelectDay` cambia con la URL): si no, el `memo` de
  // las celdas no serviría de nada.
  const latestSelect = useRef(onSelectDay);
  useLayoutEffect(() => {
    latestSelect.current = onSelectDay;
  });
  const select = useCallback((d: LocalDay) => latestSelect.current(d), []);

  // Centra el día elegido: sin animación la primera vez, con movimiento reducido o si está lejos.
  // Depende también de `wide`: al volver a móvil la lista se crea de nuevo, en el principio.
  useLayoutEffect(() => {
    if (wide) {
      placed.current = false;
      return;
    }
    const list = listRef.current;
    const item = list?.querySelector<HTMLElement>(`[data-day="${day}"]`)?.parentElement;
    if (!list || !item) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const left = item.offsetLeft - (list.clientWidth - item.offsetWidth) / 2;
    // Un salto largo (volver a hoy desde hace meses) animado en Safari va a trompicones.
    const near = Math.abs(left - list.scrollLeft) <= list.clientWidth * SMOOTH_MAX_WIDTHS;
    list.scrollTo?.({ left, behavior: placed.current && !reduced && near ? 'smooth' : 'instant' });
    placed.current = true;
  }, [day, wide]);

  // Si el foco estaba en la tira, pasa al día elegido (las flechas lo cambian desde fuera).
  useEffect(() => {
    const list = listRef.current;
    if (!list?.contains(document.activeElement)) return;
    list.querySelector<HTMLButtonElement>(`[data-day="${day}"]`)?.focus({ preventScroll: true });
  }, [day]);

  // En escritorio ya está el panel lateral: no se dibujan ~1.800 nodos que el CSS escondería.
  if (wide) return null;

  return (
    <nav aria-label="Días" className="-mt-2 mb-2 -mx-4 lg:hidden">
      <ol
        ref={listRef}
        className="relative flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {days.map((d) => {
          const { done, total, complete } = progressOf(analyses, d);
          return (
            <DayCell
              key={d}
              day={d}
              today={today}
              selected={d === day}
              done={done}
              total={total}
              complete={complete}
              onSelect={select}
            />
          );
        })}
      </ol>
    </nav>
  );
}

function progressOf(analyses: readonly HabitAnalysis[], d: LocalDay): DayProgress {
  const views = analyses.map((a) => viewForDay(a, d)).filter((v) => v.scheduled);
  return dayProgress(views);
}
