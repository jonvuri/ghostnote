/** Shared public-path conformance cases for the fake and live musical surfaces. */
import assert from 'node:assert/strict';

import { NOTE_PROP_FIDELITY, planStages, type NoteRecord } from '../contract/index.js';
import type { StashedChangeset } from '../stash/index.js';

export interface MusicalConformanceSlot {
  readonly trackId: string;
  readonly row: number;
}

export interface MusicalConformanceHarness {
  readonly slots: readonly [
    MusicalConformanceSlot,
    MusicalConformanceSlot,
    MusicalConformanceSlot,
  ];
  call(name: string, args?: Record<string, unknown>): Promise<Record<string, unknown>>;
  change(changeId: string): StashedChangeset;
  onActiveChange?(changeId: string, active: boolean): void;
  milestone?(name: string, detail?: unknown): void;
}

export interface MusicalConformanceResult {
  readonly exactProperties: readonly string[];
  readonly generationChangeId: string;
  readonly generationStageCount: number;
  readonly generationPropertyStageCount: number;
  readonly transformationChangeId: string;
  readonly variationChangeId: string;
}

const exactValues: Readonly<Record<string, unknown>> = {
  velocity: 96,
  duration: 0.75,
  releaseVelocity: 0.4,
  velocitySpread: 0.2,
  gain: 0.7,
  pan: -0.25,
  timbre: 0.3,
  transpose: 2,
  chance: 0.6,
  isChanceEnabled: true,
  isMuted: true,
  isOccurrenceEnabled: true,
  occurrence: 'FIRST',
  isRecurrenceEnabled: true,
  recurrence: [4, 5],
  isRepeatEnabled: true,
  repeatCount: 3,
  repeatCurve: 0.2,
  repeatVelocityCurve: -0.1,
  repeatVelocityEnd: 0.8,
};

/** One note with a value for every property whose fidelity is exact. */
export function exactMusicalNote(over: Partial<NoteRecord> = {}): NoteRecord {
  const bag: Record<string, unknown> = {
    startBeats: 0,
    pitch: 60,
    velocity: exactValues['velocity'],
    durationBeats: exactValues['duration'],
  };
  for (const [key, value] of Object.entries(exactValues)) {
    if (key !== 'velocity' && key !== 'duration') bag[key] = value;
  }
  return { ...(bag as unknown as NoteRecord), ...over };
}

export const exactMusicalProperties = (): readonly string[] => Object.entries(NOTE_PROP_FIDELITY)
  .filter(([, fidelity]) => fidelity === 'exact')
  .map(([property]) => property);

const notes = (result: Record<string, unknown>): readonly NoteRecord[] => {
  const value = result['notes'];
  assert.ok(Array.isArray(value), 'read_clip must return notes');
  return value as readonly NoteRecord[];
};

const changes = (result: Record<string, unknown>): readonly { changeId: string }[] => {
  const value = result['changes'];
  assert.ok(Array.isArray(value), 'a musical result must return changes');
  return value as readonly { changeId: string }[];
};

function onlyChange(result: Record<string, unknown>): string {
  const found = changes(result);
  assert.equal(found.length, 1, 'one musical call must record one changeset');
  assert.equal(typeof found[0]?.changeId, 'string');
  return found[0]!.changeId;
}

function close(left: unknown, right: unknown): boolean {
  return typeof left === 'number' && typeof right === 'number'
    ? Math.abs(left - right) <= 2e-3
    : JSON.stringify(left) === JSON.stringify(right);
}

function assertExactProperties(found: NoteRecord, expected: NoteRecord): void {
  const foundBag = found as unknown as Record<string, unknown>;
  const expectedBag = expected as unknown as Record<string, unknown>;
  for (const property of exactMusicalProperties()) {
    const actualKey = property === 'duration' ? 'durationBeats' : property;
    assert.ok(actualKey in foundBag, `readback omitted exact property ${property}`);
    assert.ok(
      close(foundBag[actualKey], expectedBag[actualKey]),
      `readback changed exact property ${property}`,
    );
  }
}

const literal = (value: NoteRecord) => ({
  op: 'generate' as const,
  source: { kind: 'notes' as const, notes: [value] },
});

