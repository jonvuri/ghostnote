---
title: Identity — what can be addressed durably, and what cannot
kind: capability
state: active
updated: 2026-08-22
scope: runtime object identity across tracks, chains, devices, clips and scenes
evidence: E2c, E2f, E3, E16l, E16t, E17, E18b, E59; D6
---

# Identity

> **Provenance.** Each claim carries `[K]` known, `[I]` inferred or `[U]`
> unknown, and cites its E-number or names its observer and date. Read the four
> rules in [INDEX.md](INDEX.md) before you edit this page.

## The one-line answer

**`Channel.channelId()` is the only runtime object identity in the whole
Controller API** [K, [E16l](../experiments/e16l-object-identity-settled-properly-is-the-only-one-and-there-is-no.md)]. Everything else is positional, and stays that way.

| Object | Durable key | Notes |
|---|---|---|
| Track | ● `channelId`, a UUID | Survives index shift, rename, save and restart |
| Chain (`DeviceLayer`) | ⚠ **the NAME only** | `channelId` exists but is re-minted at project load |
| Device | ⚠⚠ **none at all** | Not on `Device`, not on any supertype |
| Clip, scene, launcher slot | ○ none | Bounded positional addressing, plus content fingerprinting |

---

## 1. The completeness of that answer

E16l is a **complete-recall** pass, not a spot check, and it matters that it was
done that way. The `channelId` miss in E2c came from grepping class pages for
methods already suspected to exist — high precision, low recall.

Three passes [K, E16l]:

1. Complete-recall grep of all **1968 members** for every identity-shaped token
   (`uuid`, `guid`, `id`, `identity`, `identifier`, `key`, `hash`, `token`,
   `serial`, `slug`). **13 hits.**
2. Full member enumeration of every class we would want identity on.
3. A **supertype walk**, because that is exactly where `channelId` hid — on
   `Channel`, not on `Track`.

Of the 13 hits, one is an object identity. The rest are named actions, device
**type** UUIDs, our own extension metadata, our own hardware element ids, a MIDI
handshake, a value-object `hashCode`, and one false positive on "grid".

⚠ `Scene` has **eight members in total**. `ClipLauncherSlot` has 16, `Clip` 61,
`Device` 84. Every member of all four was read, and every base interface was
enumerated in full. **There is nowhere left for an id to hide.**

⇒ No future API sweep should reopen this without new evidence.

---

## 2. Track identity — ● durable and serializable

`track.channelId()` returns a `StringValue`; the javadoc says *"Reports the
channel UUID."* Every track reports a distinct UUID, including the FX returns and
the Master [K, [E2f](../experiments/e2f-stable-track-identity-does-exist-channelid-uuid-2026-07-19.md)].

Proven [K, E2f]:

- **Survives an index shift.** Inserting a track ahead of others changed their
  positions and not their ids.
- **Survives a rename.**
- **Clean tombstone.** A deleted track's UUID resolves to `found=false`. It does
  not alias onto whatever slid into its index.
- **Survives save, full quit and reopen**, byte-for-byte across all six tracks.

⚠ It is minted fresh on create, so a delete-and-recreate is a **different**
track. That is correct, and it is why a stash cannot be replayed onto a recreated
track by name [K, [D6](../../decisions/d6-addressing-pinned-non-following-cursors-identity-never-index-set.md)].

⇒ **Store the `channelId`, never a bank index and never a name.** Resolve it to a
live index on demand, then point a pool cursor at it.

---

## 3. ⚠ Chain identity — the id exists and is not a key

A `DeviceLayer` chain has a `channelId`. It is **not** durable.

| Reload kind | Result |
|---|---|
| Extension reload, project stays open | ●● **4/4 survived**, replicated over a second reload |
| ⚠⚠ **Project reload** — save, quit, reopen | ⚠⚠ **○ 4/4 regenerated** |

[K, [E18b](../experiments/e18b-3-2-closed-a-chain-s-is-minted-by-the-project-loader-a-matched-p.md), a matched pair on one fixture. Independently confirmed by E17
`e17ad`: 8/8 ids changed while 8/8 names survived and the track ids in the same
read were unchanged.]

