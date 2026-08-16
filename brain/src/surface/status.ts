/** Product status text and its one-way transport to Bitwig. */
import type { Transport } from '../adapters/live/transport.js';
import { WIRE } from '../adapters/live/wiremap.js';

export type StatusCategory =
  | 'change'
  | 'track-copy'
  | 'device-alternate'
  | 'clip-alternate'
  | 'reversal';

export interface StatusUpdate {
  readonly categories: readonly StatusCategory[];
  readonly changeId: string;
  /** Session write order. A larger value must remain visible over a smaller one. */
  readonly seq: number;
  /** Project identity captured by the write receipt. */
  readonly target: StatusTarget;
  /** Results for one active instruction share this key. */
  readonly groupKey?: string;
}

export interface StatusTarget {
  readonly generation: string;
  readonly project: string;
}

export interface StatusSink {
  push(value: string, target: StatusTarget): Promise<void>;
}

const LABELS: Readonly<Record<StatusCategory, string>> = {
  change: 'Change',
  'track-copy': 'Track copy',
  'device-alternate': 'Device alternate',
  'clip-alternate': 'Clip alternate',
  reversal: 'Reversal',
};

/** Format one stable, factual pane value. */
export function formatStatus(
  categories: readonly StatusCategory[],
  changeId: string,
): string {
  const unique = [...new Set(categories)];
  const specific = unique.filter((category) => category !== 'change');
  const kinds = specific.length > 0 ? specific : ['change'] as const;
  const set = new Set(kinds);
  let label: string;
  if (set.has('device-alternate') && set.has('clip-alternate') && set.size === 2) {
    label = 'Device + clip alternates';
  } else {
    label = kinds.map((category) => LABELS[category]).join(' + ');
  }
  return `${label} · ${changeId}`;
}

/** Merge confirmed managed results from one active instruction. */
export class ProductStatus {
  private readonly groups = new Map<string, Set<StatusCategory>>();
  private latest: {
    readonly seq: number;
    readonly changeId: string;
    readonly target: StatusTarget;
    readonly groupKey?: string;
    categories: readonly StatusCategory[];
  } | undefined;
  private pushVersion = 0;
  private pushTail: Promise<void> = Promise.resolve();

  constructor(private readonly sink: StatusSink = { push: async () => undefined }) {}

  async publish(update: StatusUpdate): Promise<void> {
    let categories = [...update.categories];
    if (update.groupKey !== undefined) {
      const group = JSON.stringify([
        update.groupKey, update.target.generation, update.target.project,
      ]);
      const grouped = this.groups.get(group) ?? new Set<StatusCategory>();
      for (const category of categories) grouped.add(category);
      this.groups.set(group, grouped);
      categories = [...grouped];
    }

    if (this.latest === undefined || update.seq > this.latest.seq) {
      this.latest = {
        seq: update.seq,
        changeId: update.changeId,
        target: update.target,
        categories,
        ...(update.groupKey === undefined ? {} : { groupKey: update.groupKey }),
      };
    } else if (update.groupKey !== undefined
        && update.groupKey === this.latest.groupKey
        && sameTarget(update.target, this.latest.target)) {
      // A slower result from the same instruction can add a category, but it
      // must keep the newer change id and sequence visible.
      this.latest.categories = categories;
    } else {
      return;
    }

    const value = formatStatus(this.latest.categories, this.latest.changeId);
    const target = this.latest.target;
    const version = ++this.pushVersion;
    const pending = this.pushTail.then(async () => {
      // Skip a queued value when a newer write became known before it started.
      if (version !== this.pushVersion) return;
      await this.sink.push(value, target);
    });
    this.pushTail = pending.catch(() => undefined);
    await pending;
  }
}

interface StatusReply {
  readonly accepted?: boolean;
  readonly error?: string;
  readonly generation?: string;
  readonly projectName?: string;
}

function sameTarget(left: StatusTarget, right: StatusTarget): boolean {
  return left.generation === right.generation && left.project === right.project;
}

/** Live status transport. It has no read, poll, timer, or event path. */
export class LiveStatusSink implements StatusSink {
  constructor(
    private readonly transport: Transport,
    private readonly ready: () => Promise<StatusTarget>,
  ) {}

  async push(value: string, target: StatusTarget): Promise<void> {
    if (target.generation.length === 0 || target.project.length === 0) {
      throw new Error('status target identity is unavailable');
    }
    const current = await this.ready();
    if (!sameTarget(current, target)) {
      throw new Error(
        `status target changed from ${target.project || '<unknown>'} to `
        + `${current.project || '<unknown>'}`,
      );
    }
    const reply = await this.transport.send({
      method: WIRE.statusPush,
      params: {
        value,
        expectedGeneration: target.generation,
        expectedProject: target.project,
      },
    }) as StatusReply;
    if (reply?.accepted !== true) {
      throw new Error(reply?.error ?? 'the extension did not accept the status update');
    }
    if (!sameTarget(target, {
      generation: reply.generation ?? '',
      project: reply.projectName ?? '',
    })) {
      throw new Error('the extension acknowledged the status update for a different project');
    }
  }
}
