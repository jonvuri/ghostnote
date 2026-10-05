---
title: E229 — Replay fetch cost
kind: evidence
state: done
updated: 2026-10-05
owner: phase-8h3b
---

# E229 — Replay fetch cost

## Status

[8h3b](../../plan/phase-8/8h3b-replay-fetch-cost.md) is complete. Five
fixtures had 10 trials each. Each trial fetched one D30 close capture in
16 variants, which gives 800 fetches. Every fetch was bit-exact against the
baseline rows. Every baseline matched the declared fixture.

The largest fixed cost is the host task queue. Each bridge request waits
about 20 ms before its controller task runs, also when the controller is
idle. At 131,072 notes, Gson serialization of doubles and brain JSON parsing
are the largest variable costs. Encoding is small.

**Selected format for 8h3c:** `packedDict`, with one page, encoded on the
controller thread. At 131,072 notes the fetch median falls from 202 ms to
40 ms, and read plus fetch falls from 505 ms to 339 ms. All results keep
`complete:false` and `eligible:false`.

## Method

The research build `8h3b-fetch-v1` has profile `phase-8-probe-v1`, 98 methods,
and hash `d89cee6bf21c1f96`. It loaded fresh at `2026-10-05T12:33:42.655Z`.
The owned unsaved project was `New 4`. The config is the E227 replay config
with stamp `8h3b-fetch`.

- The close task copies the decoded notes into a `ReplayFetch.Capture`
  (median 0.4 ms at 131,072 notes). All formats encode this copy.
- `replayFetch` encodes a page on the controller thread. `replayPrepared`
  returns a payload that a new thread encoded from the copy after the close.
- A research timing sink in `Bridge` records the controller-thread phases of
  each request: queue wait, dispatch (encode is part of it), Gson
  serialization, and socket write. Normal builds set no sink.
- The driver (`brain/src/probes/phase8h3b-fetch.ts`) binds from park with the
  8h3a select-first route. It waits for the D30 close and the 2 s oracle.
  Then it fetches in each variant, in a different order in each trial. Each
  fetch uses its own socket, with raw byte times. A second socket pings
  during each fetch.
- Exactness is a SHA-256 digest of every field of every row as float64.
  The baseline is `rows-16k`, the E227 format.

Formats:

| Format | Content |
|---|---|
| `rows` | E227 JSON rows, one array of nine values for each note |
| `columns` | One JSON array for each field. A field with the host default on every note is omitted |
| `ints` | `columns`, but each double field is an index array into a value table |
| `packed` | Little-endian columns (f64, i32, u8) in one base64 string, with default omission |
| `packedDict` | `packed`, but each double field is a u8 or u16 index into a value table. A field with more than 65,536 distinct values stays f64 |

Each format ran with pages of 16,384 notes and as one page. Rows also ran with
pages of 65,536 notes. All five formats also ran prepared off the controller
thread.

## 1. Cost breakdown of the E227 format

These are medians from 10 trials. Controller time is dispatch plus
serialization plus write.

| Fixture | Notes | Bytes | Pages | Fetch | Encode | Serialize | Controller, longest page | Receipt | Parse |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `one-64` | 1 | < 1 KiB | 1 | 24 ms | 0.0 ms | 0.0 ms | 0.2 ms | 24 ms | 0.0 ms |
| `n4096-64` | 4,096 | 223 KiB | 1 | 34 ms | 1.8 ms | 5.2 ms | 9.0 ms | 32 ms | 1.8 ms |
| `n16384-512` | 16,384 | 921 KiB | 1 | 55 ms | 6.2 ms | 18.3 ms | 27.6 ms | 49 ms | 6.8 ms |
| `sustain-2048` | 16,384 | 927 KiB | 1 | 53 ms | 4.5 ms | 17.6 ms | 25.8 ms | 47 ms | 6.9 ms |
| `n131072-2048` | 131,072 | 7.1 MiB | 8 | 202 ms | 11.2 ms | 55.3 ms | 9.7 ms | 148 ms | 38.0 ms |

- **Queue wait.** With no fetch, the ping queue wait had a median of 20.9 ms
  and a maximum of 22.5 ms (21 samples). Every page pays this wait. At
  131,072 notes the 8 pages pay it 8 times. The time between pages added
  37 ms more.
- **Encode** is at most 11 ms. **Gson serialization** of the JSON tree is 3 to
  5 times the encode. It is the largest controller-thread cost.
- **Wire.** One frame is one line. The time from first byte to last byte was
  at most 5 ms, also for 7.1 MiB.
- **Parse.** Brain `JSON.parse` takes 38 ms for 7.1 MiB.
- **Blocking.** One page blocks the controller thread for its controller time.
  The rows format in one page at 131,072 notes blocked for 55 ms median and
  102 ms maximum. During that fetch the ping queue wait reached 106 ms. With
  16k pages, the longest wait was 33 ms.

## 2. Candidate fixes

Medians (p95). The total is the D30 close time plus the fetch.

