import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { cleanup } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach, beforeEach } from 'vitest';
import { db } from '@/db/schema';

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
