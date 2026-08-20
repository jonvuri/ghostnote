---
id: E48
kind: evidence
state: active
source: phase-2-session-2j
---

# E48 — Second musical dogfood passes with measured operation latency [K] (2026-08-20)

**Verdict: the second natural task created an accepted track copy with two
verified F Dorian chord progressions. Background status now reports operation
wall-clock time. Exact guarded clip work remains slow, but it no longer blocks
one MCP request or hides completion.**

## Natural task

The operator asked to duplicate `Harmony` in project `26.05-2 moon`. They asked
for two clips on the copy. Each clip had to contain a different minor chord
progression in the same key as `Lead`, with complex open voicings.

The source Lead phrase uses F, C, G, and D. F is its repeated center. The agent
interpreted this sparse set as F Dorian because that mode keeps every observed
pitch and supplies the requested minor color. The task used the ordinary MCP
surface. It did not use the conformance fixture or direct DAW editing.

## Accepted public result

`copy_track` created `Harmony – Open Minor` with a fresh durable id. The copy
kept the source track content and device state. Two empty 32-beat clips were
created in zero-based rows 5 and 6. One background generation wrote:

- Row 5: Fm9, Gm11, Ebmaj9, and Cm11.
- Row 6: Fm11, Abmaj9, Bb13, and Ebmaj9.

The voicings contain five or six notes over wide pitch spans. Each chord lasts
7.5 beats in an 8-beat region. Independent `read_clip` calls returned 21 and 22
notes. The generation result had no warning, difference, disagreement, or
unverified target. `show_changed_clip` opened row 5. The operator auditioned the
result and kept it.

The project observation record identifies `ghostnote-description-v4`. It links
one accepted instruction to the confirmed `copy_track` result and the confirmed
two-output `generate_clip_music` result.

## Wall-clock measurement

Operation status now includes `elapsedMs`. It starts at acceptance, grows in
active states, and freezes when the operation becomes terminal. The existing
epoch timestamps remain. The v4 description identity marks this returned status
shape change. The v1 through v3 artifacts stay frozen.

The cleanup-safe 2x live path first measured 10,621 ms from acceptance to
terminal completion. The polling client observed 10,807 ms. Preflight
cancellation reached terminal in 45 ms.

The accepted 2j task measured:

| Work | Wall-clock time |
|---|---:|
| Copy and name the Harmony track | 1,956 ms |
| Create two empty 32-beat clips | 13,436 ms |
| Return the background operation id | 5 ms |
| Background operation, server | 34,470 ms |
| Background operation, polling client | 34,569 ms |
| Independent read of row 5 | 5,293 ms |
| Independent read of row 6 | 5,371 ms |

The measured post-key subtotal was 60,630 ms. This excludes observation-record
and navigation calls. Server and client operation measurements differed by 99
ms, which is less than the 250 ms polling interval.

## Dogfood comparison

The first task used `copy_clip_down` six times, exact note writes six times, and
six final independent reads. It kept subtle variations of the two source clips.
It used description v2. Two attempts were vetoed, one request timed out, and
three correctness defects needed focused repair.

The second task used one ordinary track copy, one two-clip creation call, one
background musical operation, and two final independent reads. It created new
harmonic material on a copied track. It used description v4. No call refused,
no result mismatched, and the first result was accepted.

Both tasks produced useful content that the operator kept. Both show that exact
long-clip reads and verification are slow. Session 2x already removed the unsafe
blocking behavior. Session 2j adds direct batch timing because the remaining
delay repeated. The two records do not repeat a wording, public granularity,
tool-choice, refusal, reversal, or musical-usefulness problem. No further public
surface revision is justified from these two uses.

The 2j musical write and clip creation are stash-backed and exact-reversible
while this session owns their results. Track copying states a separate limit:
automatic reversal does not remove the copied track. `delete_track` is the
directed cleanup path. The operator kept the track, so no reversal ran.

## Verification

- Focused operation, surface, and description tests pass 15/15.
- Full offline check passes 646/646, including typecheck.
- The extension test build passes. No extension or wire source changed.
- The live handshake passes with the 139-method golden and deployment-age check.
- The cleanup-safe timing path passes and restores its exact entry state.
- The ordinary-MCP dogfood task passes with exact readback and an accepted v4
  observation.
- The context check and `git diff --check` pass.

## Retrospective

Record server and polling-client time separately. The difference makes polling
delay visible without attributing it to project work.
