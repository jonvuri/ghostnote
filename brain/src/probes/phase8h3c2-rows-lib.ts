/** 8h3c2 reader row binding: declared fixtures and read verdicts. Pure; the live driver and verifier use it. */
export type Wire = Record<string, any>;

export const ROWS = [0, 1, 63] as const;
/** Entry selections: another track at row 0, the target slot, or another populated row of the target track. */
export const ENTRIES = ['other', 'target', 'sibling'] as const;

/** One distinct clip per row: its own length, channel, start, and pitch. Equal content would hide a wrong bind. */
export function declared(row: number): { beats: number; channel: number; step: number; cell: number; pitch: number } {
  const i = ROWS.indexOf(row as typeof ROWS[number]);
  if (i < 0) throw new Error(`no declared clip for row ${row}`);
  return { beats: 4 * (i + 1), channel: i, step: i, cell: 128 * i, pitch: 60 + i };
}

/** Every read order of the three rows. */
export function orders(): number[][] {
  const out: number[][] = [];
  const walk = (rest: number[], prefix: number[]): void => {
    if (rest.length === 0) { out.push(prefix); return; }
    rest.forEach((row, i) => walk([...rest.slice(0, i), ...rest.slice(i + 1)], [...prefix, row]));
  };
  walk([...ROWS], []);
  return out;
}

/** The declared row whose clip length matches the bound loop end, or -1. */
export function contentRow(loopEndBeats: unknown): number {
  return ROWS.find(row => declared(row).beats === loopEndBeats) ?? -1;
}

const selection = (s: Wire | undefined): number[] => [s?.trackIndex, s?.slotIndex, s?.mixerTrackIndex];

/**
 * A read passes when it binds the requested track and row, returns exactly the declared note of that row,
 * and restores the entry slot track, slot row, and mixer track.
 */
export function verdict(r: Wire): Wire {
  const reply = r.reply ?? {}, bound = reply.bound ?? {}, want = declared(r.row);
  const issues: string[] = [];
  if (reply.refused) issues.push(`refused ${reply.refused}`);
  if (bound.channelId !== r.trackId) issues.push(`bound track ${bound.channelId}`);
  if (bound.row !== r.row) issues.push(`bound row ${bound.row}`);
  const content = contentRow(bound.loopEndBeats);
  if (content !== r.row) issues.push(`content row ${content}`);
  if (!reply.refused) {
    const rows = r.rows as Wire[];
    if (rows.length !== 1) issues.push(`${rows.length} notes`);
    else {
      const n = rows[0]!;
      if (n.channel !== want.channel || n.cell !== want.cell || n.pitch !== want.pitch) {
        issues.push(`note ${n.channel}:${n.cell}:${n.pitch}`);
      }
    }
    if (reply.batches !== 1 || reply.duplicates !== 0 || reply.afterClose !== 0) issues.push('capture rule');
  }
  if (selection(r.before).join() !== selection(r.after).join()) {
    issues.push(`selection ${selection(r.before).join()} -> ${selection(r.after).join()}`);
  }
  return { pass: issues.length === 0, refused: reply.refused ?? null, boundRow: bound.row ?? null, contentRow: content,
    issues };
}
