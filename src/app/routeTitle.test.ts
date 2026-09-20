import { describe, expect, it } from 'vitest';
import { routeTitle } from './routeTitle';

describe('routeTitle', () => {
  it.each([
    ['/', 'Hoy · Hábitos'],
    ['/estadisticas', 'Estadísticas · Hábitos'],
    ['/habitos', 'Hábitos'],
    ['/habitos/', 'Hábitos'],
    ['/habitos/nuevo', 'Nuevo hábito · Hábitos'],
    ['/habitos/abc-123', 'Detalle del hábito · Hábitos'],
    ['/habitos/abc-123/editar', 'Editar hábito · Hábitos'],
    ['/revision', 'Revisión semanal · Hábitos'],
    ['/ajustes', 'Ajustes · Hábitos'],
    ['/nada', 'Página no encontrada · Hábitos'],
  ])('%s', (path, title) => {
    expect(routeTitle(path)).toBe(title);
  });
});
