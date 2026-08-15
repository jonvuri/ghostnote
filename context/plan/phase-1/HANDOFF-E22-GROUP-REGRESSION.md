---
title: Handoff — E22 track-Group focus-latch destruction matrix
kind: handoff
state: discharged
status: ⚠⚠ DISCHARGED 2026-08-12. The matrix ran on one clean Bitwig lifecycle:
        10 scored arms plus 4 recovery controls, no extension deployed, nothing
        outside the probe's own fixtures touched in any arm. THE ANSWER IS THE
        THIRD SHAPE — MISDISPATCH HAZARD, not a durable latch and not merely a
        fragile one. There is no session latch at all: `Group` dispatches to
        whatever holds Bitwig's PRIMARY FOCUS at invocation. A track-header click
        wraps in ~145 ms; a click on the target's OWN launcher slot (5025 ms), a
        chain lane (5036 ms) and a project-tab round trip (5114 ms) all miss with
        the selected mixer row still pinned to the target; and the target's OWN
        device header makes the same call build an Instrument Layer around that
        device inside the track's device chain, with every guard passing.
        ⇒ A once-per-Bitwig-session operator prompt is NOT a viable product
        precondition. §7's decision returns to the operator with the routes
        narrowed to: just-in-time verified-per-call, deferral in favour of the
        layer chain and clip block, or an interlock stronger than any observer on
        the wire. Nothing was productized, deployed or committed to reach this.
        --- the original brief follows, unchanged, as the method record ---
updated: 2026-08-12
parent: 3f-fork-chain.md
evidence: E16j, E16k, E17, E22 · D13 · standing rules 2, 5, 6, 10, 13
---

# Result — read this before the brief below

**Product disposition, 2026-08-14:** the operator chose deferral in favour of
layer-chain and clip-block managed takes. The grouped-fork product slice was
removed; ordinary typed track copying remains separate CRUD. The E22 handler and
selection observer remain only as product-banned probe support.

The brief's §6 matrix was run in order. Full detail, verbatim operator reports and
the three harness lags that had to be fixed first are in
[E22](../../evidence/experiments/e22-group-editing-action-does-not-fire-reliably-backgrounded.md).

| row | result | note |
|---|---|---|
| COLD | miss, 5103 ms | lifecycle clears it, as E22 A1/C2 |
| PRIME | wrap, 145 ms | exact child by collapse oracle |
| WARM | wrap, 145 ms | new target, no human action |
| WARM +deep | wrap, 249 ms | ⚠ added control: the 14-row cursor sweep is NOT a destroyer |
| CLIP | **miss**, 5025 ms | target's own empty slot; mixer row never left the target |
| DEVICE | ⚠⚠ **misdispatch**, 5017 ms | Instrument Layer built around the device; no track group |
| CHAIN | **miss**, 5036 ms | clean, no delta at any level |
| PROJECT-TAB | **miss**, 5114 ms | second project was already open and operator-approved |
| recovery ×4 | wrap, 145/142/137/145 ms | the channel was alive throughout |

Not run, deliberately: **RELOAD** (its purpose was the boundary beyond a restart;
four destroyers were found inside an untouched session first, so it changes no
decision) and **`clip-other`** (it existed to disambiguate a *wrapping* CLIP row;
CLIP missed with the mixer row provably pinned to the target, so focus was already
isolated from track selection).

⚠ The harness gained `WRITE_settleOn`, a verified per-track deep read, and a
guarded `rescue` mode. §5's shape is otherwise as briefed. One arm's cleanup
refused by design after a false reading and was recovered under the collapse
oracle with no collateral.

---

# E22 — how durable is the human track-Editing latch?

## 0. Next-session objective

Determine whether Bitwig's track-level Editing action `Group` has:

1. a **one-time latch** that a single human track-header click establishes for
   the rest of a Bitwig/project session, or
2. a **focus-target dependency** that normal work in the clip launcher, device
   panel, chain lanes, or another project can displace.

This distinction decides whether Phase 3f may reasonably require one operator
prime per Bitwig session. Do not make that product decision from E22's present
evidence: the latch is known to survive probe cleanup and a later API selection
of a different track, but it has not been challenged by intervening human UI
work.

