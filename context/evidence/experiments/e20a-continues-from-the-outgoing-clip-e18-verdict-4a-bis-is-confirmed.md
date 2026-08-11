---
id: E20a
kind: evidence
state: active
source: FINDINGS.md
---

# E20a — ⚠⚠ `continue_or_synced` CONTINUES FROM THE OUTGOING CLIP: E18-VERDICT §4a″-bis is confirmed by measurement, and per-call quantisation is real [K] (2026-08-09)

**Verdict: ⚠⚠ ●● 12/12.** The clip half's most valuable unclaimed primitive,
`launchWithOptions(quantization, launchMode)`, run for the first time. Both of
E18-VERDICT §4a″-bis's claims hold, and the second one — the one nothing else in
the design can imitate — is now a number rather than a javadoc reading. Probe
`e20a` (PART A autonomous, 12 checks; PART B ⚠ operator, owed).

### The launch-mode matrix — what each mode actually means

⚠ **Take A is launched deliberately OFF the grid** in T1–T5 (unquantised, mid-bar),
because that is the only condition under which the three candidate meanings of
"continue" are separable. On the grid they COINCIDE, which is why this hid.

| trial | mode | take A was at | B came in at | nearest prediction |
|---|---|---|---|---|
| T1 | `synced` | step 46 | **48** | ● the transport grid (predicted 48, exactly) |
| T2 | `from_start` | 46 | **0** | ● the top of the clip |
| T3 | ⚠⚠ `continue_or_synced` | 46 | **47** | ⚠⚠ **A's position** (1 away; the transport grid was 31 away) |
| T4 | `continue_or_from_start` | 46 | **47** | ⚠ **A's position** (1 away; both alternatives 17 away) |
| T5 | `continue_or_synced`, ⚠ B primed near the top | 46 | **47** | ⚠⚠ **A's position** (1 away; **B's own last position 17 away**) |
| T6 | `continue_or_synced`, ⚠ A ON the grid | 31 | **32** | ● A's position — and 32 steps from the top |

⇒ ⚠⚠ **"Continue" means the OUTGOING clip's position, not the incoming clip's own
last position and not the transport grid.** T5 is what separates the first two:
take B was run to the top of its clip and stopped there, and it still came in
where take A was. **This is exactly what E18-VERDICT §4a″-bis claimed**, and it was
a javadoc reading until now.

⇒ **T6 is the one the design rests on.** With take A launched normally — on the
grid, like everything else — take B comes in **where take A was**, 32 steps from
the top of the clip. That is E16m's request delivered: *the same bar, rendered
differently*, rather than a jump back to the top of the loop. ⚠ No mute, solo or
chain switch can imitate it.

### Quantisation is a genuine per-call override

| | |
|---|---|
| `"1"` fired at beat 1.04 | started at beat **4.02** — 0.02 off the bar line, after waiting **1567 ms** |
| `"none"` fired at beat 5.06 | started at **5.38** — 1.38 off the bar, after **121 ms** ⚠ the control |
| `"8"` | started at beat **32.01**, after **14266 ms** — the 8-bar grid, and materially longer than `"1"` |
| the pending state | ● `isPlaybackQueued` observed true before the switch, so a scheduled launch is distinguishable from a call that did nothing |

⚠ **Both quantisation arms fire deliberately mid-bar.** A launch fired near a bar
line lands near one whatever its quantisation, so the `"none"` control could
otherwise pass the `"1"` assertion by luck.

⚠ **The 8-bar phrase's PHASE is recorded, not asserted**: nothing in the javadoc
says whether a phrase counts from the timeline origin or the last transport start,
and asserting a guess would manufacture a finding.

### ⚠ Free, and it matters to session 3: a launch is not an edit

`E20a-A7` — launching clips fires **no occupancy events at all**. Session 3's
detector rests on silence meaning something; an A/B session that reported itself
as a stream of concurrent edits would have made it worthless within a day. It does
not.

