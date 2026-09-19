import { describe, expect, it } from 'vitest';
import type { Correlation, CorrelationReport } from '@/domain/correlation';
import { habit } from '@/test/factories';
import { describeComparisons, describeCorrelation, describeSample } from './describe';

/** Intl usa espacio duro antes del %; aquí se compara con espacios normales. */
function plain(text: string): string {
  return text.replace(/ /g, ' ');
}

function correlation(overrides: Partial<Correlation> = {}): Correlation {
  return {
    kind: 'mood',
    source: habit({ name: 'Ejercicio' }),
    target: null,
    lag: 0,
    withValue: 4.06,
    withoutValue: 3.24,
    withDays: 62,
    withoutDays: 41,
    delta: 0.82,
    margin: 0.3,
    ...overrides,
  };
}

describe('describeCorrelation', () => {
  it('describe el ánimo del mismo día', () => {
    expect(describeCorrelation(correlation())).toBe(
      'Los días que cumples Ejercicio, tu ánimo medio es 4,1; los demás días, 3,2.',
    );
  });

  it('deja claro el desfase de un día', () => {
    const text = describeCorrelation(
      correlation({
        kind: 'energy',
        source: habit({ name: 'Dormir temprano' }),
        lag: 1,
        withValue: 3.9,
        withoutValue: 3.1,
      }),
    );
    expect(text).toBe(
      'Los días después de cumplir Dormir temprano, tu energía media es 3,9; los demás, 3,1.',
    );
  });

  it('en "a evitar" habla de recaídas, no de cumplir', () => {
    const text = describeCorrelation(
      correlation({
        source: habit({ name: 'Redes', kind: 'avoid' }),
        withValue: 2.8,
        withoutValue: 3.6,
      }),
    );
    expect(text).toBe('Los días que recaes en Redes, tu ánimo medio es 2,8; los demás días, 3,6.');
  });

  it('compara dos hábitos con las dos tasas', () => {
    const text = plain(
      describeCorrelation(
        correlation({
          kind: 'habit',
          target: habit({ id: 'lec', name: 'Lectura' }),
          withValue: 0.72,
          withoutValue: 0.44,
        }),
      ),
    );
    expect(text).toBe(
      'Los días que cumples Ejercicio, cumples Lectura el 72 %; los demás días, el 44 %.',
    );
  });
});

describe('describeSample', () => {
  it('siempre dice cuántos días hay en cada grupo', () => {
    expect(describeSample(correlation())).toBe('Muestra: 62 días que sí y 41 que no.');
  });
});

describe('describeComparisons', () => {
  const report = (overrides: Partial<CorrelationReport>): CorrelationReport => ({
    findings: [],
    compared: 0,
    tested: 0,
    qualified: 0,
    scaleDays: 0,
    confidence: 0.95,
    ...overrides,
  });

  it('cuenta lo examinado, lo medible y lo concluyente', () => {
    expect(
      describeComparisons(
        report({ compared: 28, tested: 9, qualified: 2, findings: [correlation(), correlation()] }),
      ),
    ).toBe(
      'Se examinaron 28 comparaciones; 9 tenían muestra suficiente y 2 muestran una diferencia clara.',
    );
  });

  it('usa el singular cuando toca', () => {
    expect(
      describeComparisons(
        report({ compared: 1, tested: 1, qualified: 1, findings: [correlation()] }),
      ),
    ).toBe(
      'Se examinó 1 comparación; 1 tenía muestra suficiente y 1 muestra una diferencia clara.',
    );
  });

  it('avisa cuando enseña menos de las que hay', () => {
    expect(
      describeComparisons(
        report({ compared: 40, tested: 20, qualified: 9, findings: [correlation()] }),
      ),
    ).toBe(
      'Se examinaron 40 comparaciones; 20 tenían muestra suficiente y 9 muestran una diferencia clara. Aquí solo va la más marcada, una por pareja.',
    );
  });

  it('sin parejas lo dice sin rodeos', () => {
    expect(describeComparisons(report({}))).toBe('No hay parejas que comparar todavía.');
  });
});
