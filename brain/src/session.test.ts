/**
 * The bridge connection's lifecycle, offline.
 *
 * ⚠ These are the cases PHASE-1 §Risks calls *"the classic time sink"* — stale
 * sockets, a reconnect landing somewhere unexpected — and they are exactly the
 * ones that would never be run by hand, because each needs a Bitwig restart at a
 * chosen moment. A stub `BridgeLike` is what makes them a millisecond each.
 *
 * ⚠ What this deliberately does NOT test is the socket. `BridgeClient` speaks
 * TCP and its verification is `npm run probe:hello`; what is provable here is the
 * POLICY on top of it, which is where the decisions are.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { WIRE } from './adapters/live/wiremap.js';
import type { BridgeLike } from './client.js';
import { CONTRACT_VERSION, ContractVersionError } from './contract/index.js';
import { Session } from './session.js';

/**
 * A bridge that answers the handshake and the mark, and can be told to come back
 * as a different life of the extension.
 */
class StubBridge implements BridgeLike {
  connected = false;
  connects = 0;
  hellos = 0;
  generation = 'gen-1';
  project = 'project-A';
  contractVersion = CONTRACT_VERSION;

  async connect(): Promise<void> {
    this.connects++;
    this.connected = true;
  }

  disconnect(): void {
    this.connected = false;
  }

  /** ⚠ Bitwig going away, or the extension being redeployed mid-session. */
  restart(generation: string): void {
    this.connected = false;
    this.generation = generation;
  }

  async request(method: string): Promise<unknown> {
    switch (method) {
      case WIRE.hello:
        this.hellos++;
        return {
          contractVersion: this.contractVersion,
          extensionVersion: '0.0.1',
          hostApiVersion: 19,
          methodsHash: 'stub-hash',
        };
      case WIRE.hostInfo:
        return { apiVersion: 19, platform: 'test' };
      case WIRE.rigInfo:
        return { cursorPool: 3, gridSteps: 64 };
      // `hello()` scans the bank to seed the channelId -> index map, so the stub
      // owes it a shape. Empty is honest here: this file is about the
      // connection's policy, not about what is in the project.
      case WIRE.trackList:
        return { tracks: [], count: 0, bankSize: 16, itemCount: 0 };
      case WIRE.revisionGet:
        return {
          revision: 0,
          generation: this.generation,
          sceneEpoch: 1,
          contentEpoch: 0,
          project: this.project,
          contentEvents: [],
        };
      default:
        return {};
    }
  }
}

test('N-lazy: constructing a session does not connect — Bitwig may not be running yet', () => {
  const bridge = new StubBridge();
  const session = new Session({ client: bridge });
  // An MCP server starts as a subprocess of a chat client, before anyone has
  // opened the DAW. A constructor that connected would turn "not launched yet"
  // into a startup failure the user never sees.
  assert.equal(bridge.connects, 0);
  assert.equal(session.adapterInfo, undefined);
});

test('N-handshake: the first use connects and handshakes exactly once', async () => {
  const bridge = new StubBridge();
  const session = new Session({ client: bridge });

  await session.ready();
  await session.ready();
  await session.ready();

  assert.equal(bridge.connects, 1);
  assert.equal(bridge.hellos, 1, 'a handshake per call would cost a round trip on every write');
  assert.equal(session.adapterInfo?.contractVersion, CONTRACT_VERSION);
});

test('N-restart: a reconnect onto a DIFFERENT life of the extension is reported', async () => {
  const bridge = new StubBridge();
  const session = new Session({ client: bridge });

  const first = await session.ready();
  assert.equal(first.restarted, false, 'the first connection has nothing to differ from');

  const before = session.bitwig;
  bridge.restart('gen-2');
  const second = await session.ready();

  assert.equal(second.restarted, true);
  assert.equal(second.generation, 'gen-2');
  assert.equal(bridge.connects, 2);
  assert.equal(bridge.hellos, 2, 'the reconnect may have landed on a different BUILD');
  // ⚠ The adapter is REPLACED, not reconciled. Everything it held — the
  // channelId→index map, the pool's cursor assignments, the last mark — describes
  // a Bitwig that no longer exists, and D6 forbids trusting an index across a
  // structural op. A restart is the largest one there is.
  assert.notEqual(session.bitwig, before);
});

test('N-restart: a reconnect onto the SAME life keeps the adapter', async () => {
  const bridge = new StubBridge();
  const session = new Session({ client: bridge });
  await session.ready();
  const before = session.bitwig;

  // The socket dropped and came back, but the extension never restarted — the
  // ordinary case, and throwing state away here would be a needless re-scan.
  bridge.disconnect();
  const again = await session.ready();

  assert.equal(again.restarted, false);
  assert.equal(session.bitwig, before);
  assert.equal(bridge.connects, 2);
});

test('N-version: a contract mismatch REFUSES rather than limping', async () => {
  const bridge = new StubBridge();
  bridge.contractVersion = CONTRACT_VERSION + 1;
  const session = new Session({ client: bridge });

  await assert.rejects(() => session.ready(), ContractVersionError);
});

test('N-version: the mismatch is caught again after a reconnect, not only the first time', async () => {
  const bridge = new StubBridge();
  const session = new Session({ client: bridge });
  await session.ready();

  // A redeploy mid-session is the ordinary development case, and it is the one
  // moment a stale handshake would let an incompatible extension through.
  bridge.restart('gen-2');
  bridge.contractVersion = CONTRACT_VERSION + 1;

  await assert.rejects(() => session.ready(), ContractVersionError);
});

test('N-project: a project change rebuilds the adapter even though nothing restarted', async () => {
  const bridge = new StubBridge();
  const session = new Session({ client: bridge });
  await session.ready();
  const before = session.bitwig;

  // ⚠ No disconnect, no restart — the human just opened another project. The
  // socket is fine and the generation is unchanged, so `N-restart`'s detector
  // sees nothing at all.
  bridge.project = 'project-B';
  const now = await session.ready();

  assert.equal(now.restarted, false, 'the extension is the same one');
  assert.equal(now.projectChanged, true);
  assert.equal(now.project, 'project-B');
  // ⚠ Rebuilt for a STRONGER reason than a restart: the channelId -> index map
  // does not merely hold stale positions, it holds keys for tracks that no
  // longer exist.
  assert.notEqual(session.bitwig, before);
  assert.equal(bridge.connects, 1, 'and none of this needed a reconnect');
});

test('N-stash: the stash SURVIVES a restart — it records what we did, not where things are', async () => {
  const bridge = new StubBridge();
  const session = new Session({ client: bridge });
  await session.ready();
  const stash = session.stash;

  bridge.restart('gen-2');
  await session.ready();

  // ⚠ Its addresses can no longer be vouched for, and the boundary says that on
  // its own (a mark from the previous generation reads `undecidable`). Clearing
  // it here would instead make D19's reversal unaskable for work that really
  // happened — losing the record to protect against a stale index.
  assert.equal(session.stash, stash);
});