The matrix is an investigation only. Do not weaken structural readback, encode a
speculative focus action, or expose a human precondition on the product surface.

## 1. Read first

Read in this order:

1. [E22](../../evidence/experiments/e22-group-editing-action-does-not-fire-reliably-backgrounded.md)
   — authoritative cold/prime/persistence results and cleanup record.
2. `brain/src/probes/e22-group-state.ts` — the existing narrow A/B/C harness.
3. `context/archive/spike/HANDOFF-E18-BRANCH-UNLOCK.md` §1, especially
   **Session-state preconditions** — prior destruction results for chain-level
   named actions.
4. [E17](../../evidence/experiments/e17-device-layers-a-chain-can-be-created-and-soloed-and-never-grown-.md)
   — chain focus, cross-track destruction, project-reload destruction, and
   foreground-gated device-panel actions.
5. [E16j](../../evidence/experiments/e16j-e6-is-wrong-named-actions-fire-backgrounded-and-one-of-them-crea.md)
   and [E16k](../../evidence/experiments/e16k-a-group-is-a-usable-branch-container-the-collapse-primitive-work.md)
   — exact-track wrap and collapse-oracle proof.
6. [Session 3f](3f-fork-chain.md), [NOW](../../NOW.md), and
   [D13](../../decisions/d13-there-is-no-escape-hatch-settled-2026-07-19-e6.md).

Relevant implementation:

- `brain/src/probes/e22-group-state.ts`
- `brain/src/probes/phase3f-production.ts`
- `brain/src/adapters/live/adapter.ts`
- `brain/src/surface/report.ts`
- `extension/src/main/java/com/ghostnote/extension/handlers/BranchHandlers.java`
- `extension/src/main/java/com/ghostnote/extension/handlers/CursorHandlers.java`

## 2. Ground truth already established — do not re-litigate

### Track-level `Group`

Two clean Bitwig lifecycle arms on 2026-08-11 established:

| row | condition | result |
|---|---|---|
| A1 | fresh Bitwig, project reopened, no human click | miss after 5037 ms |
| B1 | human clicked disposable track header | exact wrap in 144 ms |
| C2 | second fresh Bitwig; `focus_track_header_area`, no human click | miss after 5117 ms |
| B2/B3 | human clicked disposable track header | exact wraps in 144/142 ms |
| A2 | no new click/focus; different API-selected disposable target | exact wrap in 144 ms |

Every row passed the same bank-row, cursor-target, and mixer-selected-row identity
guards. Every positive used the collapse oracle to identify the exact child.
Every row returned `gn-scale-test` to 12 visible identities, 10 scenes, stopped
transport, and pre-existing `Group 7` collapsed.

Therefore:

- a human track-header click establishes invisible Editing context;
- the controller cannot establish it with `focus_track_header_area`;
- the controller cannot observe it through the available selection observers;
- the latch survives cleanup and API selection of a different track;
- a full Bitwig restart clears it;
- survival across ordinary human UI interactions is **unmeasured**.

E16j's four background and one minimized positives are consistent with an already
primed sitting. Foreground is not required once this track latch is warm.

### Prior art shows more than one focus regime

- Project actions such as `Create Scene`, `Create Instrument Track`, and
  `Create Group Track` have fired without a measured latch.
- Chain-level named actions require a human click in the chain lane. Their latch
  survives same-track controller calls and repeated targets, but a cross-track
  `cursor.pointTrack` and project reload destroy it. A track-header click can
  redirect `Delete` to the track rather than the chain.
- Device-panel named `Group` has a **live foreground-at-invocation** requirement;
  it is not a once-per-session latch.
- Typed API operations have no measured UI-focus, foreground, or priming
  dependency.

Do not generalize one regime to another. The present matrix is specifically for
the track-level `Group` latch.

## 3. Workspace and live-state warning

The working tree contains a large coherent, uncommitted Phase 3f slice plus E22
diagnostic/probe work. Preserve it. Do not reset, clean, discard, or overwrite
unrelated changes. At the start of the fresh Codex session, run `git status
--short` and treat every listed change as existing user work.

