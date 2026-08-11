---
id: E18d
kind: evidence
state: active
source: FINDINGS.md
---

# E18d — ⚠ E4d route 3 is a FALSE NEGATIVE: `copyDevices` into a layer chain works [K] (2026-08-02)

**Verdict: ⚠⚠ ●● all three arms.** `e18c` row 4 copied a device into a layer chain,
which directly contradicts E4d route 3's recorded ○ — and E16n had reasoned about
that ○ at length when it overturned the `moveDevices` half:

> *"`copyDevices`' no-op was verb-specific rather than destination-specific"*

Two readings survived and they are materially different: **(a)** E4d's ○ was an
artifact, or **(b)** the SOURCE decides — every previous attempt copied from the
TOP-LEVEL chain, while `e18c` copied one already NESTED. Probe: `e18d`.

| arm | verb | source | destination | result |
|---|---|---|---|---|
| A | `copy` | nested (`C0`) | `C1` | ●● reproduces `e18c` row 4 |
| ⚠ **B** | ⚠ **`copy`** | ⚠ **TOP LEVEL** | `C2` | ⚠⚠ **●● — E4d says this is impossible** |
| ⚠ **C** | `move` | ⚠ **TOP LEVEL** | `C2` | ●● the discriminator |

⇒ ⚠⚠ **(a). `copyDevices` into a layer chain works from either source.** E4d route
3's ○ is a false negative of exactly the shape its own `moveDevices` sibling turned
out to be, and E16n's *"verb-specific rather than destination-specific"* is wrong in
**both** halves — it was neither. The likeliest cause is the e16o trap, which is
what killed the sibling.

⚠ **Arm C is the design, not a formality.** It holds source and destination fixed
and changes only the VERB, in the same sitting. Had B come back ○, C's ● would have
proved the top-level source handle valid and the destination alive — so the ○ could
only have been the verb, and reading (b) would have been *established* rather than
assumed. Without it, a ○ on B is the E6 failure again: a negative whose control was
a different object read through a different oracle.

⚠ **The nested source was seeded through `layer.insertDevice`** — a route
independent of every verb under test — so the fixture never presupposes the answer.

⇒ **What it changes:** one more verb is available for the §3.1 rebuild, and the
count of relocation routes into a chain goes from two (`moveDevices`,
`layer.pasteInto`) to **three**. ⚠ **What it does not change:** nothing in E18c
depended on E4d being right, and no E18c row was routed through this call.

⇒ ⚠ **This is the FIFTH capability ○ in the spike overturned by re-aiming a verb
everyone had written off** (CLAP params, `channelId`, chain creation, group creation,
now this). Standing rule 10 keeps paying for itself.

---
