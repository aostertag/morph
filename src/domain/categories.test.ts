import { describe, expect, it } from 'vitest';
import { categoryNameProblem, cleanCategoryName } from './categories';
import type { Category } from './types';

const categories: Category[] = [
  { id: 'c1', name: 'Salud', order: 0 },
  { id: 'c2', name: 'Vida social', order: 1 },
];

describe('cleanCategoryName', () => {
  it('quita espacios de los extremos y colapsa los repetidos', () => {
    expect(cleanCategoryName('  Vida   social  ')).toBe('Vida social');
  });
});

describe('categoryNameProblem', () => {
  it('acepta un nombre nuevo', () => {
    expect(categoryNameProblem('Mente', categories)).toBeNull();
  });

  it('rechaza vacío y solo espacios', () => {
    expect(categoryNameProblem('', categories)?.type).toBe('empty');
    expect(categoryNameProblem('   ', categories)?.type).toBe('empty');
  });

  it('rechaza más de 40 caracteres, contados ya limpios', () => {
    expect(categoryNameProblem('x'.repeat(40), categories)).toBeNull();
    expect(categoryNameProblem('x'.repeat(41), categories)?.type).toBe('tooLong');
    expect(categoryNameProblem(`  ${'x'.repeat(40)}  `, categories)).toBeNull();
  });

  it('detecta duplicados sin distinguir mayúsculas ni espacios sobrantes', () => {
    expect(categoryNameProblem('salud', categories)?.type).toBe('duplicate');
    expect(categoryNameProblem('  SALUD ', categories)?.type).toBe('duplicate');
    expect(categoryNameProblem('vida    SOCIAL', categories)?.type).toBe('duplicate');
  });

  it('el aviso de duplicado nombra la categoría existente', () => {
    expect(categoryNameProblem('salud', categories)?.message).toContain('«Salud»');
  });

  it('al renombrar, su propio nombre no cuenta como duplicado', () => {
    expect(categoryNameProblem('SALUD', categories, 'c1')).toBeNull();
    expect(categoryNameProblem('salud', categories, 'c2')?.type).toBe('duplicate');
  });
});
