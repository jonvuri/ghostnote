/**
 * Oracle cross-check — BWMOD_DESIGN decision 1.
 *
 * The Python in `tools/bwformat/` is the reference implementation the whole
 * spike was conducted with; every byte recipe here was proven there first. This
 * suite shells out to it and demands BYTE-IDENTICAL output from the TS port, so
 * a regression in the port cannot hide behind tests that only check invariants.
 *
 * Skipped (not failed) when `python3` is unavailable, so CI without a Python
 * runtime still runs the rest of the matrix — the product itself has no Python
 * dependency, which is the whole reason for the port.
 *
 * ⚠ A silently-skipped oracle is the "offline suite certifies wrong behaviour"
 * risk in miniature (PHASE-0 §Risks). Set `GHOSTNOTE_REQUIRE_ORACLE=1` — as the
 * CI workflow does — to turn a missing `python3` into a hard failure instead.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { addModulator, deleteModulator, loadDonor, replaceModulator, retarget } from './index.js';
import { FIXTURE_DIR, fixture } from './fixtures.js';

const havePython = (() => {
  try {
    execFileSync('python3', ['-c', 'import struct'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

if (process.env.GHOSTNOTE_REQUIRE_ORACLE === '1' && !havePython) {
  throw new Error(
    'GHOSTNOTE_REQUIRE_ORACLE=1 but python3 is unavailable — the oracle cross-check ' +
      'would have silently skipped. Install python3 or unset the variable.',
  );
}

/**
 * The reference primitives, lifted verbatim from `tools/bwformat/build_e10f_cases.py`
 * and `build_e12d2_cases.py` (the two port sources named in the design), driven
 * by a JSON job description. Kept as one literal so the oracle stays visibly the
 * SAME code the experiments ran, not a paraphrase of it.
 */
const ORACLE = String.raw`
import json, struct, sys

SENT = b'\x00\x00\x00\x03\x00\x00\x00\x00'
COUNT_FIDS = [b'\x00\x00\x12\x9c\x12', b'\x00\x00\x14\x22\x12']
STUB = b'\x00\x00\x00\x01'

def ss(b): return int(b[16:24], 16) - 1
def set_f4(b, s): return b[:16] + f'{s+1:08x}'.encode() + b[24:]

def add_ref(b, guid):
    nm = b'referenced_modulator_ids'; i = b.find(nm); p = i + len(nm)
    cnt = struct.unpack_from('>I', b, p+1)[0]; q = p+5
    for _ in range(cnt): q += 4 + struct.unpack_from('>I', b, q)[0]
    g = guid.encode()
    nb = b[:p+1] + struct.pack('>I', cnt+1) + b[p+5:q] + struct.pack('>I', len(g)) + g + b[q:]
    return set_f4(nb, ss(nb) + (len(nb) - len(b)))

def del_ref(b, guid):
    nm = b'referenced_modulator_ids'; i = b.find(nm); p = i + len(nm)
    cnt = struct.unpack_from('>I', b, p+1)[0]; q = p+5; g = guid.encode()
    for _ in range(cnt):
        L = struct.unpack_from('>I', b, q)[0]
        if b[q+4:q+4+L] == g:
            nb = b[:p+1] + struct.pack('>I', cnt-1) + b[p+5:q] + b[q+4+L:]
            return set_f4(nb, ss(nb) + (len(nb) - len(b)))
        q += 4 + L
    raise RuntimeError('ref not found')

def swap_ref(b, old, new):
    o, n = old.encode(), new.encode()
    assert len(o) == len(n) and b.count(o) == 1
    return b.replace(o, n)

def rename(obj, ch):
    o = bytearray(obj)
    m = o.find(b'\x00\x00\x02\xb9\x08\x00\x00\x00\x01'); o[m + 9] = ord(ch)
    n = o.find(b'\x00\x00\x1a\x1b\x01'); o[n + 5] = int(ch)
    return bytes(o)

def retarget_obj(b, at, newt):
    p = at; L = struct.unpack_from('>I', b, p)[0]
    return b[:p] + struct.pack('>I', len(newt)) + newt.encode() + b[p+4+L:]

def relocate_stubs(b, delta):
    ba = bytearray(b)
    for fidsig in COUNT_FIDS:
        i = ba.find(fidsig)
        while i != -1:
            p = i + len(fidsig)
            while ba[p:p+8] != SENT and ba[p:p+4] == STUB:
                v = struct.unpack_from('>I', ba, p+4)[0]
                struct.pack_into('>I', ba, p+4, v + delta)
                p += 8
            i = ba.find(fidsig, i + 1)
    return bytes(ba)

job = json.load(sys.stdin)
b = open(job['base'], 'rb').read()
op = job['op']
if op == 'add':
    obj = rename(open(job['donor'], 'rb').read(), job['slot'])
    b = add_ref(b[:job['insert_at']] + obj + b[job['insert_at']:], job['guid'])
    if job.get('delta'): b = relocate_stubs(b, job['delta'])
elif op == 'replace':
    obj = rename(open(job['donor'], 'rb').read(), job['slot'])
    b = swap_ref(b[:job['start']] + obj + b[job['end']:], job['old_guid'], job['guid'])
    if job.get('delta'): b = relocate_stubs(b, job['delta'])
elif op == 'delete':
    b = del_ref(b[:job['start']] + b[job['end']:], job['old_guid'])
    if job.get('delta'): b = relocate_stubs(b, job['delta'])
elif op == 'retarget':
    b = retarget_obj(b, job['at'], job['target'])
else:
    raise RuntimeError(op)
open(job['out'], 'wb').write(b)
`;

