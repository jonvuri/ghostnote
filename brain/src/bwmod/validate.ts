/**
 * `validate()` — BWMOD_DESIGN §5.
 *
 * Bitwig rejects an invalid preset SILENTLY (0 devices load), so these are the
 * cheap offline checks that predict a load, run before the brain pays an
 * `insertFile` round-trip. They are ordered by how often each one is the actual
 * culprit: sentinel first, then the `0x1a1b` uniqueness gate.
 *
 * ⚠ `ok` is NECESSARY BUT NOT SUFFICIENT. A bad Ramona route path passes every
 * check here and still carries no modulation (E10b). The sufficient check is a
 * live load plus a remote-page readback — keep both.
 */
import type { ValidationResult } from './types.js';
import { SENTINEL, ZIP_MAGIC, isSentinel } from './format.js';
import { parseHeader } from './header.js';
import { META_START, parseMetaRecords, readModulatorRefs } from './meta.js';
import { findModulatorList, modulatorListOffsets } from './stream.js';
import { listModulators } from './readers.js';
import { findCountStubs } from './stubs.js';

export interface ValidateOptions {
  /**
   * The pre-edit buffer. Supplied together with `stubDelta`, it turns the
   * Tier-2 check from "the count lists are well-formed" into "every stub moved
   * by exactly `(inserted − removed) footprint`, and none was left stale".
   */
  reference?: Buffer;
  /** the `(inserted − removed) footprint` the edit should have applied */
  stubDelta?: number;
}

