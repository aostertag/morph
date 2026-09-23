import { describe, expect, it } from 'vitest';
import { habit } from '@/test/factories';
import { describeHabit } from './describe';

describe('describeHabit', () => {
  const h = habit({ kind: 'boolean', frequency: { type: 'daily' }, timeOfDay: 'morning' });

  it('sin categoría no añade nada', () => {
    expect(describeHabit(h, 1)).toBe('Todos los días · Mañana');
    expect(describeHabit(h, 1, null)).toBe('Todos los días · Mañana');
    expect(describeHabit(h, 1, undefined)).toBe('Todos los días · Mañana');
  });

  it('la categoría abre la línea', () => {
    expect(describeHabit(h, 1, 'Salud')).toBe('Salud · Todos los días · Mañana');
  });

  it('«A evitar» se puede omitir donde ya lo dice el sobretítulo', () => {
    const avoid = habit({ kind: 'avoid', frequency: { type: 'daily' }, timeOfDay: 'any' });
    expect(describeHabit(avoid, 1)).toBe('A evitar · Todos los días');
    expect(describeHabit(avoid, 1, 'Mente', { showAvoid: false })).toBe('Mente · Todos los días');
  });
});
