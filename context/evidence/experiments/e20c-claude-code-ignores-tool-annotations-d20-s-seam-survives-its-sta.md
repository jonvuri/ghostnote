---
id: E20c
kind: evidence
state: active
source: FINDINGS.md
---

# E20c — ⚠⚠ CLAUDE CODE IGNORES TOOL ANNOTATIONS: D20's seam survives, its stated reason does not [K] (2026-08-09)

**Verdict: ⚠⚠ ○ on the mechanism, ● on the seam.** D20 rests its stop-and-ask on
*"the host's permission flow"* and flags the claim as **a spec reading, not a
measurement**. Measured now, and the reading is wrong: Claude Code does not appear
to read `destructiveHint` at all. Probe `e20c` — ARM A autonomous (7/7), ARM B the
operator in a live Claude Code session.

### ARM A — we emit them correctly, which is what makes ARM B interpretable

| tool | annotations, as they arrived at an MCP client |
|---|---|
| `gn_probe_write` | ● **none** — the baseline |
| `gn_probe_read` | ● `readOnlyHint: true, destructiveHint: false` |
| `gn_probe_destroy` | ● `readOnlyHint: false, destructiveHint: true` |
| `gn_probe_destroy_idempotent` | ● `destructiveHint: true, idempotentHint: true` |

⚠ Asserted **field by field**, not as "annotations exist": a host reads the field,
and an object that arrived with the wrong one set would still be truthy. Without
this arm, a host that did nothing would be indistinguishable from a server that
sent nothing, and the ○ below would have been recorded against the wrong component.

### ⚠⚠ ARM B — all four prompts are IDENTICAL

The operator called all four tools, baseline first, in a default-permission session:

> *"Claude Code treated all of the tool calls identically. It listed the tool name,
> description, and then prompted with 'Do you want to proceed?' with options 'Yes',
> 'Yes, and don't ask again for &lt;this tool in this project&gt;', 'No'. It didn't seem
> to have any indication of the tool annotations."*

⇒ ⚠⚠ **The annotation changes nothing.** The unannotated baseline prompted exactly
as the `destructiveHint` one did; `readOnlyHint` did not buy a quieter path;
`idempotentHint` did not soften anything.

⇒ ⚠ **But look at what the host DOES gate on** — *"don't ask again for **this
tool**"*. The permission grain is the **tool NAME**, per project. That is precisely
the grain D20's seam is built out of.

### What this does and does not cost D20

- ● **The seam stands, unchanged.** Destructive verbs on their own separately-NAMED
  tools is exactly what the host's permission model keys on, so *"the host's
  permission flow is the stop-and-ask"* remains true.
- ⚠⚠ **The stated reason must change.** D20 says the host prompts *because of the
  annotation*. It does not. It prompts because the call is a tool call, and it
  remembers per name. ⇒ **PROPOSED amendment** (rule 10 — proposed, not recorded):
  *"…because destructive verbs carry their own tool NAMES, which is the grain the
  host's allow-list actually uses. Annotations are sent, are correct, and are
  currently decorative."*
- ⚠ **A consequence worth stating before it bites**: *"Yes, and don't ask again for
  this tool in this project"* is a **per-name blanket grant**. D20 already accepts
  *"always allow"* as the operator's prerogative — this is what it looks like in
  practice, and it is the reason a destructive verb must never share a tool name
  with a benign one. Tool-surface granularity IS the permission granularity.
- ⚠ **Nothing inside our system gates a directed destructive call** (D20's own
  threat model: the confused agent, not a malicious client). That is unchanged, and
  now rests on the name grain rather than on a hint the host ignores.

### ⚠ Method note: the independent-evidence path did not work

The scratch server appends every call to a log so that what actually RAN can be
read back independently of what the host reported. The log showed only ARM A's own
entry. ⚠ Cause: `os.tmpdir()` resolves differently per environment, so the server
spawned by the host wrote its log somewhere other than where it was read.

⚠ **Recorded rather than patched**, and the finding does not depend on it: the
question is what the host DREW, and a human report is the correct oracle for that —
it is the same oracle every E14 row used. The wart is that the corroboration was
designed in and then silently missed its target, which is worth knowing before
another probe leans on the same trick.

---
