---
title: Current state
kind: status
state: active
updated: 2026-09-24
phase: phase-7-follow-up
session: phase7b-project-observer-scale-sweep
---

# Now

Run the
[project-wide observer scale sweep](plan/phase-7/7b-follow-up-project-observer-scale-sweep.md)
in a fresh chat. Use a fresh scratch Bitwig project. Measure view width and
observed-clip count independently before testing fixed-view correctness.
Ask the user to reload the controller when required.

[D23](decisions/d23-normalized-clip-acquisition-uses-one-1-512-view.md)
selects one fixed `1/512` observer per clip. One acquired identity is one MIDI
channel, pitch, and `1/512` cell. Same-channel and same-pitch multiplicity
inside one cell is accepted loss. Do not allocate or test a second `1/768`
observer.

[E133](evidence/experiments/e133-hybrid-observer-acquisition.md) rejects the
requested dirty-and-quiet hybrid. Every eligible rule and request pattern had
five early grid-race results in 44 shadow trials. The 48 ms confirmation and
second requested quiet event did not add grid identity. The failure stopping
rule applied before the full 3,000-trial and latency gates.

[E131](evidence/experiments/e131-consolidated-clip-acquisition.md) completes the
exact acquisition session. One `1/512` sparse view differs from its exact
dual-grid result. A `1/512` and `1/768` sparse union matches that result on the
controlled fixtures, but conservative observer settlement makes it slower.
The current implementation stays unchanged. D23 later accepts `1/512` cell
identity for the consolidated contract, so exact triplet timing is not a scale-
sweep requirement.

[E132](evidence/experiments/e132-flush-boundary-clip-settlement.md) rejects
`flush()` as a note-grid replay completion fence. The 660-trial live matrix had
122 early passive first flushes and 119 early requested first flushes.
Dirty-dependent rules missed all 120 empty-to-empty arms. Passive second-quiet
boundaries still completed early 12 times. The temporary flush recorder and
three probe methods were removed. The E131 reader and settlement stay
unchanged.

The experimental acquisition tool remains available at
`GHOSTNOTE_TOOL_PROFILE=phase-7b-agent-note-patch-v0`. Use the complete route in
the later independent played-range consolidation trial. The stable reader and
stable profile remain unchanged.

The scale sweep tests a different route from E133. It warms one fixed `1/512`
view per clip before a request and never changes target, grid, or page during a
timed read. Treat 250 ms quiet as an empirical policy, not an API guarantee.
A settled complete `1/512` scan is the comparison authority.

The deployed extension uses Controller API 25, 157 methods, and method hash
`905bc2531512025b`. The live sparse fixture probe passed and removed its owned
track and five owned clips. It restored the four-track selection and stopped
transport. The live acquisition check was read-only and passed on the selected
empty clip. No test residue remains.

The E132 fixture probe removed its owned track and five clips. It restored the
exact four-track list, selection, cursor state, and stopped transport. No test
residue remains.

The temporary E133 recorder and shadow probe were removed. The source method
table and fresh deployed extension are back to 157 methods and hash
`905bc2531512025b`. The E131 complete acquisition route remains authoritative.
The stable reader and stable profile are unchanged.

## Retrospective

Run a small failure screen before a long confidence matrix. Repeated local quiet
does not identify the requested host grid.
