/** Typed FFprobe and FFmpeg process boundary for selected audio facts. */
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const AUDIO_PROCESS_DEADLINE_MS = 5_000;
export const ROLLOFF_FRAME_SAMPLES = 8_192;
export const ROLLOFF_CUTOFF = 0.85;
export const SILENCE_THRESHOLD_DBFS = -90;
export const SILENCE_MINIMUM_SECONDS = 0.05;

const MAX_PROCESS_OUTPUT_BYTES = 1 * 1_024 * 1_024;
const VERSION = /^ff(?:mpeg|probe) version ([^\s]+)/;
const FINITE_NUMBER = /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;

export interface AudioExecutableDiscovery {
  readonly ffprobeVersion: string | null;
  readonly ffmpegVersion: string | null;
  readonly failures: readonly {
    readonly executable: 'ffprobe' | 'ffmpeg';
    readonly reason: string;
  }[];
}

export interface AudioProbeResult {
  readonly codecName: string;
  readonly sampleFormat: string;
  readonly bitsPerRawSample: number;
  readonly sampleRateHz: number;
  readonly channels: number;
  readonly durationTs: number;
  readonly timeBaseNumerator: number;
  readonly timeBaseDenominator: number;
}

export interface AudioSelection {
  readonly sampleStart: number;
  readonly sampleEnd: number;
  readonly channelIndices: readonly number[];
}

export interface SilenceInterval {
  readonly startSeconds: number;
  readonly endSeconds: number;
}

export interface CrestInputs {
  readonly peakDbfsByChannel: readonly (number | null)[];
  readonly rmsDbfsByChannel: readonly (number | null)[];
}

export interface RolloffInputs {
  readonly valuesHz: readonly number[];
  readonly frameCount: number;
}

export interface AudioExecutableAdapter {
  discover(signal?: AbortSignal): Promise<AudioExecutableDiscovery>;
  probe(bytes: Uint8Array, signal?: AbortSignal): Promise<AudioProbeResult>;
  silence(
    bytes: Uint8Array, selection: AudioSelection, signal?: AbortSignal,
  ): Promise<readonly SilenceInterval[]>;
  integratedLoudness(
    bytes: Uint8Array, selection: AudioSelection, signal?: AbortSignal,
  ): Promise<number | null>;
  crestInputs(
    bytes: Uint8Array, selection: AudioSelection, signal?: AbortSignal,
  ): Promise<CrestInputs>;
  rolloffInputs(
    bytes: Uint8Array, selection: AudioSelection, signal?: AbortSignal,
  ): Promise<RolloffInputs>;
}

export class AudioExecutableError extends Error {
  constructor(
    message: string,
    readonly code: 'missing-dependency' | 'timeout' | 'provider-failure'
    | 'invalid-output',
    readonly executable: 'ffprobe' | 'ffmpeg',
  ) {
    super(message);
    this.name = 'AudioExecutableError';
  }
}

interface ProcessResult {
  readonly stdout: string;
  readonly stderr: string;
}

export interface AudioExecutableOptions {
  readonly ffprobePath?: string;
  readonly ffmpegPath?: string;
  readonly deadlineMs?: number;
}

