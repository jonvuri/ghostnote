---
id: E18b
kind: evidence
state: active
source: FINDINGS.md
---

# E18b — ⚠⚠ §3.2 CLOSED: a chain's `channelId` is minted by the PROJECT LOADER — a matched pair on one fixture [K] (2026-08-04)

**Verdict: ⚠⚠ both arms measured on the SAME four ids, and they separate cleanly.**
§3.2 rebuilt from scratch on a fresh fixture as the operator asked, and NOT a re-run
of `e17ad`. Probe: `e18b` (`snapshot` → `resnap` → `verify`).

| arm | chain ids | proof the reload happened |
|---|---|---|
| ⚠ **extension reload** (project stayed open) | ⚠⚠ **●● 4/4 SURVIVED** | `methodsHash` moved |
| ⚠ *…replicated over a SECOND extension reload* | ⚠ **●● 4/4 SURVIVED** | new jar, ids untouched |
| ⚠⚠ **PROJECT reload** (save + quit + reopen) | ⚠⚠ **○ 4/4 REGENERATED** | ⚠ **undo stack CLEARED** |

⇒ ⚠⚠ **A chain `channelId` lives in the RUNNING PROJECT and is minted by the project
LOADER.** It survives our jar re-initialising and being replaced — twice — and dies
with the document load.

The operator's objection was the reason to rebuild it, and it is now answered:

> *"it is weird that channel identity is stable for tracks but not for chains when
> they share the same underlying object that channelId's name implies."*

⇒ ⚠ **The asymmetry is about what the project FILE persists, not about what our
proxies hand out.** A track id is written to disk; a chain id is created at load.
Nothing odd remains, and nothing on our side can recover it.

⚠ **`e17ad` is CONFIRMED** — independently, on a fresh fixture, with a different
method. Its 8/8 was not an artifact.

### ⚠⚠ Why this is a matched pair and not two experiments

⚠ **`e17ad` could not have answered the question at all**, because a quit-and-reopen
restarts BOTH the project and the extension, and its 8/8 is consistent with either
being the cause. Splitting them needs the SAME ids put through both reload types —
which meant the project arm could not rebuild its fixture:

- ⚠ A `resnap` mode was added for exactly this. The `snapshot` mode clears the track
  and rebuilds, which **mints new ids** and would have turned the pair into two
  unrelated experiments. `resnap` captures what is already there and touches nothing.
- ⚠ The re-snapshot confirmed **4/4 ids unchanged since the original**, so the two
  arms genuinely share one fixture — and that check also delivered a free
  **replication** of the extension arm across a second reload.

### ⚠⚠ Proving WHICH reload happened — the gap that would have wrecked it

⚠ **`methodsHash` and `initEpochMs` prove our JAR re-ran `init()`. Neither says the
DOCUMENT reloaded** — and a controller reload satisfying the extension proof while
being filed as the project arm would have inverted the entire finding.

⚠ Bitwig's undo history belongs to the PROJECT, so a controller reload leaves it
alone while loading a project clears it. **Measured: `canUndo` true → false**, which
is positive evidence the document was re-parsed from disk. Both proofs fired on this
run, and they are independent.

⚠ **The extension proof came from `initEpochMs`, not the hash** (`newCode: false` —
the jar was unchanged between the two runs). That is precisely the case the
`initEpochMs` field was added for, after the first version of this probe proved
re-init by hash alone and would have been unable to gate this run at all.

⚠ The undo detector is **reported, not enforced**. Whether Bitwig clears undo history
on load is an assumption about DAW behaviour nobody here has measured, and refusing a
good run on an untested assumption would be its own error — so an unproven reload
kind is labelled rather than blocked.

### ⚠ Also re-confirmed, and the framing depends on it

`channelId` is **stable WITHIN a session** — identical across back-to-back reads,
after re-scoping the container, and after a track-cursor round trip. Had it been a
per-read handle, "does not survive a reload" would be true for a much stronger reason
and the whole framing would be wrong.

⇒ ⚠⚠ **CONSEQUENCE, and it is the durable one:** addressing a take layer across
sessions must rest on the **NAME**, which E17 row 5 measured sticky across a content
change AND a save + restart. ⚠ This is the one place D6 inverts — for tracks
`channelId` is the key and the name is the human tag; for chains there is no key and
the tag is all there is.

⇒ ⚠ **The operator's "weird" is resolved, and the resolution is the useful part:**
the asymmetry with tracks is about what the project **FILE** persists, not about
what our proxies hand out. A track id is written to disk; a chain id is minted at
load. So the ○ is a property of the document format, and no amount of care on our
side can recover it — which is a cleaner statement than *"chain ids are unstable"*.

⚠ Also re-confirmed on the fresh fixture: `channelId` is **stable WITHIN a session**
— identical across back-to-back reads, after re-scoping the container, and after a
track-cursor round trip. Had it been a per-read handle the framing would be wrong in
a much stronger way.

### Method — and one guard that fired on its first outing

- ⚠ **The re-init PRECONDITION must not be the `methodsHash`.** A hash change proves
  NEW CODE loaded, which is a different claim from *`init()` re-ran* — and the arm
  this probe exists for is a controller reload where the hash may not move at all.
  Without a precondition the probe would cheerfully report *"the ids survived"*
  against an extension that never restarted: the emptiest false ● available.
- ⚠ **It fired, and it caught a real defect — mine.** The snapshot half was written
  before `initEpochMs` was added, so `snap.initEpochMs` was `undefined` and
  `x > undefined` is silently `false`. The probe REFUSED rather than scoring. Fixed
  to take EITHER proof — a moved `rig.stats.initEpochMs`, or a changed `methodsHash`
  (different code cannot be the same session) — and to treat a missing field as
  **UNKNOWN** rather than as "did not re-init", so an absent field can never
  masquerade as a failed precondition.
- ⚠ **The STRUCTURAL FINGERPRINT gate**, carried over from `e17ad`: container count,
  chain count, chain names and devices-per-chain captured at both ends, and the
  verify **refuses to compare ids at all** unless they match. So *"we read a
  different container"* can never masquerade as *"the ids changed"* — the artifact
  that made `e17n` untrustworthy, since a duplicate container has identical chain
  NAMES and different IDS.
- ⚠ **Explicit chain names** (`gnid·0`…`gnid·3`) for the same reason as E18c: a
  default name tracks content and is not a stable fingerprint field.
- The probe also **refuses if the track carries more than one container**, closing
  the `e17n` artifact by construction rather than by argument.

⇒ ⚠ **CLOSED 2026-08-04** by the project-reload arm above, run on this same fixture
with the operator's consent to save. The two arms are a matched pair and §3.2 needs
nothing further.

---