function generationPatch(slots: MusicalConformanceHarness['slots']) {
  const [block, second, third] = slots;
  const base = (channel: number, value: NoteRecord) => ({
    clip: block, channel, write: 'replace' as const, operations: [literal(value)],
  });
  return {
    schema: 'ghostnote-musical-patch' as const,
    version: 1 as const,
    protection: { kind: 'direct' as const },
    targets: [
      base(0, exactMusicalNote()),
      base(1, { startBeats: 0, pitch: 60, velocity: 90, durationBeats: 1 }),
      {
        clip: block, channel: 2, write: 'replace' as const,
        operations: [{
          op: 'generate' as const,
          source: { kind: 'chord' as const, symbol: 'Cm', octave: 4 },
          placement: { kind: 'stack' as const, startBeats: 0, durationBeats: 1 },
          velocity: 88,
        }],
      },
      base(3, { startBeats: 0, pitch: 36, velocity: 90, durationBeats: 1 }),
      base(4, { startBeats: 1 / 6, pitch: 65, velocity: 90, durationBeats: 1 / 3 }),
      base(5, { startBeats: 0, pitch: 67, velocity: 92, durationBeats: 0.5 }),
      {
        clip: block, channel: 6, write: 'replace' as const,
        operations: [{
          op: 'generate' as const,
          source: {
            kind: 'notes' as const,
            notes: Array.from({ length: 4 }, (_, index) => ({
              startBeats: index * 0.5,
              pitch: 60 + index,
              velocity: 84,
              durationBeats: 0.25,
            })),
          },
        }],
      },
      {
        clip: block, channel: 7, write: 'replace' as const,
        operations: [{
          op: 'generate' as const,
          source: { kind: 'notes' as const, notes: [
            { startBeats: 0, pitch: 48, velocity: 82, durationBeats: 0.25 },
            { startBeats: 1, pitch: 50, velocity: 82, durationBeats: 0.25 },
          ] },
        }],
      },
      {
        clip: block, channel: 8, write: 'replace' as const,
        operations: [{
          op: 'generate' as const,
          source: {
            kind: 'notes' as const,
            notes: Array.from({ length: 8 }, (_, index) => ({
              startBeats: index * 0.5,
              pitch: 55 + index % 3,
              velocity: 86,
              durationBeats: 0.25,
            })),
          },
        }],
      },
      {
        clip: second, channel: 12, write: 'replace' as const,
        operations: [literal(exactMusicalNote({ pitch: 72 }))],
      },
      {
        clip: third, channel: 15, write: 'replace' as const,
        operations: [literal(exactMusicalNote({ pitch: 76 }))],
      },
    ],
  };
}

function transformationPatch(slot: MusicalConformanceSlot) {
  return {
    schema: 'ghostnote-musical-patch' as const,
    version: 1 as const,
    seed: 'phase-2h-all-verbs',
    protection: { kind: 'direct' as const },
    targets: [
      { clip: slot, channel: 0, write: 'replace' as const, operations: [
        { op: 'transpose' as const, semitones: 1 },
      ] },
      { clip: slot, channel: 1, write: 'replace' as const, operations: [
        { op: 'harmonize' as const, harmony: { kind: 'intervals' as const, intervals: ['3M'] } },
      ] },
      { clip: slot, channel: 2, write: 'replace' as const, operations: [
        { op: 'arpeggiate' as const, pattern: 'up' as const, stepBeats: 0.5, durationBeats: 0.25 },
      ] },
      { clip: slot, channel: 3, write: 'replace' as const, operations: [
        { op: 'revoice' as const, minPitch: 48, maxPitch: 72, strategy: 'closest' as const },
      ] },
      { clip: slot, channel: 4, write: 'replace' as const, operations: [
        { op: 'quantize' as const, gridBeats: 1 / 3, strength: 1 },
      ] },
      { clip: slot, channel: 5, write: 'replace' as const, operations: [
        { op: 'humanize' as const, maxTimingBeats: 1 / 96, maxVelocity: 3 },
      ] },
      { clip: slot, channel: 6, write: 'replace' as const, operations: [
        { op: 'thin' as const, probability: 1 },
      ] },
      { clip: slot, channel: 7, write: 'replace' as const, operations: [
        { op: 'densify' as const, gridBeats: 0.25, probability: 1 },
      ] },
    ],
  };
}

function variationPatch(slot: MusicalConformanceSlot) {
  return {
    schema: 'ghostnote-musical-patch' as const,
    version: 1 as const,
    seed: 'phase-2h-four-variations',
    protection: { kind: 'clip-block' as const, reason: 'requested-variations' as const, takes: 4 },
    targets: [{
      clip: slot,
      channel: 8,
      write: 'replace' as const,
      operations: [{ op: 'humanize' as const, maxTimingBeats: 1 / 64, maxVelocity: 3 }],
    }],
  };
}