function boundedProcess(
  executable: 'ffprobe' | 'ffmpeg',
  command: string,
  arguments_: readonly string[],
  deadlineMs: number,
  input?: Uint8Array,
  signal?: AbortSignal,
): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...arguments_], { stdio: ['pipe', 'pipe', 'pipe'] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let failure: Error | undefined;
    let settled = false;
    const stop = (error: Error): void => {
      if (settled || failure !== undefined) return;
      failure = error;
      clearTimeout(timeout);
      child.kill('SIGKILL');
    };
    const finish = (error?: Error, result?: ProcessResult): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal?.removeEventListener('abort', aborted);
      if (failure !== undefined) reject(failure);
      else if (error !== undefined) reject(error);
      else resolve(result!);
    };
    const aborted = (): void => stop(new AudioExecutableError(
      `${executable} was cancelled`, 'timeout', executable,
    ));
    const timeout = setTimeout(() => stop(new AudioExecutableError(
      `${executable} exceeded its ${deadlineMs} ms deadline`, 'timeout', executable,
    )), deadlineMs);
    signal?.addEventListener('abort', aborted, { once: true });
    if (signal?.aborted === true) aborted();
    child.stdout.on('data', (part: Buffer) => {
      stdoutBytes += part.byteLength;
      if (stdoutBytes > MAX_PROCESS_OUTPUT_BYTES) stop(new AudioExecutableError(
        `${executable} output exceeds the byte limit`, 'invalid-output', executable,
      ));
      else stdout.push(part);
    });
    child.stderr.on('data', (part: Buffer) => {
      stderrBytes += part.byteLength;
      if (stderrBytes > MAX_PROCESS_OUTPUT_BYTES) stop(new AudioExecutableError(
        `${executable} diagnostics exceed the byte limit`, 'invalid-output', executable,
      ));
      else stderr.push(part);
    });
    child.on('error', (error) => stop(new AudioExecutableError(
      error.message, 'missing-dependency', executable,
    )));
    child.on('close', (code) => {
      if (failure !== undefined) {
        finish();
        return;
      }
      const output = Buffer.concat(stdout).toString('utf8');
      const diagnostics = Buffer.concat(stderr).toString('utf8');
      if (code !== 0) finish(new AudioExecutableError(
        `${executable} exited ${code}: ${diagnostics.trim()}`,
        'provider-failure', executable,
      ));
      else finish(undefined, { stdout: output, stderr: diagnostics });
    });
    child.stdin.on('error', (error) => stop(new AudioExecutableError(
      error.message, 'provider-failure', executable,
    )));
    child.stdin.end(input);
  });
}

function exactPositiveInteger(value: unknown, field: string): number {
  const parsed = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (!Number.isSafeInteger(parsed) || (parsed as number) < 1) {
    throw new AudioExecutableError(`ffprobe returned invalid ${field}`, 'invalid-output', 'ffprobe');
  }
  return parsed as number;
}

function rational(value: unknown): readonly [number, number] {
  if (typeof value !== 'string') {
    throw new AudioExecutableError('ffprobe omitted the stream time base', 'invalid-output', 'ffprobe');
  }
  const match = value.match(/^(\d+)\/(\d+)$/);
  if (match === null) {
    throw new AudioExecutableError('ffprobe returned an invalid stream time base', 'invalid-output', 'ffprobe');
  }
  return [exactPositiveInteger(match[1], 'time-base numerator'),
    exactPositiveInteger(match[2], 'time-base denominator')];
}

function finite(value: string, field: string, executable: 'ffprobe' | 'ffmpeg'): number {
  if (!FINITE_NUMBER.test(value)) {
    throw new AudioExecutableError(`${executable} returned invalid ${field}`, 'invalid-output', executable);
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new AudioExecutableError(`${executable} returned non-finite ${field}`, 'invalid-output', executable);
  }
  return parsed;
}

function selectionFilter(selection: AudioSelection): string {
  const trim = `atrim=start_sample=${selection.sampleStart}:end_sample=${selection.sampleEnd}`;
  const timestamps = 'asetpts=PTS-STARTPTS';
  const layout = selection.channelIndices.length === 1 ? 'mono' : 'stereo';
  const routes = selection.channelIndices
    .map((channel, index) => `c${index}=c${channel}`).join('|');
  return `${trim},${timestamps},pan=${layout}|${routes}`;
}

function metadataFrames(output: string): readonly Readonly<Record<string, string>>[] {
  const frames: Record<string, string>[] = [];
  let current: Record<string, string> | undefined;
  for (const line of output.split(/\r?\n/)) {
    if (line.startsWith('frame:')) {
      if (current !== undefined) frames.push(current);
      current = {};
    } else if (current !== undefined && line.startsWith('lavfi.') && line.includes('=')) {
      const index = line.indexOf('=');
      current[line.slice(0, index)] = line.slice(index + 1);
    }
  }
  if (current !== undefined) frames.push(current);
  return frames;
}

