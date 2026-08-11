---
id: E18g
kind: evidence
state: active
source: FINDINGS.md
---

# E18g — ⚠ CHAIN-LEVEL state: colour is re-appliable, and a chain has NO SENDS AT ALL [K] (2026-08-02)

**Verdict: ⚠ colour ●● / sends ○ — and the ○ CLOSES the row rather than failing it.**
Relocating devices carries the devices and nothing else, so every chain-level
property is something a rebuild must re-apply or silently lose. Probe: `e18g`.

| | result |
|---|---|
| colour readable + writable, **per-chain** | ⚠ **●●** — wrote `0.83,0.17,0.42`, read back `0.827,0.169,0.416`; the sibling chain unmoved |
| ⚠ **a chain's SENDS** | ⚠⚠ **○ THERE ARE NONE** |
| chain state carried by a device migration | ⚠ **○ NO** — `B0` kept its default `0.341,0.380,0.776` |
| …but re-appliable onto the destination | ● yes |

### ⚠⚠ A `DeviceLayer` has no send bank, and Bitwig says so out loud

    layerSendsStatus = FAILED@0: No send bank exists: Requested a send bank size of 0

⚠ **`Channel.sendBank()` does not return an EMPTY bank on a layer — it refuses to
create one.** That is a far stronger negative than a silent no-op: the API is
*stating* the capability is absent rather than quietly doing nothing, which is E6
blocker 4's entire problem. It is also one more instance of the rule E17 established
— **an inherited member is a claim, not a capability** (`deleteObject()` is inherited
and refuses; `duplicateObject()` is inherited and refuses).

⇒ ⚠ **This CLOSES the sends half of the row: a rebuild cannot lose what does not
exist.** It also fits the model — a layer chain is not a mixer channel routed to FX
buses. ⚠ **A TRACK fork, by contrast, does carry sends** (E16d), so this is a real
difference between the two branching models rather than a non-issue.

⚠ **The gate needed THREE readings, not two, and this is the transferable part.**
`marked:N` means the bank exists; *"No send bank exists"* means **Bitwig answering the
question**; anything else is OUR failure. Collapsing the last two would have let an
instrument fault be published as a capability ○ — the exact mistake standing rule 13
exists to prevent, and the one that produced three false ○s in E17. The raw status
string is recorded so the reading can be audited rather than taken on trust.

### ⚠ What it means for the rebuild

⇒ **The rebuild is not "move the devices".** It is *move the devices AND re-apply
every chain property that was set* — name, mute, solo, volume, pan and colour.
⚠ **`e18f` measured that every call is another undo step**, so each property restored
is one more step between the user and their single Cmd-Z. The costs compound, and
colour is the cheap end of that list.

---
