import * as net from 'node:net';

/**
 * TCP client for the ghostnote bridge: newline-delimited JSON-RPC 2.0.
 * Derived from daw-mcp's daw-client.ts (MIT, see NOTICE), single-DAW.
 */

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id?: string;
  result?: unknown;
  error?: { code: number; message: string };
}

export class BridgeError extends Error {
  constructor(public code: number, message: string) {
    super(message);
    this.name = 'BridgeError';
  }
}

/**
 * The connection, one interface wide — the same seam `Transport` already draws
 * one level down, and for the same reason.
 *
 * ⚠ `Session`'s reconnect handling is the part of session 3 with no offline test
 * otherwise, and it is the part PHASE-1 §Risks calls *"the classic time sink"*
 * (stale sockets, orphaned processes). Without this, proving "a reconnect that
 * lands on a different life of the extension throws the adapter away" would need
 * a real socket and a real Bitwig restart — i.e. it would not get proven.
 */
export interface BridgeLike {
  connect(): Promise<void>;
  disconnect(): void;
  readonly connected: boolean;
  request(method: string, params?: Record<string, unknown>, timeoutMs?: number): Promise<unknown>;
}

export class BridgeClient implements BridgeLike {
  private socket: net.Socket | null = null;
  private requestId = 0;
  private buffer = '';
  private pending = new Map<string, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timer: NodeJS.Timeout;
  }>();

  constructor(
    private port = 8686,
    private host = '127.0.0.1',
    private defaultTimeoutMs = 10000,
  ) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      this.socket = socket;

      socket.once('connect', () => resolve());
      socket.once('error', (err) => reject(err));
      // Post-connect errors (e.g. the bridge going down during an E5
      // hot-reload) must not surface as an unhandled 'error' event; the
      // 'close' handler below is what rejects in-flight requests.
      socket.on('error', () => {});

      socket.on('data', (data) => this.handleData(data.toString('utf8')));
      socket.on('close', () => {
        this.socket = null;
        for (const [id, p] of this.pending) {
          clearTimeout(p.timer);
          p.reject(new Error(`Connection closed with request ${id} in flight`));
        }
        this.pending.clear();
      });

      socket.connect(this.port, this.host);
    });
  }

  disconnect(): void {
    this.socket?.destroy();
    this.socket = null;
  }

  get connected(): boolean {
    return this.socket !== null && !this.socket.destroyed;
  }

  async request(method: string, params?: Record<string, unknown>, timeoutMs?: number): Promise<unknown> {
    if (!this.connected) {
      await this.connect();
    }

    const id = String(++this.requestId);
    const line = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n';

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Request timeout: ${method} (${timeoutMs ?? this.defaultTimeoutMs}ms)`));
      }, timeoutMs ?? this.defaultTimeoutMs);

      this.pending.set(id, { resolve, reject, timer });

      this.socket!.write(line, (err) => {
        if (err) {
          clearTimeout(timer);
          this.pending.delete(id);
          reject(err);
        }
      });
    });
  }

  /**
   * Send a raw line without JSON-RPC bookkeeping and collect responses
   * arriving within `windowMs` that match no pending request.
   * Probe-only: used to verify the bridge's malformed-frame handling.
   */
  async sendRaw(rawLine: string, windowMs = 500): Promise<JsonRpcResponse[]> {
    if (!this.connected) {
      await this.connect();
    }
    const collected: JsonRpcResponse[] = [];
    this.orphanSink = (msg) => collected.push(msg);
    this.socket!.write(rawLine + '\n');
    await new Promise((r) => setTimeout(r, windowMs));
    this.orphanSink = null;
    return collected;
  }

  private orphanSink: ((msg: JsonRpcResponse) => void) | null = null;

  private handleData(data: string): void {
    this.buffer += data;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.trim()) continue;
      let response: JsonRpcResponse;
      try {
        response = JSON.parse(line);
      } catch {
        console.error('[client] unparseable line from bridge:', line);
        continue;
      }
      this.handleResponse(response);
    }
  }

  private handleResponse(response: JsonRpcResponse): void {
    const pending = response.id !== undefined ? this.pending.get(response.id) : undefined;
    if (!pending) {
      this.orphanSink?.(response);
      return;
    }
    this.pending.delete(response.id!);
    clearTimeout(pending.timer);
    if (response.error) {
      pending.reject(new BridgeError(response.error.code, response.error.message));
    } else {
      pending.resolve(response.result);
    }
  }
}