/** Create the only process-spawning adapter used by audio-facts-v0. */
export function createFfmpegExecutableAdapter(
  options: AudioExecutableOptions = {},
): AudioExecutableAdapter {
  const ffprobePath = options.ffprobePath ?? 'ffprobe';
  const ffmpegPath = options.ffmpegPath ?? 'ffmpeg';
  const deadlineMs = options.deadlineMs ?? AUDIO_PROCESS_DEADLINE_MS;
  if (!Number.isSafeInteger(deadlineMs) || deadlineMs < 1
      || deadlineMs > AUDIO_PROCESS_DEADLINE_MS) {
    throw new AudioExecutableError('the audio process deadline is invalid', 'provider-failure', 'ffmpeg');
  }
  const runProbe = (arguments_: readonly string[], signal?: AbortSignal) =>
    boundedProcess('ffprobe', ffprobePath, arguments_, deadlineMs, undefined, signal);
  const runFfmpeg = (arguments_: readonly string[], signal?: AbortSignal) =>
    boundedProcess('ffmpeg', ffmpegPath, arguments_, deadlineMs, undefined, signal);
  const withStagedBytes = async <T>(
    bytes: Uint8Array,
    operation: (path: string) => Promise<T>,
  ): Promise<T> => {
    const root = await mkdtemp(join(tmpdir(), 'ghostnote-audio-provider-'));
    const path = join(root, 'verified.wav');
    try {
      await writeFile(path, bytes);
      return await operation(path);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  };

  return {
    discover: async (signal) => {
      const checks = await Promise.allSettled([
        boundedProcess('ffprobe', ffprobePath, ['-version'], Math.min(deadlineMs, 1_500), undefined, signal),
        boundedProcess('ffmpeg', ffmpegPath, ['-version'], Math.min(deadlineMs, 1_500), undefined, signal),
      ]);
      const failures: { executable: 'ffprobe' | 'ffmpeg'; reason: string }[] = [];
      const readVersion = (
        result: PromiseSettledResult<ProcessResult>, executable: 'ffprobe' | 'ffmpeg',
      ): string | null => {
        if (result.status === 'rejected') {
          failures.push({
            executable,
            reason: result.reason instanceof Error ? result.reason.message : String(result.reason),
          });
          return null;
        }
        const match = result.value.stdout.split(/\r?\n/, 1)[0]?.match(VERSION);
        if (match?.[1] === undefined) {
          failures.push({ executable, reason: `cannot read the ${executable} version` });
          return null;
        }
        return match[1];
      };
      return {
        ffprobeVersion: readVersion(checks[0], 'ffprobe'),
        ffmpegVersion: readVersion(checks[1], 'ffmpeg'),
        failures,
      };
    },
    probe: async (bytes, signal) => {
      const output = await withStagedBytes(bytes, (path) => runProbe([
        '-v', 'error', '-select_streams', 'a:0',
        '-show_entries',
        'stream=codec_name,sample_fmt,bits_per_raw_sample,bits_per_sample,sample_rate,channels,duration_ts,time_base',
        '-of', 'json', '-i', path,
      ], signal));
      let parsed: unknown;
      try {
        parsed = JSON.parse(output.stdout);
      } catch {
        throw new AudioExecutableError('ffprobe returned invalid JSON', 'invalid-output', 'ffprobe');
      }
      const streams = (parsed as { streams?: unknown }).streams;
      if (!Array.isArray(streams) || streams.length !== 1
          || streams[0] === null || typeof streams[0] !== 'object') {
        throw new AudioExecutableError(
          'ffprobe must return exactly one audio stream', 'invalid-output', 'ffprobe',
        );
      }
      const stream = streams[0] as Record<string, unknown>;
      const [timeBaseNumerator, timeBaseDenominator] = rational(stream.time_base);
      const bits = stream.bits_per_raw_sample === undefined || stream.bits_per_raw_sample === '0'
        ? stream.bits_per_sample : stream.bits_per_raw_sample;
      if (typeof stream.codec_name !== 'string' || typeof stream.sample_fmt !== 'string') {
        throw new AudioExecutableError('ffprobe omitted the codec fields', 'invalid-output', 'ffprobe');
      }
      return {
        codecName: stream.codec_name,
        sampleFormat: stream.sample_fmt,
        bitsPerRawSample: exactPositiveInteger(bits, 'bits per sample'),
        sampleRateHz: exactPositiveInteger(stream.sample_rate, 'sample rate'),
        channels: exactPositiveInteger(stream.channels, 'channel count'),
        durationTs: exactPositiveInteger(stream.duration_ts, 'duration timestamp'),
        timeBaseNumerator,
        timeBaseDenominator,
      };
    },
    silence: async (bytes, selection, signal) => {
      const output = await withStagedBytes(bytes, (path) => runFfmpeg([
        '-hide_banner', '-nostats', '-i', path, '-vn',
        '-af', `${selectionFilter(selection)},silencedetect=noise=${SILENCE_THRESHOLD_DBFS}dB:duration=${SILENCE_MINIMUM_SECONDS}`,
        '-f', 'null', '-',
      ], signal));
      const starts = [...output.stderr.matchAll(/silence_start:\s*(-?[0-9.]+)/g)]
        .map((match) => finite(match[1]!, 'silence start', 'ffmpeg'));
      const ends = [...output.stderr.matchAll(/silence_end:\s*(-?[0-9.]+)/g)]
        .map((match) => finite(match[1]!, 'silence end', 'ffmpeg'));
      if (starts.length !== ends.length) {
        throw new AudioExecutableError(
          'ffmpeg returned unmatched silence intervals', 'invalid-output', 'ffmpeg',
        );
      }
      return starts.map((startSeconds, index) => ({
        startSeconds, endSeconds: ends[index]!,
      }));
    },
    integratedLoudness: async (bytes, selection, signal) => {
      const output = await withStagedBytes(bytes, (path) => runFfmpeg([
        '-hide_banner', '-nostats', '-i', path, '-vn',
        '-af', `${selectionFilter(selection)},ebur128=peak=true`, '-f', 'null', '-',
      ], signal));
      const matches = [...output.stderr.matchAll(/I:\s+(-?inf|-?[0-9.]+) LUFS/g)];
      const value = matches.at(-1)?.[1];
      if (value === undefined) {
        throw new AudioExecutableError(
          'ffmpeg omitted integrated loudness', 'invalid-output', 'ffmpeg',
        );
      }
      return value === '-inf' ? null : finite(value, 'integrated loudness', 'ffmpeg');
    },
    crestInputs: async (bytes, selection, signal) => {
      const output = await withStagedBytes(bytes, (path) => runFfmpeg([
        '-hide_banner', '-nostats', '-loglevel', 'error', '-i', path, '-vn',
        '-af', `${selectionFilter(selection)},astats=metadata=1:reset=0:measure_perchannel=Peak_level+RMS_level:measure_overall=none,ametadata=print:file=-`,
        '-f', 'null', '-',
      ], signal));
      const final = metadataFrames(output.stdout).at(-1);
      if (final === undefined) {
        throw new AudioExecutableError('ffmpeg omitted signal aggregates', 'invalid-output', 'ffmpeg');
      }
      const read = (channel: number, key: 'Peak_level' | 'RMS_level'): number | null => {
        const value = final[`lavfi.astats.${channel}.${key}`];
        if (value === undefined) {
          throw new AudioExecutableError(
            `ffmpeg omitted channel ${channel} ${key}`, 'invalid-output', 'ffmpeg',
          );
        }
        return value === '-inf' ? null : finite(value, key, 'ffmpeg');
      };
      return {
        peakDbfsByChannel: selection.channelIndices.map((_value, index) => read(index + 1, 'Peak_level')),
        rmsDbfsByChannel: selection.channelIndices.map((_value, index) => read(index + 1, 'RMS_level')),
      };
    },
    rolloffInputs: async (bytes, selection, signal) => {
      const samples = selection.sampleEnd - selection.sampleStart;
      const frameCount = Math.floor(samples / ROLLOFF_FRAME_SAMPLES);
      if (frameCount < 1) return { valuesHz: [], frameCount: 0 };
      const completeSelection = {
        ...selection,
        sampleEnd: selection.sampleStart + frameCount * ROLLOFF_FRAME_SAMPLES,
      };
      const output = await withStagedBytes(bytes, (path) => runFfmpeg([
        '-hide_banner', '-nostats', '-loglevel', 'error', '-i', path, '-vn',
        '-af', `${selectionFilter(completeSelection)},aspectralstats=win_size=${ROLLOFF_FRAME_SAMPLES}:win_func=hann:overlap=0:measure=rolloff,ametadata=print:file=-`,
        '-f', 'null', '-',
      ], signal));
      const frames = metadataFrames(output.stdout);
      if (frames.length !== frameCount) {
        throw new AudioExecutableError(
          `ffmpeg returned ${frames.length} rolloff frames; expected ${frameCount}`,
          'invalid-output', 'ffmpeg',
        );
      }
      const valuesHz: number[] = [];
      for (const frame of frames) {
        for (let channel = 1; channel <= selection.channelIndices.length; channel += 1) {
          const value = frame[`lavfi.aspectralstats.${channel}.rolloff`];
          if (value === undefined) {
            throw new AudioExecutableError(
              `ffmpeg omitted channel ${channel} rolloff`, 'invalid-output', 'ffmpeg',
            );
          }
          valuesHz.push(finite(value, 'spectral rolloff', 'ffmpeg'));
        }
      }
      return { valuesHz, frameCount };
    },
  };
}
