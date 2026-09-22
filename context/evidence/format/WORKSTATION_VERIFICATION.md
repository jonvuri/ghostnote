---
title: Workstation verification costs and operation rules
kind: reference
state: active
updated: 2026-09-22
scope: Phase 6j audit and Phase 7 verification rules
---

# Workstation verification costs

## Scope and classification

Use this reference with the [contracts](WORKSTATION_CONTRACTS.md),
[interface inventory](WORKSTATION_INTERFACES.md), and
[S01–S17 ledger](WORKSTATION_SEAMS.md). The audit changes no product guard,
provider, schema, or settlement budget. The
[6j outcome](../../archive/outcomes/PHASE-6J-VERIFICATION-COST-AUDIT.md) records
completion. [Reduction briefs](../../plan/phase-7/VERIFICATION_REDUCTIONS.md)
name the later work and its proof requirements.

- **Essential:** A stated defect or invariant requires the evidence. Its cost
  can still have an unknown duration.
- **Reducible:** Repeated work can use specified equivalent evidence. This is a
  candidate until the successor proves equivalence. No guard removal is approved.
- **Historical:** A benchmark control, diagnostic, or completed optimization.
  Do not charge its whole cost to each product request.
- **Unknown:** No applicable measurement or implementation exists. Never use zero.

A measured range describes one recorded workload. A configured deadline limits
acceptance; it is not necessarily a hard wall-time limit. A work bound gives
counts or required passes over a declared input. Keep these three forms separate.
Do not add nested timings, compare different workloads as one regression, or
subtract model latency from provider time to estimate format overhead.

## Host verification ledger

| Cost and class | Measurement or work bound | Required evidence and risk |
|---|---|---|
| Target acquisition — essential | E51: 240 ms for one historical exact read. E38: target replies 89–102 ms; dual-pin replies 67–74 ms. Current clip acquisition permits eight attempts, with a 25 ms first wait and 144 ms retries; bridge time is extra. | D6 and E38 separate a confirmed target from delayed pins. Track ID, row/scene epoch, cursor target, and both pins must agree. A display name or position alone cannot authorize a write. |
| Pre-write guards — essential | Input checks precede host work. Live revision, window, occupancy, route and fidelity checks are part of the pipeline; no isolated current wall-time sample exists. | D15 requires input validation before a deferred host exception can crash the host. D10 guards each stage. Complete source state, D8 fidelity, and protection must exist before a destructive clear. A source hash replaces none of these guards. |
| Planned settlement — essential | Current named waits: tick 24, cursor point 25, note write 25, grid/track structure 144, file insertion 268, parameter acquisition 194, device insertion 4,000 ms. Grid/page count multiplies the read cost below. | D9 and E15-D prove that early property reads lose writes. D10/E15-F require separate create/property turns and forbid property coalescing across clips. E53's eligible callback can wake a wait; it cannot prove success. |
| Complete note readback — essential | E52: 1,744 ms median at the old two-page coverage; E64: 1,638 ms. These are historical timing baselines. E119 bounds current fine-grid page work. E54 retains one final read per touched clip and one eligible settled retry. | D15 requires a different handle or a re-pointed handle. E54 compares all channels and catches foreign notes, missing notes, changed fields and host defaults. A receipt, context hash, or expected candidate is not observed state. |
| Scalar readback — essential, duplicate inventory already reduced | E61's direct scalar completion uses two equal target-bound callback replies. E78's four-scalar cohort used one preflight and one complete post-read: 4.383 s wall time, versus 33.3 s in its earlier workload. | Keep track, full route, parameter ID, observer generation and exact base value. E78 preserves one change record and reversal per scalar. Do not reintroduce a full inventory per scalar or replace the cohort post-read with unqualified echoes. |
| Recovery — essential when needed; not a normal-path tax | E97 measured 968–1,102 ms normal remote inventories and 2,111 ms with one stale generation. Workflow policy: 12,000 ms deadline, 250 ms retry, at most three observations. Adapter acquisition remains inside each read. | Late results cannot complete settlement. The deadline does not cancel an in-flight read. E54 permits one exact note verification retry, never mutation replay. A partial stage failure keeps known effects and remaining differences. An unknown effect needs reconciliation, not a blind retry. |
| Reversal preparation — essential for an owned write | The executor captures the write-set before apply. `planRevert` later reads the recorded target set and content delta before it plans a reversal. Isolated preparation time is unknown. E61's 16.023–16.712 s managed reversals are whole workflows, not preparation timings. | D5/D8 and the stash boundary require complete prior state, fidelity, ownership and a current boundary comparison. E109 caught omitted host defaults in a cleanup hash. A fresh digest alone does not prove ownership. Read-only analysis needs no stash or reversal plan. |
| Full-state scans — essential only within the required scope | One snapshot shares one complete note scan per clip across 16 channel addresses. E51 host scans used 757 ms in seven old pages. Full project time is unknown; it depends on occupied clips, extent, reader width and routes. | Complete clip state is necessary for clip-wide clear/replay, including notes outside the agent view. A full launcher/device matrix is not required for local file analysis or every scalar. Bank coverage and project detectors still apply to live reads. |
| Selection recovery — essential for borrowed UI state | E51 measured 47 ms selection restoration. E97 records a 4,000 ms/25 ms restoration policy. This is separate from content verification. | E99 checks and consumes the selection lease at the final write boundary. A user selection change invalidates restoration rights. A restore miss must not hide a completed content write. |

