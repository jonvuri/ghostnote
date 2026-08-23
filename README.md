# ghostnote

Agent-driven control of [Bitwig Studio](https://www.bitwig.com/) — a typed write
engine over the Bitwig controller API, plus `bwmod`, a `.bwpreset` byte-surgery
library that authors arbitrary modulator topology the live API cannot reach.

Two halves:

| Path | What it is |
|---|---|
| `extension/` | A Bitwig controller extension (Java). Exposes the API over newline-delimited JSON-RPC 2.0 on TCP `127.0.0.1:8686`. |
| `brain/` | The TypeScript side: the adapter contract, the fake adapter, `bwmod`, and the MCP server. |

Planning and evidence live in [`context/`](context/). Start with the current
[`NOW`](context/NOW.md) handoff, then use the
[`PROJECT`](context/PROJECT.md), [decision index](context/decisions/INDEX.md),
and [evidence index](context/evidence/INDEX.md) as needed.

> **Status:** Phases 1, 2, 4, and 5 are complete. Phase 3 is deferred. An open
> dogfooding loop precedes the Phase 6 backlog. This personal project has no
> support commitment or stability promise.

## Requirements

- **JDK 21 or newer.** The build targets 21 bytecode via `options.release`, so
  any newer JDK works without a toolchain download.
- **Node 24+.** The offline test suite uses `node:test` through `tsx`.
- **Bitwig Studio 6.0.6+** (API version 25) — only for the live half.
- `python3` — optional for running the suite, which skips `bwmod`'s 4
  reference-oracle tests without it. Required to *commit*: the pre-commit hook
  and CI both set `GHOSTNOTE_REQUIRE_ORACLE=1`, which turns that skip into a
  failure so the gate cannot quietly weaken.

## Build and install the extension

```sh
cd extension
./gradlew build          # -> build/libs/ghostnote-0.0.1.bwextension
./gradlew copyExtension  # -> ~/Documents/Bitwig Studio/Extensions/
```

Then enable it in Bitwig under **Settings → Controllers → Add → ghostnote**. It
declares zero MIDI ports; all communication is over TCP.

Bitwig hot-reloads the extension when the deployed file's **content** changes, so
`./gradlew copyExtension` re-runs `init()` without restarting the DAW. Note that
`touch` alone does *not* trigger it.

## Connect Codex

Install the brain dependencies, then add this server to `~/.codex/config.toml`:

```toml
[mcp_servers.ghostnote]
enabled = true
required = true
command = "node"
args = ["--import", "tsx", "src/mcp-server.ts"]
cwd = "/absolute/path/to/ghostnote/brain"
startup_timeout_sec = 20
```

Each array entry in `args` is one process argument. Do not combine `tsx` and the
source path in one entry. The direct Node command also avoids `npx` package
resolution and the `tsx` command-line IPC path.

Quit and restart Codex after a configuration change. The Codex desktop app, CLI,
and IDE extensions share this configuration. Start one Ghostnote chat at a time:
each chat starts its own MCP server and bridge connection.

## Run the offline suite

Needs no Bitwig, no bridge, no controller:

```sh
cd brain
npm ci
npm run check     # typecheck + the full offline suite
```

Optional scaffold sizes are read from `~/.ghostnote/rig.json` at `init()`; absent,
the defaults in `RigConfig.java` apply.

## Run the live probes

The `src/probes/` scripts are the spike's experiment record, retained as the
regression suite for Bitwig's *actual* API behaviour — they are what keeps the
offline fake honest. They need Bitwig running with the extension loaded.

```sh
cd brain
npm run probe:list        # every probe and the file it runs
npm run probe:e00         # bridge liveness
npm run probe:conformance # the adapter contract, against real Bitwig
```

Some probes create fixture tracks named `gn-A` / `gn-B` in the open project.
Run them against a scratch project, not your session.

## Contributing to your own checkout

There is no CI runner attached to this repository. The local equivalent:

```sh
git config core.hooksPath .githooks
```

which runs `npm run check` (and `./gradlew build`) on the halves a commit
touches. [`.github/workflows/ci.yml`](.github/workflows/ci.yml) mirrors it for
the day there is a remote — it has never executed.

## Licensing

MIT — see [`LICENSE`](LICENSE). Portions of the extension and the TypeScript
client are derived from [daw-mcp](https://github.com/ptaczek/daw-mcp), also MIT;
attribution is in [`NOTICE`](NOTICE).