const work = havePython ? mkdtempSync(join(tmpdir(), 'gn-bwmod-oracle-')) : '';

function runOracle(job: Record<string, unknown>): Buffer {
  const out = join(work, `out-${Math.random().toString(36).slice(2)}.bin`);
  execFileSync('python3', ['-c', ORACLE], { input: JSON.stringify({ ...job, out }) });
  return readFileSync(out);
}

/** Write a donor's bytes where the oracle can read them, as the Python does. */
function donorFile(name: string, bytes: Buffer): string {
  const path = join(work, `${name}.obj`);
  writeFileSync(path, bytes);
  return path;
}

const fixturePath = (name: string) => join(FIXTURE_DIR, `${name}.bwpreset`);

test('oracle: addModulator matches the Python reference byte for byte', { skip: !havePython }, async () => {
  const { findModulatorList } = await import('./index.js');
  const cases: [string, string, string, number | undefined][] = [
    // The E10f-B1 add: Random into a 1-modulator Polysynth preset.
    ['Polysynth/mp_one_lfo', 'random-poly', '1', undefined],
    // Tier 2 — the same recipe plus relocation, single sample and multisample.
    ['Sampler/gn_sampler_one_lfo', 'lfo-sampler', '1', 0x10],
    ['Sampler/gn_sampler_one_lfo', 'random-poly', '1', 0x0b],
    ['Sampler/gn_sampler_multi_one_lfo', 'lfo-sampler', '1', 0x10],
    // A plugin host with an embedded state blob.
    ['Zebra3/gn_zebra3clap_one_lfo', 'random-poly', '1', undefined],
  ];

  for (const [baseName, donorId, slot, delta] of cases) {
    const base = fixture(baseName);
    const donor = loadDonor(donorId);
    const expected = runOracle({
      op: 'add',
      base: fixturePath(baseName),
      donor: donorFile(donorId, donor.bytes),
      insert_at: findModulatorList(base).listEnd,
      guid: donor.guid,
      slot,
      delta,
    });
    const actual = addModulator(base, donor);
    assert.deepEqual(oraclePatchF6(actual, expected), actual, `${baseName} + ${donorId}`);
  }
});

