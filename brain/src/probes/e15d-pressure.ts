/**
 * E15-D, part 2 — the end-to-end check, through the real `LiveAdapter`.
 *
 * `e15d-pointing.ts` ruled out the hypothesis the finding was originally filed
 * under: pointing, `setStepSize` and `clearNotes` are all effective for WRITES
 * issued in the same request. What was left was an ordering sensitivity with no
 * mechanism, so this probe replays the two conformance cases that exhibited it —
 * in order, with every frame traced and the clip read back between stages.
 *
 * That trace is what cracked it: the failing and passing runs emit BYTE-IDENTICAL
 * frames. The variable is inbound cursor state, not the request — specifically
 * the step grid the previous case's readback left behind (parts 3 and 5).
 *
 * It now doubles as the regression check for the fix. A property-bearing write
 * that follows a readback is the exact shape that used to lose every property,
 * so if `OP_SETTLE_BEFORE` is ever dropped this probe fails immediately.
 *
 *   npx tsx src/probes/e15d-pressure.ts
 *
 * ⚠ Writes into the gn-A fixture clip at scene 0. Creates no tracks.
 */
import { LiveAdapter } from '../adapters/live/adapter.js';
import { BridgeTransport, type Transport } from '../adapters/live/transport.js';
import type { Frame } from '../adapters/live/wiremap.js';
import { BridgeClient } from '../client.js';
import { clip, notes as notesAt, scene, slot, track, type NoteRecord } from '../contract/index.js';
import { check, note, failureCount } from './lib.js';

const client = new BridgeClient();

/** Prints every frame the adapter sends, so the trace IS the evidence. */
class TracingTransport implements Transport {
  readonly inner: Transport;
  enabled = false;
  private t0 = Date.now();

  constructor(inner: Transport) {
    this.inner = inner;
  }

  async send(frame: Frame): Promise<unknown> {
    const at = Date.now() - this.t0;
    const res = await this.inner.send(frame);
    if (this.enabled) {
      const p = frame.params ?? {};
      const detail = frame.method === 'batch.run'
        ? (p['ops'] as { method: string; params: Record<string, unknown> }[])
            .map((o) => `${o.method}(${summarise(o.params)})`).join(' ; ')
        : summarise(p);
      console.log(`      [${String(at).padStart(5)}ms] ${frame.method}  ${detail}`);
    }
    return res;
  }

  async close(): Promise<void> {
    await this.inner.close();
  }
}

function summarise(p: Record<string, unknown>): string {
  const keep = ['trackIndex', 'slotIndex', 'stepSize', 'x', 'y', 'channel', 'notes', 'props', 'lengthBeats'];
  const parts = keep.filter((k) => p[k] !== undefined).map((k) => `${k}=${JSON.stringify(p[k])}`);
  return parts.join(' ');
}

const transport = new TracingTransport(new BridgeTransport(client));

type VerboseStep = Record<string, number | boolean | string>;

/** Raw readback, independent of the adapter's decoder — the ground truth. */
async function rawNotes(trackIndex: number, sceneIndex: number, stepSize: number): Promise<VerboseStep[]> {
  await client.request('cursor.pointTrack', { cursor: '2', trackIndex });
  await client.request('slot.select', { trackIndex, slotIndex: sceneIndex, mechanism: 'track' });
  await new Promise((r) => setTimeout(r, 200));
  await client.request('cursor.setStepSize', { cursor: '2', stepSize });
  await new Promise((r) => setTimeout(r, 300));
  const res = (await client.request('cursor.getNotesVerbose', { cursor: '2', maxX: 64 })) as { notes: VerboseStep[] };
  return res.notes;
}

const brief = (steps: VerboseStep[], stepSize: number) =>
  steps.map((s) => ({
    beat: (s['x'] as number) * stepSize, y: s['y'], gain: s['gain'], timbre: s['timbre'], pressure: s['pressure'],
  }));

const n = (over: Partial<NoteRecord> = {}): NoteRecord => ({
  startBeats: 0, pitch: 60, velocity: 100, durationBeats: 1, ...over,
});

