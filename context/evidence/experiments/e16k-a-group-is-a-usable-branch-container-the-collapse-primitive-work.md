---
id: E16k
kind: evidence
state: active
source: FINDINGS.md
---

# E16k — a GROUP is a usable branch container: the collapse primitive works and identity survives it [K] (2026-07-27)

**Verdict: ● all four rows.** `Group` wraps a track **without minting a new
`channelId`**; a duplicate of a group child lands **inside**; **delete-all-but-one
followed by `Ungroup`** returns the survivor to top level with its identity
intact, in ~243 ms; and groups **nest**, so a branch tree can have real depth.
Together these make "the project document *is* the take log" mechanically
available. Probe: `e16k-grouptopo.ts`, all silent (structural ops, transport
stopped — the probe refuses to run while it is rolling).

Run because the user's restatement of the E16 proposal rests on one sentence —
*"collapsing to a certain take would often be as simple as delete all but one in a
group and ungroup"* — and **`Ungroup` had never been invoked**. Writing that into
a design document without probing it is exactly the doc-pass failure standing
rule 10 forbids.

| row | question | result |
|---|---|---|
| K1 | does `Group` mint a new identity for the child? | ● **no** — `channelId` survives |
| K2 | does a duplicate of a group child land INSIDE? | ● yes |
| K3 | delete-all-but-one, then `Ungroup` | ● group dissolves ~243 ms; survivor back at top level, `type` back to `Instrument`, `channelId` **intact** |
| K4 | `Group` a track already in a group | ● **nests** |

### Why K1 and K3 are the load-bearing ones

`channelId` is the only durable key we have (E2f/D6) and everything addresses
through it. An operation that silently re-minted it would orphan every reference
held across a grouping or a collapse — and the failure would look like "the branch
vanished", indistinguishable from a deletion. **Both directions preserve it**, so
a group can hold a lineage and a collapse can resolve one without any re-keying.

### ⚠ K2 constrains the construction more than it enables it

`copyTracks` **and** `moveTracks` are both silent no-ops (E16 rows A / D–G), so a
track cannot be moved into a group after the fact. With K2, the **only** known
route to a populated lineage is **group the original FIRST, then duplicate** —
copies then land inside on their own. Consequences: construction order is forced,
there is no gathering of existing tracks, no re-parenting, and no ordering within
a group (sibling order is whatever creation order produced).

### ⚠ What this does NOT measure

**Group mute.** "Mute the group to A/B a whole lineage" is the ergonomic claim the
track-native model leans on hardest, and it is unanswerable here: trap 7 says
`addVuMeterObserver` is **pre-mute**, so the only honest oracle is the master bus
with the transport **rolling** — which is noise, and the posture is to ask before
making any. Left as an owed audible row.

### ⚠ A hazard that falls out of E3, sharpened by this construction

**Deleting a group CASCADES to its children.** Under a design where the group *is*
the lineage container, the most natural tidying gesture — select the container,
delete — destroys the entire lineage including the winner, in one act. This
inverts D17f's retention protection, which refuses to prune a take that still has
children. Under a store that shape of mistake is impossible; under groups it is
one keystroke.

Analysis of what this means for the branch/take design:
`spike/E16-TRACK-NATIVE-BRANCHING.md`.

---
