---
title: E342 — Grid doctor passes on 6.1.4
kind: evidence
state: active
updated: 2026-10-23
owner: phase-9b
---

# E342 — Grid doctor passes on 6.1.4

## Result

The one authorized third pass completes 9b.6j. All three cases, 76 member
roles, 16 native commands, 19 independent readback pairs, both Undo stages,
edit counters, scratch teardown, and preserved-state checks pass.
The corrected disposal guard accepts 77 owned objects, one managed node,
and depth five. No command is repeated.

The [accepted record](../data/phase9b-doctor/614-third-pass/live-v21-third-pass/accepted.json)
is byte-equal to the local 6.1.4 cache. Completion:
`2026-10-23T15:16:44.598Z`. [E316](e316-grid-doctor-606-acceptance.md)
and this result close step 2 with explicit passes on 6.0.6 and 6.1.4.
Acceptance covers the fixed research fixtures and exact fingerprints.
Product cache enforcement remains in 9b.7.

Evidence: [`614-third-pass/`](../data/phase9b-doctor/614-third-pass/).
Preparation: [E341](e341-grid-doctor-614-owned-tree-preparation.md).
Admission policy: [D52](../../decisions/d52-grid-upgrade-admission-policy.md).

## Preconditions and authorization

The operator confirms controller replacement. Hello passes with profile
`phase-8-probe-v1`, 118 methods, hash `2e939035ea90b8b0`, marker
`9b-grid-doctor-v21` on the direct handlers, and fresh initialization
`2026-10-23T15:09:24.138Z`. The 39-call baseline check agrees with the
pre-deployment baseline. A two-call metadata check confirms 36 owned
classes, 76 members, and the new guard hash. These checks are under
[`614-census/`](../data/phase9b-doctor/614-census/).

Deployed archive: `e9a31bb89c0fd050b38696256199fa04e0e533361ed6b08cc8fb28c8502592a4`.
Guard hash: `d14cf2f564cc5b2b534bef726dce9b4c5e8e03db0cdabe4a52431c88be3cf819`.
Jar fingerprint:
`5c2b1895bbb9e7d08d9216de421985bb1f24b2ee62762c9451b4fe847df2469f:35778607:1790948299000000000`.

The operator asks for direct instructions and ordinary consent, then replies
"Saved, go ahead" after being told to save and stop playback. The reply and
scope are preserved in
[`operator-authorization.json`](../data/phase9b-doctor/614-third-pass/operator-authorization.json).
The driver receives the internal third-pass token. That token is not a
verbatim operator answer. The attempt record remains unchanged.

No competing driver or established bridge client is found. The driver
checks the project, target, selection, and guards before writes. It keeps
the seven earlier 6.1.4 records and three 6.0.6 records byte-equal to their
committed copies, then creates one separate third-pass record.

## Live result and final state

| Case | Result |
| --- | --- |
| Boolean | Enable and restore pass with three independent pairs. |
| Mapping | Removal and restoration pass with three pairs and the expected new mapping identities. |
| Core | Value and cable changes restore; detached factory and disposal pass; connected delete and document Undo pass; attachment and Undo pass; final edit-counter checks pass. Thirteen independent pairs agree. |
| Teardown | All three scratch tracks are removed. Both control reads pass. Tracks, mixer, complete device banks, and selection equal entry state. |

The [capture check](../data/phase9b-doctor/614-third-pass/capture-validation.json)
rechecks all 19 pairs, 76 unique roles, 16 passing entry guards, and entry/exit
equality. The separate seven-call
[final read](../data/phase9b-doctor/614-third-pass/final-read-only.json)
confirms `gn-grid-spike` with only `grid-probe`, `FX 1`, and `Master`.
The mixer and normalized selection equal entry state. The control track is
muted at -10 dB. No claim is bound, busy, locked, unfinished, failed, or
foreign-owned. Doctor phase is 3, used and released.

The [final socket check](../data/phase9b-doctor/614-third-pass/final-sockets.txt)
shows only the Bitwig listener. The attempt directory holds eight 6.1.4
attempt records and one acceptance cache. Preserve all of them.
The [entry-file check](../data/phase9b-doctor/614-third-pass/preservation.json)
finds 223 of 224 files unchanged; only the archive deployed in E341 differs.
No saved-file identity or exact saved-project preservation claim is made.

