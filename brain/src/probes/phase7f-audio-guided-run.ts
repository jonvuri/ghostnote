/** Complete Phase 7f audio-guided sound-design dogfood run. */
import { createHash, randomUUID } from 'node:crypto';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';

import {
  AUDIO_CAPTURE_MODULE_ID, AUDIO_CAPTURE_PROJECT_SCHEMA, AUDIO_CAPTURE_REQUEST_SCHEMA,
  AUDIO_CAPTURE_SOURCE_SCHEMA, AUDIO_FACTS_MODULE_ID, AUDIO_FACTS_REQUEST_SCHEMA,
  AUDIO_PROPERTY_DEFINITIONS,
  BRIGHTNESS_LEVEL_LIMIT_LU, SENSORY_REQUEST_SCHEMA, audioCaptureModule,
  audioCaptureRequest, audioCaptureSource, audioFactsModule, captureAndAnalyze,
  createFfmpegExecutableAdapter, createLiveAudioCaptureController, routeAudioEvidence,
  verifyAudioArtifact,
  type AudioArtifactDeclaration, type AudioCaptureGuard, type AudioCaptureResult, type AudioFactsResult,
  type SavedBitwigProject,
} from '../audio/index.js';
import {
  addressKey, clip as clipAt, clipMetadata, scene, slot, track as trackAt,
  type ClipMetadataState,
} from '../contract/index.js';
import { Session } from '../session.js';
import { callTool, STABLE_TOOL_PROFILE } from '../surface/tools.js';
import { workspaceOf, type Workspace } from '../surface/workspace.js';
import {
  HYBRID_RUN_RECORD_SCHEMA, PHASE_7F_AUDIO_GUIDED_PROFILE, PHASE_7F_RUN_PROFILE,
  validateHybridRunRecord,
} from '../workstation/hybrid-run-record.js';
import {
  WORKSTATION_REQUEST_SCHEMA, WorkstationModuleRegistry,
} from '../workstation/index.js';

const METHODS_HASH = '78368fe47ea0e814';
const TRACK_NAME = 'perc a';
const TRACK_ID = '2598ed2d-9e8c-40f4-8435-33609aad552a';
const ROW = 6;
const RANGE_BEATS = 4;
const DEVICE_POSITION = 0;
const DEVICE_NAME = 'Dist TUBE-CULTURE';
const PARAMETER_ID = 'CONTENTS/PIDd';
const PARAMETER_NAME = 'Output Tilt Slope';
const BASE_VALUE = 0.3749999701976776;
const CANDIDATE_VALUE = 0.5;
const ORIGINAL_PLAY_START_BEATS = 0.28698158264160156;
const RUN_ID = `phase7f-${randomUUID()}`;
const REQUEST_ID = `${RUN_ID}-request`;
const RECORD_PATH = resolve(
  process.cwd(), '../context/evidence/experiments/e127-phase7f-hybrid-run.json',
);
const EVIDENCE_PATH = resolve(
  process.cwd(), '../context/evidence/experiments/e127-phase7f-audio-evidence.json',
);

interface Parameter {
  readonly id: string;
  readonly name: string;
  readonly normalizedValue: number;
}

interface ToolOperation {
  readonly id: string;
  readonly name: string;
  readonly elapsedMs: number;
  readonly outcome: 'pass' | 'refused' | 'failed';
}

interface ParameterWriteResult {
  readonly applied?: boolean;
  readonly partialSuccess?: boolean;
  readonly verified?: boolean;
  readonly why?: string;
  readonly parameterChanges?: readonly {
    readonly changes: readonly { readonly changeId?: string }[];
  }[];
  readonly changes?: readonly { readonly changeId?: string }[];
}

function parameterChangeIds(result: ParameterWriteResult): string[] {
  return [
    ...(result.parameterChanges ?? []).flatMap((route) => route.changes),
    ...(result.changes ?? []),
  ].flatMap((change) => change.changeId === undefined ? [] : [change.changeId]);
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const projectArgument = argument('--project-file');
if (projectArgument === undefined) throw new Error('use --project-file with the exact saved project');
const projectFile = resolve(projectArgument);
const projectDirectory = dirname(projectFile);
const projectName = basename(projectFile, '.bwproject');

let toolCalls = 0;
const operations: ToolOperation[] = [];

async function call<T>(workspace: Workspace, name: string, args: unknown = {}): Promise<T> {
  const started = performance.now();
  toolCalls += 1;
  try {
    const result = await callTool(workspace, name, args, STABLE_TOOL_PROFILE) as T;
    operations.push({
      id: `${RUN_ID}-operation-${operations.length + 1}`,
      name,
      elapsedMs: performance.now() - started,
      outcome: 'pass',
    });
    return result;
  } catch (error) {
    operations.push({
      id: `${RUN_ID}-operation-${operations.length + 1}`,
      name,
      elapsedMs: performance.now() - started,
      outcome: 'failed',
    });
    throw error;
  }
}

async function stableGuard(session: Session): Promise<AudioCaptureGuard> {
  let prior = await session.mark();
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await new Promise((done) => setTimeout(done, 100));
    const next = await session.mark();
    if (prior.generation === next.generation && prior.project === next.project
        && prior.revision === next.revision && prior.sceneEpoch === next.sceneEpoch
        && prior.contentEpoch === next.contentEpoch) {
      return {
        generation: next.generation,
        project: next.project,
        revision: next.revision,
        sceneEpoch: next.sceneEpoch,
        contentEpoch: next.contentEpoch,
      };
    }
    prior = next;
  }
  throw new Error('the live project guard did not settle');
}

