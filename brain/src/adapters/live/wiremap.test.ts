/**
 * The wire-surface guard — the offline half of "the Phase-0 handler split changed
 * nothing".
 *
 * `extension/methods.golden.json` was extracted from ProbeHandlers' dispatch
 * switch BEFORE the split, and the split's own generator refused to rewrite it
 * unless every pre-split name survived. These tests re-check that from the other
 * side, by parsing the registrations out of the Java source — so a fat-fingered
 * rename fails here, offline, the moment it happens, rather than at the first
 * probe run against a live DAW.
 *
 * The live confirmation is `rig.methods` during the Phase-0 sitting.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { WIRE_METHODS_BANNED, WIRE_METHODS_USED } from './wiremap.js';

const REPO = join(import.meta.dirname, '..', '..', '..', '..');
const GOLDEN_PATH = join(REPO, 'extension', 'methods.golden.json');
const HANDLERS_DIR = join(REPO, 'extension', 'src', 'main', 'java', 'com', 'ghostnote', 'extension', 'handlers');

interface Golden {
  count: number;
  methodsHash: string;
  addedInPhase0: string[];
  preSplitCount: number;
  methods: string[];
  preSplitMethods: string[];
}

const golden: Golden = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8'));

/**
 * Scrape `r.on("name", ...)` out of the handler groups.
 *
 * ⚠ Deliberately strict: any line mentioning `r.on(` that this pattern cannot
 * read is a FAILURE, not a skip. A silently unparsed registration is worse than
 * no check at all, because it would make the golden look green while the real
 * surface drifted.
 */
function registeredMethods(): string[] {
  const found: string[] = [];
  for (const file of readdirSync(HANDLERS_DIR).filter((f) => f.endsWith('.java'))) {
    const src = readFileSync(join(HANDLERS_DIR, file), 'utf8');
    for (const line of src.split('\n')) {
      if (!line.includes('r.on(')) continue;
      const m = line.match(/r\.on\("([^"]+)"\s*,/);
      assert.ok(m, `${file}: unparsable registration line -> ${line.trim()}`);
      found.push(m[1]!);
    }
  }
  return found;
}

const methodsHash = (names: readonly string[]): string =>
  createHash('sha256').update([...names].join('\n'), 'utf8').digest('hex').slice(0, 16);

test('W-registry: every registration in the Java source is in the golden, and vice versa', () => {
  const registered = registeredMethods().sort();
  assert.deepEqual(registered, [...golden.methods].sort(),
    'the extension registers a different method set than extension/methods.golden.json records');
  assert.equal(registered.length, golden.count);
});

test('W-registry: no method is registered twice', () => {
  const registered = registeredMethods();
  const seen = new Set<string>();
  const dupes = registered.filter((m) => (seen.has(m) ? true : (seen.add(m), false)));
  // A switch with duplicate case labels does not compile; a Map.put silently
  // wins. HandlerRegistry.on throws at init, and this catches it before deploy.
  assert.deepEqual(dupes, [], 'duplicate handler registration would silently shadow at runtime');
});

test('W-split: the split was a no-op — every pre-split method survived', () => {
  const carried = golden.methods.filter((m) => !golden.addedInPhase0.includes(m)).sort();
  assert.deepEqual(carried, [...golden.preSplitMethods].sort(),
    'the handler split dropped or renamed a wire method — the archived probes would break');
  assert.equal(carried.length, golden.preSplitCount);
});

test('W-split: Phase 0 added only the two contract meta-methods', () => {
  assert.deepEqual([...golden.addedInPhase0].sort(), ['contract.hello', 'rig.methods']);
});

test('W-hash: the golden hash matches its own method list', () => {
  // The extension computes this same value in handlers/Contract.java and returns
  // it from contract.hello, so a drifted deployment is caught at connect.
  assert.equal(methodsHash([...golden.methods].sort()), golden.methodsHash);
});

test('W-contract: every method the encoder can emit exists in the extension', () => {
  const unknown = WIRE_METHODS_USED.filter((m) => !golden.methods.includes(m));
  assert.deepEqual(unknown, [], 'the encoder would call a method the extension does not register');
});

test('W-contract: the contract reaches only a deliberate subset of the wire', () => {
  // The gap is the design, not incompleteness: the rest is probe surface. If this
  // ever approaches parity, the contract has drifted into being a 1:1 RPC facade
  // — which is the Beat Twin 57-tool failure the union shape exists to avoid.
  assert.ok(WIRE_METHODS_USED.length < golden.methods.length / 2,
    `contract reaches ${WIRE_METHODS_USED.length} of ${golden.methods.length} wire methods`);
});

test('W-banned: no banned method is reachable from the contract (E6, E3)', () => {
  for (const [method, why] of Object.entries(WIRE_METHODS_BANNED)) {
    assert.ok(!WIRE_METHODS_USED.includes(method), `${method} must stay unreachable: ${why}`);
    // It must still be REGISTERED, because the probes that established the ban
    // run against it and they are the live regression suite.
    assert.ok(golden.methods.includes(method), `${method} should remain on the wire for the probes`);
  }
});

test('W-banned: no source outside src/probes/ mentions a banned wire method', () => {
  // The only real enforcement of a "never" rule is a test that greps for it.
  const srcRoot = join(import.meta.dirname, '..', '..');
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'probes' || entry.name === 'node_modules') continue;
        walk(path);
        continue;
      }
      if (!entry.name.endsWith('.ts')) continue;
      // wiremap.ts names them in order to ban them; that is the one exemption.
      if (path.endsWith(join('live', 'wiremap.ts')) || path.endsWith('wiremap.test.ts')) continue;
      const src = readFileSync(path, 'utf8');
      for (const method of Object.keys(WIRE_METHODS_BANNED)) {
        if (src.includes(`'${method}'`) || src.includes(`"${method}"`)) {
          offenders.push(`${path} mentions ${method}`);
        }
      }
    }
  };
  walk(srcRoot);
  assert.deepEqual(offenders, [], 'a banned wire method leaked outside the probe layer');
});
