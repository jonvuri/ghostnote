/**
 * Reading the extension's wire surface out of its Java source.
 *
 * Shared deliberately between `wiremap.test.ts` (which asserts the golden still
 * matches) and `regen-wire-golden.ts` (which rewrites it). Two copies of this
 * regex would be a drift hazard of exactly the kind the golden exists to catch:
 * a generator and a checker that disagree produce a file that is green and
 * wrong.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export const REPO_ROOT = join(import.meta.dirname, '..', '..', '..');
export const GOLDEN_PATH = join(REPO_ROOT, 'extension', 'methods.golden.json');
export const HANDLERS_DIR = join(
  REPO_ROOT, 'extension', 'src', 'main', 'java', 'com', 'ghostnote', 'extension', 'handlers',
);

export interface Golden {
  $comment: string[];
  extractedAt: string;
  extractedFrom: string;
  count: number;
  methodsHash: string;
  addedInPhase0: string[];
  addedInSession1: string[];
  addedInSession2: string[];
  /** The E16 mini-spike's probe surface (branches as duplicated tracks). */
  addedInE16?: string[];
  /**
   * Session 3b's early probes: the clip-block primitives and the doc-state
   * capacity apparatus.
   *
   * ⚠ Session 3 (E19) added NO wire method — it changed `revision.get`'s reply
   * fields, which is precisely the class of change `methodsHash` cannot see and
   * `deploy.ts` was built to catch — so E16 is the previous bucket, not a
   * skipped one.
   */
  addedInE20?: string[];
  /** Session 3e arm 1: per-clip launch settings, before product design. */
  addedInSession3eProbe?: string[];
  preSplitCount: number;
  preSplitHash: string;
  methods: string[];
  preSplitMethods: string[];
}

/**
 * Scrape `r.on("name", …)` out of every handler group.
 *
 * ⚠ Deliberately strict: any line mentioning `r.on(` that this pattern cannot
 * read THROWS rather than being skipped. A silently unparsed registration is
 * worse than no check at all, because it would leave the golden looking green
 * while the real surface drifted underneath it.
 */
export function scrapeRegistrations(dir = HANDLERS_DIR): string[] {
  const found: string[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.java'))) {
    const src = readFileSync(join(dir, file), 'utf8');
    for (const line of src.split('\n')) {
      if (!line.includes('r.on(')) continue;
      const m = line.match(/r\.on\("([^"]+)"\s*,/);
      if (m === null) throw new Error(`${file}: unparsable registration line -> ${line.trim()}`);
      found.push(m[1]!);
    }
  }
  return found;
}

/**
 * sha256 of the sorted names joined by newline, first 16 hex chars.
 *
 * ⚠ Must stay identical to `Contract.methodsHash` in the extension, which is
 * what `contract.hello` returns — that equality is the whole point, since it is
 * what catches a deployed extension that drifted from this checkout.
 */
export const methodsHash = (names: readonly string[]): string =>
  createHash('sha256').update([...names].join('\n'), 'utf8').digest('hex').slice(0, 16);

export const readGolden = (): Golden => JSON.parse(readFileSync(GOLDEN_PATH, 'utf8')) as Golden;
