#!/usr/bin/env python3
"""Freeze and run the hardened Phase 8c4d targeted holdout."""

from __future__ import annotations

import argparse
import importlib.util
import json
import math
import platform
import random
import re
import socket
import sys
import time
from copy import deepcopy
from decimal import Decimal
from pathlib import Path
from typing import Any, Callable


PACKAGE_ROOT = Path(__file__).resolve().parent
BENCHMARKS_ROOT = PACKAGE_ROOT.parent


def load_module(name: str, path: Path) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load module: {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


v12 = load_module(
    "ghostnote_compact_format_v14_v12",
    BENCHMARKS_ROOT / "compact-format-v12" / "compare.py",
)
v13 = load_module(
    "ghostnote_compact_format_v14_v13",
    BENCHMARKS_ROOT / "compact-format-v13" / "diagnostic.py",
)
base = v12.base
core = v12.core
transport = v12.transport

SCHEMA = "ghostnote-compact-format-hardened-v14"
CORPUS_SCHEMA = "ghostnote-compact-format-holdout-corpus-v14"
RUN_ID = "phase8c4d-targeted-holdout-r2"
COHORT = "targeted-holdout-r2"
SEED = 41042
VARIANT_OFFSET = 140
ARMS = (
    "compact-bar-fields",
    "compact-bar-local-labels",
    "exact-object-json",
)
COMPACT_ARMS = ARMS[:2]
DECISION_FAMILIES = ("comprehension-analysis", "continuation-affine")
GUARD_FAMILIES = ("document-serialization",)
FAMILIES = (*DECISION_FAMILIES, *GUARD_FAMILIES)
UNIQUE_COUNTS = {
    "comprehension-analysis": 8,
    "continuation-affine": 8,
    "document-serialization": 4,
}
REPEATS = {
    "comprehension-analysis": 2,
    "continuation-affine": 2,
    "document-serialization": 1,
}
PROVIDERS = base.PROVIDERS
MODELS = base.MODELS
KEYS = base.KEYS
SETTINGS = {
    "openai": {
        "reasoning_effort": "low",
        "max_completion_tokens": 12000,
        "temperature": "provider default; omitted from request",
    },
    "gemini": {
        "thinking_level": "low",
        "max_output_tokens": 12000,
        "temperature": "provider default; omitted from request",
    },
    "claude-haiku": {
        "thinking": {"type": "enabled", "budget_tokens": 1024},
        "max_tokens": 12000,
        "temperature": "provider default; omitted from request",
    },
}
MAXIMUM_CALLS = sum(
    UNIQUE_COUNTS[family] * REPEATS[family] * len(ARMS) for family in FAMILIES
)
MAXIMUM_TOKEN_COUNT_REQUESTS = MAXIMUM_CALLS
RECENT_COST_ESTIMATE = {
    "openai": Decimal("0.739000"),
    "gemini": Decimal("0.218000"),
    "claude-haiku": Decimal("1.758000"),
}
PROVIDER_COST_LIMITS = {
    "openai": Decimal("0.850000"),
    "gemini": Decimal("0.350000"),
    "claude-haiku": Decimal("1.850000"),
}
APPROVAL_PATH = PACKAGE_ROOT / "runs" / "targeted-holdout-r2-approval.json"
HISTORICAL_PACKAGES = (
    "compact-bar-v0",
    "symbolic-format-v1",
    "compact-format-v2",
    "compact-format-v3",
    "compact-json-v1",
    "symbolic-format-v2",
    "compact-format-v4",
    "compact-format-v5",
    "compact-format-v6",
    "compact-format-v7",
    "compact-format-v8",
    "compact-format-v9",
    "compact-format-v10",
    "compact-format-v11",
    "compact-format-v12",
    "compact-format-v13",
)
DEPENDENCIES = (
    BENCHMARKS_ROOT / "compact-format-v6" / "core.py",
    BENCHMARKS_ROOT / "compact-format-v10" / "benchmark.py",
    BENCHMARKS_ROOT / "compact-format-v11" / "screen.py",
    BENCHMARKS_ROOT / "compact-format-v12" / "compare.py",
    BENCHMARKS_ROOT / "compact-format-v13" / "diagnostic.py",
)
NETWORK_HOSTS = {
    "openai": "api.openai.com",
    "gemini": "generativelanguage.googleapis.com",
    "claude-haiku": "api.anthropic.com",
}
LOCAL_NOTE_PATTERN = re.compile(
    r"N id=(\S+) voice=(\S+) start=(\S+) duration=(\S+) "
    r"pitch=(\d+) velocity=(\d+)"
)
POSITIONAL_ARM = "compact-bar-" + "v1"


class CostBudgetExceeded(RuntimeError):
    """Stop before an approved provider budget can be exceeded."""


class ProviderCompletedError(RuntimeError):
    """Report a received response that failed local validation."""

    def __init__(self, message: str, call: dict[str, Any]) -> None:
        super().__init__(message)
        self.call = call


def candidate_definitions() -> dict[str, dict[str, Any]]:
    shared = {
        "headers": ["BASE <token>", "SOURCE <token>", "OMITS " + " ".join(core.OMISSIONS)],
        "note_order": list(core.FIELDS),
        "rational_spelling": "integer or reduced improper a/b fraction",
        "identity": "Note IDs are globally unique in the document.",
        "canonical_order": "start, voice, pitch, id",
        "parser": "v14-two-phase-structural-canonical",
    }
    return {
        "compact-bar-fields": {
            **shared,
            "declaration": "FIELDS " + " ".join(core.FIELDS),
            "note_template": "N <id> <voice> <start> <duration> <pitch> <velocity>",
        },
        "compact-bar-local-labels": {
            **shared,
            "declaration": None,
            "note_template": (
                "N id=<id> voice=<voice> start=<start> duration=<duration> "
                "pitch=<pitch> velocity=<velocity>"
            ),
        },
        "exact-object-json": {
            "schema": core.SCHEMA,
            "fields": ["schema", "base_sha256", "source_id", "omits", "overlays", "notes"],
            "note_order": list(core.FIELDS),
            "rational_spelling": "integer or reduced improper a/b fraction",
            "identity": "Note IDs are globally unique in the document.",
            "canonical_order": (
                "Note and overlay arrays use the frozen canonical order. JSON "
                "object key order and insignificant whitespace are ignored."
            ),
            "parser": "v14-two-phase-structural-canonical",
        },
    }


def candidate_hashes() -> dict[str, str]:
    return {
        arm: core.digest(definition)
        for arm, definition in candidate_definitions().items()
    }


def refresh_task(value: dict[str, Any]) -> dict[str, Any]:
    result = deepcopy(value)
    result.pop("semantic_sha256", None)
    result.pop("sha256", None)
    semantic = {
        name: item
        for name, item in result.items()
        if name not in {"schema", "id", "cohort", "variant", "origin", "license"}
    }
    result["semantic_sha256"] = core.digest(semantic)
    result["sha256"] = core.digest(result)
    return result


def serialization_task(index: int) -> dict[str, Any]:
    variant = VARIANT_OFFSET + 16 + index
    source = core.motif_task(COHORT, variant, SEED)
    notes = deepcopy(source["expected"])
    return refresh_task(
        {
            "schema": core.SCHEMA,
            "id": f"{COHORT}-document-serialization-v{variant}",
            "cohort": COHORT,
            "family": "document-serialization",
            "variant": variant,
            "origin": "generated",
            "license": "MIT",
            "expected": notes,
            "target_notes": notes,
        }
    )


def make_corpus() -> dict[str, Any]:
    core.ANALYSIS_BATCH_COUNTS[COHORT] = (4,) * 8
    analysis = [
        base.transform_holdout(
            core.analysis_task(COHORT, VARIANT_OFFSET + index, SEED), 36, 17
        )
        for index in range(UNIQUE_COUNTS["comprehension-analysis"])
    ]
    continuation = []
    for index in range(UNIQUE_COUNTS["continuation-affine"]):
        task = core.motif_task(COHORT, VARIANT_OFFSET + 8 + index, SEED)
        task["family"] = "continuation-affine"
        continuation.append(refresh_task(task))
    value = {
        "schema": CORPUS_SCHEMA,
        "cohort": COHORT,
        "license": "MIT",
        "fixtures": {
            "comprehension-analysis": analysis,
            "continuation-affine": continuation,
            "document-serialization": [
                serialization_task(index)
                for index in range(UNIQUE_COUNTS["document-serialization"])
            ],
        },
    }
    value["sha256"] = core.digest(value)
    return value


def historical_hashes() -> tuple[set[str], set[str], set[str]]:
    full: set[str] = set()
    semantic: set[str] = set()
    cases: set[str] = set()
    for name in HISTORICAL_PACKAGES:
        root = BENCHMARKS_ROOT / name
        for path in sorted(root.rglob("*.json")):
            try:
                value = json.loads(path.read_text())
            except json.JSONDecodeError:
                continue
            def collect_full_hashes(item: Any, hash_context: bool = False) -> None:
                if isinstance(item, dict):
                    for key, child in item.items():
                        if key.endswith("sha256") and isinstance(child, str):
                            full.add(child)
                        collect_full_hashes(child, key.endswith("sha256"))
                elif isinstance(item, list):
                    for child in item:
                        if hash_context and isinstance(child, str):
                            full.add(child)
                        collect_full_hashes(child, hash_context)

            collect_full_hashes(value)
            base.collect_hashes(value, semantic, cases)
    return full, semantic, cases


def cohort_audit() -> dict[str, Any]:
    corpus = make_corpus()
    tasks = [task for values in corpus["fixtures"].values() for task in values]
    full = {task["sha256"] for task in tasks}
    semantic = {task["semantic_sha256"] for task in tasks}
    cases = {
        item
        for task in corpus["fixtures"]["comprehension-analysis"]
        for item in task["case_semantic_sha256"]
    }
    prior_full, prior_semantic, prior_cases = historical_hashes()
    return {
        "corpus_sha256": corpus["sha256"],
        "fixture_count": len(tasks),
        "full_hash_count": len(full),
        "semantic_hash_count": len(semantic),
        "analysis_case_hash_count": len(cases),
        "internal_full_duplicates": len(tasks) - len(full),
        "internal_semantic_duplicates": len(tasks) - len(semantic),
        "prior_full_overlap": len(full & prior_full),
        "prior_semantic_overlap": len(semantic & prior_semantic),
        "prior_analysis_case_overlap": len(cases & prior_cases),
        "historical_packages": list(HISTORICAL_PACKAGES),
        "historical_snapshot": {
            "full_count": len(prior_full),
            "semantic_count": len(prior_semantic),
            "analysis_case_count": len(prior_cases),
            "sha256": core.digest(
                {
                    "full": sorted(prior_full),
                    "semantic": sorted(prior_semantic),
                    "cases": sorted(prior_cases),
                }
            ),
        },
    }


def base_jobs() -> list[dict[str, Any]]:
    corpus = make_corpus()
    return [
        {
            "family": family,
            "variant": task["variant"],
            "repeat": repeat,
            "task": task,
        }
        for family in FAMILIES
        for task in corpus["fixtures"][family]
        for repeat in range(1, REPEATS[family] + 1)
    ]


def jobs(provider: str) -> list[dict[str, Any]]:
    if provider not in PROVIDERS:
        raise ValueError(f"Unknown provider: {provider}")
    provider_index = PROVIDERS.index(provider)
    groups = base_jobs()
    random.Random(SEED + provider_index).shuffle(groups)
    result = []
    for group_index, group in enumerate(groups):
        rotation = (group_index + provider_index) % len(ARMS)
        order = ARMS[rotation:] + ARMS[:rotation]
        for arm in order:
            result.append({**group, "arm": arm})
    return [
        {**job, "planned_sequence": sequence}
        for sequence, job in enumerate(result, start=1)
    ]


def render_document(arm: str, document: dict[str, Any]) -> str:
    if arm == "compact-bar-local-labels":
        return v13.render_local_document(document)
    return core.render_document(arm, document)


def represented_source(arm: str, task: dict[str, Any]) -> str | None:
    rows = task.get("source")
    if not isinstance(rows, list):
        return None
    document = core.make_document(
        rows, core.digest(core.projected(rows)), task["id"] + "-source"
    )
    return render_document(arm, document)


def perfect_document(task: dict[str, Any]) -> dict[str, Any]:
    notes = task["expected"]
    base_value = "none" if task["family"] == "document-serialization" else core.digest(core.projected(task["source"]))
    return core.make_document(notes, base_value, task["id"])


def perfect_payload(arm: str, task: dict[str, Any]) -> str:
    if task["family"] == "comprehension-analysis":
        return core.render_analysis(task["expected"]).removeprefix("ANALYSIS ")
    return render_document(arm, perfect_document(task))


def analysis_grammar() -> str:
    return (
        "Return one line with exactly these key=value fields in this order: "
        + " ".join(core.ANALYSIS_FIELDS)
        + ". Do not add a prefix, another label, another row, or prose."
    )


def document_grammar(arm: str) -> str:
    shared = (
        "Note IDs must be globally unique in the complete document. Spell every "
        "start and duration as an integer or a reduced improper a/b fraction. "
        "Do not use a decimal, mixed fraction, or unreduced fraction. Use canonical "
        "note order by start, voice, pitch, and ID."
    )
    if arm == "exact-object-json":
        return (
            "Return one exact object with schema, base_sha256, source_id, omits, "
            "overlays, and notes. Include all seven empty overlay collections. "
            "Each note has exactly id, voice, start, duration, pitch, and velocity. "
            + shared
        )
    if arm == "compact-bar-fields":
        return (
            "Return BASE, SOURCE, the fixed OMITS row, and exactly one declaration "
            "row shown below. Each N row has exactly six values after N.\n"
            "FIELDS id voice start duration pitch velocity\n"
            "Do not repeat labels inside an N row. "
            + shared
        )
    return (
        "Return BASE, SOURCE, and the fixed OMITS row. Do not return a FIELDS row. "
        "Use exactly this label order on every note row: N id=<id> voice=<voice> "
        "start=<start> duration=<duration> pitch=<pitch> velocity=<velocity>. "
        + shared
    )


def example_for(arm: str, family: str) -> str:
    if family == "comprehension-analysis":
        return v12.ANALYSIS_EXAMPLE.removeprefix("ANALYSIS ")
    rows = [
        core.note("ex-bass", "bass", "0", "1", 48, 80),
        core.note("ex-lead", "lead", "1/2", "3/2", 67, 84),
    ]
    return render_document(arm, core.make_document(rows, "example", "example-source"))


def task_instruction(task: dict[str, Any]) -> str:
    family = task["family"]
    if family == "comprehension-analysis":
        return core.analysis_instruction(task)
    if family == "continuation-affine":
        contract = task["contract"]
        return (
            "Apply one compound-affine operation to all six source events in "
            "canonical order. Use output IDs "
            + ",".join(contract["output_ids"])
            + " in the same order. Set pitch=2*axis-source_pitch+semitones, "
            f"where axis={contract['axis']} and semitones={contract['semitones']}. "
            f"Set start={contract['output_start']}+(source_start-first_source_start)*"
            f"{contract['rhythmic_factor']} and duration=source_duration*"
            f"{contract['rhythmic_factor']}. Preserve voice and velocity. Return "
            "only the six output notes."
        )
    return (
        "Serialize exactly these target notes. Do not calculate or change a value. "
        "Use literal BASE none and SOURCE "
        + task["id"]
        + ". Use the fixed OMITS declaration and empty overlays. Target notes: "
        + core.canonical(task["target_notes"])
    )


def prompt_for(job: dict[str, Any]) -> str:
    arm = job["arm"]
    task = job["task"]
    family = job["family"]
    if family == "comprehension-analysis":
        representation = (
            f"Input representation: {arm}. This name describes only the input. "
            "Use the shared analysis output grammar."
        )
        grammar = analysis_grammar()
    else:
        representation = f"Input and output representation: {arm}." if family == "continuation-affine" else f"Output representation: {arm}."
        grammar = document_grammar(arm)
    parts = [
        "Complete one deterministic symbolic-music task.",
        "Return one JSON object with exactly one string field named payload. Put "
        "the requested representation in that string. Do not add prose.",
        representation,
        grammar,
        "Follow this complete output example, but use the task values:\n"
        + example_for(arm, family),
        task_instruction(task),
    ]
    if family == "continuation-affine":
        parts.append(
            f"Use exact output headers BASE {core.digest(core.projected(task['source']))} "
            f"and SOURCE {task['id']}. Use the fixed OMITS declaration and empty overlays."
        )
    source = represented_source(arm, task)
    if source is not None:
        parts.extend(("<input_document>", source, "</input_document>"))
    return "\n\n".join(parts)


def parse_failure(message: str) -> dict[str, Any]:
    return {
        "structural_parse_pass": False,
        "canonical_form_pass": False,
        "syntax_pass": False,
        "semantic_pass": False,
        "musical_pass": False,
        "primary_pass": False,
        "checks": {},
        "component": {"correct": 0, "planned": 0},
        "diagnostic": {
            "class": "structural-parse",
            "error_type": "ValueError",
            "message": message,
        },
    }


def tolerant_compact(arm: str, text: str) -> dict[str, Any]:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if len(lines) < 4 or not lines[0].startswith("BASE ") or not lines[1].startswith("SOURCE "):
        raise ValueError("A compact document is missing a fixed header")
    if lines[2] != "OMITS " + " ".join(core.OMISSIONS):
        raise ValueError("A compact document has the wrong OMITS header")
    index = 3
    if arm == "compact-bar-fields":
        if len(lines) <= index or lines[index] != "FIELDS " + " ".join(core.FIELDS):
            raise ValueError("The FIELDS document needs its one fixed declaration")
        index += 1
        pattern = re.compile(r"N (\S+) (\S+) (\S+) (\S+) (\d+) (\d+)")
    else:
        if lines[index].startswith("FIELDS "):
            raise ValueError("The local-label document cannot contain FIELDS")
        pattern = LOCAL_NOTE_PATTERN
    notes = []
    for line in lines[index:]:
        match = pattern.fullmatch(line)
        if match is None:
            raise ValueError(f"Invalid note row: {line}")
        values = match.groups()
        notes.append(
            core.note(values[0], values[1], values[2], values[3], int(values[4]), int(values[5]))
        )
    return core.make_document(notes, lines[0][5:], lines[1][7:])


def tolerant_document(arm: str, payload: str) -> dict[str, Any]:
    if arm in COMPACT_ARMS:
        return tolerant_compact(arm, payload)
    value = json.loads(payload)
    if not isinstance(value, dict) or set(value) != {
        "schema", "base_sha256", "source_id", "omits", "overlays", "notes"
    }:
        raise ValueError("An exact object has incorrect fields")
    if value["schema"] != core.SCHEMA or value["omits"] != list(core.OMISSIONS):
        raise ValueError("An exact object has the wrong schema or omissions")
    notes = [core.normalize_note(row) for row in value["notes"]]
    return core.make_document(
        notes, value["base_sha256"], value["source_id"], value["overlays"]
    )


def strict_document(arm: str, payload: str) -> dict[str, Any]:
    if arm == "compact-bar-local-labels":
        return core.parse_document("compact-bar-fields", v13.local_to_fields(payload))
    return core.parse_document(arm, payload)


def document_score(arm: str, task: dict[str, Any], payload: str) -> dict[str, Any]:
    strict_error = None
    try:
        document = strict_document(arm, payload)
        canonical_pass = True
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
        strict_error = error
        canonical_pass = False
        try:
            document = tolerant_document(arm, payload)
        except (KeyError, TypeError, ValueError, json.JSONDecodeError) as tolerant_error:
            return parse_failure(str(tolerant_error))
    expected = perfect_document(task)
    expected_by_id = {row["id"]: row for row in expected["notes"]}
    actual_by_id = {row["id"]: row for row in document["notes"]}
    checks = {
        "document_context": (
            document["base_sha256"] == expected["base_sha256"]
            and document["source_id"] == expected["source_id"]
            and document["omits"] == expected["omits"]
            and document["overlays"] == expected["overlays"]
        ),
        "global_unique_ids": len(actual_by_id) == len(document["notes"]),
        "note_set": set(actual_by_id) == set(expected_by_id),
    }
    field_checks = {
        f"{note_id}.{field}": actual_by_id.get(note_id, {}).get(field) == row[field]
        for note_id, row in expected_by_id.items()
        for field in core.FIELDS
    }
    checks.update(field_checks)
    semantic_pass = all(checks.values())
    return {
        "structural_parse_pass": True,
        "canonical_form_pass": canonical_pass,
        "syntax_pass": canonical_pass,
        "semantic_pass": semantic_pass,
        "musical_pass": semantic_pass,
        "primary_pass": canonical_pass and semantic_pass,
        "checks": checks,
        "component": {
            "correct": sum(field_checks.values()),
            "planned": len(field_checks),
        },
        "diagnostic": None
        if canonical_pass and semantic_pass
        else {
            "class": "canonical" if not canonical_pass else "semantic",
            "canonical_error": None if strict_error is None else str(strict_error),
            "failed_checks": sorted(name for name, passed in checks.items() if not passed),
        },
    }


def analysis_score(task: dict[str, Any], payload: str) -> dict[str, Any]:
    score = v12.score_response("compact-bar-fields", task, payload)
    canonical_pass = (
        score["syntax_pass"]
        and payload == payload.strip()
        and not payload.startswith("ANALYSIS ")
    )
    checks = score.get("checks", {})
    planned = len(core.ANALYSIS_FIELDS) * task["contract"]["case_count"]
    correct = 0
    try:
        text = payload.strip()
        normalized = text if text.startswith("ANALYSIS ") else "ANALYSIS " + text
        actual = core.parse_analysis(normalized)
        correct = sum(
            actual[field][index] == task["expected"][field][index]
            for field in core.ANALYSIS_FIELDS
            for index in range(task["contract"]["case_count"])
        )
    except (KeyError, TypeError, ValueError):
        pass
    value = {
        **score,
        "structural_parse_pass": score["syntax_pass"],
        "canonical_form_pass": canonical_pass,
        "syntax_pass": canonical_pass,
        "semantic_pass": score["musical_pass"],
        "primary_pass": canonical_pass and score["musical_pass"],
        "component": {"correct": correct, "planned": planned},
        "checks": checks,
    }
    if score["syntax_pass"] and not canonical_pass:
        value["diagnostic"] = {
            "class": "canonical",
            "message": "The optional legacy ANALYSIS prefix is not canonical in v14",
        }
    return value


def score_response(arm: str, task: dict[str, Any], payload: str) -> dict[str, Any]:
    if task["family"] == "comprehension-analysis":
        return analysis_score(task, payload)
    return document_score(arm, task, payload)


def package_files() -> dict[str, str]:
    return {
        name: base.file_sha256(PACKAGE_ROOT / name)
        for name in ("benchmark.py", "README.md", "PROTOCOL.md")
    }


def dependency_files() -> dict[str, str]:
    return {
        str(path.relative_to(BENCHMARKS_ROOT)): base.file_sha256(path)
        for path in DEPENDENCIES
    }


def prompt_manifest() -> dict[str, list[dict[str, Any]]]:
    hashes = candidate_hashes()
    return {
        provider: [
            {
                "planned_sequence": job["planned_sequence"],
                "arm": job["arm"],
                "candidate_sha256": hashes[job["arm"]],
                "family": job["family"],
                "variant": job["variant"],
                "repeat": job["repeat"],
                "task_sha256": job["task"]["sha256"],
                "prompt_sha256": core.sha256_text(prompt_for(job)),
                "prompt_bytes": len(prompt_for(job).encode()),
            }
            for job in jobs(provider)
        ]
        for provider in PROVIDERS
    }


def size_report() -> dict[str, Any]:
    rows = []
    for family in FAMILIES:
        tasks = make_corpus()["fixtures"][family]
        for arm in ARMS:
            prompts = [
                prompt_for(
                    {
                        "arm": arm,
                        "family": family,
                        "variant": task["variant"],
                        "repeat": 1,
                        "task": task,
                    }
                )
                for task in tasks
            ]
            payloads = [perfect_payload(arm, task) for task in tasks]
            rows.append(
                {
                    "family": family,
                    "arm": arm,
                    "fixture_count": len(tasks),
                    "mean_prompt_bytes": round(
                        sum(len(value.encode()) for value in prompts) / len(prompts), 3
                    ),
                    "mean_perfect_response_bytes": round(
                        sum(len(value.encode()) for value in payloads) / len(payloads), 3
                    ),
                }
            )
    return {
        "offline_bytes": rows,
        "runtime_metrics": [
            "prompt_bytes",
            "response_bytes",
            "api_input_tokens",
            "api_output_tokens",
        ],
        "rule": (
            "Report runtime size by provider, family, and arm. Keep it separate "
            "from strict conformance and semantic quality."
        ),
    }


def decision_rule() -> dict[str, Any]:
    return {
        "outcomes": ["retain-both", "revise", "stop"],
        "smallest_useful_paired_rows": 2,
        "smallest_useful_effect": 0.125,
        "exact_noninferiority_loss_margin_rows": 2,
        "maximum_repeated_candidate_only_losses": 0,
        "minimum_provider_completion": 0.95,
        "minimum_compact_syntax": 0.875,
        "minimum_exact_control_pass": 0.75,
        "informative_exact_band": {
            "inclusive_minimum": 0.75,
            "exclusive_maximum": 0.95,
        },
        "informative_compact_band": {
            "exclusive_minimum": 0.25,
            "exclusive_maximum": 0.875,
        },
        "size_gates": {
            "maximum_local_to_fields_prompt_ratio": 1.20,
            "maximum_local_to_fields_response_ratio": 2.00,
            "maximum_compact_to_exact_response_ratio": 0.80,
            "api_token_use": "Report by provider and arm. It is not a musical score.",
        },
        "family_authority": (
            "A decision family needs exact JSON in its informative band and at "
            "least one compact arm in its informative band. Otherwise, it is a "
            "guard result and cannot establish a format effect."
        ),
        "selection_authority": (
            "The holdout can retain both candidates or require revision or stop. "
            "It cannot remove one D24 candidate or select a public format."
        ),
    }


def stopping_rule() -> dict[str, Any]:
    return {
        "before_calls": [
            "identity mismatch",
            "freshness failure",
            "deterministic failure",
            "missing credential",
            "network preflight failure",
            "cost capacity failure",
        ],
        "during_provider": {
            "transport_failures": 1,
            "budget_stops": 1,
            "unavailable_responses": 3,
        },
        "automatic_retries": 0,
        "repairs": 0,
        "value_of_information": (
            "Stop the sequence after revise or stop. Do not buy another compact "
            "provider cycle until a new design changes a product decision."
        ),
    }


def effective_request_settings(provider: str) -> dict[str, Any]:
    value = deepcopy(SETTINGS[provider])
    value.pop("temperature")
    return value


def protocol_manifest() -> dict[str, Any]:
    audit = cohort_audit()
    value = {
        "schema": SCHEMA,
        "run_kind": "hardened-targeted-holdout-protocol",
        "run_id": RUN_ID,
        "package_files": package_files(),
        "dependency_files": dependency_files(),
        "cohort": COHORT,
        "cohort_audit": audit,
        "candidate_definitions": candidate_definitions(),
        "candidate_sha256": candidate_hashes(),
        "arms": list(ARMS),
        "retired_provider_arms": [POSITIONAL_ARM, "all other historical formats"],
        "families": {
            family: {
                "unique_fixtures": UNIQUE_COUNTS[family],
                "repeats": REPEATS[family],
                "role": "decision" if family in DECISION_FAMILIES else "guard",
            }
            for family in FAMILIES
        },
        "estimands": {
            "compact_pair": (
                "Effect of the complete deployable compact prompt package on "
                "initial strict conformance and semantic accuracy."
            ),
            "compact_vs_exact": (
                "Initial semantic noninferiority for each complete compact prompt "
                "package against exact-object JSON."
            ),
            "size": (
                "Paired prompt bytes, response bytes, API input tokens, and API "
                "output tokens. Size does not enter musical scoring."
            ),
        },
        "models": MODELS,
        "declared_settings": SETTINGS,
        "effective_request_settings": {
            provider: effective_request_settings(provider) for provider in PROVIDERS
        },
        "prompts": prompt_manifest(),
        "calls": {
            "maximum_per_provider": MAXIMUM_CALLS,
            "maximum_all_providers": MAXIMUM_CALLS * len(PROVIDERS),
            "maximum_haiku_token_count_requests": MAXIMUM_TOKEN_COUNT_REQUESTS,
            "automatic_retries": 0,
            "repairs": 0,
        },
        "cost_guard": {
            "recent_cost_estimate_usd": {
                provider: base.rounded_usd(value)
                for provider, value in RECENT_COST_ESTIMATE.items()
            },
            "recent_cost_estimate_total_usd": base.rounded_usd(
                sum(RECENT_COST_ESTIMATE.values(), Decimal(0))
            ),
            "maximum_provider_cost_usd": {
                provider: base.rounded_usd(value)
                for provider, value in PROVIDER_COST_LIMITS.items()
            },
            "maximum_total_cost_usd": base.rounded_usd(
                sum(PROVIDER_COST_LIMITS.values(), Decimal(0))
            ),
            "maximum_call_cost_usd": {
                provider: base.rounded_usd(base.maximum_call_cost(provider))
                for provider in PROVIDERS
            },
            "input_token_ceiling_per_call": base.INPUT_TOKEN_CEILING,
            "output_token_ceiling_per_call": 12000,
            "request_byte_ceiling_per_call": base.REQUEST_BYTE_CEILING,
            "failed_reservation": "retained",
            "aggregation": "Sum exact provider line items and round once.",
        },
        "size_report": size_report(),
        "decision_rule": decision_rule(),
        "stopping_rule": stopping_rule(),
        "measurement": {
            "strict_and_components_separate": True,
            "planned_and_scored_denominators_separate": True,
            "states": ["unavailable", "failed", "initial", "repaired"],
            "repair_primary": "No repair is allowed.",
            "progress_fields": [
                "planned",
                "attempted",
                "provider_completed",
                "available",
                "scored",
                "failed",
                "unavailable",
                "budget_stopped",
            ],
        },
        "holdout_replacement": (
            "The unused v10 holdout is invalid. Candidate, prompt, task, scorer, "
            "sampling, and decision metrics changed."
        ),
        "privacy": "Generated MIT symbolic text only.",
        "approval_boundary": (
            "No token-count or provider request is approved until the operator "
            "approves the exact protocol and run-plan hashes."
        ),
    }
    value["sha256"] = core.digest(value)
    return value


def run_plan() -> dict[str, Any]:
    protocol = protocol_manifest()
    value = {
        "schema": SCHEMA,
        "run_kind": "hardened-targeted-holdout-plan",
        "run_id": RUN_ID,
        "protocol_sha256": protocol["sha256"],
        "cohort_sha256": protocol["cohort_audit"]["corpus_sha256"],
        "historical_snapshot": protocol["cohort_audit"]["historical_snapshot"],
        "candidate_sha256": protocol["candidate_sha256"],
        "arms": protocol["arms"],
        "families": protocol["families"],
        "models": MODELS,
        "declared_settings": SETTINGS,
        "effective_request_settings": protocol["effective_request_settings"],
        "calls": protocol["calls"],
        "cost_guard": protocol["cost_guard"],
        "size_report": protocol["size_report"],
        "decision_rule": protocol["decision_rule"],
        "stopping_rule": protocol["stopping_rule"],
        "schedule_sha256": {
            provider: core.digest(protocol["prompts"][provider])
            for provider in PROVIDERS
        },
        "approval": "pending",
    }
    value["sha256"] = core.digest(value)
    return value


def prompt_visibility_screen() -> dict[str, Any]:
    results = []
    for family in FAMILIES:
        task = make_corpus()["fixtures"][family][0]
        for arm in ARMS:
            prompt = prompt_for(
                {
                    "arm": arm,
                    "family": family,
                    "variant": task["variant"],
                    "repeat": 1,
                    "task": task,
                }
            )
            requirements: dict[str, list[str]] = {}
            if family == "comprehension-analysis":
                requirements = {
                    **{f"output:{field}": [field] for field in core.ANALYSIS_FIELDS},
                    "case-count": [
                        f"Analyze {task['contract']['case_count']} ordered chord groups"
                    ],
                    "chord-selection": ["chord_groups", "note_ids"],
                    "root-and-bass": ["root_pcs are chord roots", "bass_pcs are the lowest"],
                    "quality-definitions": ["major=[0,4,7]", "half-diminished-seventh"],
                    "function-definitions": ["Relative to key_tonic_pc", "vii-half-dim43"],
                    "motif-definitions": ["motif_relations are transposition", "rhythmic-scale"],
                    "rhythm-definitions": ["rhythms are sustained", "arpeggiated"],
                    "case-data": [core.canonical(task["contract"])],
                    "input-notes": [represented_source(arm, task) or ""],
                }
            elif family == "continuation-affine":
                contract = task["contract"]
                omission_fragment = (
                    '"omits":["channel","mute","release_velocity","articulation","expression"]'
                    if arm == "exact-object-json"
                    else "OMITS " + " ".join(core.OMISSIONS)
                )
                requirements = {
                    "document-context": [
                        f"BASE {core.digest(core.projected(task['source']))}",
                        f"SOURCE {task['id']}",
                        omission_fragment,
                        "empty overlays",
                    ],
                    "note-set": [*contract["output_ids"], "only the six output notes"],
                    "pitch": [
                        "pitch=2*axis-source_pitch+semitones",
                        f"axis={contract['axis']}",
                        f"semitones={contract['semitones']}",
                    ],
                    "start": [
                        f"start={contract['output_start']}+(source_start-first_source_start)*",
                        str(contract["rhythmic_factor"]),
                    ],
                    "duration": [
                        "duration=source_duration*",
                        str(contract["rhythmic_factor"]),
                    ],
                    "voice-and-velocity": ["Preserve voice and velocity"],
                    "source-events": [represented_source(arm, task) or ""],
                }
            else:
                requirements = {
                    "document-context": [
                        "BASE none",
                        f"SOURCE {task['id']}",
                        "fixed OMITS declaration",
                        "empty overlays",
                    ],
                    "literal-copy": ["Do not calculate or change a value"],
                    "target-fields-and-values": [core.canonical(task["target_notes"])],
                }
            if family != "comprehension-analysis":
                requirements.update(
                    {
                        "global-identity": ["globally unique"],
                        "rational-canonical": ["reduced improper a/b"],
                        "canonical-order": ["start, voice, pitch, and ID"],
                        "note-fields": list(core.FIELDS),
                    }
                )
            missing = {
                name: [fragment for fragment in fragments if fragment not in prompt]
                for name, fragments in requirements.items()
                if any(fragment not in prompt for fragment in fragments)
            }
            results.append(
                {
                    "family": family,
                    "arm": arm,
                    "scorer_requirements": requirements,
                    "missing": missing,
                }
            )
    return {
        "rows": results,
        "all_visible": all(not row["missing"] for row in results),
    }


def mutate_first_note(payload: str, arm: str, field: str, value: str) -> str:
    if arm == "compact-bar-fields":
        lines = payload.splitlines()
        index = next(i for i, line in enumerate(lines) if line.startswith("N "))
        parts = lines[index].split()
        parts[core.FIELDS.index(field) + 1] = value
        lines[index] = " ".join(parts)
        return "\n".join(lines)
    if arm == "compact-bar-local-labels":
        return re.sub(rf"{field}=\S+", f"{field}={value}", payload, count=1)
    data = json.loads(payload)
    data["notes"][0][field] = (
        int(value) if field in {"pitch", "velocity"} else value
    )
    return core.canonical(data)


def mutate_context(payload: str, arm: str, field: str) -> str:
    if arm == "exact-object-json":
        data = json.loads(payload)
        if field == "omits":
            data["omits"] = data["omits"][:-1]
        else:
            data[field] = "wrong"
        return core.canonical(data)
    lines = payload.splitlines()
    prefixes = {"base_sha256": "BASE ", "source_id": "SOURCE ", "omits": "OMITS "}
    prefix = prefixes[field]
    index = next(i for i, line in enumerate(lines) if line.startswith(prefix))
    lines[index] = prefix + "wrong"
    return "\n".join(lines)


def mutation_screen() -> dict[str, Any]:
    corpus = make_corpus()
    continuation = corpus["fixtures"]["continuation-affine"][0]
    analysis = corpus["fixtures"]["comprehension-analysis"][0]
    checks: dict[str, bool] = {}
    for arm in ARMS:
        perfect = perfect_payload(arm, continuation)
        checks[f"{arm}:perfect"] = score_response(arm, continuation, perfect)["primary_pass"]
        mutations = {
            "id": "wrong-id",
            "voice": "wrong-voice",
            "start": "99/2",
            "duration": "99/2",
            "pitch": "1",
            "velocity": "1",
        }
        for field, replacement in mutations.items():
            changed = mutate_first_note(perfect, arm, field, replacement)
            changed_score = score_response(arm, continuation, changed)
            checks[f"{arm}:note-{field}-detected"] = not changed_score["primary_pass"]
        for field in ("base_sha256", "source_id", "omits"):
            changed = mutate_context(perfect, arm, field)
            checks[f"{arm}:context-{field}-detected"] = not score_response(
                arm, continuation, changed
            )["primary_pass"]
        noncanonical = mutate_first_note(perfect, arm, "start", "0/2")
        noncanonical_score = score_response(arm, continuation, noncanonical)
        checks[f"{arm}:noncanonical-separated"] = (
            noncanonical_score["structural_parse_pass"]
            and not noncanonical_score["canonical_form_pass"]
        )
        mixed = mutate_first_note(perfect, arm, "duration", "1 1/2")
        checks[f"{arm}:mixed-fraction-rejected"] = not score_response(
            arm, continuation, mixed
        )["structural_parse_pass"]
        if arm == "exact-object-json":
            duplicate = json.loads(perfect)
            duplicate["notes"][1]["id"] = duplicate["notes"][0]["id"]
            duplicate_payload = core.canonical(duplicate)
        else:
            lines = perfect.splitlines()
            note_indexes = [i for i, line in enumerate(lines) if line.startswith("N ")]
            first_id = (
                lines[note_indexes[0]].split()[1]
                if arm == "compact-bar-fields"
                else re.search(r"id=(\S+)", lines[note_indexes[0]]).group(1)
            )
            if arm == "compact-bar-fields":
                parts = lines[note_indexes[1]].split()
                parts[1] = first_id
                lines[note_indexes[1]] = " ".join(parts)
            else:
                lines[note_indexes[1]] = re.sub(
                    r"id=\S+", f"id={first_id}", lines[note_indexes[1]], count=1
                )
            duplicate_payload = "\n".join(lines)
        checks[f"{arm}:duplicate-id-rejected"] = not score_response(
            arm, continuation, duplicate_payload
        )["structural_parse_pass"]
    analysis_payload = perfect_payload("compact-bar-fields", analysis)
    perfect_analysis_score = analysis_score(analysis, analysis_payload)
    checks["analysis:perfect"] = perfect_analysis_score["primary_pass"]
    checks["analysis:component-count"] = (
        perfect_analysis_score["component"]["correct"]
        == perfect_analysis_score["component"]["planned"]
        == len(core.ANALYSIS_FIELDS) * analysis["contract"]["case_count"]
    )
    checks["analysis:missing-field"] = not analysis_score(
        analysis, analysis_payload.rsplit(" ", 1)[0]
    )["syntax_pass"]
    for field in core.ANALYSIS_FIELDS:
        changed = re.sub(
            rf"({field}=)[^, ]+", rf"\g<1>wrong", analysis_payload, count=1
        )
        checks[f"analysis:{field}-detected"] = not analysis_score(
            analysis, changed
        )["primary_pass"]
    legacy = analysis_score(analysis, "ANALYSIS " + analysis_payload)
    checks["analysis:legacy-prefix-separated"] = (
        legacy["structural_parse_pass"]
        and not legacy["canonical_form_pass"]
        and legacy["semantic_pass"]
    )
    checks["retired-arm-absent"] = POSITIONAL_ARM not in ARMS
    return {"checks": checks, "all_pass": all(checks.values())}


def row_score(row: dict[str, Any]) -> dict[str, Any] | None:
    return row["initial"].get("score")


def row_pass(row: dict[str, Any]) -> bool:
    score = row_score(row)
    return bool(score and score.get("primary_pass"))


def row_syntax(row: dict[str, Any]) -> bool:
    score = row_score(row)
    return bool(score and score.get("syntax_pass"))


def denominator_summary(rows: list[dict[str, Any]]) -> dict[str, Any]:
    scored = [row for row in rows if row_score(row) is not None]
    return {
        "planned": len(rows),
        "attempted": sum(row.get("attempted", False) for row in rows),
        "provider_completed": sum(row.get("provider_completed", False) for row in rows),
        "available": sum(row["initial"]["kind"] == "initial" for row in rows),
        "scored": len(scored),
        "strict_syntax_passes": sum(row_syntax(row) for row in scored),
        "strict_full_passes": sum(row_pass(row) for row in scored),
        "failed": sum(row["initial"]["kind"] == "failed" for row in rows),
        "unavailable": sum(row["initial"]["kind"] == "unavailable" for row in rows),
        "budget_stopped": sum(row.get("budget_stopped", False) for row in rows),
    }


def synthetic_rows(mode: str) -> list[dict[str, Any]]:
    rows = []
    family_variants = {
        family: sorted(
            task["variant"] for task in make_corpus()["fixtures"][family]
        )
        for family in DECISION_FAMILIES
    }
    for job in jobs("openai"):
        passed = True
        kind = "initial"
        if mode == "unavailable" and job["planned_sequence"] == 1:
            kind = "unavailable"
            passed = False
        if mode in {"failed", "budget"} and job["planned_sequence"] == 1:
            kind = "failed"
            passed = False
        if job["family"] == "comprehension-analysis":
            variants = family_variants[job["family"]]
            if mode in {"informative", "repeated-loss"}:
                passed = job["variant"] not in variants[:2]
                if (
                    mode == "repeated-loss"
                    and job["arm"] == "compact-bar-local-labels"
                    and job["variant"] == variants[2]
                ):
                    passed = False
            elif mode == "discordant-balanced":
                if job["arm"] == "exact-object-json":
                    passed = not (
                        job["variant"] in variants[:3] and job["repeat"] == 1
                    )
                elif job["arm"] == "compact-bar-local-labels":
                    passed = not (
                        job["variant"] in variants[:3] and job["repeat"] == 2
                    )
                else:
                    passed = job["variant"] not in variants[:2]
            elif mode == "deficit-three":
                if job["arm"] == "exact-object-json":
                    passed = not (
                        job["variant"] in variants[:2] and job["repeat"] == 1
                    )
                elif job["arm"] == "compact-bar-local-labels":
                    passed = not (
                        job["variant"] in variants[:5] and job["repeat"] == 1
                    )
                else:
                    passed = job["variant"] not in variants[:2]
        score = {
            "syntax_pass": passed,
            "primary_pass": passed,
            "semantic_pass": passed,
            "component": {"correct": int(passed), "planned": 1},
        }
        if kind == "initial":
            initial = core.result_state("initial", score)
        else:
            initial = core.result_state(kind, reason="synthetic")
        rows.append(
            {
                **{name: job[name] for name in ("planned_sequence", "arm", "family", "variant", "repeat")},
                "initial": initial,
                "initial_call": None,
                "repair": None,
                "repair_call": None,
                "attempted": True,
                "provider_completed": kind != "failed",
                "budget_stopped": mode == "budget" and kind == "failed",
            }
        )
    return rows


def repeated_losses(rows: list[dict[str, Any]], candidate: str, family: str) -> int:
    indexed = {
        (row["arm"], row["variant"], row["repeat"]): row
        for row in rows
        if row["family"] == family
    }
    variants = sorted(
        {row["variant"] for row in rows if row["family"] == family}
    )
    return sum(
        all(
            row_pass(indexed[("exact-object-json", variant, repeat)])
            and not row_pass(indexed[(candidate, variant, repeat)])
            for repeat in range(1, REPEATS[family] + 1)
        )
        for variant in variants
    )


def aggregation_screen() -> dict[str, Any]:
    complete = synthetic_rows("complete")
    unavailable = synthetic_rows("unavailable")
    failed = synthetic_rows("failed")
    budget = synthetic_rows("budget")
    loss = synthetic_rows("repeated-loss")
    discordant = synthetic_rows("discordant-balanced")
    unavailable_summary = denominator_summary(unavailable)
    def synthetic_summary(mode: str) -> str:
        runs = []
        for provider in PROVIDERS:
            rows = synthetic_rows(mode)
            runs.append(
                {
                    "provider": provider,
                    "results": rows,
                    "progress": denominator_summary(rows),
                    "actual_cost_usd": 0.0,
                }
            )
        return summarize_runs(runs)["decision"]

    checks = {
        "planned_and_scored_separate": unavailable_summary["planned"]
        == MAXIMUM_CALLS
        and unavailable_summary["scored"] == MAXIMUM_CALLS - 1,
        "unavailable_not_musical_failure": unavailable_summary["strict_full_passes"]
        == unavailable_summary["scored"],
        "failed_not_in_scored_denominator": denominator_summary(failed)["scored"]
        == MAXIMUM_CALLS - 1
        and denominator_summary(failed)["failed"] == 1,
        "budget_stop_is_separate": denominator_summary(budget)["budget_stopped"]
        == 1
        and denominator_summary(budget)["failed"] == 1,
        "complete_has_no_repeated_loss": repeated_losses(
            complete, "compact-bar-local-labels", "comprehension-analysis"
        )
        == 0,
        "repeated_loss_detected": repeated_losses(
            loss, "compact-bar-local-labels", "comprehension-analysis"
        )
        == 1,
        "ceiling_summary_revises": synthetic_summary("complete") == "revise",
        "informative_summary_retains_both": synthetic_summary("informative")
        == "retain-both",
        "repeated_loss_summary_revises": synthetic_summary("repeated-loss")
        == "revise",
        "balanced_discordance_has_three_losses": paired_summary(
            discordant,
            "compact-bar-local-labels",
            "exact-object-json",
            "comprehension-analysis",
        )["candidate_only_losses"]
        == 3,
        "balanced_discordance_is_noninferior": synthetic_summary(
            "discordant-balanced"
        )
        == "retain-both",
        "three_row_deficit_revises": synthetic_summary("deficit-three")
        == "revise",
    }
    return {"checks": checks, "all_pass": all(checks.values())}


class CostGuard:
    def __init__(self, provider: str) -> None:
        self.provider = provider
        self.message_attempts = 0
        self.token_count_attempts = 0
        self.settled_cost = Decimal(0)
        self.committed_cost = Decimal(0)
        self.failed_reservations = 0

    def authorize_token_count(self) -> None:
        if self.provider != "claude-haiku":
            raise RuntimeError("Only Claude Haiku uses token counting")
        if self.token_count_attempts >= MAXIMUM_TOKEN_COUNT_REQUESTS:
            raise RuntimeError("The token-count request limit is exhausted")
        self.token_count_attempts += 1

    def validate_token_count(self, input_tokens: int) -> None:
        if input_tokens + base.TOKEN_COUNT_MARGIN > base.INPUT_TOKEN_CEILING:
            raise RuntimeError("The input-token cost ceiling is exceeded")

    def check_message_capacity(self, payload_bytes: int) -> None:
        if payload_bytes > base.REQUEST_BYTE_CEILING:
            raise RuntimeError("The request-byte ceiling is exceeded")
        if self.message_attempts >= MAXIMUM_CALLS:
            raise RuntimeError("The message-call limit is exhausted")
        reservation = base.maximum_call_cost(self.provider)
        if self.committed_cost + reservation > PROVIDER_COST_LIMITS[self.provider]:
            raise CostBudgetExceeded("The approved cost ceiling would be exceeded")

    def authorize_message(self, payload_bytes: int) -> Decimal:
        self.check_message_capacity(payload_bytes)
        reservation = base.maximum_call_cost(self.provider)
        self.message_attempts += 1
        self.committed_cost += reservation
        return reservation

    def settle(
        self, reservation: Decimal, measured: dict[str, int], actual: Decimal
    ) -> None:
        if measured["input_tokens"] > base.INPUT_TOKEN_CEILING:
            raise RuntimeError("Measured input tokens exceed the cost bound")
        if measured["output_tokens"] > base.output_token_limit(self.provider):
            raise RuntimeError("Measured output tokens exceed the request bound")
        if actual > reservation:
            raise RuntimeError("Measured call cost exceeds its reservation")
        self.settled_cost += actual
        self.committed_cost = self.committed_cost - reservation + actual

    def retain_failed_reservation(self) -> None:
        self.failed_reservations += 1

    def snapshot(self) -> dict[str, Any]:
        return {
            "message_attempts": self.message_attempts,
            "token_count_attempts": self.token_count_attempts,
            "settled_cost_usd": base.rounded_usd(self.settled_cost),
            "settled_exact_usd": base.exact_usd(self.settled_cost),
            "committed_cost_usd": base.rounded_usd(self.committed_cost),
            "committed_exact_usd": base.exact_usd(self.committed_cost),
            "failed_reservations": self.failed_reservations,
            "maximum_cost_usd": base.rounded_usd(
                PROVIDER_COST_LIMITS[self.provider]
            ),
        }


def cost_screen() -> dict[str, Any]:
    checks = {}
    for provider in PROVIDERS:
        guard = CostGuard(provider)
        reservation = guard.authorize_message(1)
        guard.retain_failed_reservation()
        snapshot = guard.snapshot()
        checks[f"{provider}:failed-reservation"] = (
            snapshot["message_attempts"] == 1
            and snapshot["failed_reservations"] == 1
            and Decimal(str(snapshot["committed_exact_usd"])) == reservation
        )
        checks[f"{provider}:recent-plus-call-fits"] = (
            RECENT_COST_ESTIMATE[provider] + base.maximum_call_cost(provider)
            <= PROVIDER_COST_LIMITS[provider]
        )
        checks[f"{provider}:effective-settings"] = (
            effective_request_settings(provider) == base.SETTINGS[provider]
        )
    return {"checks": checks, "all_pass": all(checks.values())}


def network_preflight(
    provider: str,
    connector: Callable[..., Any] = socket.create_connection,
) -> dict[str, Any]:
    host = NETWORK_HOSTS[provider]
    started = time.perf_counter()
    connection = connector((host, 443), timeout=5)
    try:
        latency_ms = (time.perf_counter() - started) * 1000
    finally:
        connection.close()
    return {"host": host, "port": 443, "latency_ms": round(latency_ms, 3)}


def preflight_screen() -> dict[str, Any]:
    calls = []

    class Connection:
        def close(self) -> None:
            calls.append("closed")

    def connector(address: Any, timeout: int) -> Connection:
        calls.append((address, timeout))
        return Connection()

    success = network_preflight("openai", connector)

    def failure(address: Any, timeout: int) -> Any:
        raise OSError("synthetic network failure")

    try:
        network_preflight("gemini", failure)
        failure_detected = False
    except OSError:
        failure_detected = True
    return {
        "success_host": success["host"] == NETWORK_HOSTS["openai"],
        "connection_closed": calls[-1] == "closed",
        "failure_detected_before_loop": failure_detected,
        "all_pass": success["host"] == NETWORK_HOSTS["openai"]
        and calls[-1] == "closed"
        and failure_detected,
    }


def deterministic_screen() -> dict[str, Any]:
    audit = cohort_audit()
    schedules = {provider: jobs(provider) for provider in PROVIDERS}
    visibility = prompt_visibility_screen()
    mutations = mutation_screen()
    aggregation = aggregation_screen()
    costs = cost_screen()
    preflight = preflight_screen()
    provider_accounting = provider_accounting_screen()
    size_gates = offline_size_gates()
    prompts = [
        prompt_for(job) for provider in PROVIDERS for job in schedules[provider]
    ]
    pair_blocks = {
        provider: [
            rows[index : index + len(ARMS)]
            for index in range(0, len(rows), len(ARMS))
        ]
        for provider, rows in schedules.items()
    }
    first_counts = {
        provider: {
            arm: sum(block[0]["arm"] == arm for block in blocks) for arm in ARMS
        }
        for provider, blocks in pair_blocks.items()
    }
    value = {
        "schema": SCHEMA,
        "job_count_per_provider": {
            provider: len(rows) for provider, rows in schedules.items()
        },
        "expected_job_count_per_provider": MAXIMUM_CALLS,
        "candidate_sha256": candidate_hashes(),
        "cohort_audit": audit,
        "visibility": visibility,
        "mutations": mutations,
        "aggregation": aggregation,
        "cost": costs,
        "preflight": preflight,
        "provider_accounting": provider_accounting,
        "offline_size_gates": size_gates,
        "all_pair_blocks_have_all_arms": all(
            set(row["arm"] for row in block) == set(ARMS)
            for blocks in pair_blocks.values()
            for block in blocks
        ),
        "balanced_first_arm_counts": first_counts,
        "planned_sequences_are_contiguous": all(
            [row["planned_sequence"] for row in rows]
            == list(range(1, MAXIMUM_CALLS + 1))
            for rows in schedules.values()
        ),
        "all_requests_fit": all(
            base.request_bytes(provider, prompt) <= base.REQUEST_BYTE_CEILING
            for provider in PROVIDERS
            for prompt in prompts
        ),
        "historical_snapshot_excludes_current_and_future": (
            "compact-format-v14" not in HISTORICAL_PACKAGES
            and all(name in HISTORICAL_PACKAGES for name in ("compact-bar-v0", "compact-format-v13"))
        ),
        "retired_arms_absent": POSITIONAL_ARM not in ARMS and len(ARMS) == 3,
        "size_report": size_report(),
    }
    freshness_pass = all(
        audit[name] == 0
        for name in (
            "internal_full_duplicates",
            "internal_semantic_duplicates",
            "prior_full_overlap",
            "prior_semantic_overlap",
            "prior_analysis_case_overlap",
        )
    )
    expected_first = len(base_jobs()) // len(ARMS)
    value["all_checks_pass"] = all(
        (
            all(count == MAXIMUM_CALLS for count in value["job_count_per_provider"].values()),
            freshness_pass,
            visibility["all_visible"],
            mutations["all_pass"],
            aggregation["all_pass"],
            costs["all_pass"],
            preflight["all_pass"],
            provider_accounting["all_pass"],
            size_gates["pass"],
            value["all_pair_blocks_have_all_arms"],
            all(
                counts == {arm: expected_first for arm in ARMS}
                for counts in first_counts.values()
            ),
            value["planned_sequences_are_contiguous"],
            value["all_requests_fit"],
            value["historical_snapshot_excludes_current_and_future"],
            value["retired_arms_absent"],
        )
    )
    value["sha256"] = core.digest(value)
    return value


def deterministic_manifest() -> dict[str, Any]:
    screen = deterministic_screen()
    protocol = protocol_manifest()
    plan = run_plan()
    value = {
        "schema": SCHEMA,
        "screen_sha256": screen["sha256"],
        "protocol_sha256": protocol["sha256"],
        "run_plan_sha256": plan["sha256"],
        "cohort_sha256": protocol["cohort_audit"]["corpus_sha256"],
        "candidate_sha256": candidate_hashes(),
        "job_count_per_provider": MAXIMUM_CALLS,
        "all_checks_pass": screen["all_checks_pass"],
    }
    value["sha256"] = core.digest(value)
    return value


def validate_approval(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text())
    plan = run_plan()
    if (
        value.get("run_id") != RUN_ID
        or value.get("protocol_sha256") != plan["protocol_sha256"]
        or value.get("run_plan_sha256") != plan["sha256"]
        or value.get("cohort_sha256") != plan["cohort_sha256"]
        or value.get("candidate_sha256") != plan["candidate_sha256"]
    ):
        raise ValueError("Approval does not match the frozen v14 plan")
    if (
        value.get("status") != "approved"
        or not isinstance(value.get("operator_statement"), str)
        or not value["operator_statement"].strip()
    ):
        raise ValueError("Approval needs an explicit operator statement")
    return value


def count_input_tokens(key: str, prompt: str, guard: CostGuard) -> int:
    guard.authorize_token_count()
    spec = base.count_spec(key, prompt)
    raw = transport.post_json(spec["url"], spec["headers"], spec["payload"])
    input_tokens = raw.get("input_tokens")
    if not isinstance(input_tokens, int) or input_tokens < 0:
        raise ValueError("The token-count response is invalid")
    guard.validate_token_count(input_tokens)
    return input_tokens


def one_call(
    provider: str, key: str, job: dict[str, Any], guard: CostGuard
) -> tuple[dict[str, Any], dict[str, Any]]:
    prompt = prompt_for(job)
    payload_bytes = base.request_bytes(provider, prompt)
    guard.check_message_capacity(payload_bytes)
    input_estimate = (
        count_input_tokens(key, prompt, guard) if provider == "claude-haiku" else None
    )
    reservation = guard.authorize_message(payload_bytes)
    started = time.perf_counter()
    try:
        spec = base.request_spec(provider, key, prompt)
        raw = transport.post_json(spec["url"], spec["headers"], spec["payload"])
    except Exception:
        guard.retain_failed_reservation()
        raise
    latency_ms = (time.perf_counter() - started) * 1000
    transport_name = "claude" if provider == "claude-haiku" else provider
    call = {
        "prompt_sha256": core.sha256_text(prompt),
        "prompt_bytes": len(prompt.encode()),
        "request_bytes": payload_bytes,
        "input_token_estimate": input_estimate,
        "cost_reservation_usd": base.exact_usd(reservation),
        "latency_ms": round(latency_ms, 3),
        "retries": 0,
        "request_id": raw.get("id"),
        "raw_response_sha256": core.digest(raw),
        "effective_request_settings": effective_request_settings(provider),
    }
    try:
        measured = transport.usage(transport_name, raw)
        cost, exact_cost = base.cost_usd(provider, measured)
        guard.settle(reservation, measured, exact_cost)
        call.update(
            {
                "usage": measured,
                "cost_usd": cost,
                "returned_model": transport.returned_model(transport_name, raw),
                "stop_reason": transport.stop_reason(transport_name, raw),
            }
        )
    except Exception as error:
        guard.retain_failed_reservation()
        call["local_validation_error"] = f"{type(error).__name__}: {error}"
        raise ProviderCompletedError(
            call["local_validation_error"], call
        ) from error
    try:
        reason = transport.stop_reason(transport_name, raw)
        limits = (
            {"length"}
            if provider == "openai"
            else {"MAX_TOKENS"}
            if provider == "gemini"
            else {"max_tokens"}
        )
        if reason in limits:
            return core.result_state("unavailable", reason="output-limit"), call
        if provider == "openai":
            text = raw["choices"][0]["message"].get("content")
        elif provider == "gemini":
            text = "".join(
                part.get("text", "")
                for part in raw["candidates"][0]["content"]["parts"]
            )
        else:
            text = "".join(
                block.get("text", "")
                for block in raw["content"]
                if block.get("type") == "text"
            )
        if not isinstance(text, str) or not text:
            raise ValueError("The provider response has no text content")
        outer = transport.parse_outer(text)
    except Exception as error:
        call["local_validation_error"] = f"{type(error).__name__}: {error}"
        raise ProviderCompletedError(
            call["local_validation_error"], call
        ) from error
    payload = outer["payload"]
    call.update(
        {
            "response_payload": payload,
            "response_bytes": len(payload.encode()),
            "response_payload_sha256": core.sha256_text(payload),
            "outer_schema_valid": outer["outer_schema_valid"],
        }
    )
    score = score_response(job["arm"], job["task"], payload)
    if not outer["outer_schema_valid"]:
        score = parse_failure("The response envelope is invalid")
    return core.result_state("initial", score), call


def provider_accounting_screen() -> dict[str, Any]:
    raw = {
        "id": "synthetic-response",
        "model": MODELS["openai"],
        "choices": [{"finish_reason": "stop", "message": {}}],
        "usage": {
            "prompt_tokens": 1,
            "completion_tokens": 1,
            "prompt_tokens_details": {"cached_tokens": 0},
            "completion_tokens_details": {"reasoning_tokens": 0},
        },
    }
    original = transport.post_json
    guard = CostGuard("openai")
    captured = None
    try:
        transport.post_json = lambda *_args, **_kwargs: raw
        try:
            one_call("openai", "synthetic-key", jobs("openai")[0], guard)
        except ProviderCompletedError as error:
            captured = error.call
    finally:
        transport.post_json = original
    checks = {
        "malformed_response_is_provider_completed": captured is not None,
        "raw_response_is_retained": captured is not None
        and captured.get("raw_response_sha256") == core.digest(raw),
        "usage_and_cost_are_retained": captured is not None
        and captured.get("usage", {}).get("input_tokens") == 1
        and captured.get("cost_usd") is not None,
        "settled_call_is_not_failed_reservation": guard.message_attempts == 1
        and guard.failed_reservations == 0
        and guard.settled_cost > 0,
    }
    return {"checks": checks, "all_pass": all(checks.values())}


def not_attempted_row(job: dict[str, Any], reason: str) -> dict[str, Any]:
    return {
        "planned_sequence": job["planned_sequence"],
        "started_sequence": None,
        "completed_sequence": None,
        "arm": job["arm"],
        "candidate_sha256": candidate_hashes()[job["arm"]],
        "family": job["family"],
        "variant": job["variant"],
        "repeat": job["repeat"],
        "task_sha256": job["task"]["sha256"],
        "semantic_sha256": job["task"]["semantic_sha256"],
        "attempted": False,
        "provider_completed": False,
        "budget_stopped": False,
        "initial": {"kind": "not-attempted", "reason": reason},
        "initial_call": None,
        "repair": None,
        "repair_call": None,
    }


def execute_jobs(
    provider: str, key: str
) -> tuple[list[dict[str, Any]], CostGuard, dict[str, int]]:
    schedule = jobs(provider)
    guard = CostGuard(provider)
    results = []
    counters = {
        "planned": len(schedule),
        "attempted": 0,
        "provider_completed": 0,
        "available": 0,
        "scored": 0,
        "failed": 0,
        "unavailable": 0,
        "budget_stopped": 0,
    }
    stop_reason = None
    started_sequence = 0
    completed_sequence = 0
    for job in schedule:
        if stop_reason is not None:
            results.append(not_attempted_row(job, stop_reason))
            continue
        before_attempts = guard.message_attempts
        before_token_counts = guard.token_count_attempts
        try:
            initial, call = one_call(provider, key, job, guard)
            attempted = guard.message_attempts > before_attempts
            started_sequence += int(attempted)
            completed_sequence += 1
            provider_completed = True
            budget_stopped = False
        except Exception as error:
            attempted = guard.message_attempts > before_attempts
            started_sequence += int(attempted)
            provider_completed = isinstance(error, ProviderCompletedError)
            completed_sequence += int(provider_completed)
            budget_stopped = isinstance(error, CostBudgetExceeded)
            initial = core.result_state(
                "failed", reason=f"{type(error).__name__}: {error}"
            )
            call = error.call if isinstance(error, ProviderCompletedError) else None
            if budget_stopped:
                stop_reason = "budget-stop"
            elif isinstance(error, ProviderCompletedError):
                stop_reason = "provider-completed-validation-failure"
            elif guard.token_count_attempts > before_token_counts and not attempted:
                stop_reason = "token-count-failure"
            else:
                stop_reason = "transport-failure"
        kind = initial["kind"]
        counters["attempted"] += int(attempted)
        counters["provider_completed"] += int(provider_completed)
        counters["available"] += int(kind == "initial")
        counters["scored"] += int(initial.get("score") is not None)
        counters["failed"] += int(kind == "failed")
        counters["unavailable"] += int(kind == "unavailable")
        counters["budget_stopped"] += int(budget_stopped)
        if counters["unavailable"] >= 3:
            stop_reason = "unavailable-stop"
        results.append(
            {
                "planned_sequence": job["planned_sequence"],
                "started_sequence": started_sequence if attempted else None,
                "completed_sequence": completed_sequence if provider_completed else None,
                "arm": job["arm"],
                "candidate_sha256": candidate_hashes()[job["arm"]],
                "family": job["family"],
                "variant": job["variant"],
                "repeat": job["repeat"],
                "task_sha256": job["task"]["sha256"],
                "semantic_sha256": job["task"]["semantic_sha256"],
                "attempted": attempted,
                "provider_completed": provider_completed,
                "budget_stopped": budget_stopped,
                "initial": initial,
                "initial_call": call,
                "repair": None,
                "repair_call": None,
            }
        )
        print(
            f"{provider}: planned={counters['planned']} "
            f"attempted={counters['attempted']} "
            f"provider-completed={counters['provider_completed']} "
            f"failed={counters['failed']} unavailable={counters['unavailable']} "
            f"budget-stopped={counters['budget_stopped']}",
            file=sys.stderr,
            flush=True,
        )
    return results, guard, counters


def run_provider(provider: str, env_file: Path, approval_file: Path) -> dict[str, Any]:
    approval = validate_approval(approval_file)
    screen = deterministic_screen()
    if not screen["all_checks_pass"]:
        raise ValueError("The deterministic screen failed")
    environment = transport.load_env(env_file)
    missing = [name for name in KEYS.values() if not environment.get(name)]
    if missing:
        raise ValueError(f"Provider credential preflight failed: {','.join(missing)}")
    preflight = network_preflight(provider)
    results, guard, counters = execute_jobs(provider, environment[KEYS[provider]])
    calls = [row["initial_call"] for row in results if row["initial_call"] is not None]
    exact_cost = sum(
        (
            Decimal(str(call["cost_usd"]["total"]))
            for call in calls
            if call.get("cost_usd") is not None
        ),
        Decimal(0),
    )
    snapshot = guard.snapshot()
    if base.rounded_usd(exact_cost) != snapshot["settled_cost_usd"]:
        raise AssertionError("The exact call sum and settled guard total differ")
    value = {
        "schema": SCHEMA,
        "run_kind": "hardened-targeted-holdout-provider",
        "run_id": RUN_ID,
        "provider": provider,
        "cohort": COHORT,
        "cohort_sha256": make_corpus()["sha256"],
        "candidate_sha256": candidate_hashes(),
        "requested_model": MODELS[provider],
        "declared_settings": SETTINGS[provider],
        "effective_request_settings": effective_request_settings(provider),
        "client": "Python urllib.request direct HTTPS",
        "platform": f"{platform.system()} {platform.release()} {platform.machine()}",
        "python": platform.python_version(),
        "protocol_sha256": protocol_manifest()["sha256"],
        "screen_sha256": screen["sha256"],
        "run_plan_sha256": run_plan()["sha256"],
        "schedule_sha256": run_plan()["schedule_sha256"][provider],
        "approval": approval,
        "network_preflight": preflight,
        "results": results,
        "progress": counters,
        "actual_cost_usd": base.rounded_usd(exact_cost),
        "actual_cost_exact_usd": base.exact_usd(exact_cost),
        "cost_guard": snapshot,
        "complete": counters["provider_completed"] == MAXIMUM_CALLS
        and counters["failed"] == 0
        and counters["unavailable"] == 0
        and counters["budget_stopped"] == 0,
    }
    value["raw_run_sha256"] = core.digest(
        [call["raw_response_sha256"] for call in calls]
    )
    value["manifest_sha256"] = core.digest(value)
    return value


def load_manifest(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text())
    unsigned = deepcopy(value)
    claimed = unsigned.pop("manifest_sha256", None)
    if claimed != core.digest(unsigned):
        raise ValueError(f"Manifest hash mismatch: {path}")
    provider = value.get("provider")
    if provider not in PROVIDERS:
        raise ValueError(f"Manifest has an unknown provider: {path}")
    expected = jobs(provider)
    rows = value.get("results", [])
    expected_identity = [
        (
            job["planned_sequence"],
            job["arm"],
            job["family"],
            job["variant"],
            job["repeat"],
            job["task"]["sha256"],
        )
        for job in expected
    ]
    actual_identity = [
        (
            row.get("planned_sequence"),
            row.get("arm"),
            row.get("family"),
            row.get("variant"),
            row.get("repeat"),
            row.get("task_sha256"),
        )
        for row in rows
    ]
    if (
        value.get("run_id") != RUN_ID
        or value.get("run_kind") != "hardened-targeted-holdout-provider"
        or value.get("protocol_sha256") != protocol_manifest()["sha256"]
        or value.get("run_plan_sha256") != run_plan()["sha256"]
        or value.get("cohort_sha256") != make_corpus()["sha256"]
        or value.get("candidate_sha256") != candidate_hashes()
        or value.get("requested_model") != MODELS[provider]
        or value.get("declared_settings") != SETTINGS[provider]
        or value.get("effective_request_settings")
        != effective_request_settings(provider)
        or value.get("schedule_sha256") != run_plan()["schedule_sha256"][provider]
        or len(rows) != MAXIMUM_CALLS
        or actual_identity != expected_identity
    ):
        raise ValueError(f"Manifest does not match the frozen holdout: {path}")
    if any(
        row.get("candidate_sha256") != candidate_hashes()[row["arm"]]
        for row in rows
    ):
        raise ValueError(f"Manifest has a candidate hash mismatch: {path}")
    denominators = denominator_summary(rows)
    if any(
        value.get("progress", {}).get(name) != denominators[name]
        for name in (
            "planned",
            "attempted",
            "provider_completed",
            "available",
            "scored",
            "failed",
            "unavailable",
            "budget_stopped",
        )
    ):
        raise ValueError(f"Manifest progress counters do not reconcile: {path}")
    started = [row["started_sequence"] for row in rows if row["started_sequence"] is not None]
    completed = [row["completed_sequence"] for row in rows if row["completed_sequence"] is not None]
    if started != list(range(1, len(started) + 1)) or completed != list(
        range(1, len(completed) + 1)
    ):
        raise ValueError(f"Manifest has invalid realized ordinals: {path}")
    calls = [row["initial_call"] for row in rows if row["initial_call"] is not None]
    if any(
        call.get("returned_model") != MODELS[provider]
        for call in calls
        if call.get("returned_model") is not None
    ):
        raise ValueError(f"Manifest contains a different returned model: {path}")
    exact_cost = sum(
        (
            Decimal(str(call["cost_usd"]["total"]))
            for call in calls
            if call.get("cost_usd") is not None
        ),
        Decimal(0),
    )
    if (
        base.rounded_usd(exact_cost) != value.get("actual_cost_usd")
        or base.rounded_usd(exact_cost)
        != value.get("cost_guard", {}).get("settled_cost_usd")
        or value.get("raw_run_sha256")
        != core.digest([call["raw_response_sha256"] for call in calls])
    ):
        raise ValueError(f"Manifest cost or raw-run accounting does not reconcile: {path}")
    guard = value.get("cost_guard", {})
    if (
        guard.get("message_attempts") != denominators["attempted"]
        or guard.get("token_count_attempts", 0) > MAXIMUM_TOKEN_COUNT_REQUESTS
        or (
            provider == "claude-haiku"
            and guard.get("token_count_attempts", 0) < denominators["attempted"]
        )
        or (
            provider != "claude-haiku"
            and guard.get("token_count_attempts", 0) != 0
        )
        or guard.get("committed_cost_usd", math.inf)
        > base.rounded_usd(PROVIDER_COST_LIMITS[provider])
    ):
        raise ValueError(f"Manifest request accounting does not reconcile: {path}")
    return value


def safe_rate(numerator: int, denominator: int) -> float | None:
    return round(numerator / denominator, 6) if denominator else None


def family_arm_summary(rows: list[dict[str, Any]], family: str, arm: str) -> dict[str, Any]:
    selected = [row for row in rows if row["family"] == family and row["arm"] == arm]
    denominators = denominator_summary(selected)
    components = [row_score(row).get("component", {}) for row in selected if row_score(row)]
    component_correct = sum(int(value.get("correct", 0)) for value in components)
    component_planned = sum(int(value.get("planned", 0)) for value in components)
    return {
        **denominators,
        "strict_syntax_rate_scored": safe_rate(
            denominators["strict_syntax_passes"], denominators["scored"]
        ),
        "strict_full_rate_scored": safe_rate(
            denominators["strict_full_passes"], denominators["scored"]
        ),
        "strict_full_rate_planned": safe_rate(
            denominators["strict_full_passes"], denominators["planned"]
        ),
        "component_correct": component_correct,
        "component_planned_scored": component_planned,
        "component_accuracy_scored": safe_rate(component_correct, component_planned),
    }


def paired_summary(
    rows: list[dict[str, Any]], candidate: str, baseline: str, family: str
) -> dict[str, Any]:
    indexed = {
        (row["arm"], row["variant"], row["repeat"]): row
        for row in rows
        if row["family"] == family
    }
    pairs = []
    for variant in sorted(
        {row["variant"] for row in rows if row["family"] == family}
    ):
        for repeat in range(1, REPEATS[family] + 1):
            left = indexed[(candidate, variant, repeat)]
            right = indexed[(baseline, variant, repeat)]
            if row_score(left) is not None and row_score(right) is not None:
                pairs.append((left, right))
    return {
        "planned_pairs": UNIQUE_COUNTS[family] * REPEATS[family],
        "scored_pairs": len(pairs),
        "candidate_passes": sum(row_pass(left) for left, _ in pairs),
        "baseline_passes": sum(row_pass(right) for _, right in pairs),
        "candidate_only_wins": sum(
            row_pass(left) and not row_pass(right) for left, right in pairs
        ),
        "candidate_only_losses": sum(
            row_pass(right) and not row_pass(left) for left, right in pairs
        ),
    }


def runtime_size_summary(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    result = []
    for family in FAMILIES:
        for arm in ARMS:
            calls = [
                row["initial_call"]
                for row in rows
                if row["family"] == family
                and row["arm"] == arm
                and row.get("initial_call") is not None
            ]
            result.append(
                {
                    "family": family,
                    "arm": arm,
                    "provider_completed": len(calls),
                    "prompt_bytes": sum(call["prompt_bytes"] for call in calls),
                    "response_bytes": sum(call.get("response_bytes", 0) for call in calls),
                    "api_input_tokens": sum(
                        int(call.get("usage", {}).get("input_tokens", 0))
                        for call in calls
                    ),
                    "api_output_tokens": sum(
                        int(call.get("usage", {}).get("output_tokens", 0))
                        for call in calls
                    ),
                }
            )
    return result


def offline_size_gates() -> dict[str, Any]:
    indexed = {
        (row["family"], row["arm"]): row
        for row in size_report()["offline_bytes"]
    }
    rule = decision_rule()["size_gates"]
    rows = []
    for family in FAMILIES:
        fields = indexed[(family, "compact-bar-fields")]
        local = indexed[(family, "compact-bar-local-labels")]
        exact = indexed[(family, "exact-object-json")]
        values = {
            "family": family,
            "local_to_fields_prompt_ratio": round(
                local["mean_prompt_bytes"] / fields["mean_prompt_bytes"], 6
            ),
            "local_to_fields_response_ratio": round(
                local["mean_perfect_response_bytes"]
                / fields["mean_perfect_response_bytes"],
                6,
            ),
            "fields_to_exact_response_ratio": round(
                fields["mean_perfect_response_bytes"]
                / exact["mean_perfect_response_bytes"],
                6,
            ),
            "local_to_exact_response_ratio": round(
                local["mean_perfect_response_bytes"]
                / exact["mean_perfect_response_bytes"],
                6,
            ),
        }
        values["pass"] = (
            values["local_to_fields_prompt_ratio"]
            <= rule["maximum_local_to_fields_prompt_ratio"]
            and values["local_to_fields_response_ratio"]
            <= rule["maximum_local_to_fields_response_ratio"]
            and (
                family == "comprehension-analysis"
                or (
                    values["fields_to_exact_response_ratio"]
                    <= rule["maximum_compact_to_exact_response_ratio"]
                    and values["local_to_exact_response_ratio"]
                    <= rule["maximum_compact_to_exact_response_ratio"]
                )
            )
        )
        rows.append(values)
    return {"families": rows, "pass": all(row["pass"] for row in rows)}


def provider_summary(run: dict[str, Any]) -> dict[str, Any]:
    rows = run["results"]
    families = {
        family: {
            arm: family_arm_summary(rows, family, arm) for arm in ARMS
        }
        for family in FAMILIES
    }
    paired = {
        family: {
            candidate: paired_summary(
                rows, candidate, "exact-object-json", family
            )
            for candidate in COMPACT_ARMS
        }
        for family in DECISION_FAMILIES
    }
    informative = {}
    rule = decision_rule()
    for family in DECISION_FAMILIES:
        compact_rates = [
            families[family][arm]["strict_full_rate_scored"] for arm in COMPACT_ARMS
        ]
        exact_rate = families[family]["exact-object-json"]["strict_full_rate_scored"]
        exact_band = rule["informative_exact_band"]
        compact_band = rule["informative_compact_band"]
        informative[family] = (
            exact_rate is not None
            and exact_band["inclusive_minimum"]
            <= exact_rate
            < exact_band["exclusive_maximum"]
            and any(
                rate is not None
                and compact_band["exclusive_minimum"]
                < rate
                < compact_band["exclusive_maximum"]
                for rate in compact_rates
            )
        )
    candidate_gates = {}
    for candidate in COMPACT_ARMS:
        all_candidate = [row for row in rows if row["arm"] == candidate]
        overall = denominator_summary(all_candidate)
        syntax_rate = safe_rate(overall["strict_syntax_passes"], overall["scored"])
        family_gates = {
            family: {
                "pass_deficit_rows": (
                    paired[family][candidate]["baseline_passes"]
                    - paired[family][candidate]["candidate_passes"]
                ),
                "noninferior": (
                    paired[family][candidate]["baseline_passes"]
                    - paired[family][candidate]["candidate_passes"]
                )
                <= decision_rule()["exact_noninferiority_loss_margin_rows"],
                "repeated_losses": repeated_losses(rows, candidate, family),
                "repeated_loss_pass": repeated_losses(rows, candidate, family)
                <= decision_rule()["maximum_repeated_candidate_only_losses"],
            }
            for family in DECISION_FAMILIES
        }
        candidate_gates[candidate] = {
            "syntax_rate_scored": syntax_rate,
            "syntax_pass": syntax_rate is not None
            and syntax_rate >= decision_rule()["minimum_compact_syntax"],
            "families": family_gates,
            "pass": syntax_rate is not None
            and syntax_rate >= decision_rule()["minimum_compact_syntax"]
            and all(
                item["noninferior"] and item["repeated_loss_pass"]
                for item in family_gates.values()
            ),
        }
    completion = safe_rate(
        run["progress"]["provider_completed"], run["progress"]["planned"]
    )
    control = {
        family: families[family]["exact-object-json"]["strict_full_rate_scored"]
        for family in DECISION_FAMILIES
    }
    control_pass = all(
        rate is not None and rate >= decision_rule()["minimum_exact_control_pass"]
        for rate in control.values()
    )
    return {
        "provider": run["provider"],
        "progress": run["progress"],
        "completion_rate": completion,
        "completion_pass": completion is not None
        and completion >= decision_rule()["minimum_provider_completion"],
        "exact_control_rates": control,
        "exact_control_pass": control_pass,
        "families": families,
        "paired_vs_exact": paired,
        "informative_family": informative,
        "informativeness_pass": any(informative.values()),
        "candidate_gates": candidate_gates,
        "size": runtime_size_summary(rows),
        "actual_cost_usd": run["actual_cost_usd"],
    }


def summarize_runs(runs: list[dict[str, Any]]) -> dict[str, Any]:
    by_provider = {run["provider"]: run for run in runs}
    if set(by_provider) != set(PROVIDERS):
        raise ValueError("The summary needs all three provider manifests")
    providers = [provider_summary(by_provider[provider]) for provider in PROVIDERS]
    exact_totals = {
        provider: sum(
            (
                Decimal(str(call["cost_usd"]["total"]))
                for row in by_provider[provider]["results"]
                for call in (row.get("initial_call"),)
                if call is not None
                and call.get("cost_usd") is not None
            ),
            Decimal(0),
        )
        for provider in PROVIDERS
    }
    for provider, total in exact_totals.items():
        if base.rounded_usd(total) != by_provider[provider]["actual_cost_usd"]:
            raise ValueError("A provider cost does not match its exact line-item sum")
    fatal = any(
        not row["completion_pass"] or not row["exact_control_pass"]
        for row in providers
    )
    candidates_pass = all(
        row["candidate_gates"][candidate]["pass"]
        for row in providers
        for candidate in COMPACT_ARMS
    )
    sizes = offline_size_gates()
    informativeness_pass = all(
        row["informativeness_pass"] for row in providers
    )
    if fatal:
        decision = "stop"
    elif candidates_pass and informativeness_pass and sizes["pass"]:
        decision = "retain-both"
    else:
        decision = "revise"
    value = {
        "schema": SCHEMA,
        "run_kind": "hardened-targeted-holdout-summary",
        "run_id": RUN_ID,
        "protocol_sha256": protocol_manifest()["sha256"],
        "run_plan_sha256": run_plan()["sha256"],
        "candidate_sha256": candidate_hashes(),
        "providers": providers,
        "offline_size_gates": sizes,
        "actual_cost_usd": {
            **{
                provider: base.rounded_usd(total)
                for provider, total in exact_totals.items()
            },
            "total": base.rounded_usd(sum(exact_totals.values(), Decimal(0))),
        },
        "decision": decision,
        "selection_authority": decision_rule()["selection_authority"],
    }
    value["sha256"] = core.digest(value)
    return value


def write_new(value: dict[str, Any], output: Path | None) -> None:
    text = json.dumps(value, indent=2, sort_keys=True) + "\n"
    if output is None:
        print(text, end="")
    else:
        if output.exists():
            raise FileExistsError(f"Refusing to replace: {output}")
        output.write_text(text)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--check", type=Path)
    parser.add_argument("--print-plan", action="store_true")
    parser.add_argument("--provider", choices=PROVIDERS)
    parser.add_argument(
        "--env-file", type=Path, default=PACKAGE_ROOT.parents[2] / ".env"
    )
    parser.add_argument("--approval-file", type=Path, default=APPROVAL_PATH)
    parser.add_argument("--output", type=Path)
    parser.add_argument(
        "--summarize",
        nargs=3,
        type=Path,
        metavar=("OPENAI", "GEMINI", "HAIKU"),
    )
    args = parser.parse_args()
    if args.self_test:
        screen = deterministic_screen()
        if not screen["all_checks_pass"]:
            raise SystemExit(json.dumps(screen, indent=2, sort_keys=True))
        print(json.dumps({"pass": True, **deterministic_manifest()}, indent=2, sort_keys=True))
        return
    if args.check:
        actual = deterministic_manifest()
        expected = json.loads(args.check.read_text())
        if actual != expected:
            raise SystemExit(
                "Deterministic mismatch\nexpected="
                + json.dumps(expected, sort_keys=True)
                + "\nactual="
                + json.dumps(actual, sort_keys=True)
            )
        print(json.dumps({"pass": True, **actual}, indent=2, sort_keys=True))
        return
    if args.print_plan:
        print(json.dumps(run_plan(), indent=2, sort_keys=True))
        return
    if args.provider:
        write_new(
            run_provider(args.provider, args.env_file, args.approval_file),
            args.output,
        )
        return
    if args.summarize:
        write_new(
            summarize_runs([load_manifest(path) for path in args.summarize]),
            args.output,
        )
        return
    print(
        json.dumps(
            {
                "screen": deterministic_screen(),
                "protocol": protocol_manifest(),
                "plan": run_plan(),
            },
            indent=2,
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
