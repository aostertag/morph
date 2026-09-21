import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HABIT_COLORS } from '@/domain/types';
import { HABIT_COLOR_DISPLAY_ORDER, HABIT_COLOR_LABEL } from '@/ui/HabitMarks';

const css = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8');
const darkStart = css.indexOf(':root[data-theme="dark"] {');

function tokenIn(block: string, color: string): string | undefined {
  return new RegExp(`--color-habit-${color}:\\s*(#[0-9a-f]{6});`).exec(block)?.[1];
}

describe('paleta de hábitos', () => {
  const light = css.slice(0, darkStart);
  const dark = css.slice(darkStart);

  it('cada color tiene etiqueta y valor en tema claro y oscuro', () => {
    for (const color of HABIT_COLORS) {
      expect(HABIT_COLOR_LABEL[color], color).toBeTruthy();
      expect(tokenIn(light, color), `claro ${color}`).toBeDefined();
      expect(tokenIn(dark, color), `oscuro ${color}`).toBeDefined();
    }
  });

  it('las claves no se repiten y los valores tampoco dentro de un tema', () => {
    expect(new Set(HABIT_COLORS).size).toBe(HABIT_COLORS.length);
    for (const block of [light, dark]) {
      const values = HABIT_COLORS.map((c) => tokenIn(block, c));
      expect(new Set(values).size).toBe(values.length);
    }
  });

  it('conserva las 10 claves originales en su orden (los hábitos guardan la clave)', () => {
    expect(HABIT_COLORS.slice(0, 10)).toEqual([
      'rojo',
      'naranja',
      'ocre',
      'oliva',
      'verde',
      'turquesa',
      'azul',
      'violeta',
      'magenta',
      'grafito',
    ]);
  });
});

describe('orden de presentación del selector', () => {
  it('es una permutación de HABIT_COLORS: ningún color falta ni se repite', () => {
    expect([...HABIT_COLOR_DISPLAY_ORDER].sort()).toEqual([...HABIT_COLORS].sort());
  });

  it('ordena por tono, con el gris al final', () => {
    expect(HABIT_COLOR_DISPLAY_ORDER.at(-1)).toBe('grafito');
    expect(HABIT_COLOR_DISPLAY_ORDER.slice(0, 3)).toEqual(['rojo', 'naranja', 'ocre']);
  });
});
