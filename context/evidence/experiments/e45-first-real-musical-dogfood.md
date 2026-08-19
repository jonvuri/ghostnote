---
id: E45
kind: evidence
state: active
source: phase-2-session-2i
---

# E45 — First real musical dogfood exposes long-clip and cursor limits [K] (2026-08-19)

**Verdict: the public surface created six verified 32-beat phrase variations in
an operator-selected project. The operator accepted the result. The task exposed
three correctness defects and a blocking latency problem.**

## Natural task

The operator opened `26.05-2 moon`. They asked to read the only clips on the
`Lead` and `Harmony` tracks and extend each with three simple variations. The
first wording used "measures." The final clarification defined one phrase as
the complete original 32-beat clip. Phrase 1 had to remain unchanged. Three
subtle full-phrase variations had to follow it.

The project was not a fixture. The work used the ordinary MCP server and public
tools. The observation record keeps the original request, both clarifications,
managed copy results, one vetoed wrong interpretation, one failed attempt, and
the final accepted instruction.

## Final public result

Rows 2 through 4 on both tracks are host copies of row 1. Each clip is 32 beats.
The changes are small:

- Row 2 adds one quiet note at beat 12.
- Row 3 adds one quiet note at beat 29.
- Row 4 combines both notes at slightly lower velocity.

Six independent public `read_clip` calls confirmed the complete source notes and
the intended additions. No readback reported a mismatch. `show_changed_clip`
opened Lead row 2 and confirmed the Edit layout. The operator auditioned the
result and kept all six variation clips.

## Correctness findings

The first public read falsely reported that the occupied 32-beat clips were
empty. The exact reader covered only eight beats at its fine grids. The reader
now pages the fixed 512-step cursor window with `cursor.scrollToStep`, restores
the page origin after each scan, and reconciles binary and triplet grids as
before. A focused test reads a note at beat 24 from a 32-beat clip.

The first multi-clip retry timed out after 60 seconds but continued to mutate the
project. Its rollback then raced that in-flight request. Exact reads proved that
the residue contained only known copied notes, after which the residue was
removed. This is evidence for asynchronous completion and cancellation-safe
request handling. It is not an operator edit.

The next retry reported one Harmony row-2 write as applied even though readback
found the note in row 3. Additive note writes now confirm and pin the exact track
and row before the write turn. A stage wider than the verified writer pool is
refused before mutation. A note outside the fixed writer window is also refused
before mutation. The corrected live retry had no mismatch.

An unresolved clip-family address no longer reports "there is no clip." Cursor
confirmation and exact scan failures do not prove an empty slot.

The run also showed that additive note changes against the original continuous
host durations can report `canBeUndone: true` even when replay is not
representable on the current grid. The operator-facing reversal for the final
result therefore deletes only the six newly created clips after an explicit
veto. It does not rely on that incorrect note-replay claim.

## Latency and async verdict

The first exact read of the two source clips took 15.482 seconds. The final six
independent 32-beat reads took about 32 seconds. Each exact read scans 16 MIDI
channels at binary and triplet grids across several pages. This dominates the
task.

One six-target musical request exceeded the MCP client's 60-second timeout and
continued after the timeout. The full corrected sequence took more than two
minutes because it used six guarded copies, six separately verified note writes,
and six independent reads. This materially interrupted use. The E44 expression
waits remain a small part of cost; long exact reads and synchronous request
completion are the dominant costs.

Session 2i activates the deferred async-completion follow-up. It must define
completion and cancellation behavior before it replaces the working synchronous
path. A separate three-clip expression mutation was not safe while the operator
was auditioning the real output.

The plan keeps the known repairs outside the second dogfood use. The focused 2i
follow-up owns existing-clip metadata updates, paged note writes, and truthful
reversal qualification. Session 2x owns asynchronous completion and explicit
cancellation. Session 2j starts only after both repairs complete.

## Verification

The full offline check passes 629/629. The extension build and deployment,
context check, and `git diff --check` pass. Six final public writes and six
independent public reads verified the accepted live result.

## Retrospective

The word "measure" hid the intended phrase boundary. Confirm the musical unit
when the requested unit can mean either a beat-grid span or a complete clip.
For long clips, compare the requested beat extent with both read and write
cursor widths before planning a transformation.