⇒ ⚠ **A chain `channelId` lives in the running project and is minted by the
project loader.** It survives our jar re-initialising and being replaced, and it
dies with the document load.

⚠ **The asymmetry with tracks is about what the project FILE persists, not about
what our proxies hand out.** A track id is written to disk; a chain id is created
at load. Nothing on our side can recover it. That is a cleaner statement than
*"chain ids are unstable"* [K, E18b].

⚠ It **is** stable within a session — identical across back-to-back reads, after
re-scoping the container, and after a track-cursor round trip. Had it been a
per-read handle, the framing would be wrong in a much stronger way [K, E18b].

⇒ **In production, a chain `channelId` is a within-turn creation witness and
nothing more** [K, live, 2026-08-14].

### ⇒ The useful half, and it inverts D6 one level down

> For a **track**, `channelId` is the key and the name is the human tag.
> For a **chain**, there is no key and **the tag is all there is**.

[K, E18b, E17]

A chain is therefore addressed by **container position plus name**. See
[containers](containers.md) §2 for the rename evidence, and for the hazard that
an untouched shipped chain auto-names itself after its first inserted device.

---

## 4. ⚠⚠ Device identity — there is none, and it has already cost something

A device carries no identity, on itself or on any supertype [K, E16l]. A device
**type** UUID says *which model*, never *which instance*.

**This is not abstract. It shaped session 3f-g.** The whole position proof for a
winner-collapse is a top-level **name sequence**, because a device has no durable
id to diff. A winner device that shared a name with a surviving top-level device
made *"it moved back"* and *"nothing happened"* the same reading, and the answer
reported success either way [K, review pass, 2026-08-15].

The fix was to **fail closed**, not to find an identity: the proof and the batch
precondition now refuse a move whose projected order spells the order it started
from, and `keep_device_alternate` projects the whole restoration **before the
container is destroyed**, which is the only point at which a refusal is still
worth anything [K, live, 2026-08-15].

E59 applies the same rule to managed top-level FX chains. Each mutation carries
the prior accepted complete device-name and enabled-state sequences. A change in
either sequence refuses before the target write. After an accepted relocation,
the checkpoint derives owned current positions from that observation. It keeps
minted positions only as ownership provenance [K,
[E59](../experiments/e59-managed-fx-chain-is-live.md)].

This guard detects an unrelated insertion, deletion, move, rename, or enabled-
state change. It still cannot detect replacement by another device with the
same name and enabled state. The workflow therefore narrows positional drift.
It does not create device identity [K, E59].

⚠ **No stronger observable exists to fall back on.** If a device identity is ever
measured, that is what relaxes this. The fingerprint fields in
[devices](devices.md) §4 would narrow the gap and would not close it.

---

## 5. `createEqualsValue` — ◐ narrowly useful and dangerously shaped

`ObjectProxy.createEqualsValue(ObjectProxy)` creates a `BooleanValue` that is
true when two proxies target the same object. It is on the base of **every**
proxy [K, E16l].

**What it is not.** Not an identifier. It cannot be serialized, stored, sent over
the wire, or compared across sessions, so it cannot give an agent a durable
reference to hold in context [K, E16l].

**What it does and does not do** [K, [E16t](../experiments/e16t-is-a-track-drift-guard-is-meaningless-between-two-cursors-and-fa.md)]:

| row | result |
|---|---|
| Called outside `init()` | ● **refused** — *"This can only be called during driver initialization"* |
| 65 pairs pre-allocated at init | ● built, no init failure |
| Settle after a repoint | ● 96 ms |
| Cursor ↔ bank item, same object | ● true, and exactly one bank row matches |
| Survives a rename | ● true — D6's name check would have failed here |
| ⚠ Detects a **position shift** | ● false at the old index, true at the new |
| ⚠ Cursor ↔ cursor, tracks | ⚠ ○ **true on DIFFERENT tracks** — meaningless |
| Clip cursor ↔ clip cursor | ○ true across different slots **and** different tracks |

⇒ **The rule is not "`createEqualsValue` works".** It is: **it works between a
cursor and a bank item, and it is meaningless between two cursors of the same
kind.**