Sources: [D5](../../decisions/d5-checkpoints-are-branchable-takes-not-a-linear-undo-stack-settled.md),
[D6](../../decisions/d6-addressing-pinned-non-following-cursors-identity-never-index-set.md),
[D8](../../decisions/d8-checkpoint-fidelity-measured-settled-2026-07-25.md),
[D9](../../decisions/d9-grid-and-units-settled-2026-07-25.md),
[D10](../../decisions/d10-batch-execution-mechanics-settled-2026-07-25.md),
[D15](../../decisions/d15-verification-discipline-settled-2026-07-25.md),
[E38](../experiments/e38-pin-confirmation-polls-without-restarting-the-point.md),
[E51](../experiments/e51-bulk-clip-read-removes-channel-loop-but-misses-latency-gate.md),
[E52](../experiments/e52-dedicated-read-window-closes-the-exact-read-gate.md),
[E53](../experiments/e53-note-step-observer-is-a-partial-wake-hint.md),
[E54](../experiments/e54-clip-mutation-settlement-is-bounded.md),
[E61](../experiments/e61-device-observer-efficiency-unblocks-surface.md),
[E64](../experiments/e64-phase-4-closes-with-saved-device-baseline.md),
[E78](../experiments/e78-cohort-parameter-writes-are-live.md),
[E97](../experiments/e97-bounded-settlement-and-nested-colourcopy-reliability.md),
[E99](../experiments/e99-selection-borrowing-and-background-stability.md).
Current mechanics: [reader/guards](../../../brain/src/adapters/live/adapter.ts),
[budgets](../../../brain/src/contract/budgets.ts),
[executor](../../../brain/src/engine/executor.ts),
[reversal entry](../../../brain/src/surface/workspace.ts),
[stash boundary](../../../brain/src/stash/stash.ts), and
[settlement](../../../brain/src/engine/settlement.ts).

### Fine-grid and full-scan accounting

[E119](../experiments/e119-offline-verification-cost-audit.md) corrects the
current reading of E116. With the selected 2,048-step reader, 32 beats require
8 binary pages, 12 triplet pages and two resets. Scheduled waits alone total
3,168 ms. A 512-step reader needs 80 pages and two resets: 11,808 ms. Read the
advertised width; do not infer it from the writer width. The 128-beat default
reader also needs 80 pages. Current total live read latency is unknown.

For each occupied clip, count pages from its full observed extent and advertised
width. Sum those costs for a full scan; do not multiply by 16 channels because
one page returns them together. Empty-slot metadata and track/window scans are
separate. The historical seven-track, eight-row acceptance scan was a regression
baseline, not the default scope of a module request. Never call a bank-window
scan a complete project scan when the window does not cover the project.

The current musical planner reads a complete preflight, then the executor
captures its stash, then reads after apply. These reads have different authority.
The first two are a reduction candidate only under R1's shared freshness proof.
The last is independent post-write evidence and must remain. A later reversal
adds a fresh boundary read and its own guarded execution; it is not free.

