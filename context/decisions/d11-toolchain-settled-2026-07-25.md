---
id: D11
kind: decision
state: active
source: DECISIONS.md
---

# D11 — Toolchain **[SETTLED 2026-07-25]**

**`extension-api:25` compiled to Java 21 bytecode, Gradle with `options.release`
(NOT a toolchain block), Node 24 + TypeScript, no runtime Python.**

- Bitwig 6.0.6 bundles a Java 25 JVM; targeting **21 (LTS)** gives headroom and
  builds on any JDK ≥ 21 (developed on Temurin 26). A `java { toolchain }` block
  would pin an exact JDK and force a provisioning download or fail — `release`
  guarantees the property that matters, which is 21-compatible bytecode.
- **Reproducible archives** (`preserveFileTimestamps = false`,
  `reproducibleFileOrder = true`): without them two builds of identical source
  differ byte-for-byte.
- **Java, not Kotlin** — every reference codebase is Java, and copy-paste parity
  was worth more than ergonomics during verification (SPIKE_PLAN §2.2). Revisit
  freely; nothing depends on it.
- **Python (`tools/bwformat/*.py`) is a CI ORACLE only** (D3). The product has no
  Python dependency; `GHOSTNOTE_REQUIRE_ORACLE=1` makes it mandatory in CI and the
  pre-commit hook.
- **`init()` is a hazard surface.** Check `@Deprecated` before wiring any handle
  there — `getModulationSource(int)` throws and takes the whole extension down
  (E7-Finding-0, standing rule 9). `npm run probe:hello` is the first thing run
  after any deploy.
