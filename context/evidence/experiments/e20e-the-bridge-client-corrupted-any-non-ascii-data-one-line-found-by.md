---
id: E20e
kind: evidence
state: active
source: FINDINGS.md
---

# E20e — ⚠⚠ THE BRIDGE CLIENT CORRUPTED ANY NON-ASCII DATA: one line, found by accident [K] (2026-08-09)

**Verdict: ⚠⚠ a real data-corruption bug, diagnosed and FIXED.** Found while
measuring `getDocumentState()` capacity (E20d) as *"1 MB echoes come back two
characters longer, intermittently"*. It was never about 1 MB.

```ts
socket.on('data', (data) => this.handleData(data.toString('utf8')));   // ⚠ the bug
socket.setEncoding('utf8');                                            // ● the fix
```

**`BridgeClient` decoded every TCP chunk INDEPENDENTLY.** TCP hands over arbitrary
byte boundaries, so a multi-byte UTF-8 character straddling one was decoded as two
U+FFFD replacement characters — one per fragment. ⇒ **One character silently became
two, corrupting content and length together.**

### ⚠⚠ Why the "1 MB" framing was wrong, and dangerous

| | |
|---|---|
| what it looked like | a capacity limit at ~1 MB, intermittent, absent below 256 KB |
| what it was | **any reply carrying a non-ASCII character**, whenever a chunk boundary lands inside it |
| why size correlated | small replies arrive in ONE chunk. Nothing splits, so nothing corrupts. The 1 MB payload crossed ~16 boundaries and carried a `→` roughly every 100 chars |
| why it was intermittent | the boundaries are the kernel's choice, not ours |

⚠ **A track named `Café`, an em dash in a clip name, any CJK text** — all corruptible
at any size. ⚠⚠ **And standing rule 1 offers NO protection**: a readback travels the
same broken path as the write, so it agrees with itself. This is the one failure
class the project's central discipline cannot catch, which is why it survived 294
green tests and four live probe sittings.

### The regression tests, and what writing them taught

`brain/src/client.test.ts` — 4 cases over a **real loopback `net.Server`**, because
the bug lives in the seam between socket and parser and a fake handing over whole
strings cannot express it.

⚠⚠ **The first version of two of those tests was decorative**, and only a
both-directions check found that out (E17 method guard 10). With the bug
deliberately reintroduced they still PASSED — loopback coalesces back-to-back small
writes into one segment, so the split never happened. ⇒ The harness now waits 5 ms
between chunks, and all three UTF-8 cases fail with the bug and pass with the fix,
verified by reverting and restoring.

⚠ A third instance of the same reflex, in the harness itself: it originally parsed
the FIRST CHUNK as a whole request and blew up on a 200 KB one. **"One chunk is one
message" was assumed three times in one file** — by the client, by the test, and by
the harness. It is a comfortable assumption.

### ⚠ Found on the way, NOT fixed: a connect race

Two concurrent first requests both see `connected === false` and both call
`connect()` — opening two sockets, leaking one, and assigning request ids in
whichever order the connects resolve. Observed directly: `request('one')` resolved
with the reply to id 2. ⚠ An in-flight `connect()` is not memoised. **Recorded, not
fixed** — unrelated to the corruption this diff was for, and folding it in is how
the fix that matters stops being reviewable.

### Decision impact

- ● **The recorded wire ceiling is now 1 MB exact, 3/3 live**, and `e20d` scores it
  again rather than reporting it as a known flake.
- ⚠ **Nothing else changes** — no contract, no adapter, no probe result. Every
  earlier measurement was ASCII-only and therefore unaffected, which is luck rather
  than design.
- ⚠ **Owed**: the connect race above.

---
