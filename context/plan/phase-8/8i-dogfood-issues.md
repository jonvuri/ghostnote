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
a review session. A transcript reference is an extract file and its `line`
values, under `context/evidence/data/`.

Owners: `description`, `tool`, `client`, `agent`, `driver` (the runner, a
fixture driver, or the runbook), and `operator` (the fixture state).

| ID | Task | Client | Transcript | What happened | Expected | Owner | Decision |
|---|---|---|---|---|---|---|---|
| D1 | P1 (E261) | Codex | `phase8i12-dogfood/p1-codex/extract.jsonl`, lines 13–19 | Before the first Ghostnote call, the agent ran two scripts: one lists every Ghostnote tool with its description (23,318 tokens before the client cut the output), one prints two descriptions again. The `--json` event stream does not show these calls | No expectation for the client. The driving agent must read the rollout file, not the event stream. The cut means that the agent can see an incomplete tool list | client | |
| D2 | P1 and smoke (E261) | Codex | `phase8i12-dogfood/p1-codex/meta.json`; extract line 37 | `codex exec` ended 21 s after the last agent message (46 s wall, 24 s of session rows). The smoke run took 42 s for one read | The process ends with the turn. Inference: a client step at exit (the smoke run logged "failed to refresh available models: request timed out") | client | |
| D3 | Smoke (E261) | Claude | `phase8i12-dogfood/smoke-claude-failed-server/events.jsonl` | With a `cwd` field in the MCP configuration, the Ghostnote server status was `failed`. The agent reported the failure and made no change. The runner now changes directory in the command | A stated server start that works for each client. A public install note for Claude Code must not rely on `cwd` | driver | |
| D4 | Entry checks (E261) | — | E261, Entry checks | The first `probe:hello` after the extension start listed 4 tracks of another project state; later reads listed `gn-scale-test`. The hello passed | The entry check proves the project. The runbook now reads the project name before each setup; the hello could print it | driver | |
| D5 | Entry checks (E261) | — | `phase8i12-dogfood/state-entry.jsonl` | At entry, `selection.status` reported no selected slot. The E234 baseline names slot `gn-A` row 0 | The baseline selection, or a baseline text that admits no slot selection after a project open | operator | |