/** Run the complete successful public path and restore every created clip. */
export async function runPublicMusicalConformance(
  harness: MusicalConformanceHarness,
): Promise<MusicalConformanceResult> {
  const [block, second, third] = harness.slots;
  const active: string[] = [];
  const activate = (changeId: string): string => {
    active.push(changeId);
    harness.onActiveChange?.(changeId, true);
    return changeId;
  };
  const deactivate = (changeId: string): void => {
    const index = active.lastIndexOf(changeId);
    if (index >= 0) active.splice(index, 1);
    harness.onActiveChange?.(changeId, false);
  };
  const applyReversal = async (
    changeId: string,
    scope?: { readonly trackId: string; readonly row: number },
  ): Promise<void> => {
    const result = await harness.call('revert_change', {
      changeId,
      ...(scope === undefined ? {} : { scope }),
    });
    assert.equal(result['applied'], true,
      `reversal ${changeId} must apply: ${JSON.stringify(result)}`);
  };
  const revert = async (changeId: string): Promise<void> => {
    await applyReversal(changeId);
    deactivate(changeId);
  };
  const waitForClip = async (slot: MusicalConformanceSlot, exists: boolean): Promise<void> => {
    const started = Date.now();
    for (;;) {
      const read = await harness.call('read_clip', { ...slot });
      if (read['clipExists'] === exists) return;
      if (Date.now() - started > 8000) {
        assert.fail(`clip ${slot.trackId} row ${slot.row} did not settle to ${String(exists)}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  };

  let result: MusicalConformanceResult | undefined;
  try {
    const beforeChanges = new Set(active);
    const created = await harness.call('add_clip', {
      clips: harness.slots.map((slot) => ({ ...slot, lengthBeats: 8 })),
    });
    const createdId = created['changeId'];
    const createdChangeId = typeof createdId === 'string' ? activate(createdId) : undefined;
    assert.equal(created['applied'], true, JSON.stringify(created));
    assert.ok(createdChangeId !== undefined, JSON.stringify(created));
    harness.milestone?.('clip lifecycle creates three empty sources', harness.slots);

    const generated = await harness.call('generate_clip_music', generationPatch(harness.slots));
    const generationChangeId = activate(onlyChange(generated));
    assert.equal(generated['applied'], true);
    assert.equal((generated['outputs'] as unknown[]).length, 11);
    assert.deepEqual((generated['readback'] as { disagreements: unknown[]; unverified: unknown[] }).disagreements, []);
    assert.deepEqual((generated['readback'] as { disagreements: unknown[]; unverified: unknown[] }).unverified, []);
    const generationChange = harness.change(generationChangeId);
    const generationStages = generationChange.take.receipt.stages;
    const generationPlan = planStages(generationChange.take.ops);
    const generationPropertyStages = generationPlan.filter((stage) =>
      stage.ops.some((op) => op.op === 'note.props'));
    assert.equal(generationStages.length, generationPlan.length,
      'the receipt must include every planned stage');
    assert.ok(generationPropertyStages.length >= 3, 'several expressive clips must keep per-clip property stages');
    assert.ok(generationStages.every((stage) => stage.applied && stage.ops.every((op) => op.ok)));
    harness.milestone?.('generation spans clips, channels, straight and triplet grids', {
      stages: generationStages.length,
      propertyStages: generationPropertyStages.length,
    });

    const generatedExact = notes(await harness.call('read_clip', { ...block, channel: 0 }))[0];
    assert.ok(generatedExact !== undefined);
    assertExactProperties(generatedExact, exactMusicalNote());
    const secondExact = notes(await harness.call('read_clip', { ...second, channel: 12 }))[0];
    const thirdExact = notes(await harness.call('read_clip', { ...third, channel: 15 }))[0];
    assert.ok(secondExact !== undefined && thirdExact !== undefined);
    assertExactProperties(secondExact, exactMusicalNote({ pitch: 72 }));
    assertExactProperties(thirdExact, exactMusicalNote({ pitch: 76 }));
    harness.milestone?.('independent readback covers all 20 exact properties', exactMusicalProperties());

    const transformed = await harness.call('transform_clip_music', transformationPatch(block));
    const transformationChangeId = activate(onlyChange(transformed));
    assert.equal(transformed['applied'], true);
    assert.equal((transformed['outputs'] as unknown[]).length, 8);
    const transformedExact = notes(await harness.call('read_clip', { ...block, channel: 0 }))[0];
    assert.ok(transformedExact !== undefined);
    assert.equal(transformedExact.pitch, 61);
    assertExactProperties(transformedExact, exactMusicalNote({ pitch: 61 }));
    assert.equal(notes(await harness.call('read_clip', { ...block, channel: 4 }))[0]?.startBeats, 1 / 3);
    assert.equal(notes(await harness.call('read_clip', { ...block, channel: 6 })).length, 0);
    assert.ok(notes(await harness.call('read_clip', { ...block, channel: 7 })).length > 2);
    harness.milestone?.('all eight transformation verbs apply in one public call');

    const opened = await harness.call('show_changed_clip', {
      changeId: transformationChangeId,
      target: block,
    });
    assert.equal(opened['navigated'], true);
    assert.equal(opened['layoutRequested'], 'EDIT');
    await revert(transformationChangeId);
    assert.equal(notes(await harness.call('read_clip', { ...block, channel: 0 }))[0]?.pitch, 60);
    harness.milestone?.('editor navigation and directed reversal restore generation');

    const varied = await harness.call('transform_clip_music', variationPatch(block));
    const variationChangeId = activate(onlyChange(varied));
    assert.equal(varied['applied'], true);
    assert.equal((varied['outputs'] as unknown[]).length, 4);
    assert.deepEqual((varied['readback'] as { disagreements: unknown[] }).disagreements, []);
    const clipBlocks = varied['clipBlocks'] as { createdRows: number[] }[];
    assert.deepEqual(clipBlocks[0]?.createdRows, [block.row + 1, block.row + 2, block.row + 3]);
    const variationCounts: number[] = [];
    for (let offset = 0; offset < 4; offset += 1) {
      const read = await harness.call('read_clip', {
        trackId: block.trackId, row: block.row + offset, channel: 8,
      });
      assert.equal(read['clipExists'], true);
      variationCounts.push(notes(read).length);
    }
    await applyReversal(variationChangeId, block);
    for (const offset of [3, 2, 1]) {
      await applyReversal(variationChangeId, {
        trackId: block.trackId,
        row: block.row + offset,
      });
    }
    await waitForClip(block, true);
    deactivate(variationChangeId);
    for (let offset = 1; offset < 4; offset += 1) {
      const read = await harness.call('read_clip', { trackId: block.trackId, row: block.row + offset });
      assert.equal(read['clipExists'], false);
    }
    assert.deepEqual(variationCounts, [8, 8, 8, 8],
      'each variation row must keep all eight source notes');
    harness.milestone?.('four requested variations reverse without clip residue');

    const changeCountBeforePressure = harness.change(generationChangeId).seq;
    await assert.rejects(
      harness.call('generate_clip_music', {
        schema: 'ghostnote-musical-patch', version: 1, protection: { kind: 'direct' },
        targets: [{
          clip: block, channel: 11, write: 'merge',
          operations: [{
            op: 'generate',
            source: { kind: 'notes', notes: [{
              startBeats: 0, pitch: 80, velocity: 90, durationBeats: 1, pressure: 0.5,
            }] },
          }],
        }],
      }),
    );
    assert.equal(harness.change(generationChangeId).seq, changeCountBeforePressure);
    assert.deepEqual(notes(await harness.call('read_clip', { ...block, channel: 11 })), []);
    harness.milestone?.('pressure refuses before mutation');

    result = {
      exactProperties: exactMusicalProperties(),
      generationChangeId,
      generationStageCount: generationStages.length,
      generationPropertyStageCount: generationPropertyStages.length,
      transformationChangeId,
      variationChangeId,
    };

    await revert(generationChangeId);
    for (const source of harness.slots) {
      assert.deepEqual(notes(await harness.call('read_clip', { ...source, channel: 0 })), []);
    }
    await revert(createdChangeId);
    for (const source of harness.slots) {
      assert.equal((await harness.call('read_clip', { ...source }))['clipExists'], false);
    }
    assert.equal(beforeChanges.size, 0);
    harness.milestone?.('all conformance changes reverse to empty source slots');
    return result;
  } finally {
    for (const changeId of [...active].reverse()) {
      try {
        await revert(changeId);
      } catch {
        // The caller reports the original failure and checks the live baseline.
      }
    }
  }
}
