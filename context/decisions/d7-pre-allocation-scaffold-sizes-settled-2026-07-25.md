---
id: D7
kind: decision
state: active
source: DECISIONS.md
---

# D7 — Pre-allocation scaffold sizes **[SETTLED 2026-07-25]**

**Ship `TRACKS=256, SCENES=128, CURSOR_POOL=8, DEVICE_BANK=16, paramHandles=64`,
all config-tunable via `~/.ghostnote/rig.json`.** E5 found **no knee below 65 536
slots** (512×128 = 81ms init) and latency flat at the ~24ms control-surface tick
floor in every configuration, loaded or empty. Cold init was 108ms inside a 13.4s
Bitwig launch; project-open cost was below measurement resolution.

**Confirmed and implemented 2026-08-20 by E50.** A 48-track fixture with 384
native devices kept observer warm-up and ping latency flat. The full D7 scaffold
completed init in at most 171.3 ms during the hot-reload matrix. One cold start
reported 339.1 ms of construction and 20 ms of bank settlement, with zero
control-thread stalls. `RigConfig` and the fake now use these values as their
actual defaults.

**The binding constraint is not performance — it is the bank window** (D6). Scale
therefore bounds maximum project size, which is a correctness limit rather than a
tuning preference.

⚠ **Init-time allocation is not merely a convention, it is enforced.** E14-C2:
`getDocumentState()` settings cannot be created after `init()` — *"This can only be
called during driver initialization"*. INITIAL_PROMPT §3a's first structural
constraint is confirmed for the settings surface too, so **anything the human
surface will ever show must exist at init and be revealed with `show()`**
(`RigConfig.uiSlots`, default 16; the panel is "fine" at that size, E14-C4).

⚠ **AMENDED 2026-07-25 (E14-I5): graphics allocation is init-only too, and it
refuses with the SAME SENTENCE.** `host.createBitmap` after `init()` returns
*"This can only be called during driver initialization"* — verbatim E14-C2's
refusal, from an unrelated subsystem. That makes §3a's pre-allocation idiom its
**fourth** independent occurrence (cursor pools E1, device/param handles E5,
settings E14-C2, graphics E14-I5), and it is now the DEFAULT ASSUMPTION for any
Bitwig resource rather than a per-subsystem discovery. **Anything Phase 3 will
ever draw into must be allocated at init.** The refusal is clean, synchronous and
catchable — the good failure mode, and the opposite of E14-A1.
