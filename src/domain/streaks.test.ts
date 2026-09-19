import { describe, expect, it } from 'vitest';
import { d, entriesOn, habit, pause } from '@/test/factories';
import { addDays, eachDay } from './day';
import { type EvaluatedUnit, evaluateHabit, type UnitStatus } from './evaluate';
import { computeStreaks } from './streaks';

const CODES: Record<string, UnitStatus> = { D: 'done', M: 'missed', P: 'paused', '.': 'pending' };

/**
 * Construye unidades diarias desde el 2026-01-01 a partir de un patrón:
 * D = cumplido, M = fallado, P = pausa, . = pendiente. Los espacios se ignoran.
 */
function units(pattern: string): EvaluatedUnit[] {
  const codes = pattern.replaceAll(' ', '').split('');
  return codes.map((code, i) => {
    const status = CODES[code];
    if (!status) throw new Error(`Código desconocido: ${code}`);
    const day = addDays(d('2026-01-01'), i);
    return { start: day, end: day, status, required: 1, achieved: status === 'done' ? 1 : 0 };
  });
}

function streaks(pattern: string) {
  return computeStreaks('day', units(pattern));
}

describe('rachas sin comodines', () => {
  it('cuenta unidades cumplidas consecutivas', () => {
    expect(streaks('DDDDD')).toMatchObject({ current: 5, best: 5, wildcardsAvailable: 0 });
  });

  it('un fallo sin comodín reinicia la racha y conserva la mejor', () => {
    const s = streaks('DDD M DD');
    expect(s).toMatchObject({ current: 2, best: 3, wildcardUses: [] });
    expect(s.bestRange).toEqual({ start: '2026-01-01', end: '2026-01-03', length: 3 });
    expect(s.currentRange).toEqual({ start: '2026-01-05', end: '2026-01-06', length: 2 });
  });

  it('racha actual 0 tras un fallo final', () => {
    const s = streaks('DD M');
    expect(s).toMatchObject({ current: 0, best: 2, currentRange: null });
  });

  it('sin historia no hay racha', () => {
    expect(streaks('')).toMatchObject({ current: 0, best: 0, bestRange: null, currentRange: null });
  });

  it('un empate en la mejor racha se queda con la más reciente', () => {
    expect(streaks('DD M DD').bestRange).toMatchObject({ start: '2026-01-04' });
  });
});

describe('unidades neutras', () => {
  it('el día en curso sin cumplir no rompe la racha', () => {
    expect(streaks('DDDD .')).toMatchObject({ current: 4 });
  });

  it('los días en pausa no suman ni rompen ni gastan comodín', () => {
    expect(streaks('DDD PPP DD')).toMatchObject({ current: 5, wildcardUses: [] });
    const s = streaks('DDDDDDD PPPPP M D');
    expect(s.wildcardUses).toEqual([{ start: '2026-01-13', end: '2026-01-13' }]);
    expect(s.current).toBe(8);
  });
});

describe('comodines', () => {
  it('se gana uno cada 7 unidades de racha', () => {
    expect(streaks('DDDDDD').wildcardsAvailable).toBe(0);
    expect(streaks('DDDDDDD').wildcardsAvailable).toBe(1);
    expect(streaks('DDDDDDD DDDDDDD').wildcardsAvailable).toBe(2);
  });

  it('se acumulan como máximo 2', () => {
    expect(streaks('DDDDDDD DDDDDDD DDDDDDD').wildcardsAvailable).toBe(2);
  });

  it('cubre automáticamente un fallo: la racha sigue pero ese día no suma', () => {
    const s = streaks('DDDDDDD M DDD');
    expect(s).toMatchObject({ current: 10, best: 10, wildcardsAvailable: 0 });
    expect(s.wildcardUses).toEqual([{ start: '2026-01-08', end: '2026-01-08' }]);
    expect(s.currentRange).toEqual({ start: '2026-01-01', end: '2026-01-11', length: 10 });
  });

  it('comodines encadenados cubren dos fallos seguidos', () => {
    const s = streaks('DDDDDDD DDDDDDD MM D');
    expect(s).toMatchObject({ current: 15, wildcardsAvailable: 0 });
    expect(s.wildcardUses.map((u) => u.start)).toEqual(['2026-01-15', '2026-01-16']);
  });

  it('un tercer fallo seguido rompe la racha cuando se agotan', () => {
    const s = streaks('DDDDDDD DDDDDDD MMM DD');
    expect(s).toMatchObject({ current: 2, best: 14, wildcardsAvailable: 0 });
    expect(s.wildcardUses).toHaveLength(2);
  });

  it('tras romper la racha hay que volver a llegar a 7 para ganar otro', () => {
    const s = streaks('DDDDDDD MM DDDDDD');
    expect(s).toMatchObject({ current: 6, wildcardsAvailable: 0 });
    expect(streaks('DDDDDDD MM DDDDDDD').wildcardsAvailable).toBe(1);
  });

  it('se sigue ganando con la racha que un comodín mantuvo viva', () => {
    // 7 → gana 1; lo gasta; al llegar a 14 gana otro.
    const s = streaks('DDDDDDD M DDDDDDD');
    expect(s).toMatchObject({ current: 14, wildcardsAvailable: 1 });
  });

  it('un fallo antes de cualquier racha no usa comodín', () => {
    expect(streaks('M DDD')).toMatchObject({ current: 3, wildcardUses: [] });
  });
});

