/**
 * Carry stored overlays to a new acquisition of the same clip (8h4c).
 *
 * Host notes do not store portable overlays. The identity registry keeps the
 * overlays of each base ref as its annotation store. When a later acquisition
 * keeps the clip ID (`current` or `stale`, or a verified write), this module
 * applies the lifecycle rules of IDENTITY-AND-OVERLAYS.md:
 *
 *   - an overlay with an unresolved reference is removed, and so is every
 *     overlay that depends on it (transitively);
 *   - a current overlay whose dependency basis changed, or that depends on a
 *     stale overlay, becomes stale and keeps its old basis and data;
 *   - nothing is recomputed, and no claim moves to another note.
 */
import { validate, type Overlay, type StateDocument } from '../document/index.js';
import { cloneJson } from '../document/json.js';
import { basisFromIndex, indexState, overlayOrder } from '../document/semantic.js';

export interface OverlayRemoval {
  readonly id: string;
  readonly reason: 'unresolved-reference' | 'removed-dependency';
}

export interface CarriedOverlays {
  readonly overlays: Overlay[];
  readonly removed: readonly OverlayRemoval[];
  /** IDs of overlays that this carry made stale. */
  readonly staled: readonly string[];
}

/** The event and clip IDs that one overlay names. */
function references(overlay: Overlay): { events: string[]; clips: string[] } {
  const data = overlay.data as Record<string, unknown>;
  const events = [
    ...overlay.depends.events.map((item) => item.id),
    ...(typeof data['event'] === 'string' ? [data['event']] : []),
    ...(Array.isArray(data['events']) ? data['events'] as string[] : []),
    ...(typeof data['anchor'] === 'string' ? [data['anchor']] : []),
  ];
  const clips = [
    ...overlay.depends.clips.map((item) => item.id),
    ...overlay.depends.membership,
    ...(typeof data['clip'] === 'string' ? [data['clip']] : []),
  ];
  return { events, clips };
}

function overlayDependencies(overlay: Overlay): string[] {
  const data = overlay.data as Record<string, unknown>;
  return [...overlay.depends.overlays, ...(typeof data['nominal'] === 'string' ? [data['nominal']] : [])];
}

/**
 * Carry `prior` overlays onto `document`, which has no overlays of its own.
 * The result document is valid: every current overlay has a matching basis.
 */
export function carryOverlays(prior: readonly Overlay[], document: StateDocument): CarriedOverlays {
  const events = new Set(document.events.map((event) => event.id));
  const clips = new Set(document.clips.map((clip) => clip.id));
  const removed: OverlayRemoval[] = [];
  let kept = prior.map((overlay) => cloneJson(overlay) as Overlay);
  kept = kept.filter((overlay) => {
    const named = references(overlay);
    const resolved = named.events.every((id) => events.has(id)) && named.clips.every((id) => clips.has(id));
    if (!resolved) removed.push({ id: overlay.id, reason: 'unresolved-reference' });
    return resolved;
  });
  for (let changed = true; changed;) {
    changed = false;
    const ids = new Set(kept.map((overlay) => overlay.id));
    kept = kept.filter((overlay) => {
      const resolved = overlayDependencies(overlay).every((id) => ids.has(id));
      if (!resolved) {
        removed.push({ id: overlay.id, reason: 'removed-dependency' });
        changed = true;
      }
      return resolved;
    });
  }
  const state: StateDocument = { ...cloneJson(document) as StateDocument, overlays: kept };
  const index = indexState(state);
  const staled: string[] = [];
  for (const overlay of overlayOrder(kept)) {
    if (overlay.state !== 'current') continue;
    const dependsOnStale = overlay.depends.overlays.some((id) => index.overlays.get(id)!.state === 'stale');
    if (dependsOnStale || overlay.basis !== basisFromIndex(index, overlay)) {
      overlay.state = 'stale';
      staled.push(overlay.id);
    }
  }
  const valid = validate(state) as StateDocument;
  return {
    overlays: valid.overlays,
    removed: removed.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    staled: staled.sort(),
  };
}
