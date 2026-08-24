---
id: E83
kind: evidence
state: active
source: dogfooding-d02-session-8
---

# E83 — Exact clip-color palette is live [K] (2026-08-24)

**Verdict: `set_clip_metadata` now accepts only 27 live-proved colors. Each
supported request returns the exact requested bytes. Unsupported requested or
prior colors refuse before a write.**

## Boundary finding

The E80 request `[145,105,78]` returned `[145,105,77]`. A request with blue
`77` returned `76`. A focused sweep also found `79 → 78` and `255 → 254`, while
`0` and `127` were exact. A one-second wait did not change these results.

The same conversion occurred through the cursor and launcher-slot color
writers. `Color.fromRGB255`, byte-bin centers, and one uniform offset did not
make arbitrary triples exact. A uniform offset of less than one left the E80
triple at `[145,105,77]`. An offset of one returned `[146,106,78]`. The host
conversion is not an independently invertible byte conversion for all triples.
Ghostnote therefore does not retry a failed byte with `+1` or `-1`.

## Exact domain

The public domain contains 26 live-proved Bitwig palette colors and the existing
Ghostnote legacy blue `[31,159,223]`. The Bitwig blue `[68,200,255]` is excluded
because no in-range input returned its blue byte exactly.

The extension sends the center of each measured wire byte:
`float32((byte + 0.5) / 255)`. It sends `1` for byte `255`. This rule and the
wire-byte column record the sent floats. The probe also emits every full-precision
sent float and host float as JSON.

| Requested bytes | Wire bytes | Host floats | Returned bytes |
| --- | --- | --- | --- |
| 84,84,84 | 84,84,85 | .329412,.329412,.329412 | 84,84,84 |
| 122,122,122 | 122,122,122 | .478431,.478431,.478431 | 122,122,122 |
| 128,128,128 | 128,128,129 | .501961,.501961,.501961 | 128,128,128 |
| 201,201,201 | 201,201,201 | .788235,.788235,.788235 | 201,201,201 |
| 134,137,172 | 134,137,173 | .525490,.537255,.674510 | 134,137,172 |
| 163,121,67 | 163,121,68 | .639216,.474510,.262745 | 163,121,67 |
| 198,159,112 | 198,159,113 | .776471,.623529,.439216 | 198,159,112 |
| 87,97,198 | 87,97,198 | .341176,.380392,.776471 | 87,97,198 |
| 132,138,224 | 132,138,224 | .517647,.541176,.878431 | 132,138,224 |
| 149,73,203 | 149,73,203 | .584314,.286275,.796079 | 149,73,203 |
| 217,56,113 | 217,56,114 | .850980,.219608,.443137 | 217,56,113 |
| 217,46,36 | 217,46,37 | .850980,.180392,.141176 | 217,46,36 |
| 255,87,6 | 255,87,7 | 1,.341176,.023529 | 255,87,6 |
| 217,157,16 | 217,157,17 | .850980,.615686,.062745 | 217,157,16 |
| 67,210,185 | 67,210,186 | .262745,.823529,.725490 | 67,210,185 |
| 115,152,20 | 115,152,21 | .450980,.596078,.078431 | 115,152,20 |
| 0,157,71 | 0,157,72 | 0,.615686,.278431 | 0,157,71 |
| 188,118,240 | 188,118,240 | .737255,.462745,.941177 | 188,118,240 |
| 225,102,145 | 225,102,146 | .882353,.400000,.568628 | 225,102,145 |
| 236,97,87 | 236,97,88 | .925490,.380392,.341176 | 236,97,87 |
| 255,131,62 | 255,131,63 | 1,.513726,.243137 | 255,131,62 |
| 228,183,78 | 228,183,79 | .894118,.717647,.305882 | 228,183,78 |
| 160,192,76 | 160,192,77 | .627451,.752941,.298039 | 160,192,76 |
| 0,166,148 | 0,166,149 | 0,.650980,.580392 | 0,166,148 |
| 62,187,98 | 62,188,99 | .243137,.733333,.384314 | 62,187,98 |
| 0,153,217 | 0,153,218 | 0,.600000,.850980 | 0,153,217 |
| 31,159,223 | 31,159,223 | .121569,.623529,.874510 | 31,159,223 |

## Public behavior

The contract owns the exact requested-to-wire lookup. The public tool returns
the complete named palette when it refuses an unsupported request. It states
that nothing was written and tells the caller not to change one byte and retry.

The tool also reads the prior metadata before the write. It refuses when the
prior color is outside the exact domain because that color cannot be restored
exactly. The executor repeats this check at the mutation boundary. The encoder
refuses any unsupported color even if a caller bypasses the public tool.

The live public proof first refused `[145,105,78]` and left the complete clip
metadata unchanged. It then requested red `[217,46,36]`. Independent readback
returned the same bytes. Ordinary reversal restored the complete legacy-blue
metadata with no omitted state or caveat.

## Verification

- Focused brain suite: 309/309 pass.
- Complete brain suite: 881/881 pass.
- Extension build and tests: pass.
- Live 27-color matrix: pass.
- Public refusal, readback, and reversal: pass.
- Contract handshake: 148 methods, hash `eb3391803ef4eea4`.
- Live cleanup: exact accepted five-track list restored.
- Deploy freshness: pass. The running controller started after the deployed
  file.

## Retrospective

Measure complete host color tuples before defining a component conversion.
Keep every supported request and its wire encoding in one live-proved table.