Known additions include:

- the Phase 3f track-fork contract, live/fake adapter, engine, surface, wire, and
  extension changes;
- `brain/src/probes/phase3f-production.ts`;
- `brain/src/probes/e22-group-state.ts` and `probe:e22`;
- E22 evidence and documentation;
- `WriteEffectUnobservedError` and its corrected post-send surface report.

> ⚠ **This inventory is spent (2026-08-14).** It described the worktree the
> experiment ran against. Per the disposition above, everything grouped-fork in it
> was removed, `phase3f-production.ts` and `WriteEffectUnobservedError` included;
> the typed duplication and readback pieces were kept and reshaped toward
> `copy_track`. Only `probe:e22` and this document survive as written. Do not read
> the list as a description of the current tree.

The last offline verification was `npm run check` at 355/355, extension
`./gradlew test` green, and `git diff --check` green. The wire handshake was 143
methods, hash `4c4d687667d4804b`.

There is a local `BranchHandlers.groupTrack` source refinement that moves the
before-identity scan ahead of the final cursor/mixer checks. It was deliberately
not needed for the E22 matrix and may not be deployed in the currently running
Bitwig extension. **Do not deploy or reload the extension before the first cold
arm unless the fresh session first proves the deployed/golden handshake is
wrong.** A controller reload is not a clean Bitwig lifecycle boundary and a
deployment would add an unnecessary variable.

At this handoff, the open Bitwig process is already human-primed by B2/B3 and A2,
although the project itself is back at its clean 12-track/10-scene baseline. A
fresh Codex chat does not clear that Bitwig state.

## 4. Begin the fresh session exactly this way

1. Read this handoff and E22, then inspect `git status --short` before editing.
2. Tell the operator the experiment needs one real cold lifecycle arm.
3. Have the operator save as needed, fully quit Bitwig, relaunch it, and reopen
   `gn-scale-test`.
4. After reopening, the operator must make **no clicks in Bitwig** until the cold
   row completes. Clicking Codex/terminal outside Bitwig is fine; E22 already
   disproved a simple foreground requirement for this action.
5. Run `npm run probe:hello` as the first controller contact. Confirm Bitwig
   6.0.6/API 25, 143 methods/hash `4c4d687667d4804b`, project `gn-scale-test`, 12
   visible identities, 10 scenes, stopped transport, and full bank visibility.
6. Do not run E16/E17 or other named-action probes first. Setup poisoning is part
   of the phenomenon.
7. Extend the narrow E22 harness before the first destructive-focus arm, but do
   not deploy extension code unless an actually required method is absent.

Coordinate every human click explicitly. The probe should display the unique
fixture name and a countdown, as mode B already does. Never ask the operator to
guess which row or device to click.

## 5. Harness shape and safety boundary

Reuse `e22-group-state.ts`; do not turn E16j into a large mixed-action probe.
Extend it with named, single-purpose modes so each process invocation performs
one scored arm and exact cleanup.

For every arm:

1. Refuse if transport is rolling, the full track bank is not visible, or the
   baseline differs unexpectedly.
2. Snapshot all visible track `channelId`s, scenes, group expansion states, and
   current layout.
3. Create a uniquely named disposable **target track** for the attempted track
   wrap.
4. When the destructor needs a clip, device, container, or chain, create a
   separate uniquely named **sacrificial fixture**, owned wholly by the probe.
5. Snapshot the sacrificial fixture deeply enough to detect every plausible
   alternate dispatch: track identities/parentage, clip identities/content,
   devices, containers, and chains as applicable.
6. Explicitly unpin and point the track cursor once at the disposable target.
7. Immediately before fire, prove bank row, cursor target, mixer-selected row,
   and revision in the same callback. Nothing selection-changing runs after
   those checks.
8. Invoke `Group` once. Never score `Action.invoke()`'s return.
9. Diff **all plausible structural levels**, not only tracks. Wrong focus can
   redirect a named action instead of producing a harmless miss.
10. If a new track group appears, use the collapse oracle to prove its exact
    child.
