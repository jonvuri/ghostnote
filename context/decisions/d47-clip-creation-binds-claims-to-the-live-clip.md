---
id: D47
kind: decision
state: active
updated: 2026-10-09
source: phase-8i9
---

# D47 — Clip creation binds claims to the live clip **[SETTLED 2026-10-09]**

An agent that creates a clip cannot know its clip ID: the identity registry
names the clip after the creation. Before 8i9, `add_launcher_clip` created the
empty clip, then refused the content when the document had claims: "A
replacement with overlays must use the clip ID of a read". The agent then had
to read the new clip and put the claims with a second edit (8i9 source
transcript, lines 133–136).

## Rule

`add_launcher_clip` takes claims with the clip ID of the document. This is a
host input rule in
[HOST-BINDING.md](../../spec/ghostnote-document-v1/HOST-BINDING.md#claims-on-clip-creation);
the portable grammar does not change.

1. **Check before the creation.** The tool seals the claims in the clip ID
   space of the document as sent (D45). A supplied basis is checked there; a
   mismatch refuses with `detail.expectedBasis` in that space. The codec checks
   every claim. A refusal has no effect.
2. **Map, do not replace.** After the creation, every clip reference moves to
   the live clip ID, and each current claim gets the basis of the same
   dependencies under that ID. A wrong supplied basis never reaches this step.
   Event and claim IDs stay.
3. **Bound the expansion.** A membership dependency and an overlay dependency
   expand to the clip's event IDs and to a claim envelope at each basis
   computation. The add refuses more than 4,194,304 expansion units before any
   read (D44).
4. **Replacement keeps its rule.** `edit_launcher_clip` with intent `replace`
   still needs the clip ID of a read for a document with claims.

## Consequences

- One public call creates a clip with nominal and groove claims, with no
  preceding read; the readback returns the live clip ID, the proposed IDs, and
  current bases ([E256](../evidence/experiments/e256-overlay-authoring-and-creation.md)).
- The add host budget does not change; the check, the mapping, and the seal
  are brain work. The largest admitted add takes 22.2 s live.
- A content refusal after the creation still returns the creation effect and
  its revert route.