export function validate(buf: Buffer, opts: ValidateOptions = {}): ValidationResult {
  const problems: string[] = [];
  const warnings: string[] = [];
  const guard = (what: string, fn: () => void) => {
    try {
      fn();
    } catch (err) {
      problems.push(`${what}: ${(err as Error).message}`);
    }
  };

  // --- header -------------------------------------------------------------
  let header;
  try {
    header = parseHeader(buf);
  } catch (err) {
    return { ok: false, problems: [`header: ${(err as Error).message}`], warnings };
  }
  if (header.encoding !== '0002') {
    problems.push(`encoding is ${header.encoding}, not 0002 — an opaque container is not editable`);
  }
  if (header.streamOffset < META_START || header.streamOffset >= buf.length) {
    problems.push(`f4 points outside the file (stream offset 0x${header.streamOffset.toString(16)})`);
  } else if (buf.readUInt8(header.streamOffset) !== 0x0a) {
    problems.push(
      `f4-1 does not index the 0x0a stream marker (found 0x${buf.readUInt8(header.streamOffset).toString(16)})`,
    );
  }
  if (header.f6 !== 0) {
    if (header.f6 + ZIP_MAGIC.length > buf.length) {
      problems.push(`f6 (0x${header.f6.toString(16)}) points past the end of the file`);
    } else if (buf.compare(ZIP_MAGIC, 0, ZIP_MAGIC.length, header.f6, header.f6 + ZIP_MAGIC.length) !== 0) {
      problems.push(
        `f6 is stale: 0x${header.f6.toString(16)} is not the PK\\x03\\x04 plugin-state blob ` +
          '— a length-changing edit slid it (E11i)',
      );
    }
  }

  // --- META ---------------------------------------------------------------
  guard('META', () => {
    const records = parseMetaRecords(buf);
    if (records.length === 0) throw new Error('no records parsed');
    // The record run ends with a u32(0), then spaces out to the 0x0a at f4-1.
    let p = records[records.length - 1].end;
    if (p + 4 <= header.streamOffset && buf.readUInt32BE(p) === 0) p += 4;
    for (let i = p; i < header.streamOffset; i++) {
      if (buf.readUInt8(i) !== 0x20) {
        throw new Error(`byte 0x${i.toString(16)} between the last record and f4-1 is neither terminator nor padding`);
      }
    }
  });

  // --- the modulator list -------------------------------------------------
  // A container preset (layer/chain/drum machine) carries one list per nested
  // device. Such a file LOADS perfectly well — it is just outside what the
  // editors will touch without being told which device to work on — so that is
  // a warning about scope, not a prediction of rejection.
  const listCount = (() => {
    try {
      return modulatorListOffsets(buf).length;
    } catch {
      return 0;
    }
  })();
  if (listCount > 1) {
    warnings.push(
      `this preset holds ${listCount} MODULATORS lists (a container: one per nested device) — ` +
        'the modulator checks below are skipped; select a list explicitly to edit it',
    );
    return { ok: problems.length === 0, problems, warnings };
  }

  let modulators: ReturnType<typeof listModulators> = [];
  let listOk = false;
  guard('MODULATORS list', () => {
    const list = findModulatorList(buf);
    if (!isSentinel(buf, list.listEnd)) {
      throw new Error('the list does not end with the 00 00 00 03 00 00 00 00 sentinel');
    }
    if (list.itemStarts.length > 0) {
      // The E11h/E11i off-by-2: a bound landing inside the sentinel corrupts it
      // and rejects the whole preset. The last object's terminator must abut it.
      const terminator = buf.readUInt32BE(list.listEnd - 4);
      if (terminator !== 0) {
        throw new Error(
          `the last modulator's terminator does not abut the sentinel ` +
            `(0x${terminator.toString(16)} at 0x${(list.listEnd - 4).toString(16)})`,
        );
      }
    }
    if (list.listEnd + SENTINEL.length > buf.length) throw new Error('the sentinel runs past the end of the file');
    modulators = listModulators(buf);
    listOk = true;
  });

  // --- the one load gate: unique 0x1a1b -----------------------------------
  if (listOk) {
    const seen = new Map<number, number>();
    for (const m of modulators) {
      const first = seen.get(m.instanceId);
      if (first !== undefined) {
        problems.push(
          `duplicate 0x1a1b instance id ${m.instanceId} on modulators ${first} (${modulators[first].deviceName}) ` +
            `and ${m.index} (${m.deviceName}) — a duplicate rejects the ENTIRE preset`,
        );
      } else {
        seen.set(m.instanceId, m.index);
      }
    }

    // --- meta refs track the modulator GUIDs ------------------------------
    guard('referenced_modulator_ids', () => {
      const refs = readModulatorRefs(buf);
      const guids = modulators.map((m) => m.guid);
      if (refs.length !== guids.length) {
        throw new Error(`${refs.length} ref(s) for ${guids.length} modulator(s)`);
      }
      const sortedRefs = [...refs].sort();
      const sortedGuids = [...guids].sort();
      for (let i = 0; i < sortedRefs.length; i++) {
        if (sortedRefs[i] !== sortedGuids[i]) {
          throw new Error(`set mismatch — refs ${JSON.stringify(refs)} vs modulator GUIDs ${JSON.stringify(guids)}`);
        }
      }
    });

    for (const m of modulators) {
      m.routes.forEach((r, i) => {
        if (r.target.length === 0) {
          warnings.push(`modulator ${m.index} (${m.deviceName}) route ${i} has an empty target — it will not modulate`);
        }
      });
    }
  }

  // --- Tier 2: the sample's count-list reference stubs --------------------
  guard('count stubs', () => {
    const stubs = findCountStubs(buf);
    if (stubs.length === 0) return; // sample-less: plain Tier 1, nothing to relocate
    for (const stub of stubs) {
      if (stub.value === 0) {
        throw new Error(`stub at 0x${stub.offset.toString(16)} points at object 0 — almost certainly a bad delta`);
      }
    }
    if (opts.reference === undefined || opts.stubDelta === undefined) return;
    const before = findCountStubs(opts.reference);
    if (before.length !== stubs.length) {
      throw new Error(`the edit changed the stub COUNT (${before.length} -> ${stubs.length}); it should only shift values`);
    }
    for (let i = 0; i < stubs.length; i++) {
      const expected = before[i].value + opts.stubDelta;
      if (stubs[i].value !== expected) {
        throw new Error(
          `stub ${i} (field 0x${stubs[i].fieldId.toString(16)}) is ${stubs[i].value}, expected ` +
            `${expected} = ${before[i].value} + ${opts.stubDelta} — a stale stub rejects the preset (E12)`,
        );
      }
    }
  });

  return { ok: problems.length === 0, problems, warnings };
}