## Measurements

The driver sends 543 calls with 14,989.423 ms summed wire time. The durable
attempt-to-cache interval is 16,255 ms. It uses 57 doctor document tasks:
16 commands, 38 reads, and three binds. Document work totals 305.507 ms
(E316: 229.244 ms). Maximum command task time is 37.238 ms; maximum command
queue time is 0.181 ms. Whole-JVM heap samples peak at 685,768,704 bytes.
These samples do not measure retained allocation or process RSS.

Per-command samples, one each:

| Command | 6.1.4 ms | E316 ms | Change | E339 ms | E340 ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| boolean-enable | 1.896 | 1.262 | +50.3% | 1.593 | 2.044 |
| boolean-restore | 0.294 | 0.256 | +14.8% | 0.237 | 0.242 |
| mapping-remove | 10.509 | 19.897 | -47.2% | 4.078 | 13.952 |
| mapping-restore | 9.682 | 12.892 | -24.9% | — | 19.540 |
| value-set | 3.207 | 3.122 | +2.7% | — | 2.506 |
| value-restore | 1.113 | 0.642 | +73.3% | — | 1.385 |
| cable-connect | 6.306 | 3.419 | +84.5% | — | 4.787 |
| cable-disconnect | 4.197 | 1.311 | +220.2% | — | 1.205 |
| factory-create | 1.665 | 2.655 | -37.3% | — | 1.793 |
| factory-dispose | 0.678 | 0.550 | +23.2% | — | — |
| delete-connect | 4.959 | 1.709 | +190.2% | — | — |
| delete | 17.831 | 6.297 | +183.2% | — | — |
| undo-delete | 8.764 | 3.984 | +120.0% | — | — |
| delete-disconnect | 4.393 | 1.637 | +168.4% | — | — |
| attach | 29.850 | 21.660 | +37.8% | — | — |
| undo-attach | 0.729 | 1.039 | -29.9% | — | — |

Ten samples exceed E316 by more than 20 percent. Two exceed E339 and four
exceed E340. The full [comparison](../data/phase9b-doctor/614-third-pass/live-v21-third-pass/timing-comparison.json)
records all percentages. The cause of the increases is not established;
bytecode changes, guard work, host state, and timing noise are not separated.
The single-pass research acceptance follows D52. It makes no stable latency
claim and does not authorize timing repeats. All admitted bounds hold.

The first entry guard takes 1.076 ms; later entry guards take 0.013–0.071 ms.
Disposal takes 0.678 ms natively (E316: 0.550 ms, +23.2 percent); its complete
document task takes 3.192 ms. The owned-tree pass is inside that task but
outside the native timer and entry-field `guardNanos`. There is no separate
owned-tree timing sample. Guard metadata validation before the pass takes
1.363 ms. No product call budget or public description changes.

## Consent procedure correction

The exact-phrase requirement came from the driver procedure, not D52.
Commit `f61fe15f` added the exact-string README instruction. Commit
`b7788bff` called the second-pass token the operator's exact answer.
The 9b.6j preparation and agent prompt propagated that requirement.
[D53](../../decisions/d53-ordinary-operator-consent.md) records the correction.

`AGENTS.md` and the README now require direct instructions and accept
ordinary approval. Driver tokens stay internal. The optional
`--operator-reply` argument preserves the actual answer without a prescribed
phrase or an automatic permission classifier. Old evidence and attempt
records are unchanged. This is a CLI and documentation change; it adds no
host call and requires no extension deployment.

## Verification and limits

- E341's Java checks and 135-check doctor harness pass. Its Python tests
  and full 2,468-test TypeScript suite pass.
- After the consent correction, typecheck and 22 focused driver/baseline
  tests pass. The ordinary-reply test covers free wording, record retention,
  missing values, duplicates, and the 4 KiB input limit.
- Changed-document links and frontmatter are checked at closeout. The full
  context check retains 18 pre-existing missing-frontmatter errors.
- No product cache enforcement, unrestricted Grid write support, or stable
  performance bound follows. E310's breadth limits remain. Do not rerun the
  accepted doctor. Continue with the planned 9b.7 tool work.

## Retrospective

An internal scope token became a required operator sentence through README
instructions and record comments. Keep machine tokens and actual replies
separate. Put required operator actions in plain instructions, then ask one
short consent question when authorization is needed.
