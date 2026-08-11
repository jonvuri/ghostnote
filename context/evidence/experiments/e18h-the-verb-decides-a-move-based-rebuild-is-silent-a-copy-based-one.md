---
id: E18h
kind: evidence
state: active
source: FINDINGS.md
---

# E18h — ⚠⚠ THE VERB DECIDES: a MOVE-based rebuild is SILENT, a COPY-based one is not [K] (2026-08-03)

**Verdict: ⚠⚠ ●● perfect separation across all four arms, both gates passed.** A
layer rebuild CAN be performed silently during playback — which a track fork cannot.
Probe: `e18h`, run 3 (runs 1 and 2 are the method record below).

| arm | heard | |
|---|---|---|
| ⚠ **REBUILD-COPY** — instantiates a SECOND plugin instance | ⚠ **2/2** | audible |
| ⚠⚠ **REBUILD-MOVE** — relocates the EXISTING instance | ⚠⚠ **0/2** | **SILENT** |
| ⚠ **PLACEBO** | **0/2** | the listener is not pattern-matching |
| ⚠ **CONTROL** — fork `gn-E16`, E16 C5's fixture | ⚠ **2/2** | the rig resolves a glitch |

⇒ ⚠⚠ **THE OPERATOR'S MECHANISM IS CONFIRMED, by a clean discriminator:**

> **Instantiating a plugin is the audible event. Relocating an existing one is free.**

The two rebuild arms are byte-identical except for one parameter — `verb: 'copy'`
versus `verb: 'move'` — and they separate 2/2 against 0/2 with the control firing and
the placebo clean **in the same sitting**. That is the strongest shape this spike has
for an ear result.

### ⚠⚠ What it changes: layers WIN this row, and it is the first row they win outright

| | glitch on a structural branch change |
|---|---|
| track fork | ⚠ **5/5 audible (E16 C5)** — and there is no silent variant |
| ⚠ **layer rebuild via MOVE** | ⚠⚠ **●● SILENT** |
| layer rebuild via COPY | 2/2 audible — parity with the fork |

⇒ ⚠ **This partly offsets `e18f`'s 7-undo-step cost**, which is the row layers lose.
A take system that can restructure without a click during playback is doing something
the track model cannot do at all.

### ⚠ The TRADE-OFF is real, and one half of it is NOT measured

`MOVE` is silent but the device leaves its source chain; `COPY` never drops it but
instantiates. ⚠ **The "gap" has NOT been measured and must not be reported as if it
had.** The audio in every trial was playing on a track OTHER than the one carrying
the rebuild — deliberately, to isolate the ENGINE-wide event from the doubling that
forking `gn-E16` would otherwise produce. So:

- ⚠ **measured:** a MOVE-based rebuild causes no engine glitch anywhere in the project.
- ⚠ **NOT measured:** whether the migrated take's OWN output has an audible hole while
  it is between containers. That needs audio running through the container being
  rebuilt, and it is a different probe.

⇒ **Record both, decide neither** (rule 10). The choice between an audible click and a
possible momentary hole is the user's, and it cannot be made until the second half is
measured.

### ⚠⚠ The method record: two earlier runs, and both failures were the instrument

**Run 1 — VOID.** Control 0/1. The operator diagnosed it:

> *"The control likely didn't glitch because before we were using heavy tracks with
> Zebra instances… Glitching is most likely a function of heavy plugin
> initialization, and maybe unpredictable even then."*

The record confirmed it — **E16 C5's 5/5 forked `gn-E16`, "two Zebra3s and a
Polysynth"**, while run 1 forked four NATIVE devices. ⚠ And the consequence was
bigger than the control: run 1's REBUILD arms were light too, so a passing control
would still not have tested the realistic case.

**Run 2 — VALID but CONFLATED, and the fault was the probe's.** Gates passed (placebo
0/2, control 2/2) and both rebuild arms read 2/2 — but `buildOld()` ran INSIDE the
measured window:

    clear previous → insertFile 4-chain preset → insert Zebra3 → insertFile a 2nd
    preset → migrate → delete old
    └─────────────── FIXTURE, ~3.4 s ──────────────┘ └── the rebuild ──┘

⚠ Roughly half the window was setup, containing the heaviest instantiation in the
probe. So `MOVE` reading 2/2 measured the fixture build, not the verb — **the
discriminator never ran**, and reading those equal columns as "the verb makes no
difference" would have been exactly wrong. Run 3 moved setup outside the window
(judged window: migrate + delete-old, **1.73 s**) and the columns immediately
separated.

⚠ **Three runs, two thrown away, and neither for a wrong answer** — one fixture too
light to fire the control, one window too wide to attribute. Both were caught by
gates the probe carried from the start rather than by re-reading the numbers
afterwards, which is the only reason run 3's separation can be trusted.

⚠ A blindness leak was closed on the way: rebuild arms ran ~5 s against the control's
~0.9 s, so a question arriving early told the listener which arm they were on. All
arms are now padded to a fixed 7 s.

---