function oneParameter(result: {
  readonly standing?: string;
  readonly deviceName?: string;
  readonly parameters?: readonly Parameter[];
}): Parameter {
  if (result.standing !== 'stable' || result.deviceName !== DEVICE_NAME) {
    throw new Error('the selected device inventory is not exact and stable');
  }
  const matches = result.parameters?.filter((item) => item.id === PARAMETER_ID) ?? [];
  if (matches.length !== 1 || matches[0]?.name !== PARAMETER_NAME) {
    throw new Error('the selected Dist TUBE-CULTURE Output Tilt Slope parameter is unavailable');
  }
  return matches[0]!;
}

function fact(result: AudioFactsResult, id: string): number | null {
  return result.facts.find((item) => item.fieldId === id)?.value ?? null;
}

async function readExactClipMetadata(workspace: Workspace): Promise<ClipMetadataState> {
  const at = await workspace.mark();
  const address = clipMetadata(clipAt(slot(trackAt(TRACK_ID), scene(ROW, at.sceneEpoch))));
  const snapshot = await workspace.read([address]);
  const entry = snapshot.entries[addressKey(address)];
  if (entry?.value.of !== 'clipMetadata') {
    throw new Error('the exact perc a clip metadata is unavailable');
  }
  return entry.value.metadata;
}