### ⚠⚠ TWO PROBE BUGS, and the first one produced a consistent matrix of nothing

Both are worth more than the result they nearly spoiled, because both are shapes
that recur.

1. ⚠⚠ **A pre-existing ONE-BAR clip silently became take B.** `ensureTake` created
   a clip only when the slot was EMPTY and accepted whatever was already there
   otherwise — so row 5's leftover 4-beat clip was adopted, and *this probe's own
   header* says a clip shorter than the launch grid makes the arms undecidable:
   the switch always lands where the loop restarts, so `continue_or_synced` and
   `from_start` are identical **by construction**. The first run reported
   `continue_or_synced` entering at step 15 against take A at 32 and looked like a
   real negative refuting §4a″-bis.
   ⇒ **Standing rule 1 applies to the SETUP, not only the result.** The fix reads
   `loopLength` back through a cursor and replaces a clip of the wrong length, and
   an `E20a-S1` check now refuses the whole probe rather than measuring.
2. **The on-grid trial was DEGENERATE.** With take A synced and the switch on a bar
   line, take A sits at a multiple of 16 steps when the handover happens — so
   "A's position", "the transport grid" and "the top of the clip" all named the
   same step (measured: A at 63 handing to B at 0, all three predictions within 1).
   ⇒ The trial now fires inside a **window** whose next bar line falls mid-clip.
   A control that can accidentally agree with the experiment is not a control, and
   this is that failure one level up: a *trial* that cannot disagree with itself.

⚠ **The diagnostic that found bug 1 is worth keeping** (`probe:e20a-diag`). It
asks one question — does `Clip.playingStep()` track a launcher clip's playhead? —
and answered it with a per-cursor time series. It **vindicated the instrument**
(cursor 0 swept 0→62 while its clip played and read **−1** while the other clip
played, and vice versa: `playingStep` is a per-CLIP playhead, not a per-track one)
and caught the wrong clip length in passing. Three false ○s in E17 came from being
unable to tell a broken handle from a real negative; this is the cheap version of
not repeating that.

### What it closes, and what it does not

- ● **E16m is answered, and with a knob**: beat-aligned A/B, at bar or phrase
  granularity, chosen per call.
- ● **§4a″-bis's `"continue_or_synced"` claim is measured**, so the clip block's
  ergonomic case no longer rests on a reading.
- ○ **Unattendedness is still not ours.** `launchWithOptions` is a VERB — every
  switch needs a caller — and Next Actions are not in the API (§4a″). Nothing here
  changes that, and this probe deliberately measures none of it.
- ● **THE EAR AGREES WITH THE NUMBERS** (`probe:e20a-ear`, 2026-08-09, master peak
  **84** so the refusal-on-silence guard passed rather than being skipped):

  | | operator |
  |---|---|
  | did the switch land cleanly on a bar line? | ● **yes** |
  | did take B come in PART-WAY THROUGH rather than restarting? | ● **yes** |
  | is this the A/B you asked for in E16m? | ⚠ verbatim: **"Yes."** |

  ⚠ **The takes had to be rewritten for this arm to mean anything.** They were a
  note on every beat at a constant pitch — so every bar sounded like every other
  bar and *"did it come in part-way through?"* had **no audible answer**; the
  operator would have been asked to report something they could not hear. The takes
  are now RISING lines (A from pitch 60, B the same shape an octave up), which
  makes position audible: a take entering at bar 3 enters high. E16m was a
  complaint made by ear, and this is its answer in the same currency.

### Decision impact

- **D18's clip block keeps its justification**, now evidenced. `launchWithOptions`
  and its two working modes are the mechanism session 3e should design the block's
  A/B around.
- ⚠ **New, for 3e**: the A/B is position-continuous **only when the outgoing take
  is itself on the grid** — which is the ordinary case, and worth stating in the
  tool description as a mechanical fact rather than discovered later as a bug.

---
