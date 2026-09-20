import {
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { LocalDay, Weekday } from '@/domain/day';
import type { HabitHistory } from '@/domain/history';
import type { Habit } from '@/domain/types';
import { cx } from '@/lib/cx';
import {
  formatMonthYear,
  formatNumber,
  formatPercent,
  formatShortDate,
  weekdayLetter,
  weekdayLong,
} from '@/lib/format';
import { describeDay } from './describe';
import {
  buildHeatmap,
  type HeatCell,
  type HeatRange,
  monthSummaries,
  moveWithin,
} from './heatmapModel';

/**
 * Lado de la celda: 24 px en móvil (WCAG 2.5.8; la rejilla se desplaza en horizontal) y
 * compacta, de 12 px, en escritorio, donde el año cabe entero.
 */
const CELL = 'size-6 lg:size-3';

/** Relleno de la celda: la escala de intensidad, o la de recaídas en "a evitar". */
function fillFor(cell: HeatCell): CSSProperties {
  if (cell.kind === 'level') return { backgroundColor: `var(--color-heat-${cell.level})` };
  if (cell.kind === 'relapse') return { backgroundColor: `var(--color-relapse-${cell.level})` };
  return {};
}

/**
 * Marca dentro de la celda, para que nada se distinga solo por el color:
 * un punto pequeño si el día no toca, un trazo si está en pausa y un punto
 * de tinta si un comodín cubrió ese día.
 */
function Mark({ cell }: { cell: HeatCell }) {
  if (cell.kind === 'offSchedule') {
    return <span aria-hidden="true" className="block size-1 rounded-full bg-border-strong" />;
  }
  if (cell.kind === 'paused') {
    return <span aria-hidden="true" className="block h-0.5 w-2 bg-border-strong" />;
  }
  if (cell.wildcard && cell.record && !cell.record.success) {
    return <span aria-hidden="true" className="block size-1 rounded-full bg-text" />;
  }
  return null;
}

function Swatch({
  style,
  className,
  children,
}: {
  style?: CSSProperties;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <span
      aria-hidden="true"
      style={style}
      className={cx('inline-flex size-3 items-center justify-center rounded-sm', className)}
    >
      {children}
    </span>
  );
}

function Legend({ habit }: { habit: Habit }) {
  const marks = (
    <>
      <span className="inline-flex items-center gap-1.5">
        <Swatch>
          <span className="block size-1 rounded-full bg-border-strong" />
        </Swatch>
        No toca
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Swatch>
          <span className="block h-0.5 w-2 bg-border-strong" />
        </Swatch>
        En pausa
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Swatch style={{ backgroundColor: 'var(--color-heat-0)' }}>
          <span className="block size-1 rounded-full bg-text" />
        </Swatch>
        Comodín
      </span>
    </>
  );

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-text-muted">
      {habit.kind === 'avoid' ? (
        <span className="inline-flex items-center gap-1.5">
          Limpio
          <Swatch style={{ backgroundColor: 'var(--color-heat-0)' }} />
          <span className="ml-2">Recaídas</span>
          {[1, 2, 3].map((level) => (
            <Swatch key={level} style={{ backgroundColor: `var(--color-relapse-${level})` }} />
          ))}
          <span>3 o más</span>
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5">
          Menos
          {[0, 1, 2, 3, 4].map((level) => (
            <Swatch key={level} style={{ backgroundColor: `var(--color-heat-${level})` }} />
          ))}
          Más
        </span>
      )}
      {marks}
    </div>
  );
}

