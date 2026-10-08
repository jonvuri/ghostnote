---
id: D44
kind: decision
state: active
updated: 2026-10-08
source: phase-8i3
---

# D44 — Long writes are optimized first, then bounded on their own input **[SETTLED 2026-10-08]**

The 8h4g amendment of
[D39](d39-long-agent-native-writes-run-in-the-background-on-their-own-name.md)
removed the background route from `agent-native-v1` because the worst
measured case was far under the 60 s MCP client timeout (E45). The 8i
review found admitted inputs that were not measured: staged
`compose_devices` of five layer chains of four devices, and
`set_device_controls` with no bound.
[E252](../evidence/experiments/e252-long-device-write-profile.md) measured
the largest admitted input of every `agent-native-v1` write. Before 8i3,
admitted calls took up to 102 s (staged 5×4), 89 s (its revert), and 72 s
(Drum Machine of 16 pads); others refused only after a long read
(`set_launcher_clip_properties` of 64 clips: 32 s), or could not be
reverted (`copy_launcher_clips` of 64 and `delete_launcher_clip` of more
than 8). After the optimizations, the longest admitted call is 33.5 s.

## Rule

1. **Optimize first.** Remove the waste that grows with the input, and keep
   each guard (E252 lists each change, its guard, and the saved work).
2. **Then bound.** Each write whose cost still grows with its input admits
   a maximum, so that its measured worst case, and the worst case of its
   `revert_change`, is at most 30 s, or under 45 s with a recorded reason.
   A larger request refuses before any project read or write, with code
   `outside-limit` and `detail: { limit, maximum, requested, decision:
   'D44' }`. The tool description and the schema text of the bounded input
   state the limit; the schema has no `maxItems` for it. The agent splits the
   work into more calls.
3. **No background route.** A bound is preferred over a background flag
   (D39 amendment): every bounded case fits in one direct call. A later
   write that cannot fit gets a flag on its own tool name under D39.

The limits (`brain/src/surface/write-limits.ts`):

| Tool | Limit | Worst measured case at the limit (E252) |
|---|---|---|
| `compose_devices` | 6 device units: a VST3 or CLAP source is 2, and a device with modulators or modulator edits 2 more; 4 modulators and modulator edits | 2×3 native: 23.2 s, revert 26.9 s; 2 modulated devices: 25.3 s; 3 Divas: 13.6 s, revert 15.9 s |
| `set_device_controls` | 64 settings on 4 device routes | 4 Diva routes of 16 settings: 22.5 s; Diva, 64 settings: 13.9 s; 44 Polysynth controls: 9.4 s |
| `delete_device` | 10 devices | 10 native: 25.2 s; 10 Divas: 20.7 s |
| `set_device_enabled` | 32 settings | 21.7 s |
| `rename_track`, `delete_track` | 64 tracks | 10.7 s; 15.5 s |
| `set_launcher_clip_properties`, `set_launcher_clip_launch_settings` | 8 clips (a host limit: one write stage confirms 8 clips) | 8 clips of 16,384 notes: properties 33.5 s, revert 32.8 s (reason: two captures of each reader-limit clip; the typical clip takes 8.1 s); launch settings 23.1 s |
| `copy_launcher_clips` | 8 copies | 8 of 16,384 notes: 13.2 s, revert 24.6 s |
| `delete_launcher_clip` | 4 clips (the revert writes each clip again) | 4 of 16,384 notes: 7.3 s, revert 23.0 s |
| `move_launcher_clips` | 8 rows | 8 of 16,384 notes: 23.7 s |
| `wrap_existing_device_modulation` | 15 modulators (a host limit: the 16-page remote window) | 1 through 15: 13.6 s |

The 8i3 limit follow-up raised the route limit (2 → 4) and the removal
limit (6 → 10) after the slot fixes (E252 `final3/`). A plug-in source
stays two units: 6 Diva chains at one unit each would revert in about 32 s
(estimate), and other plug-ins have more parameters than Diva.

Not bounded, with the measured reason: `add_devices` (schema maximum 16;
16 native devices 16.8 s, 6 Divas 6.4 s), the Drum Machine (16 pads: 12.5
s), `edit_preset_modulation` (the checks share one sampling session: 8
checks 7.0 s), `delete_scene` and `add_scenes` (the 128-scene window: 56
scenes deleted in 3.2–4.5 s), `add_tracks` (16: 7.2 s), and the clip and
document edits (E248).

## Why

A bound keeps one result shape and no polling for the agent (D39
amendment). The work that a bound refuses is still possible in more calls,
and each call keeps its exact guards and its change record. Two limits are
host limits, not time limits: they turn a late refusal or a failed proof
into an early `outside-limit`.

## Consequences

- No admitted `agent-native-v1` call reaches the 60 s client timeout.
- A plug-in with many more DirectParameters than Diva (281) has a higher
  fixed cost for each route and each removal; Ghostnote cannot know the
  count before it reads. E252 names this as the remaining unbounded
  dimension.
- `stable-v1` keeps its schemas and wording (the frozen rollback); it shares
  the optimized adapter and engine.
