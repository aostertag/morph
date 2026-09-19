import { useState } from 'react';
import type { HabitHistory } from '@/domain/history';
import { type HistoryItem, historyFeed } from '@/domain/metrics';
import type { WildcardUse } from '@/domain/streaks';
import type { Entry, Habit, Pause, PauseReason } from '@/domain/types';
import { formatDate, formatShortDate } from '@/lib/format';

const PAGE = 20;

const REASON: Readonly<Record<PauseReason, string>> = {
  vacaciones: 'Vacaciones',
  enfermedad: 'Enfermedad',
  otro: 'Pausa',
};

function describeItem(item: HistoryItem, habit: Habit): { title: string; body: string | null } {
  switch (item.type) {
    case 'note':
      return { title: 'Nota', body: item.note };
    case 'wildcard':
      return {
        title: 'Comodín usado',
        body:
          item.day === item.end
            ? 'Cubrió ese día fallado y la racha siguió.'
            : `Cubrió el período hasta el ${formatShortDate(item.end)} y la racha siguió.`,
      };
    case 'pause': {
      const scope = item.global ? 'Pausa de todos los hábitos' : `Pausa de ${habit.name}`;
      const until = item.day === item.end ? 'un día' : `hasta el ${formatShortDate(item.end)}`;
      return { title: `${REASON[item.reason]}: ${scope}`, body: item.note ?? `Duró ${until}.` };
    }
  }
}

/** Notas, comodines y pausas, del más reciente al más antiguo. */
export function HistoryList({
  history,
  entries,
  wildcardUses,
  pauses,
}: {
  history: HabitHistory;
  entries: readonly Entry[];
  wildcardUses: readonly WildcardUse[];
  pauses: readonly Pause[];
}) {
  const [visible, setVisible] = useState(PAGE);
  const items = historyFeed(history, entries, wildcardUses, pauses);

  return (
    <section className="mt-12" aria-labelledby="historial">
      <h2 id="historial" className="label-caps mb-3 border-b border-border pb-2">
        Historial
      </h2>
      {items.length === 0 ? (
        <p className="py-2 text-md text-text-muted">
          Todavía no hay notas, comodines ni pausas. Las notas se escriben al elegir un día en el
          calendario.
        </p>
      ) : (
        <>
          <ol>
            {items.slice(0, visible).map((item) => {
              const { title, body } = describeItem(item, history.habit);
              return (
                <li key={`${item.type}-${item.day}`} className="border-b border-border py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                    <p className="text-md font-medium">{title}</p>
                    <p className="text-sm text-text-muted">{formatDate(item.day, history.today)}</p>
                  </div>
                  {body && <p className="mt-1 text-md text-text-muted">{body}</p>}
                </li>
              );
            })}
          </ol>
          {visible < items.length && (
            <button
              type="button"
              onClick={() => setVisible((n) => n + PAGE)}
              className="mt-4 min-h-touch text-md text-accent underline-offset-4 hover:underline"
            >
              Ver más ({items.length - visible})
            </button>
          )}
        </>
      )}
    </section>
  );
}