## Provider and artifact measurements

| Source and scope | Recorded cost | Audit use |
|---|---|---|
| E103, three eight-beat master captures | Clip setup 416–545 ms; recorder active 47–49; playback 4,415–4,440; stop 143–148; file settle 102–103; analysis 56–88. After-setup totals 4,776–4,820 ms. | Capture duration is useful work. Stable one-file attribution is essential. Clip setup is fixture work. Embedded signal analysis is historical coupling; the product capture needs only identity/header validation. Hash/header cost is not isolated. |
| E104, offline document opens | Release notes with hash 0.5–0.9 ms; 62.3 MB guide with hash 27.8–32.5 ms. | Essential manifest and exact-byte checks at each offline open. Do not use the weaker Python probe loader as the product gate. |
| E104, 1,480-document corpus | Extraction 1,439.5–1,515.1 ms; FTS5 build 90.6–97.7; median routed query 0.404–0.439. | Extraction/build are source/index lifecycle work. Query time excludes those passes. Rejected LSA and repeated determinism runs are historical controls. |
| E122, installed 306-page API corpus | Source open/hash 66.687 ms; extraction 16.535; FTS5 build 28.145; cold index validation 10.006; cold query 0.478; warm index validation 8.449; warm query 0.444. | Product adapter timings for one machine. Source open is separate. Cold and warm inclusive requests were 61.184 and 15.542 ms. Index validation hashes stored rows and checks SQLite and FTS integrity. |
| E105, six-source audio cohort | FFmpeg version process 34.3 ms; warm full query 519.4–525.3. Librosa first useful run 4,238.9 ms; warm 482.1–483.9. | Provider compute is separate from byte verification and result translation. The values are cohort totals, not per-file costs. Optional librosa is not needed by the first 7d task. |
| E109/E110, symbolic cohorts | E109 exact Python analyzer 0.25–0.34 ms for six clips. E110 Music21 import 274.16 ms, warm supported tasks 19.77–29.41 ms. | These are probe/formula costs. They do not measure the planned TypeScript source canonicalizer or worker boundary. Import is startup, not every request. |
| E114, context prompts | Bar text 7,158 bytes versus 24,425 exact JSON; 3,828/4,625 input tokens across the two models. | Agent input cost, not parser/compiler CPU time. Full-state preservation stays outside the prompt. |
| E118, task-routed prompt | 38,195 bytes versus 84,373 raw-fact bytes; 10,254/13,002 input tokens. | Routing reduces unused evidence. It does not remove source, unit, formula, coverage, silence or comparison checks. Model response times do not bound sensory v1 translation. |
| E119, existing context functions | Measured JSON parse, validation, inclusive render/fingerprint and text-only hash for 3, 128 and 1,024 events. | Local bounded fixtures only. Parse → render → fingerprint performs three validations and two renders. R2 can share the checked result; exact-source hashing remains separate. |

Sources: [E103](../experiments/e103-master-recorder-produces-exact-project-local-wav.md),
[E104](../experiments/e104-exact-version-document-cache-and-routed-lexical-retrieval-pass.md),
[E105](../experiments/e105-ffmpeg-and-librosa-form-the-audio-fact-boundary.md),
[E109](../experiments/e109-exact-note-structure-is-the-semantic-boundary.md),
[E110](../experiments/e110-wider-symbolic-provider-survey-selects-music21-and-musicpy.md),
[E114](../experiments/e114-bar-context-and-guarded-note-patches-pass-two-models.md),
[E118](../experiments/e118-task-routed-sensory-packets-improve-bounded-decisions.md),
[E119](../experiments/e119-offline-verification-cost-audit.md).

## S01–S17 format costs

`V` is parse/schema/semantic validation. `C` is canonicalization. `H` is hashing
or fingerprint comparison. `P/T` is projection or field/unit translation. This
table accounts for each category separately from host work and provider compute.
A work bound states the necessary scope, not a measured runtime or a complexity
guarantee. Payload/operation limits for new modules must be set in Phase 7.
`None` means that the listed existing path does not perform that operation;
it does not mean that the entire seam costs zero.