11. Clean only identities the probe created. Refuse cleanup if the action touched
    any pre-existing identity or wrapped/deleted anything outside the fixtures.
12. Restore every pre-existing group expansion state and prove the exact baseline
    before exiting.

Log the exact ordered READ/WRITE RPC sequence and timings. One variable per row;
no retries or opportunistic focus calls within a scored arm.

## 6. Destruction matrix

Run the rows in order. Stop immediately on unexpected mutation outside the
disposable fixtures.

| row | human/UI action before measured sequence | expected evidence | question |
|---|---|---|---|
| COLD | none after full restart/project reopen | track `Group` misses; no structural delta anywhere | did the lifecycle clear the latch? |
| PRIME | click the uniquely named disposable target's **track header** | exact target is wrapped | can this fresh sitting still be primed? |
| WARM | no further human action; use a different target | exact target is wrapped | reproduce persistence before challenging it |
| CLIP | re-prime on a disposable track header, then click an empty disposable launcher slot | score track wrap and diff clip/track state | does clip-launcher focus displace or redirect it? |
| DEVICE | re-prime, then click a disposable device header in a sacrificial track | score track wrap and diff full disposable device topology | does device-panel focus displace or redirect it? |
| CHAIN | re-prime, then click a disposable chain lane inside a sacrificial container | score track wrap and diff track/device/chain topology | does chain focus displace or redirect it? |
| PROJECT-TAB | re-prime, switch to another already-safe/disposable project tab and back without reload | score track wrap and diff both projects | is the latch project-tab scoped? |
| RELOAD | only if still useful: re-prime, save if required, reload `gn-scale-test`, then no click | track `Group` should miss if E17's boundary generalizes | is project reload a destructor? |

For CLIP, DEVICE, CHAIN, and PROJECT-TAB, pair the scored arm with a subsequent
**recovery control** in a separate invocation: human-click the new disposable
target's track header and require an exact wrap. This proves that a miss was
focus-state-sensitive rather than a broken action channel or harness. The
recovery click also establishes a known warm start for the next row.

Interpretation:

- If every row through PROJECT-TAB remains an exact track wrap, the evidence
  supports a durable once-per-Bitwig-session latch. Still state the measured
  boundaries rather than claiming immortality.
- If a row misses but no alternate structure changes, that interaction destroys
  or supersedes the track latch.
- If another structural level changes, the interaction redirected `Group`; this
  is stronger evidence against a one-time product prompt because it creates a
  misdispatch hazard.
- If recovery also misses, stop. Re-establish a clean sibling control before
  interpreting the destructor row.

The PROJECT-TAB row requires an operator-approved safe second project. Do not
silently create, save, close, or repurpose one. If none is already available,
defer that row and record why; CLIP/DEVICE/CHAIN still answer the normal-work
question well enough to guide the product decision.

## 7. Decision gate

After the matrix, update E22, NOW, Session 3f, D13, and this handoff with the exact
destruction boundaries and cleanup record.

Return the product decision to the operator with one of these measured shapes:

- **Durable session latch:** one human track-header prime survived all tested
  normal UI focus moves and only restart/reload cleared it. A once-per-session
  prompt is a plausible operational contract, subject to explicit operator
  acceptance.
- **Scoped/fragile latch:** one or more normal focus moves caused a miss. A
  once-per-session prompt is insufficient; a just-in-time prompt or deferral is
  required.
- **Misdispatch hazard:** another structure changed. Do not ship automatic
  track `Group` behind a mere prompt without a stronger interlock.

No result makes the latch controller-observable. Even in the durable case,
production must fail closed on structural readback and must never infer that a
past click occurred.

## 8. Work deliberately deferred

- Do not begin the nested layer-chain address while this matrix is active.
- Do not replace `Group` with `Create Group Track` plus move/copy; E16k measured
  those insertion routes as silent no-ops.
- Do not re-open the broad E6 foreground theory. Track `Group`, chain actions,
  and device-panel actions have different measured regimes.
- Do not commit, deploy, or productize the human precondition merely to complete
  this experiment.