| 131,072 notes | Bytes | Fetch | Total | Controller, longest page | Longest ping wait |
|---|---:|---:|---:|---:|---:|
| `rows-16k` (E227) | 7.1 MiB | 202 (243) ms | 505 ms | 9.7 (29) ms | 33 ms |
| `rows-64k` | 7.1 MiB | 124 ms | 421 ms | 35 ms | 63 ms |
| `rows-all` | 7.1 MiB | 104 (159) ms | 405 ms | 55 (102) ms | 106 ms |
| `columns-all` | 6.0 MiB | 130 ms | 434 ms | 86 ms | 108 ms |
| `ints-all` | 3.2 MiB | 86 ms | 389 ms | 47 ms | 110 ms |
| `packed-16k` | 6.0 MiB | 182 ms | 486 ms | 8.1 ms | 24 ms |
| `packed-all` | 6.0 MiB | 44 (91) ms | 342 ms | 13.6 (39) ms | 42 ms |
| `packedDict-16k` | 2.5 MiB | 180 ms | 479 ms | 7.8 ms | 24 ms |
| `packedDict-all` | 2.5 MiB | 40 (53) ms | 339 ms | 11.8 (27) ms | 43 ms |
| `packed-prepared` | 6.0 MiB | 38 (40) ms | 341 ms | 7.9 (9.6) ms | 27 ms |
| `packedDict-prepared` | 2.5 MiB | 32 (45) ms | 337 ms | 3.2 (4.7) ms | 23 ms |

| 16,384 notes (`n16384-512` / `sustain-2048`) | Fetch | Controller |
|---|---:|---:|
| `rows-16k` | 55 / 53 ms | 27.6 / 25.8 ms |
| `packed-all` | 37 / 35 ms | 10.7 / 8.2 ms |
| `packedDict-all` | 35 / 34 ms | 8.7 / 6.9 ms |
| `packedDict-prepared` | 28 / 30 ms | 2.3 / 2.4 ms |

At 4,096 notes every variant took 25–35 ms, and one note took 24 ms. That is
mostly one queue wait.

1. **Page size.** Fewer pages remove queue waits. With JSON, one large page
   moves the serialization into one long controller block (up to 102 ms).
2. **Columnar JSON** saves 16% of the bytes. It does not reduce serialization
   much, because doubles stay as text.
3. **Compact encoding.** Integer arrays halve the bytes, but Gson still
   serializes a large tree. A packed base64 block removes most serialization
   and parse cost. One string is cheap to write and to parse. Value tables
   make the block 2.4 times smaller and the tails shorter.
4. **Off the controller thread.** The close-task copy makes this safe. The
   copy cannot change after the close. Encoding off the thread removes the
   encode from the controller block, but the bridge still serializes the
   payload. For packed formats it saves only 2–9 ms of controller time at
   131,072 notes.

Each fix ran alone and in combination. The fixture value distributions have
few distinct values. A clip with more than 65,536 distinct values in one
field uses f64 for that field. That fallback is the `packed` layout, which was
also measured.

## 3. Selected format

Use **`packedDict` with one page, encoded on the controller thread**, for
8h3c:

- **Total time.** Read plus fetch is 339 ms median at 131,072 notes. The
  E227 format takes 505 ms, and the best variant measured takes 337 ms. At
  16,384 notes `packedDict-all` saves 18–20 ms on the fetch.
- **Controller block.** 11.8 ms median and 27 ms p95 at 131,072 notes. This
  is about one queue wait. The JSON formats in one page block for 47–102 ms.
- **Code size.** One encoder of about 60 lines in Java and one decoder of about
  40 lines in TypeScript. No transport change is needed. The prepared
  variants need a worker thread and payload lifecycle, and that work saves
  only 2–9 ms. `packed` is a little smaller in code, but its tails are
  longer (fetch p95 91 ms against 53 ms) and its frames are 2.4 times larger.

Product limits for 8h3c: keep one page up to 131,072 notes, which is the
largest measured. Above that, use pages of 131,072 notes. Each additional
page pays one queue wait. Write the wire goldens in 8h3c.

## Artifacts

Data is in [phase8h3b-fetch](../data/phase8h3b-fetch/). Each
`fetch-<fixture>.json.gz` holds the raw page, ping, and bridge timing records
of 10 trials. `summary.json` is recomputed by
`npm run probe:phase8h3b-fetch -- summary <dir> <summary.json>`. It checks the
exact flags against the digests and the costs against the raw pages.
`state.json` holds the owned track IDs and fixtures. `config-entry.json`
holds the original config.

## Verification and restoration

Brain type checking and all 1,874 tests pass. Extension `check` passes,
including the new `ReplayFetchTest`. A one-off check decoded Java-encoded
pages of every format with the TypeScript decoder, with equal digests. Wire
goldens are unchanged; the method table is the same. Context links and diff
whitespace pass.

The original config hash is `256bbf07…43b0`. The research archive is removed.
The normal archive was rebuilt from this change, because it holds the timing
hook, and deployed. The operator closed `New 4` without saving and replaced
the controller. The normal hello passes with `normal-v1`, 85 methods, hash
`bba7383dce25c0f0`. Initialization at `2026-10-05T12:45:08.491Z` is after
deployment at `2026-10-05T12:42:40Z`. The active project has none of the
fixture track IDs. [restoration.json](../data/phase8h3b-fetch/restoration.json)
records these checks.
