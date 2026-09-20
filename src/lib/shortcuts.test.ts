import { describe, expect, it } from 'vitest';
import { overlayOpen, parseShortcut, type ShortcutTarget, targetBlocksShortcut } from './shortcuts';

const key = (k: string, modifiers: Partial<Record<string, boolean>> = {}) => ({
  key: k,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  repeat: false,
  ...modifiers,
});

describe('parseShortcut', () => {
  it.each([
    ['1', { type: 'habit', index: 0 }],
    ['9', { type: 'habit', index: 8 }],
    ['ArrowLeft', { type: 'prevDay' }],
    ['ArrowRight', { type: 'nextDay' }],
    ['n', { type: 'newHabit' }],
    ['N', { type: 'newHabit' }],
    ['?', { type: 'help' }],
  ])('%s', (k, expected) => {
    expect(parseShortcut(key(k))).toEqual(expected);
  });

  it.each(['0', '10', 'a', 'Enter', ' ', 'ArrowUp', 'Escape'])('%j no es un atajo', (k) => {
    expect(parseShortcut(key(k))).toBeNull();
  });

  it('con Ctrl, Meta o Alt no hay atajo (Ctrl+N es del navegador)', () => {
    expect(parseShortcut(key('n', { ctrlKey: true }))).toBeNull();
    expect(parseShortcut(key('1', { metaKey: true }))).toBeNull();
    expect(parseShortcut(key('ArrowLeft', { altKey: true }))).toBeNull();
  });

  it('mantener pulsada la tecla no repite la acción', () => {
    expect(parseShortcut(key('1', { repeat: true }))).toBeNull();
  });
});

function el(tagName: string, extra: Partial<ShortcutTarget> = {}, role?: string): ShortcutTarget {
  return { tagName, getAttribute: (name) => (name === 'role' ? (role ?? null) : null), ...extra };
}

describe('targetBlocksShortcut', () => {
  const digit = { type: 'habit', index: 0 } as const;
  const arrow = { type: 'nextDay' } as const;

  it('sin elemento con foco, no bloquea', () => {
    expect(targetBlocksShortcut(null, digit)).toBe(false);
    expect(targetBlocksShortcut(el('BODY'), digit)).toBe(false);
  });

  it('escribiendo en un campo, nada actúa', () => {
    for (const target of [
      el('TEXTAREA'),
      el('SELECT'),
      el('INPUT', { type: 'text' }),
      el('INPUT', { type: 'number' }),
      el('INPUT', { type: 'date' }),
      el('INPUT'),
      el('DIV', { isContentEditable: true }),
    ]) {
      expect(targetBlocksShortcut(target, digit)).toBe(true);
      expect(targetBlocksShortcut(target, arrow)).toBe(true);
    }
  });

  it('una casilla con foco (recién marcada) deja pasar los números', () => {
    expect(targetBlocksShortcut(el('INPUT', { type: 'checkbox' }), digit)).toBe(false);
    expect(targetBlocksShortcut(el('BUTTON'), digit)).toBe(false);
    expect(targetBlocksShortcut(el('A'), digit)).toBe(false);
  });

  it('las flechas respetan radios, listas y rejillas', () => {
    expect(targetBlocksShortcut(el('INPUT', { type: 'radio' }), arrow)).toBe(true);
    expect(targetBlocksShortcut(el('INPUT', { type: 'range' }), arrow)).toBe(true);
    // Una casilla no usa las flechas: tras marcar un hábito se puede seguir navegando.
    expect(targetBlocksShortcut(el('INPUT', { type: 'checkbox' }), arrow)).toBe(false);
    expect(targetBlocksShortcut(el('DIV', {}, 'slider'), arrow)).toBe(true);
    expect(targetBlocksShortcut(el('TD'), arrow)).toBe(true);
    expect(targetBlocksShortcut(el('BUTTON'), arrow)).toBe(false);
  });

  it('un radio no impide usar los números', () => {
    expect(targetBlocksShortcut(el('INPUT', { type: 'radio' }), digit)).toBe(false);
  });
});

describe('overlayOpen', () => {
  const root = (matches: boolean) => ({ querySelector: () => (matches ? ({} as Element) : null) });
  it('detecta diálogos y menús abiertos', () => {
    expect(overlayOpen(root(true))).toBe(true);
    expect(overlayOpen(root(false))).toBe(false);
  });
});
