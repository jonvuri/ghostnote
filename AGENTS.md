# Repository instructions

Write clear, concise technical prose suited to the reader. Use precise terminology and sentence structure that makes relationships easy to follow; do not sacrifice meaning or natural phrasing to simplify individual words or sentences. Improve unclear prose where you make a change.

## Work

Start with `context/NOW.md`, the requested or next backlog item, and its brief
if needed. Read sources relevant to the change. Use a brief for substantial
scope, unresolved choices, or a handoff; a small change needs no separate plan.
Do the work and verify the changed behavior. Documentation needs link and diff
checks; offline behavior needs relevant tests; host behavior needs a focused
live check. Broaden checks for shared changes or unresolved risks.

Update facts and backlog status that changed. Record useful results once; a
brief or the review summary can suffice. Use E records for durable measurements
that need citation or reproduction, and D records for durable design decisions.
Keep earlier E/D records unchanged. Stage only the task changes; do not commit.
Report results, verification, and a suggested commit message. For reviews,
inspect the diff and relevant state; report findings without unsolicited fixes.

## Live work

State operator actions directly. Explain scope and material risk when consent
is needed; accept ordinary approval, retain the actual reply, and carry it
forward within scope ([D53](context/decisions/d53-ordinary-operator-consent.md)).

Deploy from `extension/`: `./gradlew copyExtension` for `ghostnote`, or
`./gradlew copyProbeExtension` for `ghostnote probe`. They overwrite the same
archive. Controller replacement in Bitwig Settings is operator-only. Tell the
operator when replacement is needed and which product to load; leave the
procedure to them. Wait for confirmation, then run
`npm run probe:hello` from `brain/`. Check profile, method count/hash, fresh
initialization time, and deliberate build markers before live work.

Before a write, check project, target, selection, and competing session probe
drivers or Ghostnote clients. Use one foreground driver chain and one live
writer. Leave unrelated processes alone. Keep input validation, ownership,
freshness, selection protection, and D52 Grid admission. D15 requires independent
post-write readback; a writer echo is insufficient. Inspect uncertain effects
before further work; do not automatically repeat the write. Native research
writes retain their lock and uncertain-state latch.

Remove owned scratch objects and check preserved state. Restore exact files
when testing saved-fixture persistence or promising exact file preservation.
Claims expire across server sessions, threads, or resumes. The normal profile
has no `transport.stop`; the operator stops playback after a launch.

## Implementation policy

[D54](context/decisions/d54-recovery-is-not-a-prerequisite-for-requested-edits.md)
replaces blanket reversal and exact-recovery requirements. Preserve correct
effects and truthful partial results, including preservation of unrelated state.
Assess costly checks by their purpose and evidence; existing prescriptions are
not a reason to retain redundant work. Change public behavior and its
tests/descriptions together. D15 amendments identify the claim and retained
evidence; broad proof can stay in regression or upgrade tests.

For changed live costs, use the relevant [ledger rows](context/contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md)
and call-budget tests. For tool changes, follow [tool maintenance](context/README.md#tool-maintenance).
