/**
 * The bridge client's framing, over a REAL loopback socket.
 *
 * ⚠⚠ Born from a data-corruption bug the whole offline suite could not see
 * (E20d). `BridgeClient` decoded every TCP chunk independently with
 * `data.toString('utf8')`, so a multi-byte character straddling a chunk boundary
 * became two U+FFFD replacement characters — one character silently turning into
 * two, corrupting content and length together.
 *
 * ⚠ It was found by accident, as *"1 MB echoes come back two characters longer,
 * intermittently"*, while measuring `getDocumentState()` capacity. The size was
 * never the point: **any** reply carrying a non-ASCII character can be corrupted
 * the moment a chunk boundary lands inside it, and standing rule 1 offers no
 * protection — a readback travels the same broken path as the write, so it agrees
 * with itself.
 *
 * ⚠ These tests use a real `net.Server` rather than a fake transport, deliberately.
 * The bug lives in the seam between the socket and the parser; a fake that hands
 * over whole strings cannot express the failure at all, which is exactly why 294
 * green tests said nothing about it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as net from 'node:net';

import { BridgeClient } from './client.js';

/**
 * A one-shot bridge that replies with `payload`, written as raw byte chunks.
 *
 * ⚠ The caller controls where the split falls, because that is the variable under
 * test. Splitting a response into arbitrary chunks is not a pathological case: it
 * is what TCP does to anything larger than a segment.
 */
