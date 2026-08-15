---
id: D18
kind: decision
state: active
source: DECISIONS.md
updated: 2026-08-14
---

# D18 — Managed takes use layer chains and clip blocks; track copying is ordinary CRUD **[REVISED 2026-08-14]**

**There are two managed take representations: layer chains for device-chain
alternates and launcher clip blocks for clip-content alternates. Track duplication
remains a direct, typed track CRUD capability, but a copied track is not a take in
ghostnote's model and receives no lineage, switching, or take-lifecycle
bookkeeping.**

This revises the three-mechanism hybrid settled on 2026-08-06. The earlier choice
was reasonable on the evidence available: layers were strong for device-scoped
work but could never carry clips, while tracks carried the whole channel and
provided a visible collapsed lineage container. E22 then proved that the only way
to create that container, the Editing action `Group`, follows unobservable primary
focus and can silently edit a device chain instead. Any capability that requires
operator assistance for mechanical execution is outside the product contract.

The original investigation remains in
[E18-VERDICT](../archive/spike/E18-VERDICT.md) and
[HYBRID-AUTONOMY-LEVELS](../archive/spike/HYBRID-AUTONOMY-LEVELS.md). E22's
destruction matrix is the decisive new evidence.

## a. What survives from the hybrid, and why

The two managed representations divide by the Bitwig object whose alternate is
being preserved:

| representation | owns | switching | distinctive reach |
|---|---|---|---|
| layer chain | devices and device state | container-local exclusive solo | Master/FX-return devices, silent move-based rebuild, no track-bank row |
| clip block | launcher clip content and launch settings | per-slot launch | beat-aligned switching and position-continuous clip A/B |

Layers alone were never sufficient because a layer has no clips and cannot express
a melodic or rhythmic clip alternate. Clip blocks alone cannot carry a device
chain. Both remain necessary.

The track-fork proposal added whole-track snapshots, sends, immediate visibility,
and a collapsed lineage view. On review after E22, its uniquely useful product
advantages reduce to visual lineage and organization: ordinary ungrouped sibling
tracks can already be compared with track mute/solo, track solo is project-wide
rather than group-scoped, and mutes are still toggled individually. Those visual
advantages do not justify an unobservable, operator-dependent, misdispatching
constructor.

## b. Independent alternates within one instruction

A turn may create several independent managed takes. A request that changes a
track's instrument and its melody can create a layer-chain alternate and a clip
alternate concurrently, but they are not promised to be linked. The same is true
when one instruction changes several tracks: each alternate is its own event.

They may share ordinary provenance such as a turn or instruction identifier. That
correlation is not a compound take, an atomic project state, or a guarantee that
switching one switches the others.

⚠ **What neither representation covers, stated so it is not discovered later.** A
layer chain carries devices and device state and has **no clips, no sends and no
track-mixer state**; a clip block carries launcher clip content and launch settings
and nothing else. So these are explicitly OUTSIDE both managed representations
until designed:

- **arrangement clips** — the clip block is launcher-only;
- **per-alternate sends, track-mixer state, or routing** — a layer channel has no
  sends, and routing is not object-scoped;
- **cross-track and project-level alternates** — tempo, scenes, several tracks at
  once;
- **a mixed change as one linked object** — it decomposes into independent events
  per §b, or it is unsupported.

`copy_track` may be directed at such work and will do it, because it copies the
whole channel. ⚠ It does not thereby acquire take semantics, and an agent reaching
for it in place of a scoped alternate is a measurement the 3g record must see
(§e), not a silent fallback that reinstates the retired hybrid by convention.

## c. Track copying is typed CRUD, not an unrecorded write

`copy_track` duplicates one addressed track using the measured typed
`Channel.duplicate()` route. It is available whenever the operator directs an
agent to copy a track, including workflows that resemble informal takes.

The copy:

- goes through the normal executor, preconditions, readback, and session change
  reporting;
- returns the fresh durable track identity;
- is subject to the observable bank-window budget, one row per copy;
- remains after automatic reversal, with that limitation reported and a separately
  authorized `delete_track` as the directed cleanup path;
- creates no take record, lineage relation, managed A/B pair, or automatic
  collapse/cleanup obligation.

This is intentionally between the discarded alternatives: it is neither promoted
to a take model nor allowed to become an invisible side write.

⚠ Its costs are mechanical facts the description states plainly rather than
warnings the agent has to infer:

- **it is immediately audible** if the source was audible — a copy is not a quiet
  staging area, and nothing mutes it on the agent's behalf;
- **instantiating the copied device chain can glitch the audio and adds engine
  load** — E16 row C5's blind placebo-controlled ear test heard it 5/5 on real
  duplications against 0/3 on placebo, and heavy plugins are what make it audible.
  ⚠ Not to be confused with disk cost, which E16u measured as immaterial;
- **it consumes one track-bank row**, and the Master and FX returns cross the
  ceiling first (E16r);
- **only the regular track types actually measured are supported.** Other types
  refuse until proven rather than being attempted on the assumption that
  `Channel.duplicate()` behaves the same everywhere.

None of that requires confirmation or a human gesture before the call. It does
mean creation is not safely auto-reversible, so persistence and the cleanup
boundary are the prominent part of the description, not a footnote.

## d. Autonomy is a hard capability boundary

Mechanical functionality must be provisioned and executable without runtime
operator setup. In particular:

- the layer seed asset is bundled or provisioned at build time; an operator never
  authors a preset shell to enable the feature;
- nested layer addressing, creation, filling, switching, reduction, and collapse
  use typed, observable operations;
- named actions do not re-enter the product through a prompt or focus ritual;
- a difficult autonomous operation may be cumbersome, but it may not depend on a
  human click.

The common layer collapse is winner extraction: move the surviving chain's devices
out of the container, then delete the container and its remaining chains. Removing
one of three-or-more chains while preserving several alternates may use a rebuild.
Neither route needs focus priming.

Open correctness work remains explicit: preserve multi-device order; decide how
to preserve the container's original signal-chain position rather than always
moving to `chainEnd`; account for chain-level gain/pan state that does not travel
with devices; measure the on-track audible gap; and do not claim cross-device
modulation survives until its indexed path is tested.

## e. Tool descriptions and observation

The original L3-open principle survives, but the old three-way dispatch classifier
does not. There is no longer a choice among three equivalent take mechanisms:
device alternates and clip alternates have one managed representation each, while
track copying is a separate general capability.

Descriptions begin light and factual. They name object scope, mechanical
preconditions, costs, destructive seams, and correct procedures. They do not need
to hide the now-settled object boundary, and they should not market `copy_track`
as a take tool. Naming and wording are versioned because they may determine
whether agents choose the right scoped operation or reach for a coarse track copy.

⚠ The surface's lexical ban list (`brain/src/surface/naming.ts`) is what holds
that line mechanically, and this revision changes what it should forbid: the
retired mechanism's vocabulary stays banned permanently, while the words a
correctly scoped device-alternate or copy tool may need are marked relaxation
candidates. Reopen them one entry at a time with the reason rewritten in place.
A deletion with no replacement reason is the leak arriving quietly.

Observation records enough to revisit those descriptions:

- raw requested/write-set scope: device-only, launcher-clip-only, mixed, or
  unsupported;
- each independent managed alternate actually created, correlated to its turn;
- actual structure used: layer chain, clip block, both independently, track copy,
  or none;
- agent rationale when available, operator response, result identity, and tool-
  description version.

Do not overfit one ordinary session. Adapt when a failure pattern repeats across
distinct sessions. Stay open to failure modes not named in advance. A single
strong controlled result may still justify immediate containment when safety or
correctness is at stake, as E22 did.

## f. The record and the other axes

The observation record remains per-project in the hidden-at-`init()` document
setting proven by E20d. Raw write-set is retained so later analyses can be replayed;
accepted, vetoed, and silent operator responses remain distinct; tool-description
version is mandatory.

This decision governs representation, not whether every edit gets a take. Axis B
stays deliberate and coarse: most writes use the stash without creating an
alternate. Axis C remains zero initiative under D20: destruction occurs only at
operator direction through the annotated tool seam.

## g. Fidelity protection remains explicit

The D16 floor is unchanged in purpose: a write whose prior state cannot be stashed
at `exact` fidelity, or whose damage occurs before a safe stash can exist, refuses
unless the affected object is already protected by its appropriate managed take
representation. The system never responds by automatically copying a track.

The protection must match the object at risk: a device write is protected by the
layer alternate it targets; a launcher-clip write is protected by the clip block
it targets. Mixed work satisfies each side independently or refuses the
unprotected side before anything is applied.
