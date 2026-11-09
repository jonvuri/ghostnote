/**
 * D44 (8i3, E252): the largest admitted input of each `agent-native-v1` write whose cost grows with its input.
 *
 * Each limit keeps the measured worst case of one call under the 30 s plan budget, or under 45 s with a recorded
 * reason, so that no admitted call reaches the 60 s MCP client timeout (E45). Some limits are also host limits:
 * one write stage confirms at most 8 clips through the writer cursors, and the extension keeps 24 launcher content
 * events, which a revert must compare across. A larger request refuses before any project read or write, with
 * code outside-limit and the limit in detail. Split the work into more calls.
 */
import { ToolFailure } from './agent-native-result.js';

export const WRITE_LIMITS = Object.freeze({
  /**
   * set_device_controls: settings in one call (D69). A route's settings share one write turn, so they add no
   * measured cost: one Diva route of 64 or of all 281 settings took 2.4 s, 16 routes of 16 (256) verified (E412).
   */
  deviceControlSettings: 256,
  /**
   * set_device_controls: same-route cohorts in one call (D69). Each is one write turn between two complete
   * inventories: about 1.3 s on a native device (E411) and 2.3 s on a 281-ID plug-in. 12 Diva routes took 26.8 s,
   * 16 took 36.4 s (E412).
   */
  deviceControlCohorts: 12,
  /**
   * compose_devices: device units (D67, E407). A new native or preset source is 1; a VST3, CLAP or existing source 2;
   * a device with modulators 2 more. After P01's direct insertion and adapter reductions (D65), units no longer
   * drive the cost: 4×4 native took 3.8 s, 16 plug-in units 3.5 s, 4 modulated devices 6.6 s. The worst admitted
   * case is 8 existing sources into 8 chains at position 18: 25.6 s, revert 13.7 s (E408, with shared relocation
   * readings: 17.0 s, revert 12.0 s).
   */
  stagedCompositionDevices: 16,
  /**
   * compose_devices: layer chains (D68, E409). The container arrives from a 16-chain seed with its chains named, so
   * no chain is grown or renamed live: 16 one-device chains at position 18 took 10.9 s, revert 3.5 s (E407 with
   * host duplications: 38.1 s). The seed width is the limit.
   */
  compositionLayerChains: 16,
  /** compose_devices: outer and preset-local modulators/edits; normal-profile route proof, not sound sampling. */
  compositionModulators: 4,
  /** delete_device: removed devices in one call (E252 final3: 10 native devices 25.2 s, 10 281-ID plug-ins 20.7 s). */
  deviceDeletions: 10,
  /** set_device_enabled: settings in one call. */
  deviceEnabledSettings: 32,
  /**
   * read_track_mixer and set_track_mixer: tracks in one call (8i7). A plan bound, not a time limit: the 8-track
   * read and write each take one `track.mixer` turn for each snapshot (E257).
   */
  trackMixerTracks: 8,
  /** rename_track and delete_track: tracks in one call. */
  trackBatch: 64,
  /** set_launcher_clip_properties and set_launcher_clip_launch_settings: one stage confirms 8 writer cursors. */
  clipCursorBatch: 8,
  /** copy_launcher_clips: copies in one call. */
  clipCopyBatch: 8,
  /** delete_launcher_clip: clips in one call. Its revert writes each clip again (8 clips of 16,384 notes: 46 s). */
  clipDeleteBatch: 4,
  /** move_launcher_clips: rows in one range (each clip is two launcher content events). */
  clipMoveRows: 8,
  /**
   * wrap_existing_device_modulation: modulators in one wrap. A host limit, not a time limit (8 and 15 take 13.5 s):
   * the container has one remote page and each modulator adds one, and the remote-page window is 16 (E252: 16
   * modulators never prove their pages).
   */
  wrapModulators: 15,
} as const);

export type WriteLimit = keyof typeof WRITE_LIMITS;

/** Schema text for a bounded input (8i3 follow-up): the agent sees the limit before a call. No maxItems: the refusal stays outside-limit. */
export function atMost(limit: WriteLimit, what: string): string {
  return `At most ${WRITE_LIMITS[limit]} ${what} in one call; a larger request refuses with code outside-limit.`;
}

/**
 * Refuse a request above one limit before any project read or write. `maximum` is for benchmarks that measure a
 * candidate limit; no tool input reaches it.
 */
export function requireWithinLimit(
  limit: WriteLimit, requested: number, what: string, maximum: number = WRITE_LIMITS[limit],
): void {
  const value = maximum;
  if (requested <= value) return;
  throw new ToolFailure('outside-limit', 'input', `This call admits at most ${value} ${what}; the request has `
    + `${requested}. Nothing was read or written. Split the work into more calls.`,
  { detail: { limit, maximum: value, requested, decision: 'D44' } });
}
