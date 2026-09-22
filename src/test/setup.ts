import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { cleanup } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach, beforeEach, vi } from 'vitest';
import { db } from '@/db/schema';

/**
 * Fecha base de los tests de UI: miércoles a mitad de mes, lejos de cualquier
 * borde de semana, mes, trimestre o año. Sin esto, `todayLocal()` (en
 * `src/test/render.tsx`) lee el reloj real y varios tests fallan solo según qué
 * día se ejecuten (p. ej. un lunes: ver CLAUDE.md, «Pendiente»).
 *
 * Se fija en el nivel superior de este archivo, no en un `beforeEach`: algunos
 * tests hacen `const today = todayLocal()` al cargarse el módulo, antes de que
 * corra ningún `beforeEach`.
 *
 * Se puede sobrescribir con `TEST_TODAY=YYYY-MM-DD` para simular otra fecha (por
 * ejemplo, al comprobar que la suite no depende del calendario). Se construye con
 * el constructor de `Date` en hora local a mediodía, nunca a partir de un string:
 * `new Date('YYYY-MM-DD')` se interpreta en UTC y, en zonas al oeste de UTC
 * (America/Santiago, America/New_York), cae en el día anterior.
 *
 * Solo se falsea `Date` (`toFake: ['Date']`): el resto de temporizadores,
 * `fake-indexeddb` y `user-event` siguen con reloj real, igual que ya hacía
 * `RemindersRunner.test.tsx`.
 */
function resolveTestToday(): Date {
  const raw = process.env.TEST_TODAY;
  if (!raw) return new Date(2026, 2, 18, 12, 0, 0);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) throw new Error(`TEST_TODAY debe tener el formato YYYY-MM-DD, no «${raw}»`);
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0);
}

vi.useFakeTimers({ toFake: ['Date'] });
vi.setSystemTime(resolveTestToday());

beforeEach(async () => {
  await db.open();
  await Promise.all(db.tables.map((table) => table.clear()));
  localStorage.clear();
  // Los toasts de Sonner viven en un store global que sobrevive al desmontaje:
  // sin esto, un test vería los avisos del anterior.
  toast.dismiss();
});

afterEach(() => {
  cleanup();
});

// jsdom no implementa la captura de puntero, que usan Sonner y dnd-kit.
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.hasPointerCapture = () => false;
}

// jsdom tampoco implementa matchMedia (tema del sistema).
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

// Recharts mide su contenedor con ResizeObserver, que jsdom no trae.
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Si el elemento con foco se desmonta justo antes de pulsar otro botón, user-event
// da `document` como `relatedTarget` y Sonner intenta devolverle el foco al
// desmontarse. En un navegador real eso es `null`; aquí basta con que no falle.
if (typeof (document as { focus?: unknown }).focus !== 'function') {
  Object.defineProperty(document, 'focus', { value: () => {}, configurable: true });
}
