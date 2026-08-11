---
id: E16t
kind: evidence
state: active
source: FINDINGS.md
---

# E16t — `createEqualsValue` is a TRACK-drift guard, is meaningless between two cursors, and fails GREEN [K] (2026-07-31)

**Verdict: ◐ narrowly useful and dangerously shaped.** It detects positional
drift — which D6 has nothing equivalent to — and it is **meaningless between two
proxies of the same cursor kind**, where it reads `true` unconditionally. Probes:
`e16t-equals.ts`, `e16t-diag.ts`, `e16t-diag2.ts`. New wire: `equals.status`,
`equals.tryCreate`. Silent.

| row | result |
|---|---|
| ⚠ **standing rule 13** — `createEqualsValue` outside `init()` | ● **REFUSED**: *"This can only be called during driver initialization"* |
| 65 pairs pre-allocated at init | ● `built:65`, no init failure |
| settle time after a repoint | ● **96 ms** |
| cursor ↔ bank item, same object | ● true, and **exactly one** bank row matches |
| survives a RENAME | ● true — D6's name check would have failed |
| ⚠ **detects a POSITION SHIFT** | ● **false at the old index, true at the new** |
| cursor ↔ cursor (tracks) | ○ **true on DIFFERENT tracks** — meaningless |
| clip cursor ↔ clip cursor | ○ **true across different slots AND different tracks** |
| pool clip ↔ host follower clip | ● false — so it is not literally constant |

⇒ **The rule is not "createEqualsValue works".** It is: **it works between a
CURSOR and a BANK ITEM, and is meaningless between two cursors of the same
kind.** For clips there is no cursor-vs-bank-item pair available at all — a
`Clip` and a `ClipLauncherSlot` are different objects and the bank holds only the
latter — so it offers clips nothing and **E16l stands**.

### ⚠ Rule 13's fifth independent occurrence

`getDocumentState()` settings (E14-C2), `host.createBitmap` (E14-I5), cursor
pools (E1), device/param handles (E5), and now this. The rule's status changes:
it has been treated as a **default to assume** for anything the API hands out,
and it is now a measured property of five unrelated subsystems.

### ⚠ The claim this row made and then withdrew, and the direction it failed in

`e16t` asserted cursor↔cursor as an **aliasing detector** — E2c's fixture
contamination, caught directly rather than from symptoms — and never exercised
it; it only ever exercised cursor↔bank-item. `e16t-diag2` §G exercised it: `ct0=ct1`
reads **true on different tracks**. The claim is withdrawn.

⚠ **The failure direction is the point.** An aliasing detector that is always
true reports "no aliasing" by reporting "always aliased" — it fails **GREEN**. It
was caught only because §F's cross-track clip result impeached a guard the row
had already published, and the impeachment was chased instead of written up.

⚠ **Two probe defects produced things that read like findings**, both from a
discarded return value, and both caught by their own transcripts: `e16t` ignored
`point()`'s result while cursor 1 was still track-pinned; `e16t-diag` §1b asked
for scenes 11 and 12 in a project whose slot bank has 16 rows but whose **rows
past the scene count are not pointable**, so both cursors stayed at scene 1 and
"two cursors on different empty slots compare equal" was two cursors on the SAME
slot. That is the E16o trap twice in one row.

### ⚠ The sharpest limitation: it detects DRIFT, not DEATH

A pinned cursor whose target is **deleted** silently slides onto the track that
inherits its position — `cursor.status` then reports `trackName="gn-B"` — and the
equals value reads **true against the wrong track**. Named rather than counted,
per E16r's method note: `e16t` printed "matches 1 row", and only naming the row
turned that into the finding.

⇒ The guard answers *"is this cursor the same object as that bank row"*. It never
answers *"is this cursor still on the object I aimed it at"*, because the cursor
itself is not durable. **Pairing with `channelId` stays mandatory**, and pinning
does not protect against deletion.

---