| Seam / inventory | V | C | H | P/T | Class and evidence |
|---|---|---|---|---|---|
| S01 / I01–I03 | Each external request and typed operation; wire results at their adapter boundary | No global canonicalizer | Deployment method hash at handshake, not each payload | Encode each operation; beats/steps and gain scaling remain local | Essential: D15/D9 and existing surface/encoder fixtures. Wall cost unknown; work bounded by request/operation/frame counts. |
| S02 / I03–I05 | Complete addressed entries, receipt, channel/count/coverage checks | Order note scans per pitch/start | State comparisons, not an exact-source SHA-256 | Decode each note/property; reconcile two scans; record take once | Essential: E54 and D15. E51 reconciliation was below 1 ms in its old fixture; current phase time unknown. Work scales with returned entries and notes. |
| S03 / I04,I09 | Every clip, all 16 channels, optional fields, duplicate keys and finite numbers | Planned `exact-note-json-v0`: sort keys/clips/notes; ordered tuples stay ordered | One complete canonical payload in its named domain | Snapshot and guarded address → exact wrapper and alias map | Essential, implementation/time unknown. 7a must measure by notes/bytes; E109 is not this serializer. No numeric upper bound exists yet. |
| S04 / I04,I10 | Strict v0 parser; E119 measures it | Existing renderer sorts events/references and checks reduced rational text; not S03 canonicalization | Context-render SHA-256 measured separately in E119 | Existing render measured; live UUID, beat and authority projection unknown | Essential checks; repeated render/validation reducible under R2. E119 bounds measured fixture sizes only. 7a closes the live connection. |
| S05 / I09,I10 | Source/settings and qualified theory response | Provider-specific, unknown adapter cost | Source and response correlation required | Exact events → theory input → qualified annotations | Essential if enabled, otherwise no startup. E110 supplies compute/import, not adapter timing. Worker/translation cost unknown in 7a. |
| S06 / I10,I11 | Whole proposal sequence, IDs, defaults, constraints, complete candidate | Source canonicalizer retained; candidate preview has its own canonical SHA-256 | Compare proposal/source digest, event map and accepted preview digest | Resolve each operation against full state; preserve unnamed fields | Essential and implemented: E121 refusal fixtures. In the 20-note live candidate, source validation was 0.160 ms, proposal validation 0.825 ms, candidate compilation 1.097 ms and operation translation 0.084 ms. |
| S07 / I07,I11,I04,I05 | Complete candidate, writable grids, protection, preflight and readback | Existing note order/default normalization; no new source hash domain | Compare fresh source and independent complete observed state | Candidate → typed ops → recorded apply; host defaults stay explicit | Essential and implemented: E121. Fresh preflight was 3,801.443 ms, recorded apply 8,173.118 ms and independent readback 3,744.445 ms. R1 remains blocked; post-read remains. |
| S08 / I12,I11 | Initial profile rejects this proposal schema | Future lowering unknown | Source/context identity still required if later enabled | General groove lowering is unbuilt | Historical fixed-object probe; unknown future cost. Excluded from initial 7b, not a free supported seam. |
| S09 / I13,I10,I11 | Permission, two identities, complete/used coverage | Explicit event/order forms | Verify seed and reference separately | Extract traits; independently compare complete reference and candidate | Essential and implemented: E121. A 16-note reference projection took 0.849 ms. Complete 16-reference/20-candidate comparison took 1.220 ms. Work stays bounded by both complete note counts, not excerpt size. |
| S10 / I09,I14 | Compatible formula, units, settings, coverage and finite values | No second exact-state canonicalizer planned | Retain both source digests | Select task fields; compute allowed delta; no provider recomputation | Essential: E118/6i contract. New v1 cost unknown in 7a. Bounded selected field count must be explicit. Broader unused analysis is reducible under R4. |
| S11 / I15,I03 | Directory association, inactive recorder, bounded stop, exactly one stable file and header | No audio re-encoding | Full file-byte SHA-256; reject change during hash | Recorder state and directory diff → artifact | Essential: E103. E103 lifecycle timings bound only those samples. Product adapter/header/hash split unknown in 7e. Signal analysis belongs to S12/S13. |
| S12 / I15,I16 | Artifact identity, header, requested range/channels, before/after use checks | Keep original bytes; no implicit resample | Verify exact consumed bytes and detect mutation during analysis | Stream time base → samples, explicit decode/channel policy | Essential: E105/S12. Byte work covers full artifact; provider compute is separate. Current product input consumer/time unknown in 7d/7e. |
| S13 / I16,I14 | Silence, nulls, compatible frame/tail/channel settings, tolerance | No second source serialization | Copy each verified input identity | Parsed provider output → typed facts → task delta | Essential: E118. E105 full-cohort compute does not bound this v1 adapter. Unknown in 7d; task field scope/R4 bounds requested work. |
| S14 / I17,I18 | Full TS manifest/bytes rules, index identity and source compatibility | Installed tree and disposable corpus/index recipe | All opened source bytes; index tied to source/extractor/settings | Verified bytes → records → source-routed bounded hits | Essential and implemented: E122. R3 passes the same checked cache bytes to extraction. The installed 306-page task timings are above. |
| S15 / I19–I22 | Catalog version, donor shape/footprint, seed capacity, parser/authoring checks | Preserve supported byte structure and explicit relocation | Catalog tree fingerprint; seed hashes where supplied; donor manifest is not a per-donor hash guarantee | Existing internal binary/catalog adapters remain | Essential: S15 component fixtures and D15. Work bounded by selected bytes/objects/catalog files; isolated wall time unknown. Cross-module export wrapper unknown and only needed if 7f uses it. |
| S16 / I05,I06,I08,I23,I24 | Existing observation migrations/record validation; run-profile and ID links planned | Existing stable observation JSON | Record equality/conflict checks; artifact IDs must keep their own domains | Take/status/UI/operator evidence → run record | Essential authority and effects record. Work bounded by entries/serialized bytes; new cross-module record/time unknown in 7f. Blind evaluation machinery is historical. |
| S17 / I24 | Descriptor version, accepted schemas, request ID, source, deadline and response | Per-module framing only; no global state serializer | Source correlation, not a substitute for source validation | Typed in-process calls or private JSON worker frames | Essential: the in-process registry is implemented. E120 covers registry failure isolation. The 7b compiler and reference fixtures cover source correlation. Executable worker framing remains module-local and unbuilt until selected. |