test('oracle: replaceModulator matches the Python reference byte for byte', { skip: !havePython }, async () => {
  const { listModulators, modulatorBounds } = await import('./index.js');
  for (const [baseName, donorId, delta] of [
    ['Polysynth/modtest', 'classiclfo-poly', undefined],
    ['Sampler/gn_sampler_one_lfo', 'random-sampler', 0x0d - 0x10],
  ] as [string, string, number | undefined][]) {
    const base = fixture(baseName);
    const donor = loadDonor(donorId);
    const index = 1 < listModulators(base).length ? 1 : 0;
    const [start, end] = modulatorBounds(base, index);
    const expected = runOracle({
      op: 'replace',
      base: fixturePath(baseName),
      donor: donorFile(donorId, donor.bytes),
      start,
      end,
      old_guid: listModulators(base)[index].guid,
      guid: donor.guid,
      // The Python renames the donor to the SLOT index; the TS assigns
      // nextFreeInstanceId. Drive both to the same id so the bytes are comparable.
      slot: String(listModulators(base)[index].instanceId),
      delta,
    });
    const actual = replaceModulator(base, index, donor, {
      instanceId: listModulators(base)[index].instanceId,
      removedFootprint: 0x10,
    });
    assert.deepEqual(oraclePatchF6(actual, expected), actual, `${baseName} replace ${donorId}`);
  }
});

test('oracle: deleteModulator matches the Python reference byte for byte', { skip: !havePython }, async () => {
  const { listModulators, modulatorBounds } = await import('./index.js');
  for (const [baseName, delta] of [
    ['Polysynth/modtest', undefined],
    ['Sampler/gn_sampler_one_lfo', -0x10],
    ['Sampler/gn_sampler_multi_one_lfo', -0x10],
  ] as [string, number | undefined][]) {
    const base = fixture(baseName);
    const [start, end] = modulatorBounds(base, 0);
    const expected = runOracle({
      op: 'delete',
      base: fixturePath(baseName),
      start,
      end,
      old_guid: listModulators(base)[0].guid,
      delta,
    });
    const actual = deleteModulator(base, 0, { removedFootprint: 0x10 });
    assert.deepEqual(oraclePatchF6(actual, expected), actual, `${baseName} delete`);
  }
});

test('oracle: retarget matches the Python reference byte for byte', { skip: !havePython }, async () => {
  const { routeSlots, modulatorBounds } = await import('./index.js');
  const base = fixture('Polysynth/modtest');
  for (const target of ['CONTENTS/F1RESO', 'X', 'CONTENTS/A_MUCH_LONGER_PATH_THAN_THE_ORIGINAL_ONE']) {
    const [start, end] = modulatorBounds(base, 2);
    const expected = runOracle({
      op: 'retarget',
      base: fixturePath('Polysynth/modtest'),
      at: routeSlots(base, start, end)[0].targetAt,
      target,
    });
    assert.deepEqual(retarget(base, 2, target), expected, `retarget ${target}`);
  }
});

/**
 * The reference scripts never re-pointed `f6` — the rule was only established in
 * E11i, after they were written, and they got away with it because no Zebra case
 * they built happened to shift the blob. Copy the TS `f6` into the oracle's
 * output so the comparison covers the bytes the oracle actually reasoned about,
 * and assert separately that the difference is confined to those 8 header bytes.
 */
function oraclePatchF6(actual: Buffer, expected: Buffer): Buffer {
  const patched = Buffer.from(expected);
  actual.copy(patched, 32, 32, 40);
  const f6Differed = !expected.subarray(32, 40).equals(actual.subarray(32, 40));
  if (f6Differed) {
    assert.deepEqual(
      patched.subarray(0, 32),
      actual.subarray(0, 32),
      'the oracle and the port must agree on every header field except f6',
    );
  }
  return patched;
}
