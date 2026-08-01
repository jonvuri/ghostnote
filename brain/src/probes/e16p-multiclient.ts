/**
 * E16 §3.2 — does the bridge really serve TWO clients, and does the revision
 * guard hold across them?
 *
 * ⚠ **This exists because the §3.2 proposal rested on a CODE READING.**
 * `Bridge.java` binds `new ServerSocket(port, 8, loopback)` and hands each
 * accepted socket to its own thread from a cached pool, and `ExecState`'s
 * comment says every request is marshalled onto the single control-surface
 * thread — from which one concludes that several clients are supported and that
 * E8's revision counter serialises them. **Standing rule 10 applies to reading
 * source exactly as it applies to reading javadoc**, and this spike has been
 * wrong five times from exactly that move. So: probe it.
 *
 * It matters because retiring `ghostnoted` (D4) makes the MCP server hold a
 * bridge connection directly, and the one real cost of that is **multiple chat
 * sessions mean multiple MCP servers mean multiple writers**. Whether that is
 * survivable or catastrophic depends entirely on whether the guard that already
 * exists reaches across connections — which nobody has tested. E8-D tested it
 * with ONE client simulating interference via `revision.bump`; that proves the
 * guard works, and says nothing about processes.
 *
 * Four questions, in order of how badly a NO would hurt:
 *
 *   P1  can two clients be connected at once and both get served?
 *   P2  do their replies stay separated — no cross-talk on the shared socket
 *       handling? (a shared-mutable-buffer bug here would corrupt readback,
 *       which is the foundation standing rule 1 stands on)
 *   P3  ⚠ does the stale-revision guard reject a SECOND CLIENT's batch that was
 *       tagged before the first client's landed?
 *   P4  ⚠ under genuine concurrency — both submitted without awaiting between —
 *       does EXACTLY ONE win? This is the one that decides whether two agents
 *       can corrupt each other.
 *
 * ⚠ Every op in every batch is `ping`, which mutates NOTHING. The revision
 * guard is evaluated before any op runs, so the verdict does not depend on the
 * ops doing anything — and a probe about concurrency has no business writing
 * notes while it runs.
 *
 * Silent, safe on a non-TTY, changes nothing in the project.
 */
import { BridgeClient } from '../client.js';
import { check, note, failureCount } from './lib.js';

interface BatchResult {
  applied?: boolean; rejected?: boolean; reason?: string;
  expected?: number; actual?: number; revision?: number;
}

const A = new BridgeClient();
const B = new BridgeClient();

const rev = async (c: BridgeClient) =>
  ((await c.request('revision.get')) as { revision: number }).revision;

/** A batch of pure no-ops, tagged with a revision. */
const guardedBatch = async (c: BridgeClient, ifRevision: number) =>
  (await c.request('batch.run', {
    ops: [{ method: 'ping', params: {} }],
    ifRevision,
  }, 30000)) as BatchResult;

// ==========================================================================
// P1 — two clients, both served
// ==========================================================================
console.log('-- P1: two independent connections');
await A.connect();
await B.connect();
check('both clients connected', A.connected && B.connected,
  { a: A.connected, b: B.connected });

const helloA = (await A.request('contract.hello')) as { methodsHash: string };
const helloB = (await B.request('contract.hello')) as { methodsHash: string };
check('both clients get served, and see the same extension',
  helloA.methodsHash === helloB.methodsHash && helloA.methodsHash.length > 0,
  { a: helloA.methodsHash, b: helloB.methodsHash });

// ==========================================================================
// P2 — no cross-talk
// ==========================================================================
/**
 * Interleaved, with payloads that identify their sender, and fired without
 * awaiting between them so both sockets have requests in flight at once. A
 * client that received the other's reply would fail here loudly rather than
 * corrupting a readback silently somewhere much later.
 */
console.log('\n-- P2: interleaved traffic stays separated');
let crossTalk = 0;
for (let i = 0; i < 12; i++) {
  const [ra, rb] = await Promise.all([
    A.request('echo', { value: `A-${i}` }),
    B.request('echo', { value: `B-${i}` }),
  ]);
  const sa = JSON.stringify(ra);
  const sb = JSON.stringify(rb);
  if (!sa.includes(`A-${i}`) || sa.includes(`B-${i}`)) crossTalk++;
  if (!sb.includes(`B-${i}`) || sb.includes(`A-${i}`)) crossTalk++;
}
check('12 interleaved round trips per client, no reply landed on the wrong client',
  crossTalk === 0, { crossTalkCount: crossTalk });

