import { lazy, Suspense } from 'react';

// En producción `import.meta.env.DEV` es `false` y el generador no entra en el bundle.
const SampleDataButton = import.meta.env.DEV ? lazy(() => import('./SampleDataButton')) : null;

/** Botón de datos de ejemplo; no se renderiza fuera de desarrollo. */
export function DevSampleData() {
  if (!SampleDataButton) return null;
  return (
    <Suspense fallback={null}>
      <SampleDataButton />
    </Suspense>
  );
}

/** Bloque discreto al pie de una pantalla con las herramientas de desarrollo. */
export function DevToolsFooter() {
  if (!SampleDataButton) return null;
  return (
    <section aria-labelledby="desarrollo" className="mt-12">
      <h2 id="desarrollo" className="label-caps border-b border-border pb-2">
        Solo en desarrollo
      </h2>
      <div className="mt-4">
        <DevSampleData />
      </div>
    </section>
  );
}
