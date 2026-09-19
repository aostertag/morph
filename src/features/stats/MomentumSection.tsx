import { TrendingDown, TrendingUp } from 'lucide-react';
import { Link } from 'react-router';
import type { Momentum, MomentumLists } from '@/domain/stats';
import { MOMENTUM_DAYS } from '@/domain/stats';
import { formatNumber, formatPercent, formatPoints } from '@/lib/format';
import { ColorBar } from '@/ui/HabitMarks';

function Item({ entry }: { entry: Momentum }) {
  const { habit, recent, previous, delta } = entry;
  const Icon = delta > 0 ? TrendingUp : TrendingDown;
  return (
    <li className="flex items-baseline gap-2 border-b border-border py-2 text-md">
      <Icon size={16} aria-hidden="true" className="shrink-0 self-center text-text-muted" />
      <ColorBar color={habit.color} className="h-4 self-center" />
      <Link
        to={`/habitos/${habit.id}`}
        className="min-w-0 flex-1 truncate rounded-sm underline-offset-4 hover:underline"
      >
        {habit.name}
      </Link>
      <span className="shrink-0 font-medium">{formatPoints(delta)}</span>
      <span className="shrink-0 text-sm text-text-muted">
        {formatPercent(previous.ratio ?? 0)} → {formatPercent(recent.ratio ?? 0)}
      </span>
    </li>
  );
}

/**
 * Hábitos que se mueven: las últimas cuatro semanas contra las cuatro anteriores.
 * No depende del período elegido arriba, y se dice.
 */
export function MomentumSection({ lists }: { lists: MomentumLists }) {
  const { improving, declining, measured } = lists;
  const weeks = MOMENTUM_DAYS / 7;

  return (
    <section aria-labelledby="tendencia" className="mt-12">
      <h2 id="tendencia" className="label-caps mb-3 border-b border-border pb-2">
        Últimas {weeks} semanas
      </h2>

      {measured === 0 ? (
        <p className="text-md text-text-muted">
          Todavía no hay {weeks} semanas de historia con las que comparar.
        </p>
      ) : improving.length === 0 && declining.length === 0 ? (
        <p className="text-md text-text-muted">
          Ningún hábito cambia más de 10 puntos respecto a las {weeks} semanas anteriores.
        </p>
      ) : (
        <>
          {improving.length > 0 && (
            <>
              <h3 className="mt-2 text-md font-medium">Mejorando</h3>
              <ul>
                {improving.map((entry) => (
                  <Item key={entry.habit.id} entry={entry} />
                ))}
              </ul>
            </>
          )}
          {declining.length > 0 && (
            <>
              <h3 className="mt-4 text-md font-medium">Decayendo</h3>
              <ul>
                {declining.map((entry) => (
                  <Item key={entry.habit.id} entry={entry} />
                ))}
              </ul>
            </>
          )}
        </>
      )}

      <p className="mt-3 text-sm text-text-muted">
        Se comparan las últimas {weeks} semanas con las {weeks} anteriores, con al menos una semana
        de días evaluables en cada una. {formatNumber(measured)}{' '}
        {measured === 1 ? 'hábito cumple' : 'hábitos cumplen'} ese mínimo.
      </p>
    </section>
  );
}
