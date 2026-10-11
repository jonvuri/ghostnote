---
title: 8i automated dogfood issue log
kind: reference
state: active
updated: 2026-10-11
parent: 8i-agent-native-hybrid-dogfood.md
---

# 8i automated dogfood issue log

The driving agent of an automated dogfood session
([runbook](8i-automated-dogfood-runbook.md)) adds one row for each issue.
It does not change product code. The operator fills the decision column in
a review session. The operator reviewed D1 to D12 on 2026-10-11: D9 and
D8 get fix sessions; the other rows need no action. A transcript reference is an extract file and its `line`
values, under `context/evidence/data/`.

Owners: `description`, `tool`, `client`, `agent`, `driver` (the runner, a
fixture driver, or the runbook), and `operator` (the fixture state).

| ID | Task | Client | Transcript | What happened | Expected | Owner | Decision |
|---|---|---|---|---|---|---|---|
| D1 | P1 (E261) | Codex | `phase8i12-dogfood/p1-codex/extract.jsonl`, lines 13–19 | Before the first Ghostnote call, the agent ran two scripts: one lists every Ghostnote tool with its description (23,318 tokens before the client cut the output), one prints two descriptions again. The `--json` event stream does not show these calls | No expectation for the client. The driving agent must read the rollout file, not the event stream. The cut means that the agent can see an incomplete tool list | client | No action (operator, 2026-10-11) |
| D2 | P1 and smoke (E261) | Codex | `phase8i12-dogfood/p1-codex/meta.json`; extract line 37 | `codex exec` ended 21 s after the last agent message (46 s wall, 24 s of session rows). The smoke run took 42 s for one read | The process ends with the turn. Inference: a client step at exit (the smoke run logged "failed to refresh available models: request timed out") | client | No action (operator, 2026-10-11) |
| D3 | Smoke (E261) | Claude | `phase8i12-dogfood/smoke-claude-failed-server/events.jsonl` | With a `cwd` field in the MCP configuration, the Ghostnote server status was `failed`. The agent reported the failure and made no change. The runner now changes directory in the command | A stated server start that works for each client. A public install note for Claude Code must not rely on `cwd` | driver | No action (operator, 2026-10-11) |
| D4 | Entry checks (E261) | — | E261, Entry checks | The first `probe:hello` after the extension start listed 4 tracks of another project state; later reads listed `gn-scale-test`. The hello passed | The entry check proves the project. The runbook now reads the project name before each setup; the hello could print it | driver | No action (operator, 2026-10-11) |
| D5 | Entry checks (E261) | — | `phase8i12-dogfood/state-entry.jsonl` | At entry, `selection.status` reported no selected slot. The E234 baseline names slot `gn-A` row 0 | The baseline selection, or a baseline text that admits no slot selection after a project open | operator | No action (operator, 2026-10-11) |
| D6 | S2 (E262) | Codex, Claude | `phase8i13-dogfood/s2-codex/extract.jsonl`, lines 63, 76; `s2-claude/extract.jsonl`, lines 68, 88 | Each agent restored the device order with a second `move_devices` and did not try `revert_change` on the move. Each report says that nothing stays that it could not undo. No report says that the move has no revert and was restored by hand | The request was "tell me anything you could not undo". A report that names the step with no revert and the manual restore | description | No action (operator, 2026-10-11) |
| D7 | S2 (E262) | Claude | `phase8i13-dogfood/s2-claude/extract.jsonl`, line 54 | `read_device_controls` with a `layer-chain` route to the wrapped Delay+, 3 s after the `wrap_existing_device_modulation` result, returned `authority-unavailable`, `standing: unstable`, no parameters (558 ms). The agent did not retry and reported one failed read | The controls of a device in the new layer chain, or a refusal that says when to retry | tool | No action (operator, 2026-10-11) |
| D8 | S2 (E262) | Codex, Claude | `phase8i13-dogfood/s2-codex/extract.jsonl`, lines 69, 70; `s2-claude/extract.jsonl`, lines 63, 64, 72, 74 | `revert_change` of an `add_devices` effect deleted the device and returned `fidelity: none` with empty `restored` and `notRestored` lists. `check_revert` returned `fullyRestorable: true` with an empty `wouldRestore` list | A result that names the deleted device and a fidelity that agrees with the verified state | tool | Fix: [8i15](8i15-device-add-revert-report.md) |
| D9 | S4 (E262) | Codex, Claude | `phase8i13-dogfood/s4-codex/extract.jsonl`, lines 65–74; `s4-claude/extract.jsonl`, lines 45–52 | A copy from row 0 to row 2 took three writes: copy to row 1, copy to row 2, then remove the row 1 copy (`revert_change` or `delete_launcher_clip`). A move of the row 1 copy to row 2 refused (`occupied`, boundary row 3). The route works only when the next row is empty | One call copies a clip to any empty row of the track | tool | Fix: [8i14](8i14-clip-copy-to-any-row.md) |
| D10 | S4, S5 (E262) | Codex | `phase8i13-dogfood/s4-codex/extract.jsonl`, lines 15, 20, 40; `s5-codex/extract.jsonl`, line 15 | S4, with "Use Ghostnote." in the prompt: three `cua_repl` calls. `getApp("Ghostnote")` failed, `getState()` returned the list of the applications on the operator's computer, and `getApp` for Bitwig was refused as not approved. S5, without the line: the first call was a refused `cua_repl` call for Bitwig; the agent then found Ghostnote in the tool list. E261 had no `cua_repl` call | No expectation for the client. The runner can disable the plug-in for a session; the evidence copy must not hold the application list (removed here) | client | No action (operator, 2026-10-11) |
| D11 | Fixture check (E262) | — | E262, Driver and runner; each `state-cleanup.jsonl` | After a clip write on a fixture track and the track delete, `selection.status` reports the last slot (`trackIndex`, `slotIndex`) and `slot.status` reports `isSelected: false`. The state no longer equals `state-entry.jsonl` (no slot). The session compared without the two slot fields | A `selection.status` that reports no slot when none is selected, or a baseline comparison that does not hold the slot fields (the runbook now says so) | driver | No action (operator, 2026-10-11) |
| D12 | S1, S2, S4 (E262) | — | E262, Driver and runner | The plan asked for raw wire reads of the state. The bridge has no clip or device read without a cursor, so the driver reads clip documents and device controls with the product read tools in its own process | An independent read that does not use the tool under test, or a plan that accepts the product read | driver | No action (operator, 2026-10-11) |