describe('integración con evaluateHabit', () => {
  const ctx = (today: string) => ({ today: d(today), weekStartsOn: 1 as const, pauses: [] });

  it('un registro retroactivo recalcula la racha y los comodines', () => {
    const h = habit({ createdOn: d('2026-01-01') });
    const all = eachDay(d('2026-01-01'), d('2026-01-10'));
    const withoutJan3 = entriesOn(all.filter((day) => day !== '2026-01-03'));
    const before = evaluateHabit(h, withoutJan3, ctx('2026-01-10'));
    expect(computeStreaks(before.unit, before.units)).toMatchObject({ current: 7, best: 7 });

    const after = evaluateHabit(h, entriesOn(all), ctx('2026-01-10'));
    expect(computeStreaks(after.unit, after.units)).toMatchObject({
      current: 10,
      wildcardsAvailable: 1,
    });
  });

  it('hábito a evitar: la racha cuenta días limpios', () => {
    const h = habit({ kind: 'avoid', createdOn: d('2026-01-01') });
    const e = evaluateHabit(h, entriesOn(['2026-01-02']), ctx('2026-01-10'));
    // 1 limpio, 2 recaída, 3–9 limpios (7), 10 en curso.
    expect(computeStreaks(e.unit, e.units)).toMatchObject({
      current: 7,
      best: 7,
      wildcardsAvailable: 1,
    });
  });

  it('hábito semanal: la racha se cuenta en semanas y gana comodín a las 7', () => {
    const h = habit({ frequency: { type: 'perWeek', times: 1 }, createdOn: d('2026-01-05') });
    // Una vez por semana durante 7 semanas (lunes), semana 8 sin nada, semana 9 una vez.
    const mondays = Array.from({ length: 7 }, (_, i) => addDays(d('2026-01-05'), i * 7));
    const entries = entriesOn([...mondays, '2026-03-02']);
    const e = evaluateHabit(h, entries, ctx('2026-03-03'));
    const s = computeStreaks(e.unit, e.units);
    expect(s.unit).toBe('week');
    expect(s).toMatchObject({ current: 8, wildcardsAvailable: 0 });
    expect(s.wildcardUses).toEqual([{ start: '2026-02-23', end: '2026-03-01' }]);
  });

  it('hábito mensual: la racha se cuenta en meses', () => {
    const h = habit({ frequency: { type: 'perMonth', times: 1 }, createdOn: d('2026-01-01') });
    const e = evaluateHabit(
      h,
      entriesOn(['2026-01-10', '2026-02-10', '2026-03-10']),
      ctx('2026-04-02'),
    );
    expect(computeStreaks(e.unit, e.units)).toMatchObject({ unit: 'month', current: 3 });
  });

  it('una pausa global en medio de la racha no la rompe', () => {
    const h = habit({ createdOn: d('2026-01-01') });
    const entries = entriesOn(['2026-01-01', '2026-01-02', '2026-01-06']);
    const e = evaluateHabit(h, entries, {
      today: d('2026-01-06'),
      weekStartsOn: 1,
      pauses: [pause('2026-01-03', '2026-01-05')],
    });
    expect(computeStreaks(e.unit, e.units)).toMatchObject({ current: 3, wildcardUses: [] });
  });
});
