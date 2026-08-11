---
id: E16p
kind: evidence
state: active
source: FINDINGS.md
---

# E16p / E16q — the bridge serves two clients atomically, and the middle dot round-trips [K] (2026-07-30)

Two small rows, each closing a premise something larger was about to be built on.

### E16p — ⚠ the revision guard is atomic ACROSS CONNECTIONS ●

**Run because the §3.2 proposal to retire `ghostnoted` rested on a CODE
READING** — `Bridge.java` accepts each client on its own thread and `ExecState`
claims thread confinement makes check-apply-bump atomic for free. Standing rule
10 applies to reading source exactly as to reading javadoc, and this spike has
been wrong five times from that move. Probe: `e16p-multiclient.ts`; every batch
op is `ping`, so nothing in the project is touched.

| row | result |
|---|---|
| P1 two clients connected and served | ● identical `methodsHash` from both |
| P2 12 interleaved round trips each | ● **0** replies delivered to the wrong client |
| P3 both read the same revision | ● one counter, not one per connection |
| P3 B's batch tagged with the revision A consumed | ● rejected whole, `reason: stale-revision` |
| ⚠ **P4 both submitted concurrently against one revision** | ● **exactly one winner, 6/6 rounds** |
| P5 one client disconnecting | ● the other is unaffected |

⇒ **Retiring the daemon gives up no ordering guarantee.** E8-D had tested the
guard with one client simulating interference via `revision.bump`, which proves
the guard works and says nothing about processes; this says it holds across them.

⚠ **What it does NOT show:** that two agents writing concurrently is a good idea.
The guard makes writes **ordered, not coherent** — a rejected batch still has to
be re-planned against the new world by whoever sent it. That is an MCP-server
design question, not a bridge property, and it is the residual cost of retiring
`ghostnoted`.

### E16q — `track.setName` round-trips non-ASCII exactly ●

The whole lineage-naming scheme (§1b) rests on `·` (U+00B7) surviving a write and
a read. It does. Probe: `e16q-naming.ts`, one throwaway track, deleted after.

- ⚠ **`B· Bass different-line` round-trips EXACTLY, compared by CODEPOINT** —
  U+00B7 in, U+00B7 out. Compared by codepoint deliberately: `·` U+00B7,
  `∙` U+2219 and `•` U+2022 are indistinguishable at UI sizes and a silent
  substitution would pass any human check.
- **10 of 10 non-ASCII cases exact**, including CJK (U+97F3) and an astral-plane
  emoji (U+1F3B9, a surrogate pair). So non-ASCII is not special-cased anywhere.
- A **96-character** name is not truncated by `name().get()` — a long original
  name plus a tag plus a gist survives.
- Leading and trailing spaces are preserved.

⚠ **One incidental, and it has a consequence.** An **empty** name reads back as
`"Inst 8"` — Bitwig substitutes a display default, so **a track is never
nameless**, and the default appears to derive from creation order rather than
being stored data. The scheme tags every lineage member so this does not bite
it, but **the reaping guard's "refuse to delete an untagged track" must test for
the ABSENCE OF A TAG, never for an empty name.**

---
