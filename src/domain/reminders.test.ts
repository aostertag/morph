import { describe, expect, it } from 'vitest';
import { d, habit } from '@/test/factories';
import { planReminders, REMINDER_GRACE_MS, reminderAt, reminderKey } from './reminders';

const today = d('2026-09-19');
const at = (time: string) => {
  const value = reminderAt(today, time);
  if (value === null) throw new Error('hora inválida');
  return value;
};

function withReminder(id: string, time: string, enabled = true) {
  return habit({ id, name: id, reminder: { time, enabled } });
}

describe('reminderAt', () => {
  it('usa la hora local del día indicado', () => {
    const date = new Date(at('09:30'));
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 8, 19]);
    expect([date.getHours(), date.getMinutes()]).toEqual([9, 30]);
  });

  it.each(['24:00', '9:30', '09:60', '', 'mañana'])('rechaza %j', (time) => {
    expect(reminderAt(today, time)).toBeNull();
  });
});

describe('planReminders', () => {
  const pending = (h: ReturnType<typeof habit>) => ({ habit: h, pending: true });

  it('avisa de lo que toca ahora y dice cuándo es el siguiente', () => {
    const a = withReminder('a', '09:00');
    const b = withReminder('b', '20:00');
    const plan = planReminders([pending(a), pending(b)], at('09:05'), today, new Set());
    expect(plan.due).toEqual([a]);
    expect(plan.nextAt).toBe(at('20:00'));
  });

  it('el siguiente es el más cercano', () => {
    const plan = planReminders(
      [pending(withReminder('a', '21:00')), pending(withReminder('b', '18:00'))],
      at('08:00'),
      today,
      new Set(),
    );
    expect(plan).toEqual({ due: [], nextAt: at('18:00') });
  });

  it('no repite un aviso ya enviado hoy', () => {
    const a = withReminder('a', '09:00');
    const plan = planReminders(
      [pending(a)],
      at('09:05'),
      today,
      new Set([reminderKey('a', today)]),
    );
    expect(plan).toEqual({ due: [], nextAt: null });
  });

  it('el aviso de otro día no cuenta como enviado', () => {
    const a = withReminder('a', '09:00');
    const plan = planReminders(
      [pending(a)],
      at('09:05'),
      today,
      new Set([reminderKey('a', d('2026-09-18'))]),
    );
    expect(plan.due).toEqual([a]);
  });

  it('descarta un aviso que llega demasiado tarde', () => {
    const a = withReminder('a', '09:00');
    const late = at('09:00') + REMINDER_GRACE_MS + 60_000;
    expect(planReminders([pending(a)], late, today, new Set())).toEqual({ due: [], nextAt: null });
    expect(
      planReminders([pending(a)], at('09:00') + REMINDER_GRACE_MS, today, new Set()).due,
    ).toEqual([a]);
  });

  it('no avisa de lo que ya está hecho, no toca o está en pausa', () => {
    const a = withReminder('a', '09:00');
    expect(planReminders([{ habit: a, pending: false }], at('09:05'), today, new Set())).toEqual({
      due: [],
      nextAt: null,
    });
  });

  it('ignora recordatorios desactivados, sin hora válida o de hábitos archivados', () => {
    const off = withReminder('off', '09:00', false);
    const broken = withReminder('broken', '9h');
    const archived = { ...withReminder('old', '09:00'), archivedOn: d('2026-09-01') };
    const none = habit({ id: 'none' });
    const plan = planReminders(
      [pending(off), pending(broken), pending(archived), pending(none)],
      at('09:05'),
      today,
      new Set(),
    );
    expect(plan).toEqual({ due: [], nextAt: null });
  });

  it('a las 00:00 exactas el aviso de las 00:00 sale', () => {
    const a = withReminder('a', '00:00');
    expect(planReminders([pending(a)], at('00:00'), today, new Set()).due).toEqual([a]);
  });
});
