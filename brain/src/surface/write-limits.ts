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
  /** set_device_controls: settings in one call. */
  deviceControlSettings: 64,
  /**
   * set_device_controls: same-route cohorts in one call. Each reads complete inventories: about 2 s on a native
   * device, 3.4 s on a 281-ID plug-in (E252 final3: 4 plug-in cohorts and 64 settings took 22.5 s).
   */
  deviceControlCohorts: 4,
  /**
   * compose_devices: device units. Each staged device is an insertion, a move, and later a reversal: about 3.5 s
   * each way for a native device, so a VST3 or CLAP source counts as two units. A device with modulators has its own
   * page proof and sampling session (about 7 s) and counts two more (E252: 8 native devices took 30 s and their
   * revert 35 s; 6 devices with modulators on 3 of them 45.6 s). A plug-in stays two units: 3 Diva chains took 13.8 s
   * and their revert 15.8 s, so 6 at one unit each would take about 28 s and 32 s, and other plug-ins have more
   * parameters than Diva.
   */
  stagedCompositionDevices: 6,
  /** compose_devices: outer and preset-local modulators in one composition (each has a behavior proof). */
  compositionModulators: 4,
  /** delete_device: removed devices in one call (E252 final3: 10 native devices 25.2 s, 10 281-ID plug-ins 20.7 s). */
  deviceDeletions: 10,
  /** set_device_enabled: settings in one call. */
  deviceEnabledSettings: 32,
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

/** Refuse a request above one limit before any project read or write. */
export function requireWithinLimit(limit: WriteLimit, requested: number, what: string): void {
  const value = WRITE_LIMITS[limit];
  if (requested <= value) return;
  throw new ToolFailure('outside-limit', 'input', `This call admits at most ${value} ${what}; the request has `
    + `${requested}. Nothing was read or written. Split the work into more calls.`,
  { detail: { limit, maximum: value, requested, decision: 'D44' } });
}