The [seam ledger](WORKSTATION_SEAMS.md) supplies the component fixture and
consumer blocker for each row. No reduction can waive those fixtures. Existing
preset, observation and wire paths have bounded input scope but lack isolated
format timing. Record their byte/object counts and timing if the selected task
uses them; do not benchmark an unused module to fill a table.

## Repeated work and historical instrumentation

Already shared evidence must remain shared: one all-channel scan per clip in a
snapshot (E51/E54), one parameter preflight per same-route cohort (E78), and one
inventory per device/sample round for equivalent modulation witnesses (E97).
These are completed reductions, not new projected savings.

The remaining candidates are R1 preflight/stash reuse, R2 context render reuse,
R3 verified document bytes, and R4 task-selected audio/facts. Each brief states
the exact evidence that must remain. None permits caching across an unknown
external edit, source change, worker setting change, or ownership gap.

Historical cost includes repeated model arms, blind keys, ballots, independent
benchmark solvers, rejected providers, broad unused metrics, fixture setup,
whole-project regression scans and diagnostic traces. A required operator
verdict remains a product evidence boundary; its ballot generator is not a
required runtime service. Optional timing callbacks are audit instrumentation.

Some probe code still allocates host objects at extension startup. Its product
runtime cost is real but unmeasured here. The 153 registered/82 used method
counts do not quantify time or memory saved. [8b](../../plan/phase-8/8b-probe-runtime-retirement.md)
owns method/allocation retirement and D13's retained diagnostics. Do not remove
an object or method based only on a missing product import.

## Phase 7 operation and timing rules