⚠⚠ **The withdrawn claim failed GREEN, and that is the transferable part.** E16t
first published it as an aliasing detector and had only ever exercised
cursor↔bank-item. Exercised properly, `ct0=ct1` reads **true on different
tracks**. An aliasing detector that is always true reports "no aliasing" by
reporting "always aliased".

⚠ **The sharpest limitation: it detects DRIFT, not DEATH.** A pinned cursor whose
target is deleted slides silently onto the track that inherits its position, and
the equals value then reads **true against the wrong track**. ⇒ **Pairing with
`channelId` stays mandatory**, and pinning does not protect against deletion.

⚠ It offers **clips nothing**: there is no cursor-versus-bank-item pair available,
because a `Clip` and a `ClipLauncherSlot` are different objects and the bank holds
only the latter. E16l stands for clips.

⚠ It is a `create*`, so it must be pre-allocated at `init()`. That is rule 13's
**fifth** independent occurrence — see [banks](banks.md) §5.

**Status: in use.** `Rig.java:1174` builds the cursor-to-bank-item pairs and marks
them at `:1182` [K, source read 2026-08-15]. ⚠ This supersedes E16l's
*"Unprobed"*.

---

## 6. ⚠⚠ A name is not an identity

D6 says this for addressing, and it was not applied to the probes' own fixture
lookup. The project acquired **two tracks named `gn-lay4`**, and every E17 probe
resolved its subject with `tracks.find(t => t.name === SUBJECT)`, which silently
returns the first match. So a chain was selected on one track while the UI
selection sat on the other [K, [E16j](../experiments/e16j-e6-is-wrong-named-actions-fire-backgrounded-and-one-of-them-crea.md)].

⚠ The orphan arrived through a named `Duplicate` fired against the UI track
selection — see [actions](actions.md).

**Rules this earns, and they apply to product code as much as to probes:**

- Refuse when a name matches more than one object.
- Assert that no orphan appeared after every action, **by `channelId`**. An
  action that forks a track reads as *"○ nothing at all"* to any probe measuring
  only devices and chains.

---

## 7. Clips and scenes — ○ positional, and the mitigation is content

No identity exists for a clip, a scene or a launcher slot, and no API change is
coming that would supply one [K, E16l].

- A scene **delete** bumps the epoch and refuses stale addresses [K, E3].
- ⚠ `ClipLauncherSlotOrScene.moveTo(...)` exists, and a clip **move** almost
  certainly does not bump that epoch, so it would pass undetected. ⚠ `[U]`,
  and worth one cheap probe [E16l].

**Two mitigations, and the second is the real answer** [K, E16l]:

1. **Content fingerprinting is free**, because the snapshot already holds the
   clip's notes — that *is* the stash. Re-read the target before writing and
   compare. ⚠ A heuristic, not identity: two identical clips are
   indistinguishable, and it only works *before* our own write changes the
   content.
2. ⚠ **Fork-first makes the residual risk survivable.** A mistargeted clip write
   damages a fresh duplicate that gets deleted, rather than the user's actual
   track. **The absence of clip identity stops being a correctness problem and
   becomes a "you may have to ask again" problem.**

---

## Open questions

| # | Question | Tag | Probe |
|---|---|---|---|
| 1 | Does a clip `moveTo` bump the scene epoch? | `[U]` | Move a clip between scenes, then present a stale address and see whether it is refused |
| 2 | Can more device fields narrow same-name and same-enabled replacements? | `[U]` | Mark `presetName`, `deviceType`, `isPlugin`, and `sampleName`, then test two deliberately identical devices. ⚠ Expect a narrowing, not identity |

---

## Supersession record

| Date | Change |
|---|---|
| 2026-08-22 | E59 adds a complete name-and-enabled guard and current-position recovery. It also records the remaining same-name and same-enabled replacement limit. |
| 2026-08-15 | Page created. It supersedes the *reading* of E2c's "no stable track addressing" (already amended by E2f) and of E16w's "layer chains have their own `channelId`" as an identity story, which E17 retired. |
| 2026-08-15 | E16l's *"`createEqualsValue` … Unprobed"* superseded — it is measured by E16t and in use at `Rig.java:1174`. §5. |
