---
title: Wave-3 record data
kind: note
state: active
updated: 2026-10-24
---

# Wave-3 record data

`records.json` is the source of truth for the wave-3 planning inputs. The
markdown documents in `wave-3/` are the readable view of the same records.
`check_records.py` validates the JSON and checks that the documents agree
with it. `render_tables.py` prints the markdown tables that the documents use.
Both scripts use only the Python 3 standard library. Run them with
`python3 -I` from the repository root.

```sh
python3 -I context/plan/overlap/wave-3/data/check_records.py
python3 -I context/plan/overlap/wave-3/data/render_tables.py product
python3 -I context/plan/overlap/wave-3/data/render_tables.py external-matrix
```

## Schema

The file has one object with these keys.

| Key | Content |
|---|---|
| `schemaVersion` | `wave-3-records-1` |
| `baseline` | Date, profile, tool count, description version, and installed Bitwig build |
| `verbs` | The seven verb columns, each with a one-sentence definition |
| `statuses` | The six allowed status values, each with a definition |
| `proofLevels` | The five allowed proof levels, each with a definition |
| `effortDrivers` | The six work shapes from `dependencies.md`, each with a definition |
| `rows` | Capability rows |
| `cells` | One entry for each row and verb that has a standing |
| `workRecords` | The SM, CA, DP, MP, GI, MA, and DL records |
| `projects` | The 12 pinned clones and `superpowers`, each with its path, pin, and reuse declaration |
| `externalCells` | One entry for each project, row, and verb that an external project implements |

### Row

| Field | Meaning |
|---|---|
| `key` | Stable row key, `object.aspect` form, unique |
| `area` | One of the six feature-area document names, or `cross-cutting` |
| `object` | The host or file object |
| `aspect` | The aspect of that object that the row covers |

### Cell

| Field | Meaning |
|---|---|
| `row`, `verb` | The row key and one verb; the pair is unique |
| `status` | One of the six statuses |
| `qualifier` | Free text that narrows the status; empty when none |
| `proof` | `level` (one of five), `build` (Bitwig build for Live, else null), `evidence` (E records or paths) |
| `path` | The Ghostnote tool, code path, or external dispatch path that supplies the cell |
| `predicate` | What the path actually checks to call the operation complete |
| `counterexample` | One known input or state where the cell does not hold |
| `limits` | Known loss of untouched neighbouring state, or other bounds; optional |

A cell with status Product, Component, or Research is a claim. A claim must
have `path`, `predicate`, and `counterexample` (the matrix rule). A cell with
status Planned, Candidate, or Unresolved is a planning marker; its source
route and required proof live on the work record that references it. An
absent cell means that no standing is recorded. That is not a finding that
the capability is absent from the market.

### External cell

| Field | Meaning |
|---|---|
| `project` | One of the `projects` keys |
| `row`, `verb` | The shared row key and one verb; project, row, and verb together are unique |
| `proof` | `level` (one of five) and `build` (only for Live). No Ghostnote status: the six statuses describe Ghostnote commitment only |
| `path` | Repo-relative path under `reference/` with the handler line, or the public URL for an uncloned source |
| `predicate` | What the code checks before it reports success |
| `counterexample` | One known input or state where the cell does not hold |
| `evidenceNote` | The wave-1 audit row, the offline check, or the re-verification that produced the cell |

Not found is written only where the audit looked and found no path; the note
names that inspection. An absent external cell records no inspection.

### Work record

| Field | Meaning |
|---|---|
| `id` | SM-n, CA-n, DP-n, MP-n, GI-n, MA-n, or DL-n; unique |
| `kind` | `capability` (references cells) or `delivery` (release work, no cells) |
| `area` | The owning document name |
| `title` | Short title |
| `status`, `qualifier` | As for a cell; every referenced cell has the same status |
| `proof` | The strongest evidence for the route today |
| `cells` | List of `{row, verb}`; at least one for `capability` records |
| `sourceRoute` | Where an implementation lead exists |
| `requiredProof` | What must be proved before the status can rise |
| `owner` | An existing plan owner, or `none` |
| `prerequisites` | Record IDs that must complete first |
| `enabling` | Record IDs that reduce the work but are not required |
| `effortDriver` | One of the six work shapes |

## Rules that the check enforces

- Allowed statuses, verbs, proof levels, and effort drivers only.
- Unique row keys, unique row-verb pairs, unique record IDs.
- Every cell row exists. Every record cell reference resolves.
- Every `capability` record has at least one cell, and each referenced cell
  has the record's status.
- A Live proof names a build. A non-Live proof has a null build.
- Claim cells have a path, a predicate, and a counterexample.
- Prerequisite and enabling IDs resolve to records.
- The markdown documents name every work-record ID with its status, and
  name no ID that the JSON lacks.
- External cells: known project, row, and verb; unique project-row-verb; no
  `status` field; a Live proof names a build; path, predicate,
  counterexample, and evidence note are present.
- `external-register.md` names every external cell in its detail tables
  exactly once, and names no cell that the JSON lacks.

## Static report

The [static report](../report.html) uses this data directly. Its
[builder and checks](../report/README.md) verify all record dispositions,
cell detail IDs, local links, and generated bytes. The report's editorial
sequences do not change record statuses or select an implementation order.
