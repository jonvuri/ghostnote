---
title: Host API — source lookup, and mechanisms ghostnote does not use
kind: capability
state: active
updated: 2026-08-15
scope: extension-api 25 as an artifact; unused mechanisms recorded as leads
evidence: E16l, E16n/o, E16p; reference/BitX
---

# Host API

> **Provenance.** Each claim carries `[K]` known, `[I]` inferred or `[U]`
> unknown, and cites its E-number or names its observer and date. Read the four
> rules in [INDEX.md](INDEX.md) before you edit this page.

This page holds two things: **how to read the API source**, and **mechanisms
that exist and that ghostnote does not use**. Recording a lead is not adopting
it. Adoption belongs to Phase 4 or to a 3f successor.

---

## 1. How to read the API 25 source

Ghostnote compiles against `com.bitwig:extension-api:25`, resolved from
`https://maven.bitwig.com` (`extension/build.gradle`) [K, source read].

⚠⚠ **`maven.bitwig.com` publishes the `-sources` classifier beside the compile
artifact.** The authoritative source is therefore one command away, and no live
probe and no third-party copy is needed to enumerate a type
[K, resolved 2026-08-15].

```
cd extension && ./gradlew bitwigApiSourcePath     # prints the cache path
unzip -o <that path> -d /tmp/api25                # 278 .java files
```

`bitwigApiSource` is a dedicated configuration that is **not** on the compile or
runtime path, and no task depends on it, so an ordinary build never resolves it.
The types live under `/tmp/api25/com/bitwig/extension/controller/api/`.

⚠ There is **no javadoc jar** — `extension-api-25-javadoc.jar` returns 404. The
source carries the javadoc comments inline, which is what matters.

**How this was done before, and why the older citations read as they do.**
Member enumeration used to require a live probe or a third-party copy. E16o's
*"`InsertionPoint` has exactly 14 members"* was measured by probe, and E16l's
complete-recall pass worked from `member-search-index.js` [K, E16l, E16o].
⚠ **Both are now confirmed by source read** — see the table below.

⚠⚠ **Do not vendor `reference/BitX/BitwigAPI/BitwigAPI25.txt` into this repo.**
It is Bitwig's source redistributed by a third party, and its licence for that
redistribution has not been established. It is also no longer needed for this
purpose: the Maven artifact is authoritative and comes from Bitwig directly.

### Surface sizes, for calibration

Verified against the resolved sources jar, 2026-08-15, unless noted.

| Thing | Count |
|---|---|
| `.java` files in the sources jar | **278** (291 entries) |
| …of which `controller/api` | 205 |
| Members across the whole API | 1968 [K, E16l, by probe] |
| `InsertionPoint` members | **14**, of which 3 relocate devices — ⚠ E16o's probe count **confirmed** |
| `Scene` members | **8** — ⚠ E16l's count **confirmed** |
| `Device` declarations | **81**, of which **38 are `@Deprecated`** ⇒ 43 live. Enumerated in [devices](devices.md) §4 |
| `SpecificBitwigDevice` methods | **2** — see §6 |
| Members whose name contains "layer" | 8 [K, E17, by probe] |

⚠ The BitX dump states 276 types against this jar's 278 source files. Prefer the
Maven artifact where the two disagree.

---

## 2. ⚠ What `reference/BitX` is, stated accurately

`BitX` (`wimvandenborre/BitX`, API 25 — the same artifact ghostnote compiles
against) is a **~3,100-line command runner across 5 Java files** [K, measured
2026-08-15]. It **creates no structure** and drives only racks a human built.

Its whole structural surface is one `insertFile` call for a drum file
(`BitXFunctions.java:698`). It calls no `insertBitwigDevice`, no `moveDevices`,
no `copyDevices`, no `duplicate` and no `deleteObject` [K, grep, 2026-08-15].

⇒ **BitX contributed data and one existence proof. It contributed no technique.**
Its device UUIDs and parameter-ID strings are in [devices](devices.md); its one
existence proof is §4 below. Nothing in it addresses the problems ghostnote has
actually had to solve — chain lifecycle, identity, readback discipline.

---

## 3. `[I]` A type-filtered, cursor-free device bank

This is the one mechanism in BitX that ghostnote does not already use.

```java
DeviceMatcher m = host.createBitwigDeviceMatcher(uuid);   // ControllerHost, API 12
deviceBank.setDeviceMatcher(m);                            // DeviceBank, API 12
```

- `createBitwigDeviceMatcher(UUID)` — `ControllerHost.java:1175`, `@since API 12`.
  Javadoc: *"Creates a `DeviceMatcher` that will match any Bitwig native device
  with the supplied id."* Siblings at `:1161` `createAudioEffectMatcher()` and
  `:1168` `createNoteEffectMatcher()`.
- `setDeviceMatcher(DeviceMatcher)` — `DeviceBank.java:144`, `@since API 12`, the
  last member of the interface. Javadoc: *"Sets a `DeviceMatcher` that can be
  used to filter devices in this bank to show only those matching the supplied
  matcher. `@param matcher` … or null if all devices should be matched."*

