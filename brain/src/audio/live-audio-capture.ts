/** Session-backed controller for the audio-capture-v0 module. */
import type {
  LauncherCaptureGuard, LauncherCaptureRange,
} from '../adapters/live/adapter.js';
import { MasterRecorderActiveError } from '../adapters/live/adapter.js';
import { Session } from '../session.js';
import type {
  AudioCaptureController, AudioCaptureDiscovery, AudioCaptureGuard,
  AudioCaptureRangeObservation, AudioCaptureRecorderStatus, AudioCaptureRequest,
} from './audio-capture.js';
import { AudioCaptureRecorderActiveError } from './audio-capture.js';

function cancelled(signal?: AbortSignal): void {
  if (signal?.aborted === true) throw new Error('the live audio capture request was cancelled');
}

/** Bind capture to Session.ready(), including handshake and deployment checks. */
export function createLiveAudioCaptureController(
  session: Session,
  expectedMethodsHash: string,
): AudioCaptureController {
  if (!/^[0-9a-f]{16}$/.test(expectedMethodsHash)) {
    throw new Error('the expected extension method hash is invalid');
  }
  return {
    async discover(signal): Promise<AudioCaptureDiscovery> {
      cancelled(signal);
      await session.ready();
      cancelled(signal);
      const info = session.adapterInfo;
      if (info?.kind !== 'live' || info.host === undefined || info.methodsHash !== expectedMethodsHash) {
        throw new Error('the live Bitwig adapter does not match the selected capture build');
      }
      const deployment = session.deploymentState;
      if (deployment === undefined || deployment.state === 'stale') {
        throw new Error('the live Bitwig deployment check did not complete');
      }
      return {
        adapterName: 'ghostnote-bitwig-live-adapter',
        adapterVersion: info.contract,
        bitwigVersion: info.host.version,
        controllerApiVersion: info.host.apiVersion,
        extensionVersion: info.host.extensionVersion,
        methodsHash: info.methodsHash,
        deploymentState: deployment.state,
      };
    },
    async currentGuard(signal): Promise<AudioCaptureGuard> {
      cancelled(signal);
      await session.ready();
      const mark = await session.bitwig.revision();
      cancelled(signal);
      return {
        generation: mark.generation,
        project: mark.project,
        revision: mark.revision,
        sceneEpoch: mark.sceneEpoch,
        contentEpoch: mark.contentEpoch,
      };
    },
    async recorderStatus(ownerToken, signal): Promise<AudioCaptureRecorderStatus> {
      cancelled(signal);
      await session.ready();
      const status = await session.bitwig.masterRecorderStatus(ownerToken);
      cancelled(signal);
      return status;
    },
    async prepareSource(request, signal): Promise<void> {
      cancelled(signal);
      await session.ready();
      const source = request.source.manifest;
      await session.bitwig.prepareLauncherCapture(
        source.launcherClip,
        source.guard as LauncherCaptureGuard,
        source.range as LauncherCaptureRange,
      );
    },
    async startRecorder(ownerToken, signal): Promise<AudioCaptureRecorderStatus> {
      cancelled(signal);
      await session.ready();
      try {
        const status = await session.bitwig.startMasterRecorder(ownerToken);
        cancelled(signal);
        return status;
      } catch (error) {
        if (error instanceof MasterRecorderActiveError) {
          throw new AudioCaptureRecorderActiveError(error.status);
        }
        throw error;
      }
    },
    async stopTransport(request, signal): Promise<void> {
      cancelled(signal);
      await session.ready();
      await session.bitwig.stopTransportForCapture(
        request.bounds.stopMs, request.bounds.pollMs, signal,
      );
    },
    async performRange(
      request: AudioCaptureRequest,
      signal?: AbortSignal,
    ): Promise<AudioCaptureRangeObservation> {
      cancelled(signal);
      await session.ready();
      const source = request.source.manifest;
      return session.bitwig.playLauncherCaptureRange(
        source.launcherClip,
        source.guard as LauncherCaptureGuard,
        source.range as LauncherCaptureRange,
        request.bounds.playbackMs,
        request.bounds.stopMs,
        request.bounds.pollMs,
        signal,
      );
    },
    async stopRecorder(ownerToken, signal): Promise<AudioCaptureRecorderStatus> {
      cancelled(signal);
      await session.ready();
      const status = await session.bitwig.stopMasterRecorder(ownerToken);
      cancelled(signal);
      return status;
    },
  };
}
