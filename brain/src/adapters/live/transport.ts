/**
 * The transport seam — one method wide.
 *
 * `BridgeClient` is concrete and speaks TCP. Putting this interface in front of
 * it buys the thing that makes the encoder testable: a RECORDING transport can
 * capture frames in an offline test with no socket and no DAW, so "does the
 * contract emit the right calls?" is answerable in `encoder.test.ts` rather than
 * only against a running Bitwig.
 */
import { BridgeClient } from '../../client.js';
import type { Frame } from './wiremap.js';

export interface Transport {
  send(frame: Frame): Promise<unknown>;
  close(): Promise<void>;
}

export class BridgeTransport implements Transport {
  constructor(private readonly client: BridgeClient = new BridgeClient()) {}

  async send(frame: Frame): Promise<unknown> {
    return this.client.request(frame.method, frame.params);
  }

  async close(): Promise<void> {
    this.client.disconnect();
  }
}

/** Test double: records every frame and replays canned results. */
export class RecordingTransport implements Transport {
  readonly frames: Frame[] = [];
  private results: unknown[] = [];

  /** Queue results to hand back, in order. Missing entries resolve to `{}`. */
  willReturn(...results: unknown[]): this {
    this.results.push(...results);
    return this;
  }

  async send(frame: Frame): Promise<unknown> {
    this.frames.push(frame);
    return this.results.shift() ?? {};
  }

  async close(): Promise<void> {}

  get methods(): string[] {
    return this.frames.map((f) => f.method);
  }
}