| Operation | Required evidence | Timing and failure rule |
|---|---|---|
| Local read-only provider, docs or supplied exact state | Source identity/domain, provider/settings, schema, permission where required, coverage and authority; validate actual input/output | Measure cold startup once per worker/index lifetime and warm requests separately. No live target, stash, write settlement or reversal. Refuse missing/stale input before expensive compute. |
| Live read-only context, 7a | Guarded complete declared read, all channels, exact-source identity, context projection and omitted fields; restore borrowed selection | Measure acquisition, pages/host scans, settlement, source canonicalization/hash, validation and render separately. No apply or reversal. An unapplied candidate remains a prediction. |
| Agent patch, 7b | Exact source/ID map, whole-sequence and candidate validation, complete preflight, fidelity/protection, target/revision guards, recorded apply, independent all-channel readback | Measure compile, guard/stash, apply, settlement, verification and optional recovery separately. Keep partial effects. No automatic write retry. Plan and time reversal only when requested; preserve its boundary read. |
| Bounded scalar/idempotent write | Exact target, prior value if reversible, current route/generation and target-bound postcondition; retain existing cohort/structural guards | Use the proved narrow E61 path or E78 cohort as applicable. Do not add unrelated clip scans. Idempotence alone is not evidence that the right target changed. |
| Audio file analysis, 7d | Exact bytes before use and change detection through completion, stream/range/channels, fact settings, formula versions, paired coverage and tolerance | Separate hash/header, decode/provider, output validation and routing. Only compute declared task fields. Reject a changed source/result; no Bitwig connection required. |
| Capture, 7e | Saved-directory association, source/range, recorder ownership/state, bounded lifecycle, one stable artifact, byte hash/header, known effects | Record start/active, playback, stop, settle, attribution/hash/header separately. Capture changes state and creates a file. Stop/settle failure reports recorder state and candidates. Analysis is a separate call and failure. |
| Composed/hybrid task, 7f | Real accepted seam outputs, profile/request/source/artifact/change IDs, serialized UI and adapter writes, explicit audition verdict and exit baseline | Record parent wall time and non-overlapping child spans; keep wait/compute, cold/warm, retry and agent/operator time distinct. Refresh live state after external UI edits. UI observation does not replace semantic readback or confer reversal ownership. |

Each run records input bytes, notes/clips/channels/pages or audio samples,
reader width, host/provider versions, request/bridge counts, retry counts,
deadline, failure stage/effects and completeness. Use the current adapter timing
hooks for host phases. Add missing local phase spans only with the module that
implements them. Inclusive render/fingerprint, provider process startup and
outer workflow spans must be labelled so they are not counted twice.

Set finite input limits and startup/request deadlines before each experimental
profile runs. Choose them from the actual selected workload; retain existing
adapter budgets until a separate proof changes them. E61's background-progress
rule above two seconds remains relevant. A historical cohort time or scheduled
wait total cannot set a new provider SLA. Report late completion as failure
under the named policy, with actual elapsed time and known effects.

## Measurement gaps and next gates

E119 needed no live measurement to classify these costs. Phase 7 successor
sessions now add machine-specific measurements only when they implement a seam.

- [E120](../experiments/e120-symbolic-context-connects-complete-live-state.md)
  records the 2,048-step reader, three pages, one reset and 2,321.882 ms complete
  acquisition for the selected four-beat clip. It measures S03, S04 and the
  in-process S17 boundary separately. S05 and S10 did not run.
- [E121](../experiments/e121-guarded-agent-note-patches-pass-live-reference-dogfood.md)
  separates compiler, complete reference comparison, fresh preflight, recorded
  apply and final readback. It measures S06, S07 and S09. R1 remains blocked
  until equivalent freshness is proved.
- [E122](../experiments/e122-documentation-provider-connects-verified-offline-sources.md)
  measures the 7c installed source gate, extraction, index build, index
  validation, cold request and warm query separately. 7d measures consumed-byte
  verification and selected fact adapters.
- 7e separates attribution/hash/header from capture and analysis. Use disposable
  source material; restore the documented recorder, transport and selection state.
- 7f measures only the composed seams it uses, including S15/S16 when needed.
  8b measures allocation/init cost before it claims a retirement benefit.

A larger note reader is an unproved option. E52 makes it worth considering only
if the selected 7a workload is too slow. It needs a separate width/init/host-scan
comparison with all-channel fine-grid fidelity, paging, interference and reset
proof. Do not use a coarse read or shorten the 144 ms wait to meet a time target.
