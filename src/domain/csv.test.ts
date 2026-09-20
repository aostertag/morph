import { describe, expect, it } from 'vitest';
import { d, entry, habit } from '@/test/factories';
import { csvText, entriesToCsv } from './csv';

describe('csvText', () => {
  it('deja el texto normal como está', () => {
    expect(csvText('Leer')).toBe('Leer');
  });

  it('entrecomilla comas, comillas y saltos de línea', () => {
    expect(csvText('a, b')).toBe('"a, b"');
    expect(csvText('dijo "hola"')).toBe('"dijo ""hola"""');
    expect(csvText('uno\ndos')).toBe('"uno\ndos"');
  });

  it.each(['=SUMA(A1)', '+1', '-1', '@usuario', '\tx'])('neutraliza la fórmula %j', (value) => {
    expect(csvText(value).startsWith("'") || csvText(value).startsWith('"\'')).toBe(true);
  });
});

describe('entriesToCsv', () => {
  const habits = [
    habit({ id: 'a', name: 'Leer', order: 0 }),
    habit({ id: 'b', name: 'Agua', kind: 'quantity', target: 8, unit: 'vasos', order: 1 }),
    habit({ id: 't', name: 'Estudiar', kind: 'time', target: 30, unit: 'min', order: 2 }),
  ];

  it('cabecera, orden cronológico y por hábito, con CRLF', () => {
    const csv = entriesToCsv(habits, [
      entry('2026-02-02', 5, 'b'),
      entry('2026-02-01', 1, 'b'),
      entry('2026-02-01', 1, 'a'),
      { ...entry('2026-02-01', 45, 't'), note: 'Capítulo 3, "repaso"' },
    ]);
    expect(csv).toBe(
      [
        'fecha,habito,tipo,valor,unidad,nota',
        '2026-02-01,Leer,Sí/No,1,,',
        '2026-02-01,Agua,Cantidad,1,vasos,',
        '2026-02-01,Estudiar,Tiempo,45,min,"Capítulo 3, ""repaso"""',
        '2026-02-02,Agua,Cantidad,5,vasos,',
        '',
      ].join('\r\n'),
    );
  });

  it('sin registros solo lleva la cabecera', () => {
    expect(entriesToCsv(habits, [])).toBe('fecha,habito,tipo,valor,unidad,nota\r\n');
  });

  it('un registro sin hábito no rompe la exportación', () => {
    expect(entriesToCsv([], [entry('2026-02-01', 1, 'x')])).toContain('2026-02-01,,,1,,');
  });

  it('las fechas se escriben tal cual', () => {
    expect(entriesToCsv(habits, [entry('2026-03-29', 1, 'a')])).toContain(d('2026-03-29'));
  });
});