// ==========================================================================
// P3 — the guard reaches across connections (sequential)
// ==========================================================================
console.log('\n-- P3: a stale batch from client B, after client A landed one');
const r0 = await rev(A);
const rB0 = await rev(B);
check('both clients read the SAME revision — one counter, not one per connection',
  r0 === rB0, { fromA: r0, fromB: rB0 });

const aWins = await guardedBatch(A, r0);
const bStale = await guardedBatch(B, r0);
note(`A submitted @${r0}: applied=${aWins.applied} revision=${aWins.revision}`);
note(`B submitted @${r0}: applied=${bStale.applied} rejected=${bStale.rejected} `
  + `reason=${bStale.reason} expected=${bStale.expected} actual=${bStale.actual}`);

check('P3: client A\'s batch applied and claimed the next revision',
  aWins.applied === true && aWins.rejected !== true && aWins.revision === r0 + 1,
  { result: aWins });
check('⚠ P3: client B\'s batch, tagged with the revision A consumed, is REJECTED WHOLE — '
  + 'so the ordering guard reaches ACROSS CONNECTIONS, not just across requests',
  bStale.applied === false && bStale.rejected === true && bStale.reason === 'stale-revision',
  { result: bStale,
    why: 'if this FAILS, two MCP servers can overwrite each other and D4 cannot be retired '
      + 'without replacing this guarantee' });

// ==========================================================================
// P4 — genuine concurrency: exactly one winner
// ==========================================================================
/**
 * The sequential case above proves the counter is shared. It does NOT prove
 * there is no window in which both clients pass the check before either bumps —
 * which is precisely what a reader worried about two processes should worry
 * about. `ExecState`'s claim is that thread confinement makes
 * check-then-apply-then-bump atomic for free; this is that claim under load.
 *
 * ⚠ The two requests are dispatched WITHOUT awaiting between them, so both are
 * in flight before either can have been processed.
 */
console.log('\n-- P4: both clients submit against the same revision, concurrently');
const outcomes: { round: number; accepted: number; rejected: number }[] = [];
for (let round = 1; round <= 6; round++) {
  const r = await rev(A);
  const [ra, rb] = await Promise.all([guardedBatch(A, r), guardedBatch(B, r)]);
  const accepted = [ra, rb].filter((x) => x.applied === true).length;
  const rejected = [ra, rb].filter((x) => x.rejected === true).length;
  outcomes.push({ round, accepted, rejected });
  note(`round ${round} @rev ${r}: accepted=${accepted} rejected=${rejected}`);
}

const everyRoundHasOneWinner = outcomes.every((o) => o.accepted === 1 && o.rejected === 1);
const anyDoubleAccept = outcomes.some((o) => o.accepted > 1);
check('⚠ P4: EXACTLY ONE client won every concurrent round — the guard is atomic across '
  + 'connections, so two writers cannot both land against the same revision',
  everyRoundHasOneWinner,
  { outcomes,
    reading: anyDoubleAccept
      ? '⚠⚠ TWO CLIENTS BOTH APPLIED against one revision — the guard does NOT survive '
        + 'concurrency and a multi-writer topology is unsafe'
      : everyRoundHasOneWinner ? 'one winner per round, every round'
        : 'neither applied in some round — over-rejection, which is safe but worth explaining' });

// ==========================================================================
// P5 — one client leaving does not disturb the other
// ==========================================================================
console.log('\n-- P5: disconnect isolation');
A.disconnect();
await new Promise((r) => setTimeout(r, 300));
const afterA = await rev(B);
check('client B is unaffected by client A disconnecting',
  typeof afterA === 'number' && B.connected, { revision: afterA, bConnected: B.connected });

// ==========================================================================
// verdict
// ==========================================================================
console.log('\n=== VERDICT ===');
const multiClientOk = everyRoundHasOneWinner
  && bStale.rejected === true && crossTalk === 0;
console.log(multiClientOk
  ? '  ● The bridge serves multiple clients, replies stay separated, and E8\'s revision\n'
    + '    guard is ATOMIC ACROSS CONNECTIONS. §3.2\'s premise holds by measurement, not\n'
    + '    by code reading: retiring the daemon does not give up the ordering guarantee.'
  : '  ⚠ The multi-client premise does NOT hold as read. §3.2\'s recommendation to retire\n'
    + '    `ghostnoted` depends on this and must be revisited.');
console.log('');
console.log('  ⚠ What this does NOT show: that two AGENTS writing concurrently is a good');
console.log('    idea. The guard makes their writes ORDERED, not COHERENT — a rejected');
console.log('    batch still has to be re-planned against the new world by whoever sent it.');
console.log('    That is a design question for the MCP server, not a bridge property.');

B.disconnect();
console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} FAILURES`);
process.exit(failureCount() === 0 ? 0 : 1);
