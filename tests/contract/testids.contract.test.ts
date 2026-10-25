/**
 * Contract between the E2E registry (tests/e2e/support/testids.ts) and the app:
 * every literal testID the specs rely on must exist in src/ — either verbatim, or as the base id of a shared
 * component that derives it (Stepper `<id>-inc|-dec`, Segmented `<id>-<option>`, Header `<id>-back`).
 * `planned` blocks (placeholder screens) are excluded. When this fails: a testID was renamed/removed in src —
 * update testids.ts (and docs/testing.md), or ask for the id back.
 */
import fs from 'fs';
import path from 'path';
import { literalIds } from '../e2e/support/testids';

const SRC = path.resolve(__dirname, '../../src');

function readAll(dir: string): string {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .map((e) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) return readAll(p);
      return /\.(tsx?|jsx?)$/.test(e.name) ? fs.readFileSync(p, 'utf8') : '';
    })
    .join('\n');
}

const source = readAll(SRC);
const quoted = (id: string) => source.includes(`'${id}'`) || source.includes(`"${id}"`) || source.includes(`\`${id}\``) || source.includes(`testID: '${id}'`);

describe('E2E testID registry ↔ src', () => {
  const ids = [...new Set(literalIds())];

  it('has a reasonable number of literal ids', () => {
    expect(ids.length).toBeGreaterThan(100);
  });

  it.each(ids)('%s exists in src (verbatim or derived from a shared component)', (id) => {
    const base = id.replace(/-[^-]+$/, '');
    expect(quoted(id) || quoted(base)).toBe(true);
  });
});
