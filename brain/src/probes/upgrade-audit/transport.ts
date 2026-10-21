/** One connection with finite work. Never reconnect inside a driver command. */
import assert from 'node:assert/strict';
import net from 'node:net';
import { BridgeError } from '../../client.js';
import type { Transport } from '../../adapters/live/transport.js';
import type { Frame } from '../../adapters/live/wiremap.js';
import { Evidence, LIMITS, type Bag } from './safety.js';

export class AuditTransport implements Transport {
  private socket?: net.Socket;
  private buffer = '';
  private serial = 0;
  private dead = false;
  private started = performance.now();
  private pausedAt?: number;
  private pending = new Map<string, { resolve(value: unknown): void; reject(error: Error): void;
    timer: NodeJS.Timeout; frame: Frame; sent: number }>();
  readonly calls: { method: string; sent: number; received: number }[] = [];
  constructor(private evidence: Evidence, private commandId: string) {}
  async connect(): Promise<void> {
    assert(!this.socket && !this.dead, 'Connection cannot resume.');
    const socket = this.socket = net.createConnection({ host: '127.0.0.1', port: 8686 });
    socket.setEncoding('utf8');
    socket.on('data', (data: string) => {
      try {
        this.buffer += data;
        for (;;) {
          const end = this.buffer.indexOf('\n');
          if (end < 0) break;
          const line = this.buffer.slice(0, end); this.buffer = this.buffer.slice(end + 1);
          assert(Buffer.byteLength(line) <= LIMITS.responseBytes, 'Response byte cap');
          const reply = JSON.parse(line) as Bag, item = this.pending.get(String(reply.id));
          if (!item) continue;
          this.pending.delete(String(reply.id)); clearTimeout(item.timer);
          const received = performance.now();
          this.calls.push({ method: item.frame.method, sent: item.sent, received });
          try {
            this.evidence.append('wire.jsonl', { commandId: this.commandId, frame: item.frame,
              sent: item.sent, received, bytes: Buffer.byteLength(line), reply });
            if (reply.error) item.reject(new BridgeError(reply.error.code, reply.error.message));
            else item.resolve(reply.result);
          } catch (error) { item.reject(error as Error); throw error; }
        }
        assert(Buffer.byteLength(this.buffer) <= LIMITS.responseBytes, 'Response buffer cap');
      } catch (error) { this.stop(error as Error); }
    });
    socket.on('error', error => this.stop(error));
    socket.on('close', () => this.stop(new Error('Bridge closed. Do not resume writes.')));
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { this.stop(new Error('Connection deadline')); reject(new Error('Connection deadline')); }, 5000);
      socket.once('connect', () => { clearTimeout(timer); resolve(); });
      socket.once('error', error => { clearTimeout(timer); reject(error); });
    });
  }
  private stop(error: Error): void {
    this.dead = true;
    for (const item of this.pending.values()) { clearTimeout(item.timer); item.reject(error); }
    this.pending.clear(); this.socket?.destroy();
  }
  async send(frame: Frame): Promise<unknown> {
    assert(this.pausedAt === undefined, 'No host call during an operator pause');
    assert(this.socket && !this.dead, 'No active audit connection');
    assert(performance.now() - this.started < LIMITS.deadlineMs, 'Case deadline');
    assert(this.serial < LIMITS.calls, 'Case call bound');
    assert(!frame.method.startsWith('probe.') && frame.method !== 'transport.stop', 'Normal profile only');
    const id = String(++this.serial), sent = performance.now();
    this.evidence.append('wire.jsonl', { commandId: this.commandId, id, intent: frame, sent });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.stop(new Error(`Uncertain request: ${frame.method}`)),
        Math.min(frame.timeoutMs ?? LIMITS.requestMs, LIMITS.requestMs));
      this.pending.set(id, { resolve, reject, timer, frame, sent });
      this.socket!.write(JSON.stringify({ jsonrpc: '2.0', id, method: frame.method, params: frame.params }) + '\n');
    });
  }
  pause(): void { assert(this.pending.size === 0); this.pausedAt = performance.now(); }
  resume(): void {
    assert(this.pausedAt !== undefined);
    this.started += performance.now() - this.pausedAt; this.pausedAt = undefined;
  }
  async close(): Promise<void> { this.stop(new Error('Audit command ended')); }
}
