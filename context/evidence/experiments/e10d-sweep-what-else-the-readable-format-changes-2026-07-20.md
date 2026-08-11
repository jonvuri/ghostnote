---
id: E10d
kind: evidence
state: active
source: FINDINGS.md
---

# E10d — Sweep: what else the readable format changes (2026-07-20)

A pass over the earlier findings asking which ones the `.bwpreset` decode
(E10–E10c) actually moves. Two do, one materially. Probe `e10d-chaintrim`, all
green, plus offline analysis.

### Finding A — layer chains can be TRIMMED, collapsing E4f's "template per shape" (●)

E10c's remove-yes/insert-no asymmetry generalises one level up. Chains are
`CHAIN_LIST` items delimited exactly like modulators
(`<u32 classId> 0x02b9 str 'CHAIN<n>'`), and deleting them works. Against the
E4g 4-chain Instrument Layer (Phase-4, Polysynth, Organ, Sampler):

| trim | result |
|---|---|
| drop CHAIN2 (middle) | ● `[Phase-4, Polysynth, Sampler]` |
| drop CHAIN0 (first) | ● `[Polysynth, Organ, Sampler]` |
| drop CHAIN1+CHAIN2 | ● `[Phase-4, Sampler]` |
| drop CHAIN0+CHAIN1+CHAIN2 | ● `[Sampler]` — a 1-chain stack |

⇒ **E4f's "a finite template library, one per SHAPE (2-layer, 3-layer, 4-layer…)"
collapses to ONE wide template plus a trim step.** This does **not** contradict
E4d/E4e — growing a layer container is still impossible, and that reasoned
negative stands untouched. It removes the *need* to grow: author wide once, trim
down per use.

⚠ **The LAST chain cannot be deleted** — it has no exact end, because everything
after it (the list terminator, the enclosing object's remaining fields) belongs
to the parent. Drop the chains *before* it instead; that still reaches N=1.

⚠ **Another probe-bug-as-false-negative, caught only by the position sweep.** The
first run fell back to `b.length` for the last chain's end, cut off the whole
enclosing tail, and Bitwig rejected the file. That reads exactly like "deleting
the last chain is unsupported" — a capability ○ — but was a bug in the probe.
E10c had already guarded this case (`end = -1`); this probe did not. **Testing
the same operation in several POSITIONS is what exposed it**, the same way
multi-mechanism sweeps expose the others.

### Finding B — E4h's sample caveat is closed: presets EMBED audio (●)

E4h left open whether sample-bearing presets embed or merely reference audio,
flagging it as a possible external dependency. Reading the containers settles it:

| preset | size | embedded audio chunks | `referenced_packaged_file_ids` |
|---|---|---|---|
| Sampler "Ringwave" | 530 KB | 2 AIFF | **count = 0** |
| Drum Machine "PS2 corruption" | 5.0 MB | **24 AIFF** | **count = 0** |

The audio is **inside the file**. Original absolute source paths appear as
provenance metadata only (alongside internal `samples/<name>.wav` names), and
nothing external is referenced. ⇒ **E4h's "templates are a build-time asset, not
a runtime dependency" holds even for sample-bearing presets** — they are just
large. The residual dependency risk is retired.

### Finding C — the param catalog can be read structurally, not scraped (◐ minor)

E4 already harvests device param IDs from the bundle's
`device-settings/<uuid>/Default.bwpreset` via `strings | grep`, and noted the
output needs a resolve-check because it includes non-param tokens (`CONTENTS`,
`MODULATORS`, `FAKE1`). The decode explains *why*: those tokens are **object
names** (field `0x02b9`) at a different tree depth from parameter entries, not
noise. A structural read can distinguish them, which would remove the
per-ID live resolve-check. **Not pursued** — E4's scrape already works and the
catalog is a Phase-1 item; recorded so it is not re-derived.

### Checked and NOT changed

- **E4d/E4e (layers cannot be created)** — unchanged. E10c shows object
  insertion is rejected outright, which independently corroborates the ○ from
  the file side rather than the API side.
- **E4f "no save/export API"** — unchanged. The format is readable but nothing
  lets the agent *capture* a live structure; templates still originate from a
  human saving one.
- **E7 Findings A–E (remote controls, `modulatedValue`, drive-at-runtime)** —
  unchanged; all runtime, untouched by file-format work.
- **E6 (named actions)** — unchanged and still do-not-use.
- **E1/E2/E3/E5/E8 (addressing, fidelity, structural ops, scale, batching)** —
  no contact with the file format.

---
