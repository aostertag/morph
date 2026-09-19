import { isLocalDay, type LocalDay } from '@/domain/day';
import { type DayRange, RANGE_PRESETS, type RangePreset } from '@/domain/range';
import { RANGE_LABEL } from '@/lib/format';
import { inputClasses } from '@/ui/Field';

/**
 * Período que se analiza. Es un `select` nativo, como el del calendario del
 * detalle: cinco opciones caben mal en un segmentado a ancho de móvil.
 */
export function RangePicker({
  preset,
  range,
  today,
  onPreset,
  onCustom,
}: {
  preset: RangePreset;
  range: DayRange;
  today: LocalDay;
  onPreset: (preset: RangePreset) => void;
  onCustom: (range: DayRange) => void;
}) {
  const change = (field: 'from' | 'to') => (value: string) => {
    if (isLocalDay(value)) onCustom({ ...range, [field]: value });
  };

  return (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
      <label className="flex flex-col gap-1.5 text-md">
        <span className="label-caps">Período</span>
        <select
          value={preset}
          onChange={(event) => onPreset(event.target.value as RangePreset)}
          className={`${inputClasses} w-auto pr-8`}
        >
          {RANGE_PRESETS.map((option) => (
            <option key={option} value={option}>
              {RANGE_LABEL[option]}
            </option>
          ))}
        </select>
      </label>

      {preset === 'custom' && (
        <>
          <label className="flex flex-col gap-1.5 text-md">
            <span className="label-caps">Desde</span>
            <input
              type="date"
              value={range.from}
              max={range.to}
              onChange={(event) => change('from')(event.target.value)}
              className={`${inputClasses} w-auto`}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-md">
            <span className="label-caps">Hasta</span>
            <input
              type="date"
              value={range.to}
              min={range.from}
              max={today}
              onChange={(event) => change('to')(event.target.value)}
              className={`${inputClasses} w-auto`}
            />
          </label>
        </>
      )}
    </div>
  );
}
