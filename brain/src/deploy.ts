/**
 * Is the extension we are talking to the one that is deployed on disk?
 *
 * ## ⚠ The gap this closes, and why the obvious fix was the wrong one
 *
 * `contract.hello` compares `methodsHash` — a hash of the registered method
 * NAMES — so it catches a handler being added, removed or renamed and nothing
 * else. Every change of session 3 was invisible to it: `generation`, both epochs,
 * `contentEvents` and `project` are all FIELDS on an existing method's reply, so
 * the method table was byte-identical and the handshake passed green against a
 * jar Bitwig had never loaded. Two probe checks then failed for what looked like
 * a Bitwig reason and was really a deploy that had not taken.
 *
 * ⚠ The tell, when it was finally noticed, was the per-`init()` generation nonce
 * reading byte-identical to the previous run — a coincidence of this session
 * having just built one. Nothing was designed to catch it.
 *
 * ⚠⚠ **The obvious fix — a build id stamped into the jar and compared against a
 * checked-in golden — was rejected.** It has the flaw that kills this class of
 * guard: it needs the golden regenerated on every extension change, so the
 * routine action is "the check is noisy, regenerate it", and a check people
 * routinely silence is not a check. It also only ever detects what someone
 * remembered to stamp.
 *
 * **This asks a question that needs no maintenance at all:**
 *
 *     was the deployed file written AFTER the running extension started?
 *
 * If it was, the running instance predates the file on disk and cannot be it.
 * That is true regardless of what changed — fields, behaviour, nothing at all —
 * so it generalises past the specific bug that motivated it. `initEpochMs` was
 * already on the wire (`rig.stats`, E5's init-cost measurement), so the extension
 * needed no change whatsoever.
 *
 * ## ⚠ What it deliberately does NOT do
 *
 * It is not a content check. Touching the file without changing it reads as
 * stale, which is a false positive we accept: the remedy is one controller
 * reload, and the alternative — hashing a zip on every handshake — buys precision
 * nobody needs for a failure whose real-world cause is always "I forgot to
 * reload".
 *
 * ⚠ It is also **local-only** by construction, which matches D12's loopback
 * posture. When the file is not where we look, the answer is `unknown` and
 * nothing is blocked — a brain running somewhere without the deploy tree must not
 * be unable to work.
 */
import { statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { ContractError } from './contract/index.js';

/**
 * Where `./gradlew copyExtension` puts the jar.
 *
 * ⚠ Duplicated from `extension/build.gradle`, which is a wart with no good home:
 * the brain cannot read a gradle variable and the extension cannot tell us its
 * own path. `GHOSTNOTE_EXTENSION` overrides it, and a wrong path degrades to
 * `unknown` rather than to a false alarm.
 */
export const DEFAULT_EXTENSION_PATH = join(
  homedir(), 'Documents', 'Bitwig Studio', 'Extensions', 'ghostnote-0.0.1.bwextension',
);

export type DeploymentState =
  /** The running extension started after the deployed file was written. */
  | 'fresh'
  /** ⚠ The file on disk is NEWER than the running extension — it was never loaded. */
  | 'stale'
  /** No file where we looked, or the extension did not report when it started. */
  | 'unknown';

export interface Deployment {
  readonly state: DeploymentState;
  readonly detail: string;
  readonly deployedAtMs?: number;
  readonly startedAtMs?: number;
}

/**
 * The comparison, with no filesystem in it — so every branch is testable and the
 * arithmetic cannot hide behind a `statSync`.
 *
 * ⚠ `initEpochMs` is `-1` until the extension finishes `init()` and fills it in
 * (`ExecState.setInitStats`). That is UNKNOWN, never "the epoch zero", and
 * treating a sentinel as a timestamp would make every extension look stale by
 * about fifty-five years.
 */
export function compareDeployment(deployedAtMs: number | undefined, startedAtMs: number): Deployment {
  if (deployedAtMs === undefined) {
    return {
      state: 'unknown',
      detail:
        'no deployed extension found to compare against, so whether the running one is current '
        + 'is unchecked. Set GHOSTNOTE_EXTENSION if the jar lives somewhere else.',
      startedAtMs,
    };
  }
  if (startedAtMs < 0) {
    return {
      state: 'unknown',
      detail:
        'the extension did not report when it started (initEpochMs is the -1 sentinel), so there '
        + 'is nothing to compare the deployed file against. It may still be initialising.',
      deployedAtMs,
    };
  }
  if (deployedAtMs > startedAtMs) {
    const ago = Math.round((startedAtMs - deployedAtMs) / 1000);
    return {
      state: 'stale',
      detail:
        `the deployed extension was written ${new Date(deployedAtMs).toISOString()} but the `
        + `running one started ${new Date(startedAtMs).toISOString()}, ${Math.abs(ago)}s EARLIER — `
        + 'so Bitwig is still running a build that is no longer on disk. A deploy is not a '
        + 'reload: `./gradlew copyExtension` lands the file, and the controller must then be '
        + 'reloaded by hand in Bitwig (Settings -> Controllers). ⚠ Until you do, every reply '
        + 'comes from the OLD build, and `contract.hello` cannot tell you that — it compares '
        + 'method NAMES, so a change that only adds fields to an existing reply passes it.',
      deployedAtMs,
      startedAtMs,
    };
  }
  return {
    state: 'fresh',
    detail: `running build started ${new Date(startedAtMs).toISOString()}, after the deployed file`,
    deployedAtMs,
    startedAtMs,
  };
}

/** When the deployed jar was last written, or `undefined` if it is not there. */
export function deployedAtMs(path = process.env['GHOSTNOTE_EXTENSION'] ?? DEFAULT_EXTENSION_PATH):
number | undefined {
  try {
    return statSync(path).mtimeMs;
  } catch {
    return undefined;
  }
}

/** ⚠ Refused rather than warned, for the same reason as a contract mismatch. */
export class StaleExtensionError extends ContractError {
  constructor(readonly deployment: Deployment) {
    super(`stale extension: ${deployment.detail}`);
  }
}
