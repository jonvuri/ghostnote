---
id: E2f
kind: evidence
state: active
source: FINDINGS.md
---

# E2f — Stable track identity DOES exist: channelId (UUID) (2026-07-19)

**Verdict: ● E2c's "no stable track addressing" was too strong — I missed
`Channel.channelId()`, a per-track UUID (API 20+).** Prompted by the same
"did we miss part of the API?" challenge that surfaced CLAP. Probe `e02f`,
all green. bank index and name remain brittle (E2c stands on those), but
they are **not the only identifiers** — there is a stable one.

### What channelId is

`track.channelId()` → `StringValue`, javadoc "Reports the channel UUID."
Every track (incl. FX and Master) reports a distinct, UUID-shaped id, e.g.
gn-A = `b07f6b06-8f4f-4f4f-802d-ddf1a5190515`. (`channelIndex()`, API 22,
also exists but is just the mutable index as a value.)

### Proven stable (in-session)

- **Survives index shifts:** inserting a track ahead of gn-A/gn-B shifted
  their positions but their channelIds (and the tracks they name) were
  unchanged.
- **Survives rename:** renaming gn-A→"renamed-A" left channelId identical.
- **Clean tombstone:** a deleted track's UUID resolves to found=false — no
  aliasing onto whatever slid into its index.
- **Re-resolvable:** scanning the bank for a matching channelId returns the
  track's *current* index/name/type — the addressing primitive
  (`track.resolveByChannelId`). gn-A's UUID was byte-identical across
  separate probe runs and all structural churn this session; a
  delete+recreate of gn-B correctly minted a NEW UUID (recreated = new
  object).

### The addressing model this unlocks

**Address tracks by channelId, resolve to a live index/object on demand.**
This is the serializable identity E2c said was missing:
- Store channelId in patches/checkpoints, not bank index or name.
- On each operation, `resolveByChannelId` → current index → point a pool
  cursor (E1). Combines with E1's pinned-cursor *in-session* handle: UUID
  is the durable key, the pinned cursor is the fast live handle.
- The E2c fixture bug (identifying a created track by "last Instrument"
  positional heuristic → renamed/deleted the wrong track) is exactly what
  UUID-diff prevents. **The corrected probe identifies a newly-created
  track as "the channelId not present before"** — robust regardless of
  where `createInstrumentTrack` actually drops it (which E2f re-confirmed
  is inconsistent: the newcomer landed at index 0 here vs index 1 in E2c).

### Cross-SESSION persistence — ● CONFIRMED

User saved the project, fully quit Bitwig, and reopened. All six tracks'
channelIds matched the captured UUIDs **byte-for-byte** (gn-A
`b07f6b06-…`, gn-B `9096b9f6-…`, plus Inst 1/Audio 2/FX 1/Master).
channelId is a **persistent, serializable** identity that survives a full
application restart + project reload — exactly the durable key checkpoints
need. (Recreated tracks get a fresh UUID; a given track keeps its UUID for
the life of the project.)

### Decision impact (amends E2c)

- **Track addressing = channelId (UUID) as the stable key + resolve-to-index
  + pool cursor.** Supersedes "no stable addressing"; E2c's brittleness
  finding now applies specifically to *index and name*, not identity.
- Checkpoints/patches serialize channelIds, never indices/names.
- Same question worth checking for clips/scenes/devices: is there an
  equivalent stable id? (Slots are addressed within a track; scenes have
  `sceneIndex` which E3 showed shifts. Worth a pass in Phase 1.)
- **Lesson reinforced (twice now): don't record a capability ○ from a
  partial API pass.** channelId (API 20) and the DirectParameter API were
  both present and both initially missed.

---