[K that both exist and compile-target API 25, read from the resolved sources jar
2026-08-15. `[I]` that it would behave usefully here — **zero uses in
ghostnote**, and it has never been run against this project's fixtures.]

**Why it might matter.** It gives a device bank filtered **by type** and it does
not follow a cursor. Every cursor-following bank in `Rig` has the cursor as a
hidden argument, which is the trap E16o recorded and the lag §6 of
[containers](containers.md) had to bound. A matcher-filtered bank sidesteps both.

**Probe that would raise this to `[K]`:** create a bank with an Instrument Layer
matcher on a track holding a Layer, a Selector and a Polysynth. Assert the bank
reports exactly the Layer, and assert the reading does not move `cursorDevice0`.

⚠ It is **not** an identity mechanism. It matches a *type*, so on a track with two
Instrument Layers it reports both and tells you nothing about which is which. It
does not touch [identity](identity.md)'s gap.

---

## 4. `[I]` Process spawn from inside an extension works

`new ProcessBuilder(...).inheritIO().start()` on a background thread
(`BitXGraphics.java:65`, builder at `:74-97`), branching on
`host.platformIsWindows()` / `host.platformIsMac()`
(`ControllerHost.java:89` and `:97`; `platformIsLinux()` at `:105`) [K that the
code exists and that the predicates exist; `[I]` that it runs, since ghostnote
has not executed it].

⚠ **Relevant only to the autonomy constraint** in [PROJECT.md](../../PROJECT.md):
*"required assets are provisioned at build time, never authored or primed by the
operator at runtime."* A spawn is a way to reach outside the JVM. It is recorded,
not recommended, and it is not needed by anything currently planned.

---

## 5. `[I]` The OSC module is reachable

`getOscModule()` is declared on `Host`, not on `ControllerHost`, so it is reached
through inheritance (`api/Host.java:63`, `@since API 5`). `OscModule`
(`api/opensoundcontrol/OscModule.java`) declares exactly three method names in
four overloads:

| Member | Line | Since |
|---|---|---|
| `createAddressSpace()` | 18 | API 5 |
| `createUdpServer(int port, OscAddressSpace)` | 26 | API 5 |
| `createUdpServer(OscAddressSpace)` → `OscServer` | 38 | API 10 |
| `connectToUdpServer(String host, int port, OscAddressSpace)` | 48 | API 5 |

[K that the surface exists, read from the resolved sources jar 2026-08-15.
Unused by ghostnote.]

⚠ **Noted as an available second channel, not as a recommendation.** The existing
bridge already serves two clients atomically [K, [E16p/q](../experiments/e16p-e16q-the-bridge-serves-two-clients-atomically-and-the-middle-dot.md)], so there is no
problem here that OSC solves. ⚠ An OSC channel would also sit outside the
executor and stash boundary that every ghostnote write passes through, which is a
correctness argument against it and not merely a preference.

---

## 6. `[U]` `SpecificBitwigDevice.createIntegerOutputValue(String id)`

An output value readable from a native device
(`SpecificBitwigDevice.java:21`). ⚠ The method carries **no** `@since` of its
own; the interface that declares it is `@since API 12`.
`SpecificBitwigDevice` declares exactly two methods and this is the second —
see [devices](devices.md) §2.

**Used by neither project.** Which ids are valid is undocumented. **Probe:** call
it on a Polysynth with each harvested ID token and record which resolve.

---

## 7. `[K]` `ObjectProxy.createEqualsValue(ObjectProxy)`

On the base of every proxy (`ObjectProxy.java:22`, `@since API 3`). It creates a
`BooleanValue` that is true when two proxies target the same object. ⚠ That
interface declares only two members: `exists()` at `:14` and this.

E16l recorded it as **unprobed**. ⚠ **That reading is superseded**: ghostnote
adopted it, and `Rig.java:1174` builds
`cursorDevice0.createEqualsValue(cursorDeviceBanks[0].getDevice(d))` with the
results marked at `:1182` [K, source read 2026-08-15].

⚠ It is **not** an identifier — see [identity](identity.md) §4 for what it can
and cannot do.

---

## What this page does not do

It does not adopt §3-§6. Each is recorded with its provenance and the probe that
would settle it. ⚠ A `[K]` here means only *the member exists and is declared as
described*; it never means the mechanism was exercised against this project.

---

## Supersession record

| Date | Change |
|---|---|
| 2026-08-15 | Page created. |
| 2026-08-15 | E16l's *"`createEqualsValue` … Unprobed"* superseded — ghostnote now uses it. §7. |
| 2026-08-15 | ⚠ *"Only the `.jar` is in the Gradle cache; there is no `-sources` artifact"* **superseded**. The classifier is published; `extension/build.gradle` now resolves it through a dedicated `bitwigApiSource` configuration, and every declaration on this page is re-anchored to that source. The `reference/BitX` dump is demoted to a cross-check. §1. |
