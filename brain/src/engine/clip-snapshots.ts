/**
 * D32 snapshot reads: acquire a reference, judge references at use time, and
 * survey many references.
 *
 * Each call reads the referenced clips again through the product reader. One
 * adapter read covers all clips, in order, and each clip is acquired once for
 * all 16 channels (E230). The verdict uses the existing `contentDelta` rules
 * through `contentSince` (`contract/clip-snapshot.ts`).
 */
import {
  InvalidOpError, addressKey, clipSnapshotFrom, guardVerdict, judgeClipSnapshot, snapshotAddresses, snapshotClip,
  type Address, type ClipAddress, type ClipSnapshot, type ClipSnapshotRef, type ClipSnapshotVerdict,
  type ContentDelta, type ReadOptions, type RevisionMark, type Snapshot,
} from '../contract/index.js';

/** The reads a snapshot check needs. A workspace and an adapter both supply them. */
export interface SnapshotPort {
  mark(): Promise<RevisionMark>;
  read(addresses: readonly Address[], options?: ReadOptions): Promise<Snapshot>;
  contentSince(since: RevisionMark): Promise<ContentDelta>;
}

export interface SnapshotRead {
  /** The one read. It holds `addresses` and the addresses of each checked reference. */
  readonly read: Snapshot;
  /** One verdict for each reference, in input order. */
  readonly verdicts: readonly ClipSnapshotVerdict[];
}

/**
 * Read `addresses` and judge `refs` in the same adapter read. A mark after the read checks the scene guard again.
 *
 * A reference whose marks already fail a guard (incomparable, uncovered, or a
 * changed scene layout) is not read. The content delta is taken after the
 * read, so it covers the read itself. An event during the read therefore gives
 * `identity-changed`, never `current`.
 *
 * `supplied` is a caller's fresh read (8h4c2). It replaces the adapter read and
 * must cover every address and every source clip. The delta and the mark are
 * taken after it, so the verdict also covers the time since that read.
 */
export async function readWithClipSnapshots(
  port: SnapshotPort,
  refs: readonly ClipSnapshotRef[],
  addresses: readonly Address[] = [],
  supplied?: Snapshot,
): Promise<SnapshotRead> {
  const deltas = new Map<string, Promise<ContentDelta>>();
  const deltaFor = (mark: RevisionMark): Promise<ContentDelta> => {
    const key = JSON.stringify(mark);
    let delta = deltas.get(key);
    if (delta === undefined) {
      delta = port.contentSince(mark);
      deltas.set(key, delta);
    }
    return delta;
  };
  // A supplied read is already taken: its deltas come first, and their mark is both `now` and the mark after it.
  const suppliedDeltas = supplied === undefined || refs.length === 0 ? undefined
    : await Promise.all(refs.map((ref) => deltaFor(ref.mark)));
  const now = refs.length === 0 ? undefined
    : suppliedDeltas?.[0]!.mark ?? await port.mark();
  const early = refs.map((ref) => (now === undefined ? undefined : guardVerdict(ref, now, undefined)));
  const clips: ClipAddress[] = [];
  refs.forEach((ref, index) => {
    if (early[index] === undefined) clips.push(snapshotClip(ref, now!.sceneEpoch));
  });
  const all = uniqueAddresses([...addresses, ...clips.flatMap(snapshotAddresses)]);
  const read = supplied === undefined ? await port.read(all, clips.length === 0 ? {} : { sources: clips })
    : covered(supplied, all, clips);
  const deltaList = refs.map((ref, index) => (early[index] === undefined ? deltaFor(ref.mark) : undefined));
  await Promise.all(deltaList);
  // The scene guard also needs a mark after the read: see `judgeClipSnapshot`. A delta taken after the read has one.
  const first = deltaList.find((item) => item !== undefined);
  const after = clips.length === 0 ? undefined
    : supplied !== undefined ? now : (await first)?.mark ?? await port.mark();
  const verdicts: ClipSnapshotVerdict[] = [];
  for (const [index, ref] of refs.entries()) {
    const decided = early[index];
    verdicts.push(decided ?? judgeClipSnapshot(ref, read, await deltaList[index]!, after));
  }
  return { read, verdicts };
}

/** The survey: one verdict for each reference, and a new snapshot only for a stale clip. */
export async function checkClipSnapshots(
  port: SnapshotPort,
  refs: readonly ClipSnapshotRef[],
): Promise<readonly ClipSnapshotVerdict[]> {
  return (await readWithClipSnapshots(port, refs)).verdicts;
}

export type ClipAcquisition =
  | { readonly found: true; readonly snapshot: ClipSnapshot; readonly read: Snapshot }
  | { readonly found: false; readonly why: 'unknown-track' | 'absent-clip' | 'unreachable'; readonly read: Snapshot };

/** Read one clip and mint its reference. */
export async function acquireClipSnapshot(
  port: SnapshotPort,
  channelId: string,
  row: number,
  addresses: readonly Address[] = [],
): Promise<ClipAcquisition> {
  const now = await port.mark();
  const clip = snapshotClip({ channelId, row }, now.sceneEpoch);
  const read = await port.read(uniqueAddresses([...addresses, ...snapshotAddresses(clip)]), { sources: [clip] });
  const key = addressKey(clip);
  const entry = read.entries[key];
  if (entry === undefined) {
    const unreachable = read.unreachable.some((address) => addressKey(address) === key);
    return { found: false, why: unreachable ? 'unreachable' : 'unknown-track', read };
  }
  if (entry.value.of !== 'clip' || !entry.value.exists) return { found: false, why: 'absent-clip', read };
  return { found: true, snapshot: clipSnapshotFrom(read, clip), read };
}

/** A supplied read must hold each address (as an entry or a reported gap) and the source of each clip. */
function covered(read: Snapshot, addresses: readonly Address[], clips: readonly ClipAddress[]): Snapshot {
  const reported = new Set([...Object.keys(read.entries), ...[...read.missing, ...read.unreachable, ...read.unstable]
    .map(addressKey)]);
  const absent = addresses.find((address) => !reported.has(addressKey(address)));
  const unsourced = clips.find((clip) => read.sources?.[addressKey(clip)] === undefined);
  if (absent !== undefined || unsourced !== undefined) {
    throw new InvalidOpError('snapshot preflight', `the supplied read does not cover ${addressKey((absent ?? unsourced)!)}`);
  }
  return read;
}

/** Keep the first occurrence of each address. */
function uniqueAddresses(addresses: readonly Address[]): Address[] {
  const seen = new Set<string>();
  return addresses.filter((address) => {
    const key = addressKey(address);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
