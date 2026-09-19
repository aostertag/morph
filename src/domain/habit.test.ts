import { describe, expect, it } from 'vitest';
import { habit } from '@/test/factories';
import { type HabitInput, normalizeHabitInput, validateHabitInput } from './habit';

function input(overrides: Partial<HabitInput> = {}): HabitInput {
  const { id: _id, order: _order, archivedOn: _archived, ...rest } = habit();
  return { ...rest, ...overrides };
}

describe('normalizeHabitInput', () => {
  it('limpia espacios del nombre', () => {
    expect(normalizeHabitInput(input({ name: '  Leer   30  min ' })).name).toBe('Leer 30 min');
  });

  it('descarta meta y unidad donde no aplican', () => {
    const n = normalizeHabitInput(input({ kind: 'boolean', target: 5, unit: 'vasos' }));
    expect(n).toMatchObject({ target: null, unit: null });
    expect(normalizeHabitInput(input({ kind: 'time', target: 20, unit: null })).unit).toBe('min');
  });
});

describe('validateHabitInput', () => {
  it('acepta un hábito correcto', () => {
    expect(validateHabitInput(input())).toEqual({});
    expect(validateHabitInput(input({ kind: 'quantity', target: 8, unit: 'vasos' }))).toEqual({});
  });

  it('exige nombre', () => {
    expect(validateHabitInput(input({ name: '   ' })).name).toBeDefined();
    expect(validateHabitInput(input({ name: 'x'.repeat(61) })).name).toBeDefined();
  });

  it('exige meta positiva y unidad en cuantitativos', () => {
    const errors = validateHabitInput(input({ kind: 'quantity', target: 0, unit: ' ' }));
    expect(errors.target).toBeDefined();
    expect(errors.unit).toBeDefined();
    expect(validateHabitInput(input({ kind: 'time', target: null })).target).toBeDefined();
  });

  it('valida la frecuencia según el tipo', () => {
    const errors = validateHabitInput(
      input({ kind: 'avoid', frequency: { type: 'perWeek', times: 2 } }),
    );
    expect(errors.frequency).toBeDefined();
  });

  it('valida la hora del recordatorio', () => {
    expect(
      validateHabitInput(input({ reminder: { time: '25:00', enabled: true } })).reminder,
    ).toBeDefined();
    expect(validateHabitInput(input({ reminder: { time: '07:30', enabled: true } }))).toEqual({});
  });
});