async function main(): Promise<void> {
  const startedAt = new Date().toISOString();
  const projectBytes = await readFile(projectFile);
  const projectFileSha256 = createHash('sha256').update(projectBytes).digest('hex');
  const session = new Session({ expectMethodsHash: METHODS_HASH });
  const captures: AudioCaptureResult[] = [];
  let candidateChangeId: string | undefined;
  let recoveryChangeId: string | undefined;
  let recoveryOperationId: string | undefined;
  let recoveryVerified = false;
  let candidateOperationId: string | undefined;
  let recoveryWriteResult: ParameterWriteResult | undefined;
  let candidateWriteResult: ParameterWriteResult | undefined;
  let finalized = false;
  try {
    await session.ready();
    const workspace = workspaceOf({
      ready: async () => { await session.ready(); },
      get adapter() { return session.bitwig; },
      get executor() { return session.executor; },
      stash: session.stash,
      observationStore: session.observations,
    });
    const run = async (): Promise<void> => {
      const connection = await call<{ readonly project: string }>(workspace, 'check_connection');
      if (connection.project !== projectName) {
        throw new Error(`live project ${connection.project} does not match ${projectName}`);
      }
      const tracks = await call<{
        readonly tracks: readonly { readonly trackId: string; readonly name: string }[];
      }>(workspace, 'list_tracks');
      const target = tracks.tracks.filter((item) => item.trackId === TRACK_ID && item.name === TRACK_NAME);
      if (target.length !== 1) throw new Error('the selected real track identity changed');
      const clip = await call<{
        readonly readable: boolean; readonly clipExists: boolean; readonly lengthBeats: number | null;
      }>(workspace, 'read_clip', { trackId: TRACK_ID, row: ROW, channel: 0 });
      if (!clip.readable || !clip.clipExists || clip.lengthBeats !== RANGE_BEATS) {
        throw new Error('the selected real launcher clip no longer satisfies the capture contract');
      }
      const captureMetadata = await readExactClipMetadata(workspace);
      if (captureMetadata.playStartBeats !== ORIGINAL_PLAY_START_BEATS
          || captureMetadata.loopEnabled !== true
          || captureMetadata.loopStartBeats !== 0
          || captureMetadata.loopEndBeats !== RANGE_BEATS) {
        throw new Error('the exact perc a play start or loop metadata changed');
      }
      const devices = await call<{
        readonly complete: boolean;
        readonly devices: readonly { readonly position: number; readonly name: string; readonly enabled?: boolean }[];
      }>(workspace, 'inspect_devices', { trackId: TRACK_ID });
      const device = devices.devices[DEVICE_POSITION];
      if (!devices.complete || device?.name !== DEVICE_NAME || device.enabled !== true) {
        throw new Error('the selected real Dist TUBE-CULTURE device no longer matches');
      }
      const beforeInventory = await call<{
        readonly standing?: string; readonly deviceName?: string; readonly parameters?: readonly Parameter[];
      }>(workspace, 'inspect_device_parameters', {
        device: { trackId: TRACK_ID, devicePosition: DEVICE_POSITION }, view: 'direct',
      });
      let beforeParameter = oneParameter(beforeInventory);
      if (Math.abs(beforeParameter.normalizedValue - CANDIDATE_VALUE) <= 1e-6) {
        console.log('PHASE7F_STAGE recover-base-after-prior-parser-failure');
        const recovered = await call<ParameterWriteResult>(workspace, 'set_parameter', {
          settings: [{
            kind: 'direct',
            device: { trackId: TRACK_ID, devicePosition: DEVICE_POSITION },
            parameterId: PARAMETER_ID,
            normalizedValue: BASE_VALUE,
          }],
        });
        recoveryWriteResult = recovered;
        console.log(`PHASE7F_RECOVERY_RESULT ${JSON.stringify(recovered)}`);
        recoveryOperationId = operations.at(-1)?.id;
        const recoveryIds = parameterChangeIds(recovered);
        if (recoveryIds.length !== 1) {
          throw new Error('the baseline recovery did not return one recorded change ID');
        }
        recoveryChangeId = recoveryIds[0];
        const recoveredInventory = await call<{
          readonly standing?: string; readonly deviceName?: string;
          readonly parameters?: readonly Parameter[];
        }>(workspace, 'inspect_device_parameters', {
          device: { trackId: TRACK_ID, devicePosition: DEVICE_POSITION }, view: 'direct',
        });
        beforeParameter = oneParameter(recoveredInventory);
        recoveryVerified = Math.abs(beforeParameter.normalizedValue - BASE_VALUE) <= 1e-6;
      }
      if (Math.abs(beforeParameter.normalizedValue - BASE_VALUE) > 1e-6) {
        throw new Error(
          `the Output Tilt Slope base is ${beforeParameter.normalizedValue}, expected ${BASE_VALUE}`,
        );
      }

      const project: SavedBitwigProject = {
        schema: AUDIO_CAPTURE_PROJECT_SCHEMA,
        directory: projectDirectory,
        projectFile,
        projectFileSha256,
        liveProjectName: projectName,
        permissionBasis: 'operator-authorized real Phase 7f project-local temporary WAVE files',
        associationBasis: 'operator-established-path-plus-live-guard-v0',
      };
      const registry = new WorkstationModuleRegistry();
      const captureTiming: { phase: string; elapsedMs: number }[] = [];
      const analysisTiming: { phase: string; elapsedMs: number }[] = [];
      registry.register(audioCaptureModule({
        controller: createLiveAudioCaptureController(session, METHODS_HASH),
        onTiming: (event) => captureTiming.push(event),
      }));
      registry.register(audioFactsModule({
        adapter: createFfmpegExecutableAdapter(),
        onTiming: (event) => analysisTiming.push(event),
      }));

      const capture = async (role: 'A' | 'B'): Promise<{
        readonly capture: AudioCaptureResult; readonly analysis: AudioFactsResult;
      }> => {
        const guard = await stableGuard(session);
        const source = audioCaptureSource({
          schema: AUDIO_CAPTURE_SOURCE_SCHEMA,
          sourceId: `phase7f-${role.toLowerCase()}-perc-a`,
          sourceKind: 'project-master-during-launcher-clip',
          projectFileSha256,
          launcherClip: {
            kind: 'clip',
            slot: {
              kind: 'slot',
              track: { kind: 'track', channelId: TRACK_ID },
              scene: { kind: 'scene', index: ROW, epoch: guard.sceneEpoch },
            },
          },
          guard,
          range: {
            policy: 'one-launcher-loop-from-start-v0',
            startBeats: ORIGINAL_PLAY_START_BEATS,
            endBeats: RANGE_BEATS,
            stepSizeBeats: 0.25,
          },
          permissionBasis: 'operator-authorized real launcher clip and project master output',
          coverage: {
            masterSource: 'project-master',
            launcherClipRole: 'range-trigger',
            otherProjectOutput: 'not-excluded',
          },
        });
        const request = audioCaptureRequest(project, source, {
          activationMs: 4_000,
          playbackMs: 15_000,
          stopMs: 4_000,
          settleMs: 6_000,
          pollMs: 25,
          stabilityMs: 100,
        });
        const composed = await captureAndAnalyze(registry, {
          schema: WORKSTATION_REQUEST_SCHEMA,
          requestId: `${RUN_ID}-capture-${role}`,
          inputSchema: AUDIO_CAPTURE_REQUEST_SCHEMA,
          sourceSha256: source.sha256,
          payload: request,
        }, `${RUN_ID}-facts-${role}`, {
          taskId: `${RUN_ID}-brightness-${role}`,
          property: 'brightness',
          operationalDefinition: AUDIO_PROPERTY_DEFINITIONS.brightness,
        });
        captures.push(composed.capture.payload);
        if (!composed.analysis.ok) throw composed.analysis.error;
        return { capture: composed.capture.payload, analysis: composed.analysis.response.payload };
      };

      console.log('PHASE7F_STAGE baseline-capture');
      const A = await capture('A');
      console.log(`PHASE7F_ARTIFACT_A ${A.capture.artifact.absolutePath}`);

      console.log('PHASE7F_STAGE guarded-parameter-change');
      const changed = await call<ParameterWriteResult>(workspace, 'set_parameter', {
        settings: [{
          kind: 'direct',
          device: { trackId: TRACK_ID, devicePosition: DEVICE_POSITION },
          parameterId: PARAMETER_ID,
          normalizedValue: CANDIDATE_VALUE,
        }],
      });
      candidateWriteResult = changed;
      console.log(`PHASE7F_PARAMETER_RESULT ${JSON.stringify(changed)}`);
      candidateOperationId = operations.at(-1)?.id;
      const candidateIds = parameterChangeIds(changed);
      candidateChangeId = candidateIds.length === 1 ? candidateIds[0] : undefined;
      if (candidateChangeId === undefined) {
        throw new Error(
          `the candidate parameter write did not return one change ID: ${JSON.stringify(changed)}`,
        );
      }
      const afterInventory = await call<{
        readonly standing?: string; readonly deviceName?: string; readonly parameters?: readonly Parameter[];
      }>(workspace, 'inspect_device_parameters', {
        device: { trackId: TRACK_ID, devicePosition: DEVICE_POSITION }, view: 'direct',
      });
      const afterParameter = oneParameter(afterInventory);
      if (Math.abs(afterParameter.normalizedValue - CANDIDATE_VALUE) > 1e-6) {
        throw new Error('independent parameter readback did not confirm the candidate');
      }

      console.log('PHASE7F_STAGE candidate-capture');
      const B = await capture('B');
      console.log(`PHASE7F_ARTIFACT_B ${B.capture.artifact.absolutePath}`);
      const sampleRateHz = A.capture.artifact.format.sampleRateHz;
      const observedSamples = (captureResult: AudioCaptureResult): number => Math.floor(
        (captureResult.observedRange.rangeWrappedAtMs
          - captureResult.observedRange.playbackStartedAtMs) * sampleRateHz / 1_000,
      );
      const commonSamples = Math.min(observedSamples(A.capture), observedSamples(B.capture));
      if (!Number.isSafeInteger(commonSamples) || commonSamples < sampleRateHz / 2) {
        throw new Error('the captures do not expose a usable common musical sample range');
      }
      const projectedDeclaration = (
        captureResult: AudioCaptureResult,
      ): AudioArtifactDeclaration => {
        const totalSamples = captureResult.artifact.scope.sampleRange.end;
        const proposedStart = Math.floor(
          captureResult.coverage.captureLeadMs * sampleRateHz / 1_000,
        );
        const start = Math.min(Math.max(0, proposedStart), totalSamples - commonSamples);
        return {
          ...captureResult.artifact,
          scope: {
            sampleRange: { start, end: start + commonSamples },
            channelIndices: [...captureResult.artifact.scope.channelIndices],
          },
        };
      };
      const analyzeProjection = async (
        role: 'A' | 'B', captureResult: AudioCaptureResult,
      ): Promise<AudioFactsResult> => {
        const verified = await verifyAudioArtifact(projectedDeclaration(captureResult));
        const response = await registry.request(AUDIO_FACTS_MODULE_ID, {
          schema: WORKSTATION_REQUEST_SCHEMA,
          requestId: `${RUN_ID}-facts-common-${role}`,
          inputSchema: AUDIO_FACTS_REQUEST_SCHEMA,
          sourceSha256: captureResult.artifact.sha256,
          payload: {
            schema: AUDIO_FACTS_REQUEST_SCHEMA,
            artifact: verified,
            task: {
              taskId: `${RUN_ID}-brightness-common-${role}`,
              property: 'brightness',
              operationalDefinition: AUDIO_PROPERTY_DEFINITIONS.brightness,
            },
          },
        });
        return response.payload as AudioFactsResult;
      };
      const [analysisA, analysisB] = await Promise.all([
        analyzeProjection('A', A.capture), analyzeProjection('B', B.capture),
      ]);
      const comparableA = { ...A, analysis: analysisA };
      const comparableB = { ...B, analysis: analysisB };
      const sensory = routeAudioEvidence({
        schema: SENSORY_REQUEST_SCHEMA,
        taskId: `${RUN_ID}-paired-brightness`,
        property: 'brightness',
        operationalDefinition: AUDIO_PROPERTY_DEFINITIONS.brightness,
        decisionPurpose: 'Compare a bounded Dist TUBE-CULTURE tilt change before operator audition.',
        A: comparableA.analysis,
        B: comparableB.analysis,
      });
      const loudnessDelta = sensory.fields.find(
        (item) => item.fieldId === 'integrated-loudness-v0',
      )?.B_minus_A ?? null;
      const rolloffDelta = sensory.fields.find(
        (item) => item.fieldId === 'spectral-rolloff-85-v0',
      )?.B_minus_A ?? null;
      if (sensory.evidenceStatus !== 'comparable' || loudnessDelta === null
          || Math.abs(loudnessDelta) > BRIGHTNESS_LEVEL_LIMIT_LU) {
        throw new Error(`the paired brightness gate failed: loudness delta ${loudnessDelta}`);
      }

      const evidence = {
        runId: RUN_ID,
        profile: PHASE_7F_RUN_PROFILE,
        baseline: A,
        candidate: B,
        comparableProjection: {
          commonSamples,
          A: comparableA.analysis,
          B: comparableB.analysis,
        },
        sensory,
        exactParameterReadback: { before: beforeParameter, after: afterParameter },
        parameterWriteResults: { recovery: recoveryWriteResult, candidate: candidateWriteResult },
        moduleDiscovery: registry.discover(),
        timings: { capture: captureTiming, analysis: analysisTiming },
      };
      await writeFile(EVIDENCE_PATH, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');

      const modules = [
        ...registry.discover().map((module) => ({
          moduleId: module.moduleId,
          version: module.version,
          state: module.state,
          acceptedSchemas: [...module.acceptedSchemas],
          emittedSchemas: [...module.emittedSchemas],
        })),
        ...PHASE_7F_AUDIO_GUIDED_PROFILE.modules.slice(2).map((module) => ({
          ...module, state: 'available',
        })),
      ];
      const commonRecord = {
        schema: HYBRID_RUN_RECORD_SCHEMA,
        profile: PHASE_7F_RUN_PROFILE,
        rootSession: {
          id: RUN_ID,
          client: 'Codex IDE session',
          model: 'GPT-5',
          operatingMode: 'hybrid',
          startedAt,
        },
        permissions: {
          projectPath: projectFile,
          temporaryProjectLocalWaveFiles: true,
          boundedDeviceParameters: true,
          changesRequireRecordedIds: true,
          externalReference: false,
        },
        versions: {
          stableToolProfile: STABLE_TOOL_PROFILE,
          description: PHASE_7F_AUDIO_GUIDED_PROFILE.descriptionVersion,
          reasoningEffort: 'not exposed to the run',
          node: process.versions.node,
          host: 'Bitwig Studio 6.0.6',
          controllerApi: '25',
          extension: '0.0.1',
          methodsHash: METHODS_HASH,
        },
        modules,
        request: {
          id: REQUEST_ID,
          text: 'Make one existing sound noticeably brighter without making it louder.',
        },
        links: [
          { kind: 'request', id: REQUEST_ID },
          { kind: 'source', id: A.capture.source.sha256 },
          { kind: 'source', id: B.capture.source.sha256 },
          { kind: 'artifact', id: A.capture.artifact.sha256 },
          { kind: 'artifact', id: B.capture.artifact.sha256 },
          { kind: 'evidence', id: `${RUN_ID}-facts-common-A` },
          { kind: 'evidence', id: `${RUN_ID}-facts-common-B` },
          { kind: 'evidence', id: sensory.taskId },
          ...(recoveryChangeId === undefined ? [] : [{ kind: 'change' as const, id: recoveryChangeId }]),
          { kind: 'change', id: candidateChangeId },
        ],
        source: {
          id: A.capture.source.sha256,
          projectFileSha256,
          trackId: TRACK_ID,
          trackName: TRACK_NAME,
          launcherRow: ROW,
          devicePosition: DEVICE_POSITION,
          deviceName: DEVICE_NAME,
          parameterId: PARAMETER_ID,
          parameterName: PARAMETER_NAME,
        },
        artifacts: [
          {
            id: A.capture.artifact.sha256,
            role: 'A',
            absolutePath: A.capture.artifact.absolutePath,
            sha256: A.capture.artifact.sha256,
            byteCount: A.capture.artifact.byteCount,
            owned: true,
          },
          {
            id: B.capture.artifact.sha256,
            role: 'B',
            absolutePath: B.capture.artifact.absolutePath,
            sha256: B.capture.artifact.sha256,
            byteCount: B.capture.artifact.byteCount,
            owned: true,
          },
        ],
        evidence: [
          { id: `${RUN_ID}-facts-common-A`, role: 'A', schema: comparableA.analysis.schema, authority: 'derived-measurement', sourceId: comparableA.analysis.source.sourceId },
          { id: `${RUN_ID}-facts-common-B`, role: 'B', schema: comparableB.analysis.schema, authority: 'derived-measurement', sourceId: comparableB.analysis.source.sourceId },
          { id: sensory.taskId, role: 'comparison', schema: sensory.schema, authority: 'derived-measurement', sourceId: `${comparableA.analysis.source.sourceId}:${comparableB.analysis.source.sourceId}` },
        ],
        operations,
        changes: [
          ...(recoveryChangeId === undefined || recoveryOperationId === undefined ? [] : [{
            id: recoveryChangeId,
            operationId: recoveryOperationId,
            verified: recoveryVerified,
            finalDisposition: 'reverted' as const,
          }]),
          {
            id: candidateChangeId,
            operationId: candidateOperationId!,
            verified: true,
            finalDisposition: 'pending',
          },
        ],
        seams: [
          { id: 'S01', producer: 'Codex client', consumer: 'stable-v1 surface', formats: [{ name: 'MCP tool arguments/results', producerVersion: 'stable-v1', consumerVersion: 'stable-v1' }], projection: 'Exact public tool request and result.', translation: 'Validated tool arguments become typed workspace calls.', defaults: [], validation: ['Tool schemas and exact target checks passed.'], droppedData: [], verdict: 'pass' },
          { id: 'S02', producer: 'live adapter', consumer: 'workspace change store', formats: [{ name: 'Snapshot and scalar receipt', producerVersion: 'ghostnote/0', consumerVersion: 'ghostnote/0' }], projection: 'The recovery and candidate scalar receipts entered the session change store.', translation: 'Normalized DirectParameter values became param.set calls.', defaults: [], validation: ['Independent complete parameter readback passed after each write.'], droppedData: [], verdict: 'pass' },
          { id: 'S11', producer: 'audio-capture-v0 request', consumer: 'MasterRecorder and storage adapters', formats: [{ name: 'ghostnote-audio-capture-request-v0', producerVersion: '0', consumerVersion: '0' }, { name: 'audio-capture-v0', producerVersion: '0', consumerVersion: '0' }], projection: 'The launcher clip supplied range; the project master supplied audio.', translation: 'Beat range stayed separate from observed sample coverage.', defaults: [], validation: ['Saved-project, guard, recorder, unique-file, hash, and header checks passed.'], droppedData: [], verdict: 'pass' },
          { id: 'S12', producer: 'audio-capture-v0', consumer: 'audio-facts-v0', formats: [{ name: 'ghostnote-audio-artifact-v0', producerVersion: '0', consumerVersion: '0' }, { name: 'ghostnote-verified-audio-artifact-v0', producerVersion: '0', consumerVersion: '0' }], projection: `Each full artifact was verified, then projected to one ${commonSamples}-sample common musical range and verified again.`, translation: 'The file SHA-256 stayed unchanged; only the declared sample scope narrowed.', defaults: [], validation: ['Hash, PCM24 WAVE header, equal sample coverage, and final source check passed.'], droppedData: ['Unequal recorder lead and tail samples were outside the paired analysis scope.'], verdict: 'pass' },
          { id: 'S13', producer: 'audio-facts-v0', consumer: 'sensory v1 router', formats: [{ name: 'audio-facts-v0', producerVersion: '0', consumerVersion: '1' }, { name: 'ghostnote-sensory-packet-v1', producerVersion: '1', consumerVersion: '1' }], projection: 'Only silence, integrated loudness, and rolloff facts were copied.', translation: 'B minus A used finite compatible values.', defaults: [], validation: ['Units, formulas, settings, channels, coverage, provider, silence, and 0.2 LU gate passed.'], droppedData: ['Unselected audio facts were not requested.'], verdict: 'pass' },
          { id: 'S16', producer: 'cross-module run', consumer: 'hybrid run record', formats: [{ name: HYBRID_RUN_RECORD_SCHEMA, producerVersion: '0', consumerVersion: '0' }], projection: 'IDs and authority classes link without merging evidence.', translation: 'Operator input will set only the operator verdict and final disposition.', defaults: ['Verdict is pending until explicit input.'], validation: ['Strict run-record validation passes before each write.'], droppedData: ['Raw provider results remain in the separate audio evidence file.'], verdict: 'pass' },
          { id: 'S17', producer: 'frozen run profile', consumer: 'module registry', formats: [{ name: 'ghostnote-workstation-module-v0', producerVersion: '0', consumerVersion: '0' }], projection: 'Only capture and audio facts modules were enabled.', translation: 'Discovery started no provider; requests started only their selected module.', defaults: [], validation: ['Accepted and emitted schemas match the frozen profile.'], droppedData: [], verdict: 'pass' },
        ],
        authorities: [
          { claim: 'Track, clip metadata, device, parameter, artifact bytes, and readback.', authority: 'exact-observation', evidenceId: A.capture.source.sha256 },
          { claim: 'Loudness, silence, and rolloff values.', authority: 'derived-measurement', evidenceId: sensory.taskId },
          { claim: 'The Output Tilt Slope change is a plausible brightness adjustment.', authority: 'agent-interpretation', evidenceId: candidateChangeId },
          { claim: 'The candidate write reached its exact base value.', authority: 'verified-outcome', evidenceId: candidateChangeId },
          { claim: 'The original non-zero play start stayed exact for capture.', authority: 'exact-observation', evidenceId: A.capture.source.sha256 },
        ],
        costs: {
          toolCalls,
          latencyMs: {
            baselineCapture: A.capture.timingMs.total,
            candidateCapture: B.capture.timingMs.total,
            sensoryRouting: sensory.timingMs.routing,
          },
          operatorInterventions: [
            'The operator selected perc a after the preferred keys track had no device.',
            'The operator authorized a temporary play-start edit and the non-zero-start capability work.',
            'The operator restarted the system and reopened the Bitwig project.',
            'The operator gave one explicit A/B verdict.',
          ],
          targetErrors: [
            'The supplied path omitted the project directory level; the exact existing file was used.',
            'The preferred keys track has a valid launcher clip but no device.',
            'The whisper texture clip did not wrap within 55 seconds and cannot fit the capture profile with lead and tail.',
            'Two earlier perc a baseline attempts failed because audio clips report playingStep -1.',
            'A temporary play-start reset was undone exactly before the successful composed run.',
            'Dist TUBE-CULTURE did not settle its target-bound write callback; complete independent inventory verified each requested base value.',
          ],
          verificationCost: [
            'Two saved-project validations and live source preflights.',
            'Two recorder lifecycle and unique-file attribution checks.',
            'Two full artifact hashes before and after analysis.',
            'Two guarded scalar writes plus independent complete inventory readback.',
            'Exact clip-metadata reads preserved the original non-zero play start.',
          ],
          unsupportedBoundaries: [
            'Bitwig does not expose the loaded project path.',
            'Capture does not exclude other project-master output.',
            'API 25 cannot write exact displayed or semantic parameter values.',
          ],
        },
        interfaceClassifications: [
          { interface: 'audio-capture-v0', classification: 'retain-for-more-dogfood', reason: 'It produced both real artifacts; audio-clip range proof and paired scope need more runs.' },
          { interface: 'audio-facts-v0', classification: 'graduate', reason: 'It independently verified and analyzed both captures.' },
          { interface: 'ghostnote-sensory-packet-v1 audio brightness route', classification: 'graduate', reason: 'It enforced compatibility, silence, and level gates without making an aesthetic verdict.' },
          { interface: HYBRID_RUN_RECORD_SCHEMA, classification: 'revise', reason: 'The first real S16 record is useful but its verbose seam text should be reduced after another dogfood run.' },
        ],
      } as const;
      const pending = validateHybridRunRecord({
        ...commonRecord,
        status: 'running',
        operatorVerdict: { state: 'pending' },
        uiEvents: [
          {
            id: `${RUN_ID}-ui-play-start-attempt`,
            action: 'Temporarily set perc a play start to zero during an earlier failed attempt.',
            observation: 'The UI edit was external and did not make either failed artifact valid.',
            ownership: 'external-ui',
          },
          {
            id: `${RUN_ID}-ui-play-start-undo`,
            action: 'Undo the temporary play-start edits before the successful run.',
            observation: `Exact Ghostnote readback restored playStartBeats ${ORIGINAL_PLAY_START_BEATS}.`,
            ownership: 'external-ui',
          },
        ],
        finalState: {
          project: `${projectName}; candidate Output Tilt Slope ${CANDIDATE_VALUE} is live; play start remains ${ORIGINAL_PLAY_START_BEATS}`,
          recorder: 'inactive with no lease after candidate capture',
          transport: 'stopped after candidate capture',
          selection: 'entry selection restoration is pending runner completion',
          filesystem: 'A and B captures are retained pending operator verdict',
        },
      });
      await writeFile(RECORD_PATH, `${JSON.stringify(pending, null, 2)}\n`, 'utf8');

      const finalMetadata = await readExactClipMetadata(workspace);
      if (finalMetadata.playStartBeats !== ORIGINAL_PLAY_START_BEATS) {
        throw new Error(
          `the exact play start is ${finalMetadata.playStartBeats}, expected ${ORIGINAL_PLAY_START_BEATS}`,
        );
      }

      console.log(JSON.stringify({
        runId: RUN_ID,
        status: 'awaiting-operator-verdict',
        audition: {
          A: A.capture.artifact.absolutePath,
          B: B.capture.artifact.absolutePath,
        },
        measurements: {
          A: {
            loudnessLufs: fact(comparableA.analysis, 'integrated-loudness-v0'),
            rolloffHz: fact(comparableA.analysis, 'spectral-rolloff-85-v0'),
            silenceSeconds: fact(comparableA.analysis, 'silence-duration-v0'),
          },
          B: {
            loudnessLufs: fact(comparableB.analysis, 'integrated-loudness-v0'),
            rolloffHz: fact(comparableB.analysis, 'spectral-rolloff-85-v0'),
            silenceSeconds: fact(comparableB.analysis, 'silence-duration-v0'),
          },
          B_minus_A: { loudnessLu: loudnessDelta, rolloffHz: rolloffDelta },
          sensoryStatus: sensory.evidenceStatus,
        },
        parameter: { before: BASE_VALUE, candidate: CANDIDATE_VALUE, changeId: candidateChangeId },
      }, null, 2));
      console.log('PHASE7F_WAITING Enter A, B, or neither after the identified audition.');

      const rl = createInterface({ input: process.stdin, output: process.stdout });
      const rawResponse = (await rl.question('PHASE7F_VERDICT> ')).trim();
      rl.close();
      const normalized = rawResponse.toLowerCase();
      const verdict = normalized.startsWith('b') ? 'accepted-B'
        : normalized.startsWith('a') ? 'accepted-A'
          : 'rejected-both';
      let disposition: 'retained' | 'reverted' = 'retained';
      if (verdict !== 'accepted-B') {
        const reverted = await call<{ readonly applied?: boolean; readonly undoOf?: string }>(
          workspace, 'revert_change', { changeId: candidateChangeId },
        );
        console.log(`PHASE7F_REVERT_RESULT ${JSON.stringify(reverted)}`);
        disposition = 'reverted';
      }
      const finalInventory = await call<{
        readonly standing?: string; readonly deviceName?: string; readonly parameters?: readonly Parameter[];
      }>(workspace, 'inspect_device_parameters', {
        device: { trackId: TRACK_ID, devicePosition: DEVICE_POSITION }, view: 'direct',
      });
      const finalParameter = oneParameter(finalInventory);
      const expectedFinal = verdict === 'accepted-B' ? CANDIDATE_VALUE : BASE_VALUE;
      if (Math.abs(finalParameter.normalizedValue - expectedFinal) > 1e-6) {
        throw new Error('the final independent parameter readback does not match the verdict');
      }
      for (const captureResult of captures) {
        if (captureResult.ownership.creator !== 'ghostnote-audio-capture'
            || dirname(captureResult.artifact.absolutePath)
              !== resolve(projectDirectory, 'master-recordings')) {
          throw new Error('capture cleanup ownership or directory is not exact');
        }
        await unlink(captureResult.artifact.absolutePath);
      }
      const finalRecord = validateHybridRunRecord({
        ...commonRecord,
        status: 'complete',
        rootSession: { ...commonRecord.rootSession, finishedAt: new Date().toISOString() },
        costs: { ...commonRecord.costs, toolCalls },
        operations,
        changes: [
          ...(recoveryChangeId === undefined || recoveryOperationId === undefined ? [] : [{
            id: recoveryChangeId,
            operationId: recoveryOperationId,
            verified: recoveryVerified,
            finalDisposition: 'reverted' as const,
          }]),
          {
            id: candidateChangeId,
            operationId: candidateOperationId!,
            verified: true,
            finalDisposition: disposition,
          },
        ],
        operatorVerdict: { state: verdict, rawResponse },
        uiEvents: [
          ...pending.uiEvents,
          {
            id: `${RUN_ID}-ui-audition`,
            action: 'Play the identified A and B WAVE files for operator audition.',
            observation: 'Playback and the operator response are external to Ghostnote evidence.',
            ownership: 'external-ui',
          },
        ],
        authorities: [
          ...commonRecord.authorities,
          { claim: `The operator selected ${verdict}.`, authority: 'operator-confirmed', evidenceId: `${RUN_ID}-operator-verdict` },
          { claim: 'A and B were presented as identified audition files.', authority: 'ui-observation', evidenceId: `${RUN_ID}-ui-audition` },
        ],
        finalState: {
          project: `${projectName}; Dist TUBE-CULTURE Output Tilt Slope is ${finalParameter.normalizedValue}; perc a play start is ${finalMetadata.playStartBeats}`,
          recorder: 'inactive with no owned lease',
          transport: 'stopped',
          selection: 'entry selection restored by the composed workspace boundary',
          filesystem: 'Both exactly owned temporary captures were removed after evidence recording.',
        },
      });
      await writeFile(RECORD_PATH, `${JSON.stringify(finalRecord, null, 2)}\n`, 'utf8');
      finalized = true;
      console.log(`PHASE7F_COMPLETE ${JSON.stringify({ verdict, finalParameter, record: RECORD_PATH, evidence: EVIDENCE_PATH })}`);
    };
    if (workspace.preserveSelection === undefined) throw new Error('selection preservation is unavailable');
    await workspace.preserveSelection(run);
  } finally {
    try {
      await session.client.request('transport.stop', {});
    } catch {
      // The primary error reports a closed bridge.
    }
    if (!finalized && candidateChangeId !== undefined) {
      try {
        const workspace = workspaceOf({
          ready: async () => { await session.ready(); },
          get adapter() { return session.bitwig; },
          get executor() { return session.executor; },
          stash: session.stash,
          observationStore: session.observations,
        });
        await callTool(workspace, 'revert_change', { changeId: candidateChangeId }, STABLE_TOOL_PROFILE);
      } catch {
        // The run failure keeps the exact change ID for reconciliation.
      }
    }
    if (!finalized) {
      for (const captureResult of captures) {
        if (captureResult.ownership.creator === 'ghostnote-audio-capture'
            && dirname(captureResult.artifact.absolutePath)
              === resolve(projectDirectory, 'master-recordings')) {
          await unlink(captureResult.artifact.absolutePath).catch(() => undefined);
        }
      }
    }
    await session.close().catch(() => undefined);
  }
}

await main();
