---
id: D29
kind: decision
state: active
source: e225-cache-limit-knee-sweep
---

# D29 — A saved anchor project replaces protected New 3 **[SETTLED 2026-10-05]**

The user retired the rule that kept protected `New 3` open and unsaved.
The saved fixture project `gn-scale-test` is now the anchor project.

`New 3` had no musical or test value. It held four default tracks, eight
scenes, and one empty clip. It existed because Bitwig's New Project replaces
an untouched new project. A dirty project tab makes New Project open a new tab
instead. Later sessions also used it as a witness that research changed only
owned projects. The rule forbade a Bitwig restart, so heap measurements had to
use one shared, ageing JVM. In E225, a host out-of-memory crash closed Bitwig.
Recovery restored `New 3`, but the risk had no matching benefit.

## Rule

- Keep `gn-scale-test` open while research creates owned projects. It is a
  saved file, so an accidental edit can be discarded on close or revert.
- It needs no captured baseline. It is only the tab that keeps New Project
  from replacing work.
- A Bitwig restart is allowed between live experiments. Reopen
  `gn-scale-test` first, then create the owned project.
- Owned research projects stay unsaved and are closed without saving.
- Never run research in `gn-scale-test` itself.
