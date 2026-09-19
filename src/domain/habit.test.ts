import { describe, expect, it } from 'vitest';
import { d, habit } from '@/test/factories';
import {
  archiveDayFor,
  type HabitInput,
  normalizeHabitInput,
  quantityStep,
  unarchiveGap,
  validateHabitInput,
} from './habit';

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

describe('quantityStep', () => {
  it('usa 1 para metas pequeñas y valores redondos para metas grandes', () => {
    expect(quantityStep(null)).toBe(1);
    expect(quantityStep(8)).toBe(1);
    expect(quantityStep(20)).toBe(1);
    expect(quantityStep(30)).toBe(2);
    expect(quantityStep(50)).toBe(5);
    expect(quantityStep(100)).toBe(10);
    expect(quantityStep(8000)).toBe(1000);
    expect(quantityStep(10000)).toBe(1000);
  });
});

describe('archivado', () => {
  it('archiveDayFor conserva hoy solo si ya tiene registro', () => {
    expect(archiveDayFor(d('2026-03-01'), true)).toBe('2026-03-01');
    expect(archiveDayFor(d('2026-03-01'), false)).toBe('2026-02-28');
  });

  it('unarchiveGap cubre desde el día siguiente al archivado hasta ayer', () => {
    expect(unarchiveGap(d('2026-01-10'), d('2026-01-20'))).toEqual({
      start: '2026-01-11',
      end: '2026-01-19',
    });
    expect(unarchiveGap(d('2026-01-10'), d('2026-01-11'))).toBeNull();
    expect(unarchiveGap(d('2026-01-10'), d('2026-01-10'))).toBeNull();
  });
});