/** Alternativa en tabla del heatmap: un resumen por meses. */
export function MonthTable({ history, range }: { history: HabitHistory; range: HeatRange }) {
  const avoid = history.habit.kind === 'avoid';
  const showValue = history.habit.kind === 'quantity' || history.habit.kind === 'time';
  const rows = monthSummaries(history, range);

  return (
    <table className="w-full text-md">
      <caption className="sr-only">Resumen por meses</caption>
      <thead>
        <tr className="border-b border-border text-text-muted">
          <th scope="col" className="py-1 text-left font-normal">
            Mes
          </th>
          <th scope="col" className="py-1 text-right font-normal">
            {avoid ? 'Recaídas' : 'Cumplidos'}
          </th>
          <th scope="col" className="py-1 text-right font-normal">
            Días
          </th>
          <th scope="col" className="py-1 text-right font-normal">
            {showValue ? 'Total' : '%'}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.start} className="border-b border-border">
            <th scope="row" className="py-1.5 text-left font-normal">
              {formatMonthYear(row.start)}
            </th>
            <td className="py-1.5 text-right">{formatNumber(row.hits)}</td>
            <td className="py-1.5 text-right text-text-muted">{formatNumber(row.scheduled)}</td>
            <td className="py-1.5 text-right">
              {showValue
                ? formatNumber(row.value)
                : row.scheduled === 0
                  ? '–'
                  : formatPercent(row.hits / row.scheduled)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

interface HeatmapProps {
  readonly history: HabitHistory;
  readonly range: HeatRange;
  readonly weekStartsOn: Weekday;
  readonly selected: LocalDay | null;
  readonly onSelect: (day: LocalDay) => void;
}

/**
 * Rejilla anual: una tabla con una columna por semana y una fila por día de la
 * semana. Tiene un solo punto de tabulación; dentro, las flechas mueven un día
 * (arriba y abajo) o una semana (izquierda y derecha), e Inicio y Fin van a los extremos.
 */
export function Heatmap({ history, range, weekStartsOn, selected, onSelect }: HeatmapProps) {
  const model = buildHeatmap(history, range, weekStartsOn);
  const [focusDay, setFocusDay] = useState<LocalDay>(selected ?? model.last);
  const scrollRef = useRef<HTMLDivElement>(null);

  // El foco vive dentro del rango; al cambiar de año se recoloca solo.
  const focus = moveWithin(model, focusDay, 0);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);

  const move = (event: KeyboardEvent<HTMLTableElement>, delta: number) => {
    event.preventDefault();
    const next = moveWithin(model, focus, delta);
    setFocusDay(next);
    event.currentTarget.querySelector<HTMLButtonElement>(`[data-day="${next}"]`)?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTableElement>) => {
    switch (event.key) {
      case 'ArrowUp':
        return move(event, -1);
      case 'ArrowDown':
        return move(event, 1);
      case 'ArrowLeft':
        return move(event, -7);
      case 'ArrowRight':
        return move(event, 7);
      case 'Home':
        return move(event, -9999);
      case 'End':
        return move(event, 9999);
      default:
    }
  };

  return (
    <>
      <div ref={scrollRef} className="-mx-gutter overflow-x-auto pr-gutter pb-1 lg:mx-0 lg:pr-0">
        <table
          className="border-separate"
          style={{ borderSpacing: '0.1875rem' }}
          onKeyDown={onKeyDown}
        >
          <caption className="sr-only">
            Calendario de {history.habit.name}. Las flechas arriba y abajo mueven un día; las de
            izquierda y derecha, una semana.
          </caption>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 bg-bg pl-gutter lg:pl-0">
                <span className="sr-only">Día de la semana</span>
              </th>
              {model.weeks.map((week, index) => {
                const label = model.months.find((m) => m.week === index)?.label;
                return (
                  <th
                    key={week.start}
                    scope="col"
                    className={cx(CELL, 'relative p-0 align-bottom')}
                  >
                    {label && (
                      <span
                        aria-hidden="true"
                        className="absolute bottom-0 left-0 text-xs text-text-muted"
                      >
                        {label}
                      </span>
                    )}
                    <span className="sr-only">Semana del {formatShortDate(week.start)}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {model.weekdays.map((weekday, row) => (
              <tr key={weekday}>
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-bg pr-1 pl-gutter text-right lg:pl-0 align-middle text-xs text-text-faint"
                >
                  <span aria-hidden="true">{row % 2 === 1 ? weekdayLetter(weekday) : ''}</span>
                  <span className="sr-only">{weekdayLong(weekday)}</span>
                </th>
                {model.weeks.map((week) => {
                  const cell = week.cells[row];
                  if (!cell) return null;
                  if (cell.kind === 'outside') {
                    return <td key={week.start} className={cx(CELL, 'p-0')} />;
                  }
                  if (cell.kind === 'before') {
                    return (
                      <td key={week.start} className={cx(CELL, 'p-0')}>
                        <span
                          aria-hidden="true"
                          className="block size-full rounded-sm border border-border opacity-60"
                        />
                      </td>
                    );
                  }
                  return (
                    <td key={week.start} className={cx(CELL, 'p-0')}>
                      <button
                        type="button"
                        data-day={cell.day}
                        tabIndex={cell.day === focus ? 0 : -1}
                        aria-label={describeDay(
                          history.habit,
                          cell.record,
                          cell.day,
                          history.today,
                        )}
                        aria-current={cell.today ? 'date' : undefined}
                        onClick={() => {
                          setFocusDay(cell.day);
                          onSelect(cell.day);
                        }}
                        style={fillFor(cell)}
                        className={cx(
                          CELL,
                          'flex items-center justify-center rounded-sm',
                          cell.kind === 'offSchedule' || cell.kind === 'paused'
                            ? 'bg-transparent'
                            : undefined,
                          cell.today && 'ring-1 ring-border-strong',
                          cell.day === selected && 'ring-2 ring-text',
                        )}
                      >
                        <Mark cell={cell} />
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Legend habit={history.habit} />
    </>
  );
}
