/**
 * Generate the two published documents and the OpenAPI contract.
 *
 * Both documents are *live*: the fleet table, the scoring table, the
 * difficulty doctrines, the API surface and the database schema are read from
 * the code that implements them, not retyped. CI runs this with `--check`, so
 * a change to a game constant that is not reflected in the documentation fails
 * the build rather than silently publishing a lie.
 *
 *   pnpm docs         rewrite docs/
 *   pnpm docs:check   fail if docs/ is not what this would write
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { productGuide } from './product.js';
import { technicalSpec } from './technical.js';
import { openApiDocument } from './openapi.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

const OUTPUTS: Record<string, () => string> = {
  'docs/product/GAME.md': productGuide,
  'docs/technical/SPEC.md': () => technicalSpec(ROOT),
  'docs/technical/openapi.yaml': openApiDocument,
};

const check = process.argv.includes('--check');
const stale: string[] = [];

for (const [relative, build] of Object.entries(OUTPUTS)) {
  const path = join(ROOT, relative);
  const next = build();
  const current = readFileSafe(path);
  if (current === next) continue;
  if (check) {
    stale.push(relative);
    continue;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, next);
  console.log(`wrote ${relative}`);
}

if (check && stale.length > 0) {
  console.error(
    `The published documentation no longer matches the code:\n${stale.map((file) => `  - ${file}`).join('\n')}\n` +
      'Run `pnpm docs` and commit the result.',
  );
  process.exit(1);
}

if (check) console.log('documentation is current');

function readFileSafe(path: string): string | null {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}
