# ghostnote context

Start with [NOW](NOW.md), the [backlog](BACKLOG.md), and the selected brief when
one is needed. Follow relevant source links; a link is not a required reading
assignment. Small changes can use the request and review summary as their plan
and result.

## Reading routes

| Need | Reference |
|---|---|
| Product and design | [PROJECT](PROJECT.md), [decisions](decisions/INDEX.md) |
| Host capability | [Subject pages](evidence/capability/INDEX.md), then the relevant [experiment](evidence/INDEX.md) |
| Document format and host integration | [Specification](../spec/ghostnote-document-v1/SPEC.md), [host binding](../spec/ghostnote-document-v1/HOST-BINDING.md), [identity](../spec/ghostnote-document-v1/IDENTITY-AND-OVERLAYS.md), [snapshot contract](contracts/GHOSTNOTE_CACHE_CONTRACT.md) |
| Live performance | Relevant [ledger](contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md) rows and call-budget tests |
| Dogfood trial | Relevant parts of the [runbook](plan/phase-8/8i-automated-dogfood-runbook.md) |
| Feature breadth and accepted direction | [Overlap sources](plan/overlap/README.md); work order is in the backlog |
| Preset format | [Format](evidence/format/BWFORMAT_SPEC.md), [bwmod](evidence/format/BWMOD_DESIGN.md) |
| Earlier work | [Archive](archive/README.md), [phase history](plan/ROADMAP.md), [migration history](contracts/GHOSTNOTE_MIGRATION_AND_VERIFICATION.md) |

## Authority

Current user direction and later decisions supersede earlier prescriptions.
NOW records execution state; the backlog gives priority and status; briefs give
scope. Decisions settle design. Capability and format pages summarize current
evidence and cite dated experiments. Keep old experiments and decisions as
history when a newer record changes their interpretation.

Phase plans and wave reports are source material. Their old status fields and
procedures do not assign work. Use retained runbooks and technical references
for the selected task. Read historical links as evidence or rationale, not as
instructions to repeat a completed procedure.

## Maintenance

Update documents when a fact, useful interpretation, or next step changes.
Keep specifications in `spec/`. Frontmatter is optional; the backlog holds work
status. Preserve stable IDs and links. A completed brief can hold its result;
create an E record when a measurement needs separate citation or reproduction.
Add new E/D records to their indexes. Newer capability findings cite their
sources and distinguish observations from inferences; update a subject page
when its current reading changes.

Apply D54 and D55 to inherited prescriptions: correctness and honest results are the
requirements. Read counts, captures, recovery records, and verification scope
are mechanisms to assess against evidence and cost. P01 examines existing
runtime mechanisms; implementation briefs examine proposed ones. Keep current
public behavior until the implementation updates it. D15 remains current;
a per-tool amendment identifies the claim, retained evidence, and changed rule.
Use broad regression and upgrade checks where they add value without requiring
them on every call.

## Tool maintenance

Update affected descriptions, schemas, profile inventory, help, and tests with
the implementation. A changed public description artifact requires a
`TOOL_DESCRIPTION_VERSION` bump in
[description-cohort.ts](../brain/src/surface/description-cohort.ts); update the
artifact and report the version. Keep current counts in [PROJECT](PROJECT.md);
other documents can link there or label a historical snapshot.

Use the relevant implementation references: [readback results](evidence/experiments/e258-selection-effects-and-unavailable-readback.md),
[cursor pins](decisions/d43-owned-cursor-tracks-stay-pinned.md),
[write bounds](decisions/d44-long-writes-are-optimized-then-bounded.md),
[mixer units](decisions/d48-track-mixer-writes-host-raw-values.md),
[revert results](decisions/d49-revert-fidelity-states-what-the-revert-restored.md),
[MIDI conversion](contracts/MIDI_FILE_CONVERSION.md), and
[Grid admission](decisions/d52-grid-upgrade-admission-policy.md).
Check probe consumers before retiring wire methods.

## Documentation checks

Run `LANG=en_US.UTF-8 ruby context/check.rb` and `git diff --check`.
The checker checks local Markdown file links outside `archive/`. Check changed
anchors and archive links separately. Refresh the publication candidate
inventory when REL reviews a candidate snapshot; routine document edits need
no publication inventory update.
