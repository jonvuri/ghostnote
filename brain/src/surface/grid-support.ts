/**
 * 9b.7: `check_grid_support` of `agent-native-v1` (D52, D53).
 *
 * Native Grid editing is a research path until a build passes the consent-gated doctor on its exact jar
 * fingerprint. This read reports that gate for the connected host: the jar fingerprint, the accepted cache
 * record when one exists, and the operator steps when none does. It takes one revision mark for the health
 * check and makes no other host call. It never runs the doctor: that stays a driver procedure on the probe
 * profile with the operator's ordinary approval.
 *
 * This module imports only types from `tools.ts`, so there is no import cycle.
 */
import { z } from 'zod';

import { admissionNextStep, readGridAdmission } from '../grid/admission.js';
import { AGENT_NATIVE_TOOL_PROFILE, failureResult, type ReadResult, type Warning } from './agent-native-result.js';
import { checkCursorPins, checkHealth } from './agent-native.js';
import type { ToolSpec } from './tools.js';
import type { Workspace } from './workspace.js';

export const GRID_SUPPORT_SCHEMA = 'ghostnote-grid-support/1';
const PROFILE = `Profile ${AGENT_NATIVE_TOOL_PROFILE}.`;

const DESCRIPTION = `${PROFILE} Read whether native Grid (Poly Grid, FX Grid, Note Grid) editing is admitted on `
  + 'the connected Bitwig build. Admission needs an accepted doctor record for the exact bitwig.jar fingerprint '
  + '(SHA-256, size, and modification time) and the connected host version. data.supported is true only then. '
  + 'This profile has no Grid write tool yet; a future Grid write refuses without this admission. The check hashes '
  + 'the local jar (GHOSTNOTE_BITWIG_JAR, default /Applications/Bitwig Studio.app) and reads the local cache; it '
  + 'takes one revision mark and makes no other Bitwig call. When data.supported is false, data.next names the '
  + 'operator steps: an offline upgrade check, then one consent-gated scratch-track doctor pass on the probe build. '
  + 'This tool cannot run that pass. A stale extension or no open project is a failure with code unhealthy.';

async function checkGridSupport(workspace: Workspace): Promise<unknown> {
  try {
    const at = await workspace.mark();
    const over = at.window.tracks.count > at.window.tracks.bankSize || at.window.scenes.count > at.window.scenes.bankSize;
    if (!over || at.project.length === 0) checkHealth(at);
    else checkCursorPins(at);
    const info = await workspace.hostInfo?.();
    const host = info?.host === undefined ? null : { product: info.host.product, version: info.host.version };
    const admission = readGridAdmission({ hostVersion: host?.version ?? null });
    const warnings: Warning[] = [];
    if (host === null) {
      warnings.push({ code: 'host-version-unknown', message: 'The adapter reported no host version; the cache '
        + 'record version was not cross-checked.' });
    }
    if (admission.verdict === 'refused') {
      warnings.push({ code: 'grid-unsupported', message: `Native Grid writes are refused on this build: ${admission.detail}.` });
    }
    const result: ReadResult<unknown> = {
      schema: GRID_SUPPORT_SCHEMA,
      source: { host: 'bitwig', read: 'revision-mark', jar: admission.jar?.path ?? null, cache: 'local-accepted-record' },
      target: { project: at.project },
      coverage: { gridWriteTools: 'none-in-this-profile' },
      authority: { kind: 'fresh-read', policy: 'D52' },
      data: {
        supported: admission.verdict === 'admitted',
        host,
        jar: admission.jar === null ? null : { path: admission.jar.path, sha256: admission.jar.sha256,
          bytes: admission.jar.bytes, mtimeNs: admission.jar.mtimeNs, fingerprint: admission.jar.fingerprint },
        admission: admission.verdict === 'admitted'
          ? { verdict: 'admitted', cache: admission.cache }
          : { verdict: 'refused', reason: admission.reason, detail: admission.detail, cacheFile: admission.file },
        next: admissionNextStep(admission),
      },
      warnings,
    };
    return result;
  } catch (error) {
    return failureResult(GRID_SUPPORT_SCHEMA, 'resolve', error);
  }
}

export const GRID_SUPPORT_TOOLS: readonly ToolSpec[] = [{
  name: 'check_grid_support', kind: 'read', title: 'Check native Grid support on this Bitwig build',
  description: DESCRIPTION, inputSchema: z.object({}).strict().shape, inputValidator: z.object({}).strict(), emits: [],
  resultContract: { schema: GRID_SUPPORT_SCHEMA, profile: AGENT_NATIVE_TOOL_PROFILE,
    envelope: ['schema', 'source', 'target', 'coverage', 'authority', 'data', 'warnings'],
    data: ['supported', 'host', 'jar', 'admission', 'next'],
    admission: { admitted: ['verdict', 'cache'], refused: ['verdict', 'reason', 'detail', 'cacheFile'] },
    refusals: ['jar-unreadable', 'no-cached-pass', 'cache-unreadable', 'cache-invalid', 'host-version-differs'] },
  run: (workspace) => checkGridSupport(workspace),
}];