async function serverReplying(
  payload: string,
  split: (line: Buffer) => Buffer[],
): Promise<{ port: number; close: () => void }> {
  const server = net.createServer((socket) => {
    // ⚠ Accumulate until a newline. The first version of this harness parsed the
    // FIRST CHUNK as a whole request and blew up on a 200 KB one — the same
    // "one chunk is one message" assumption that produced the bug under test,
    // made again while writing the test for it. Worth leaving noted: the
    // assumption is comfortable enough to make twice in one file.
    let pending = '';
    let answered = false;
    socket.setEncoding('utf8');
    socket.on('data', (raw: string) => {
      pending += raw;
      const at = pending.indexOf('\n');
      if (at < 0 || answered) return;
      answered = true;
      const { id } = JSON.parse(pending.slice(0, at)) as { id: string };
      const line = Buffer.from(`${JSON.stringify({ jsonrpc: '2.0', id, result: { payload } })}\n`, 'utf8');
      // ⚠⚠ A REAL GAP BETWEEN CHUNKS, and without it two of these tests are
      // decorative. Loopback coalesces back-to-back small writes into a single
      // TCP segment, so the client receives one 'data' event and the split never
      // happens — both small cases passed with the bug deliberately reintroduced.
      // A test that cannot fail when the defect is present is not a regression
      // test, it is a comment (E17 method guard 10: a guard only ever shown saying
      // yes is not a guard).
      void (async () => {
        for (const chunk of split(line)) {
          socket.write(chunk);
          await new Promise((r) => setTimeout(r, 5));
        }
      })();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as net.AddressInfo;
  return { port, close: () => server.close() };
}

/** Byte offset of `needle`'s first occurrence, so a split can land INSIDE it. */
const byteIndexOf = (line: Buffer, needle: string): number => line.indexOf(needle, 0, 'utf8');

test('C-utf8: a multi-byte character split across TCP chunks survives intact', async () => {
  // ⚠ U+2192 is three bytes in UTF-8. The split lands after the FIRST of them,
  // which is precisely the case `data.toString()` per chunk cannot handle.
  const payload = 'before → after';
  const { port, close } = await serverReplying(payload, (line) => {
    const at = byteIndexOf(line, '→') + 1;
    return [line.subarray(0, at), line.subarray(at)];
  });
  const client = new BridgeClient(port);
  try {
    const res = (await client.request('echo', { payload })) as { payload: string };
    assert.equal(res.payload, payload,
      'a character split across chunks came back corrupted — the U+FFFD bug is back');
    // ⚠ Length asserted separately from content. The original bug changed BOTH,
    // and a length check is the one a caller is most likely to write.
    assert.equal(res.payload.length, payload.length);
  } finally {
    client.disconnect();
    close();
  }
});

test('C-utf8: a character split into THREE chunks also survives', async () => {
  // ⚠ One byte per chunk across the whole 3-byte sequence. The first fix that
  // suggests itself — "keep one leftover byte" — passes the two-chunk case and
  // fails this one, so the harder case is asserted rather than assumed.
  const payload = 'a→b';
  const { port, close } = await serverReplying(payload, (line) => {
    const at = byteIndexOf(line, '→');
    return [line.subarray(0, at + 1), line.subarray(at + 1, at + 2), line.subarray(at + 2)];
  });
  const client = new BridgeClient(port);
  try {
    const res = (await client.request('echo', { payload })) as { payload: string };
    assert.equal(res.payload, payload);
  } finally {
    client.disconnect();
    close();
  }
});

test('C-utf8: a large payload split at many boundaries is byte-exact', async () => {
  // ⚠ The shape that actually caught it: a big reply peppered with multi-byte
  // characters, chopped at fixed offsets so several splits land mid-character.
  // The original bug was INTERMITTENT against a live bridge because it depended
  // on where the kernel happened to break the stream; here the boundaries are
  // chosen, so a regression fails every time instead of one run in three.
  const unit = 'événement → 日本語 ';
  const payload = unit.repeat(4_000);
  const { port, close } = await serverReplying(payload, (line) => {
    const chunks: Buffer[] = [];
    for (let at = 0; at < line.length; at += 4_096) {
      chunks.push(line.subarray(at, Math.min(at + 4_096, line.length)));
    }
    return chunks;
  });
  const client = new BridgeClient(port);
  try {
    const res = (await client.request('echo', { payload }, 30_000)) as { payload: string };
    assert.equal(res.payload.length, payload.length,
      `expected ${payload.length} chars back, got ${res.payload.length}`);
    assert.equal(res.payload, payload);
  } finally {
    client.disconnect();
    close();
  }
});

test('C-frame: two responses arriving in ONE chunk are both delivered', async () => {
  // ⚠ The other half of the framing contract, and free to check here. The parser
  // splits on newlines out of an accumulator; a chunk carrying two whole lines
  // must not drop the second.
  const server = net.createServer((socket) => {
    const ids: string[] = [];
    socket.on('data', (raw) => {
      for (const line of String(raw).split('\n').filter(Boolean)) {
        ids.push((JSON.parse(line) as { id: string }).id);
      }
      if (ids.length === 2) {
        socket.write(ids.map((id) =>
          JSON.stringify({ jsonrpc: '2.0', id, result: { id } })).join('\n') + '\n');
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as net.AddressInfo;
  const client = new BridgeClient(port);
  try {
    // ⚠⚠ CONNECT FIRST, and the reason is a SECOND defect this test found.
    //
    // Without it, two concurrent first requests BOTH see `connected === false` and
    // both call `connect()` — opening two sockets, leaking one, and assigning
    // request ids in whichever order the two connects happen to resume. The
    // observed symptom was `request('one')` resolving with the reply to id 2.
    //
    // ⚠ That is a real client bug (an in-flight connect is not memoised) and it is
    // RECORDED, not fixed here: it is unrelated to the UTF-8 corruption this file
    // was written for, and folding an unrelated fix into that diff is how the fix
    // that matters stops being reviewable. Connecting first isolates the framing
    // question, which is what this case is about.
    await client.connect();
    const [a, b] = await Promise.all([client.request('one'), client.request('two')]);
    assert.deepEqual([(a as { id: string }).id, (b as { id: string }).id], ['1', '2']);
  } finally {
    client.disconnect();
    server.close();
  }
});
