---
title: Phase 8i0 clip metadata and colour tolerance
kind: plan
state: done
status: Complete (E249, D42). Property writes own their changed fields; any RGB is verified within one byte.
updated: 2026-10-08
parent: README.md
prev: 8h4g-performance-review-and-closeout.md
next: 8i-agent-native-hybrid-dogfood.md
evidence: E43, E83, E247, E248, E249; D15, D38, D40, D42
---

# Phase 8i0 clip metadata and colour tolerance

**Complete.** [E249](../../evidence/experiments/e249-clip-metadata-and-colour-tolerance.md)
records the implementation and the live checks;
[D42](../../decisions/d42-clip-colour-tolerance-and-metadata-ownership.md)
records the policy. The live sample found one more host rule: Bitwig makes a
colour below about CIE L* 33 lighter. The tool reports that as a difference.

Allow small RGB conversion differences and write only the clip properties that
must change. A rename or length edit must not need a palette selection first.
Complete this bounded repair before more 8i dogfood trials.

## Cause and policy

The IcyShellStab01 dogfood trial in project "ice jungle" passed after a colour
change. Its first extension preview refused with `unsupported`, reason
`clip-colour`. The agent had copied the source to an empty slot. The duplicate
kept a colour outside Ghostnote's exact table. Recovery took about 34 seconds.
The source session is `01a11a1e-987d-7a42-a5e1-1b27a4860a96` (2026-10-08).
The operator accepted the final musical revision. Preserve both retained clips.

[E83](../../evidence/experiments/e83-exact-clip-color-palette-is-live.md)
proved small RGB conversion differences. Ghostnote responded with a 27-colour
table and a refusal for unsupported prior colours. That policy is too strict
for musical work. The operator now accepts small colour differences.

Use a tolerance of one byte per RGB component for an explicit colour write or
restore. Accept arbitrary integer RGB triples in 0..255. Keep the actual
readback as the observed state. Do not call approximate RGB values exact.
An accepted one-byte difference needs no operator action or warning.
Report a larger difference as a colour discrepancy. Do not retry colour writes
to chase byte equality, or make a musical edit depend on palette membership.

This tolerance belongs only to colour write verification and restoration.
Snapshot hashes, identity, and stale-state checks still use observed values.
A later colour change by a person must not be hidden by the tolerance.

## Entry reads

- The [performance ledger](../../contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md),
  E83, and [E43](../../evidence/experiments/e43-clip-metadata-and-duplication-routes.md).
- `brain/src/bindings/launcher-clip-edit.ts`: `completeClipProperties` and
  `plannedMetadata`; `brain/src/surface/agent-native-clips.ts` property writes.
- `brain/src/contract/clip-color.ts` and `ops.ts`; the live encoder and
  `CursorHandlers.cursorSetClipMetadata`.
- The executor's colour guards and metadata comparison; write sets, fidelity,
  reversal planning, and checks for concurrent edits.
- The matching fake adapter, binding, engine, wire, and surface tests.

## Work

1. Carry the changed metadata fields from the planner through the operation,
   encoder, host handler, verification, and reversal. Keep a complete candidate
   for validation and observation. Emit setters only for changed fields and
   required dependencies. Keep legacy complete-operation callers valid.
2. Handle marker dependencies as one group. E43 shows that a loop-start write
   can move play markers. Preserve play start when that write needs it. Keep
   the existing rule that loop end follows loop start plus length. A name-only
   or colour-only edit must call no loop or play-marker setter.
3. Remove palette membership as a normal-profile write or reversal condition.
   Use a bounded RGB encoding without retries. The measured table can remain
   as an exact encoding for known colours; it must not limit accepted input.
   Verify the one-byte tolerance with a live sample across the byte range.
4. Make reversal restore only the fields the change owned, including required
   marker dependencies. Compare owned fields with their observed post-write
   values. Preserve later changes to unrelated fields. Keep existing refusal
   behavior when an owned field or target changed. Also cover complete
   restoration after clip deletion, where all metadata is owned.
