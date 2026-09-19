import { useSearchParams } from 'react-router';
import { findCorrelations } from '@/domain/correlation';
import { addDays, isLocalDay, type LocalDay } from '@/domain/day';
import {
  clampRange,
  type DayRange,
  previousRange,
  type RangePreset,
  rangeDays,
  resolveRange,
} from '@/domain/range';
import {
  avoidSummaries,
  consistencyRanking,
  momentum,
  scoreComparison,
  weekdayBreakdown,
} from '@/domain/stats';
import { useToday } from '@/hooks/useToday';
import { describeRange } from '@/lib/format';
import { ButtonLink } from '@/ui/Button';
import { EmptyState, ScreenHeader } from '@/ui/EmptyState';
import { AvoidSection } from './AvoidSection';
import { ConsistencySection } from './ConsistencySection';
import { CorrelationsSection } from './CorrelationsSection';
import { MomentumSection } from './MomentumSection';
import { RangePicker } from './RangePicker';
import { ScoreSection } from './ScoreSection';
import { useStats } from './useStats';
import { WeekdaySection } from './WeekdaySection';

/** Días del rango personalizado por defecto. */
const CUSTOM_DAYS = 30;

const PRESET_SLUG: Readonly<Record<RangePreset, string>> = {
  week: 'semana',
  month: 'mes',
  quarter: 'trimestre',
  year: 'ano',
  custom: 'personalizado',
};

function presetFromSlug(slug: string | null): RangePreset {
  const entry = Object.entries(PRESET_SLUG).find(([, value]) => value === slug);
  return (entry?.[0] as RangePreset | undefined) ?? 'month';
}

interface RangeState {
  readonly preset: RangePreset;
  readonly custom: DayRange | null;
  readonly setPreset: (preset: RangePreset) => void;
  readonly setCustom: (range: DayRange) => void;
}

/** Período elegido en la URL (`?rango=mes`, `?rango=personalizado&desde=…&hasta=…`). */
function useRangeState(today: LocalDay): RangeState {
  const [params, setParams] = useSearchParams();
  const preset = presetFromSlug(params.get('rango'));
  const from = params.get('desde');
  const to = params.get('hasta');
  const custom =
    from && to && isLocalDay(from) && isLocalDay(to) ? clampRange(from, to, today) : null;

  const write = (next: RangePreset, range: DayRange | null) => {
    const value =
      next === 'custom'
        ? {
            rango: PRESET_SLUG.custom,
            desde: range?.from ?? addDays(today, -(CUSTOM_DAYS - 1)),
            hasta: range?.to ?? today,
          }
        : { rango: PRESET_SLUG[next] };
    setParams(value, { replace: true });
  };

  return {
    preset,
    custom,
    setPreset: (next) => write(next, custom),
    setCustom: (range) => write('custom', range),
  };
}

export function StatsScreen() {
  const today = useToday();
  const { preset, custom, setPreset, setCustom } = useRangeState(today);
  const data = useStats(today);

  if (!data) return null;

  const { histories, dayLogs, settings, hasHabits } = data;
  const { weekStartsOn } = settings;
  const range = resolveRange(preset, today, weekStartsOn, custom);
  const previous = previousRange(range, preset);
  const length = rangeDays(range);

  const header = (
    <ScreenHeader
      title="Estadísticas"
      eyebrow={describeRange(range, today)}
      actions={
        <RangePicker
          preset={preset}
          range={range}
          today={today}
          onPreset={setPreset}
          onCustom={setCustom}
        />
      }
    />
  );

  if (!hasHabits) {
    return (
      <div className="max-w-list">
        <ScreenHeader title="Estadísticas" />
        <EmptyState
          title="Todavía no hay nada que medir."
          text="Crea un hábito y en unos días esta pantalla empezará a decir algo."
          actions={<ButtonLink to="/habitos/nuevo">Crear hábito</ButtonLink>}
        />
      </div>
    );
  }

  const report = findCorrelations({ histories, dayLogs, range, today });

  return (
    <div>
      {header}

      <ScoreSection
        histories={histories}
        range={range}
        rangeLength={length}
        comparison={scoreComparison(histories, range, previous)}
        preset={preset}
        weekStartsOn={weekStartsOn}
        today={today}
      />

      <div className="lg:grid lg:grid-cols-2 lg:gap-x-12">
        <div className="min-w-0">
          <ConsistencySection ranking={consistencyRanking(histories, range)} />
          <AvoidSection summaries={avoidSummaries(histories, range, previous)} />
        </div>
        <div className="min-w-0">
          <MomentumSection lists={momentum(histories, today)} />
          <WeekdaySection
            breakdown={weekdayBreakdown(histories, range, length)}
            weekStartsOn={weekStartsOn}
          />
        </div>
      </div>

      <CorrelationsSection
        report={report}
        hasPairs={histories.length >= 2 || dayLogs.length > 0}
        moodPending={report.scaleDays === 0}
      />
    </div>
  );
}
