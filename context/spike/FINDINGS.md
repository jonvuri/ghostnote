# ghostnote spike — findings log

One section per experiment, appended as run. Verdicts: ● confirmed working /
◐ partial / ○ failed or unavailable.

---

## E0 — Toolchain bring-up (2026-07-18)

**Verdict: ● complete.** Extension builds, loads in Bitwig 6.0.6, and the
full TCP round-trip works. All 8 probe checks pass (`brain: npm run probe:e00`).

### Settled facts

| Item | Value |
|---|---|
| Bitwig | 6.0.6, reports `hostApiVersion` **25** at runtime |
| extension-api artifact | **25** (only version served on maven.bitwig.com; older versions are unpublished) |
| Extension runtime JVM | **Java 25** (Azul), bundled with Bitwig |
| Bytecode target | `--release 21` works; Bitwig's own bundled extensions are also major-65 (Java 21) |
| Build | Gradle 9.6 + local JDK 26 cross-compiling to 21; `gradle copyExtension` deploys |
| Transport | TCP loopback :8686, newline-delimited JSON-RPC 2.0 — confirmed incl. 20KB payloads, unicode, out-of-band error frames |
| Threading | requests marshaled via `host.scheduleTask` run on thread `"Control Surface Session"` |

### Gotchas discovered (the E0 blocker)

1. **Extension discovery is via ServiceLoader, not the manifest.** Bitwig 6
   requires `META-INF/services/com.bitwig.extension.ExtensionDefinition`
   listing the definition class. The `Extension-Class` manifest attribute
   (which daw-mcp's build.gradle sets) is ignored — daw-mcp's *released*
   jar contains the services file even though its Gradle build doesn't
   create it. Without it: `extension-registry error … No extensions found
   in <jar>`, and the extension silently never appears in the vendor list.
2. **The bundled javadoc's API-version annotations lag.** Newest "API
   version N" mentions in 6.0.6's bundled docs stop at 22, but the host
   actually serves 25. Trust `host.getHostApiVersion()` (or the maven
   artifact), not doc-annotation archaeology.
3. **Bitwig watches the Extensions folder and hot-reloads on file change.**
   Redeploying a running extension restarts it in place (bridge socket
   comes back up) — no Bitwig restart needed after the initial add. Errors
   from a failed scan appear in `~/Library/Logs/Bitwig/BitwigStudio.log`
   under `extension-registry`.
4. First-time activation is manual: Settings → Controllers → Add
   Controller → vendor "ghostnote" (no auto-detect with 0 MIDI ports).

### Decision impact

- Toolchain decision (DECISIONS-to-be): Java 21 target, extension-api 25,
  Gradle 9, Gson bundled. No obstacles found.
- Transport decision: TCP + newline JSON-RPC confirmed viable; strict
  per-line framing with -32700-and-continue verified (a malformed line
  does not poison the connection).
- Hot-reload (gotcha 3) makes the spike iteration loop fast:
  `gradle copyExtension` + rerun probe, no UI interaction.

---