// ---------------------------------------------------------------- setup

const rows = (await client.request('track.list')) as { tracks: { index: number; name: string; channelId: string }[] };
const gnA = rows.tracks.find((t) => t.name === 'gn-A');
if (!gnA) throw new Error('fixture track gn-A not found');
note(`gn-A at index ${gnA.index} (${gnA.channelId})`);

const adapter = new LiveAdapter({ transport });
await adapter.hello();
const trackA = track(gnA.channelId);
const { sceneEpoch } = await adapter.revision();
const slotA = slot(trackA, scene(0, sceneEpoch));
const clipA = clip(slotA);

/** Exactly what `suite.ts`'s `withClip` does before each case. */
async function withClipPreamble(): Promise<void> {
  await adapter.apply({ ops: [{ op: 'clip.create', slot: slotA, lengthBeats: 4 }] });
  await adapter.settle('trackStruct');
  await adapter.apply({ ops: [{ op: 'note.clear', clip: clipA }] });
  await adapter.settle('noteWrite');
}

/** The property-bearing write, traced, with an independent readback after it. */
async function propsCase(labelText: string): Promise<NoteRecord | undefined> {
  console.log(`\n-- ${labelText}`);
  transport.enabled = true;
  await withClipPreamble();
  await adapter.apply({ ops: [{ op: 'note.write', clip: clipA, notes: [n({ gain: 0.7, timbre: 0.3, pan: -0.25 })] }] });
  await adapter.settle('noteWrite');
  transport.enabled = false;

  // Through a cursor the adapter never touched, so a phantom cannot flatter us.
  const raw = await rawNotes(gnA!.index, 0, 1);
  note(`independent readback: ${JSON.stringify(brief(raw, 1))}`);
  const snap = await adapter.read([notesAt(clipA)]);
  const entry = Object.values(snap.entries)[0];
  const got = entry?.value.of === 'notes' ? entry.value.notes[0] : undefined;
  note(`adapter readback: ${JSON.stringify(got)}`);
  return got;
}

const landed = (got: NoteRecord | undefined) =>
  got?.pan === -0.25 && Math.abs((got?.timbre ?? 0) - 0.3) < 2e-3;

// ============================================================ 1. in isolation

const alone = await propsCase('a property write with nothing before it (used to pass)');
check('properties land when the cursor was already on the right grid', landed(alone), { got: alone });

// ============================================================ 2. after a read

console.log('\n-- a readback first: this is what used to poison the next write');
transport.enabled = true;
await withClipPreamble();
await adapter.apply({
  ops: [{ op: 'note.write', clip: clipA, notes: [n({ startBeats: 1, pitch: 64, velocity: 100, durationBeats: 0.5 })] }],
});
await adapter.settle('noteWrite');
const notesSnap = await adapter.read([notesAt(clipA)]);
transport.enabled = false;
note(`read left the cursor on the scan grid: ${JSON.stringify(Object.values(notesSnap.entries)[0]?.value)}`);

const after = await propsCase('the same property write, now FOLLOWING a readback');
check('VERDICT: properties land after a readback too — the grid settle holds (E15-D)',
  landed(after), { got: after });

// ============================================================ 3. pressure

console.log('\n-- and the property that cannot be written at all (E15-E)');
let refused = false;
try {
  await adapter.apply({ ops: [{ op: 'note.write', clip: clipA, notes: [n({ pressure: 0.9 })] }] });
} catch (e) {
  refused = true;
  note(`refused: ${e instanceof Error ? e.message.slice(0, 90) : String(e)}...`);
}
check('a write asking for pressure is refused rather than silently phantomed', refused);

// ---------------------------------------------------------------- cleanup

await adapter.apply({ ops: [{ op: 'note.clear', clip: clipA }] });
await adapter.settle('noteWrite');
await adapter.close();
client.disconnect();
console.log(`\n${failureCount() === 0 ? 'ALL PASS' : `${failureCount()} FAILURE(S)`}`);
process.exit(failureCount() === 0 ? 0 : 1);
