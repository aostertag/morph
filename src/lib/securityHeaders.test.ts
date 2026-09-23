import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const headers = readFileSync(new URL('../../public/_headers', import.meta.url), 'utf8');

/** Vite copia el `<script>` sin `src` de index.html tal cual al build; no hace falta compilar. */
function inlineScriptHashes(source: string): string[] {
  const scriptTag = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  return [...source.matchAll(scriptTag)].map(
    ([, body]) =>
      `sha256-${createHash('sha256')
        .update(body ?? '', 'utf8')
        .digest('base64')}`,
  );
}

describe('Content-Security-Policy y los scripts en línea de index.html', () => {
  it('el hash de cada script en línea está en script-src de public/_headers', () => {
    const hashes = inlineScriptHashes(html);
    expect(hashes.length).toBeGreaterThan(0);
    for (const hash of hashes) {
      expect(
        headers.includes(`'${hash}'`),
        `Falta '${hash}' en public/_headers (script-src). Si editaste un <script> en línea de ` +
          'index.html el hash cambió: recalcúlalo (ver la nota en CLAUDE.md) y actualiza _headers.',
      ).toBe(true);
    }
  });
});
