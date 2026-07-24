/**
 * Test-only helpers: fixture loading and the "known volatile" normalization the
 * golden reconstructions compare through.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { TYPE, fieldSig, patchString } from './format.js';

export const FIXTURE_DIR = join(import.meta.dirname, '..', '..', 'fixtures');

export function fixture(relPath: string): Buffer {
  return readFileSync(join(FIXTURE_DIR, `${relPath}.bwpreset`));
}

/** Every vendored fixture, as `Polysynth/mp_bare`-style relative paths. */
export function allFixtures(): string[] {
  const out: string[] = [];
  for (const dir of readdirSync(FIXTURE_DIR)) {
    for (const f of readdirSync(join(FIXTURE_DIR, dir))) {
      if (f.endsWith('.bwpreset')) out.push(`${dir}/${f.replace(/\.bwpreset$/, '')}`);
    }
  }
  return out.sort();
}

const PRESET_NAME_SIG = fieldSig(0x12de, TYPE.STR); // the embedded preset name — per-file by design
const CHAIN_GUID_SIG = fieldSig(0x2ab8, TYPE.GUID); // device/chain GUID — regenerated on every save

/**
 * Blank the two things Bitwig legitimately rewrites on every save, so a
 * surgically-built preset can be compared byte-for-byte against a real one:
 * the embedded `0x12de` preset name and the volatile `0x2ab8` chain GUIDs
 * (E10f/E11f — the latter is not required to be unique and is not a load gate).
 *
 * Anything that survives this and still differs is a recipe defect.
 */
export function normalizeVolatiles(buf: Buffer): Buffer {
  let out: Buffer = Buffer.from(buf);
  // Fixed-width: blank the chain GUIDs in place.
  for (let at = out.indexOf(CHAIN_GUID_SIG); at !== -1; at = out.indexOf(CHAIN_GUID_SIG, at + 1)) {
    out.fill(0, at + CHAIN_GUID_SIG.length, at + CHAIN_GUID_SIG.length + 16);
  }
  // Variable-width: empty every preset name, back to front so offsets hold.
  const nameValueOffsets: number[] = [];
  for (let at = out.indexOf(PRESET_NAME_SIG); at !== -1; at = out.indexOf(PRESET_NAME_SIG, at + 1)) {
    nameValueOffsets.push(at + PRESET_NAME_SIG.length);
  }
  for (const valueAt of nameValueOffsets.reverse()) out = patchString(out, valueAt, '');
  return out;
}
