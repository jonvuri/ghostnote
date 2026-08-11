---
id: E16l
kind: evidence
state: active
source: FINDINGS.md
---

# E16l — object identity, settled properly: `channelId` is the ONLY one, and there is nowhere left for another to hide [K] (2026-07-29)

**Verdict: ○ CONFIRMED, at last with the method standing rule 10 demands.**
Across **all 1968 members** of the Controller API there is exactly one runtime
object identity — **`Channel.channelId()`**. Clips, scenes, launcher slots and
devices have none, on themselves or on any supertype. `PROJECT_PLAN.md` §7 calls
this "the oldest open question"; D16a answered it from a partial pass. This is
the complete-recall pass, and it agrees.

⚠ **One thing was missed, and it is worth having:
`ObjectProxy.createEqualsValue(ObjectProxy)`** — see below. It is not an
identifier and does not change the design, but it is a real capability nobody had
recorded.

### The method (the one E2f's miss produced)

Three passes, because the `channelId` miss came from grepping class pages for
methods already suspected to exist — high precision, low recall.

1. **Complete-recall grep of `member-search-index.js`** (1968 members, every
   class) for every identity-shaped token: `uuid`, `guid`, `id`, `identity`,
   `identifier`, `key`, `hash`, `token`, `serial`, `slug`. **13 hits.**
2. **Full member enumeration** of every class we would want identity on.
3. **Supertype walk**, because that is exactly where `channelId` hid — on
   `Channel`, not `Track`.

### Pass 1 — all 13 hits, and what each actually is

| hit | what it really is |
|---|---|
| **`Channel.channelId()`** | ⚠ **the only runtime object identity in the API** |
| `Action.getId()`, `ActionCategory.getId()` | named actions, not objects |
| `createBitwigDeviceMatcher(UUID)`, `Device.createSpecificBitwigDevice(UUID)`, `InsertionPoint.insertBitwigDevice(UUID)` | device **TYPE** UUIDs — *which model of device*, never *which instance* |
| `EnumValueDefinition.getId()`, `ExtensionDefinition.getId()` | our own extension's metadata |
| `HardwareElement.getId()`, `HardwareSurface.hardwareElementWithId(String)` | our own hardware objects, whose ids **we** assign |
| `ControllerHost.defineSysexIdentityReply(String)` | MIDI device handshake |
| `HardwareLightVisualState.hashCode()` | a value object |
| `Application.recordQuantizationGrid()` | false positive on "grid" |

### Pass 2 — there is nowhere for an id to hide

⚠ **`Scene` has EIGHT members in total**: `clipCount`, `name`, `getName`,
`selectInEditor`, `showInEditor`, and three observers. `ClipLauncherSlot` has 16,
`Clip` 61, `Device` 84. Every member of all four was read. Nothing
identity-shaped in any of them.

### Pass 3 — the supertype walk, and the base interfaces in full

| class | all superinterfaces |
|---|---|
| `Clip` | `ObjectProxy`, `Subscribable` |
| `Scene`, `ClipLauncherSlot` | `ClipLauncherSlotOrScene`, `DeleteableObject`, `DuplicableObject`, `ObjectProxy`, `Subscribable` |
| `Device` | `DeleteableObject`, `DuplicableObject`, `ObjectProxy`, `Subscribable` |
| `Channel` | as `Device`, plus `DeviceChain` |

Every base enumerated completely: `ObjectProxy` = `exists()`,
`createEqualsValue(ObjectProxy)`. `Subscribable` = 4 subscription methods.
`DeleteableObject` = 2. `DuplicableObject` = 2. `ClipLauncherSlotOrScene` = 21
(`color`, `copyFrom`, `launch*`, `moveTo`, `name`, `sceneIndex`, insertion
points, `setIndication`). **No identifier on any of them.**

⇒ **D16a's "everything else is positional and stays that way" is correct, and now
rests on a complete pass rather than a partial one.** No future API-sweep should
reopen this without new evidence.

### ⚠ The find: `ObjectProxy.createEqualsValue(ObjectProxy)` (API v3)

> *"Creates a BooleanValue that determines this proxy is considered equal to
> another proxy. For this to be the case both proxies need to be proxying the
> same target object."*

On the base of **every** proxy — `Clip`, `Scene`, `ClipLauncherSlot`, `Device`,
`Track`, all of them. Nobody had recorded it.

**What it is NOT.** Not an identifier. It cannot be serialized, stored, sent over
the wire, or compared across sessions, so it **cannot give an agent a durable
reference to hold in context**. It compares two *live proxies* only.

**What it IS.** A genuine identity *comparison*, which is a stronger guard than
what D6 uses today (verify a cursor's target by name and position). Using it means
holding a pinned cursor per object, so it is bounded by the cursor pool (D7), and
⚠ it is a `create*` — the exact shape that has thrown *"can only be called during
driver initialization"* four times (rule 13) — so it would need pre-allocating at
`init()`. **Unprobed.**

### What follows for addressing clips

The question that prompted this: *snapshot a project, the human then swaps three
clips between scenes — can we detect it and still target the intended clip?*

**No, and no API change is coming that would let us.** A scene *delete* bumps the
epoch and refuses stale addresses (E3), but `ClipLauncherSlotOrScene.moveTo(...)`
exists and a clip *move* almost certainly does not bump it, so it would pass
undetected. ⚠ Unmeasured, and worth one cheap probe.

Two mitigations, and the second is the one that matters:

1. **Content fingerprinting is an available substitute, and it is free** — the
   snapshot already holds the clip's notes, because that *is* the stash (D16e
   stores the whole clip channel). Re-read the target before writing and compare:
   if the notes disagree, something moved. Then either refuse, or search sibling
   scenes for the matching fingerprint and re-target, or recreate. ⚠ A heuristic,
   not identity — two identical clips are indistinguishable, and it only works
   *before* our own write changes the content.
2. ⚠ **Fork-first makes the residual risk survivable, and this is the real
   answer.** Under an external store a mistargeted clip write damaged the user's
   actual track. Under fork-first it damages a fresh duplicate that gets deleted.
   **The absence of clip identity stops being a correctness problem and becomes a
   "you may have to ask again" problem.** It is the strongest argument the
   track-native model has, and it fell out of a question about identifiers.

---