5. Update the host binding, migration and verification contract, tool
   descriptions, and public artifacts. Bump `TOOL_DESCRIPTION_VERSION` from
   v33 and report the new version. Keep the portable Document 1.0 grammar and
   the frozen `stable-v1` public contract. Check shared internal changes against
   the stable rollback path.

## Cost model

The scaling quantities stay the clip's captured notes and sounding cells.
The metadata field count is bounded. RGB conversion is constant work.

| Case | Host work | Expected cost and heap |
|---|---|---|
| Name, colour, or length edit on a typical 256-note clip | Existing preflight and independent readback; up to 3 cold captures; 1 metadata frame and write stage; no added turns | Compare with `set_launcher_clip_properties`, 1,447 ms (E247). About 190 ms per capture and 24 ms per sequential turn. No new cursor, observer bank, or retained clip copy |
| Metadata edit at the reader limit | Same bounded frame and stage count; up to 3 captures, about 970 ms each at 16,384 notes | Capture and projection dominate. Compare with the E247 reader limit measurements. Heap remains bounded by the existing reader; no extra resident allocation |
| Extend a duplicate and insert notes, as in the dogfood trial | Existing metadata stage plus the existing targeted note stages and independent verification | Dogfood edit: 2,190 ms for 153 inserts. Keep the same writer page checks and property stages. Compare with E248's 1.8 s read plus 16-note insert and 6.6 s largest whole-clip edit |
| Reverse one metadata change | Existing guarded read and one metadata stage; restore only owned fields | No added cold read or sequential turn. Colour tolerance adds no host work |

Batch dependent marker setters in one wire frame. Retain current settlement
and proof requirements. Update call-budget tests and the ledger for deliberate
changes. Record and explain any regression above 20 percent. The intended
user benefit is removal of palette recovery, not a claim of faster captures.

## Verification and acceptance

- Arbitrary RGB requests, including the E83 failed tuple `[145,105,78]`,
  endpoints, mixed components, and an ordinary default clip colour, pass
  without palette selection. Invalid RGB input still refuses before mutation.
- An owned clip with an unsupported prior colour can be renamed, extended,
  edited, and reversed. A call that does not change colour emits no colour
  setter and keeps its observed colour exactly.
- Name-only and colour-only calls emit no marker setters. Length and loop-start
  cases preserve required marker state. Test combined edits and repeated
  updates to one clip in one batch.
- Within-tolerance RGB readback passes. Larger differences remain visible.
  Store actual readback for later guards, so repeated reversal does not compound
  a conversion error or mistake requested values for observed values.
- A metadata reversal preserves a later edit to an unowned field. A later
  edit to an owned field still receives the existing conflict handling.
- Cover clip-delete restoration and stable complete-operation callers.
- Run focused binding, contract, encoder, fake/live adapter, executor,
  reversal, surface, and call-budget tests. Then run `npm run check` in
  `brain/`, extension checks, wire goldens, context check, and `git diff --check`.
- Measure the normal property path and the duplicate extension path live with
  wire sequences and wall times. Use an owned fixture, not the retained
  IcyShellStab01 clips. Start with its default or unsupported colour. Remove
  only the fixture and confirm the baseline after the trial.

Deploy with `./gradlew copyExtension` in `extension/`. The operator must fully
remove the controller and select the final matching `ghostnote` product in the
complete list. Wait for confirmation, then run `npm run probe:hello` in
`brain/`. Check profile, method count/hash, fresh initialization time, and a
deliberate build marker before live work. Do not replace controllers by
computer use. Deploy a probe build only if the live colour trial needs it;
restore and verify the normal build afterward.

## Records and handoff

Use E249 for the implementation evidence and D42 for the accepted colour
tolerance and metadata ownership policy, after checking those numbers are free.
Add their index rows. Amend current contracts that require exact palette
reversal; keep historical E83 measurements. Run
`check-publication-candidates.py --write` after reviewed contract changes.
Update the ledger and NOW, stage only session changes, and do not commit.
Then resume 8i with the retained musical trial as input.

Retrospective: apply exactness requirements to the value that matters. A
cosmetic conversion must not block an unrelated musical change. Test omitted
setters and field ownership through reversal, not only through forward writes.
