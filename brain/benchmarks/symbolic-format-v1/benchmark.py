#!/usr/bin/env python3
"""Run the frozen expanded symbolic-format comparison."""

from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import os
import platform
import random
import subprocess
import sys
import time
import urllib.error
import urllib.request
from collections import defaultdict
from pathlib import Path
from typing import Any

from corpus import TASK_FAMILIES, canonical, corpus_manifest, digest, make_corpus
from formats import (
    ARMS,
    COMPOSITE_ARMS,
    IDENTITY_ARMS,
    MUSICAL_FIELDS,
    PAIR_FAMILIES,
    eligibility_manifest,
    is_eligible,
    output_grammar,
    parse_events,
    projected,
    render_events,
)
from scoring import perfect_payload, score_response, source_notes


SCHEMA = "ghostnote-symbolic-format-benchmark-v1"
OPENAI_MODEL = "gpt-5.4-mini-2026-03-17"
GEMINI_MODEL = "gemini-3.8-flash"
CLAUDE_MODEL = "claude-sonnet-5"
PROVIDERS = ("openai", "gemini", "claude")
MODELS = {"openai": OPENAI_MODEL, "gemini": GEMINI_MODEL, "claude": CLAUDE_MODEL}
KEYS = {"openai": "OPENAI_API_KEY", "gemini": "GEMINI_API_KEY", "claude": "CLAUDE_API_KEY"}
PRICES = {
    "openai": {"input": 0.75, "cached_input": 0.075, "output": 4.50},
    "gemini": {"input": 0.75, "cached_input": 0.075, "output": 3.75},
    "claude": {"input": 2.00, "cached_input": 0.20, "output": 10.00},
}
PRICE_SOURCES = {
    "openai": "https://developers.openai.com/api/docs/models/gpt-5.4-mini",
    "gemini": "https://ai.google.dev/gemini-api/docs/pricing",
    "claude": "https://platform.claude.com/docs/en/about-claude/pricing",
}
SEED = 8101
PILOT_ARMS = ("compact-bar", "abc-2.1-native", "abc-2.1-composite")
SENTINEL_ARMS = PILOT_ARMS
OUTER_SCHEMA = {
    "type": "object",
    "properties": {"payload": {"type": "string"}},
    "required": ["payload"],
    "additionalProperties": False,
}


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def load_env(path: Path) -> dict[str, str]:
    result = dict(os.environ)
    if not path.exists():
        return result
    for line in path.read_text().splitlines():
        if line.strip() and not line.lstrip().startswith("#") and "=" in line:
            name, value = line.split("=", 1)
            result.setdefault(name.strip(), value.strip().strip("'\""))
    return result


def represented_source(arm: str, task: dict[str, Any]) -> str | None:
    notes = source_notes(task)
    if not notes:
        return None
    source = task.get("source", {})
    if "source" in source and isinstance(source["source"], dict):
        source = source["source"]
    return render_events(arm, notes, source if isinstance(source, dict) else {})


def task_instruction(task: dict[str, Any]) -> str:
    family = task["family"]
    if family == "comprehension-structure":
        return "Reconstruct every represented note. Keep exact onsets, durations, polyphony, voices, and every represented performance field."
    if family == "comprehension-analysis":
        evidence = task["source"]["analysis_evidence"]
        return (
            "Analyze the chord and the supplied motif evidence. Use quality labels major, minor, or dominant-seventh. "
            "Use Roman function labels I, I6, i, or V7. Use motif_relation labels transposition, inversion, or augmentation. "
            "Use rhythm=sustained when all notes share one onset and duration. "
            f"Use this independent evidence: {canonical(evidence)}. Return the supplied-key Roman function and the exact motif relation."
        )
    if family == "generation-progression":
        return (
            "Realize this four-voice progression contract. Use the literal voice names bass, tenor, alto, and soprano once at each chord start. "
            f"Multiple valid voicings are allowed: {canonical(task['contract'])}"
        )
    if family == "generation-melody":
        return (
            "Create one lead-voice melody that satisfies every constraint. The last four pitches must transpose the first four. "
            "Every note at an integer start must use strong_beat_chord_pitch_classes. "
            f"Contract: {canonical(task['contract'])}"
        )
    if family == "continuation-motif":
        source = task["source"]
        start_rule = (
            "Use output starts equal to each seed start plus 4."
            if source["operation"] != "augment"
            else f"Use output starts 4 + seed_start*{source['amount']} and multiply each duration by {source['amount']}."
        )
        return f"Return only the four continuation notes. {start_rule} Apply operation={source['operation']}, amount={source['amount']}, axis={source['axis']}."
    if family == "continuation-roles":
        return f"Continue the phrase with exactly four bass notes and four lead notes. Satisfy this fixed-harmony contract: {canonical(task['contract'])}"
    if family == "transformation-local":
        return f"Apply only this local change. Preserve every unrelated represented note exactly: {canonical(task['source']['change'])}. Base SHA-256 is {task['source']['source']['sha256']}."
    if family == "transformation-revoice":
        return f"Revoice each four-note chord with operation={task['source']['operation']}. Keep each chord's pitch classes, starts, durations, and range {task['source']['range']}."
    if family == "transformation-rhythm":
        source = task["source"]
        if source["operation"] == "groove":
            rule = f"add {source['odd_offset']} beat to the start of odd-indexed notes only; keep durations unchanged"
        else:
            rule = f"multiply every start and duration by {source['factor']}"
        return f"Apply only this exact rhythm transform: {rule}. Keep pitches and voices unchanged."
    raise ValueError(f"Unknown family: {family}")


def prompt_for(arm: str, task: dict[str, Any]) -> str:
    source = represented_source(arm, task)
    sections = [
        "Complete one deterministic symbolic-music task.",
        "Return one JSON object with exactly one string field named payload. Put the requested notation inside that string. Do not add prose.",
        f"Representation arm: {arm}.",
        output_grammar(arm, task["family"]),
        "Follow this output example exactly, but use the task values:\n" + output_example(arm, task["family"]),
        task_instruction(task),
    ]
    if source is not None:
        sections.extend(("SOURCE", source, "END SOURCE"))
    return "\n\n".join(sections)


def output_example(arm: str, family: str) -> str:
    if family == "comprehension-analysis":
        return "ANALYSIS root_pc=0 bass_pc=4 quality=major inversion=1 function=I6 motif_relation=transposition rhythm=sustained"
    if family == "transformation-local" and arm in IDENTITY_ARMS:
        if arm == "exact-json":
            return '{"base_sha256":"abc","ops":[{"op":"set","id":"n1","pitch":62}]}'
        return "PATCH abc\nSET n1 pitch=62"
    examples = {
        "exact-json": '{"notes":[{"id":"n1","voice":"lead","start":"0","duration":"1/2","pitch":60,"velocity":80}]}',
        "compact-bar": "N n1 lead 0 1/2 60 80",
        "abc-2.1-native": "%abc-2.1\nX:1\nL:1/48\nM:4/4\nK:C\nV:lead.1\nC6 |",
        "abc-2.1-composite": "%abc-2.1\nX:1\nL:1/48\nM:4/4\nK:C\nV:lead.1\nC6 |\n--- GN SIDE LEDGER ---\nGN n1 lead 0 1/2 60 80",
        "alda-native": 'piano "lead.1": o4 c8',
        "alda-composite": 'piano "lead.1": o4 c8\n--- GN SIDE LEDGER ---\nGN n1 lead 0 1/2 60 80',
        "midi-like-native": "TRACK_lead TIME_0 NOTE_ON_60 DURATION_1/2 VELOCITY_80",
        "midi-like-composite": "TRACK_lead TIME_0 NOTE_ON_60 DURATION_1/2 VELOCITY_80\n--- GN SIDE LEDGER ---\nGN n1 lead 0 1/2 60 80",
        "remi-plus-native": "<Bar=1> <Position=0> <Track=lead> <Pitch=60> <Duration=1/2> <Velocity=80>",
        "remi-plus-composite": "<Bar=1> <Position=0> <Track=lead> <Pitch=60> <Duration=1/2> <Velocity=80>\n--- GN SIDE LEDGER ---\nGN n1 lead 0 1/2 60 80",
        "octuple-midi-native": "(1,0,lead,60,1/2,80,4/4,120)",
        "octuple-midi-composite": "(1,0,lead,60,1/2,80,4/4,120)\n--- GN SIDE LEDGER ---\nGN n1 lead 0 1/2 60 80",
        "one-cycle-mini": "cycle(4){60@0~1/2~lead}",
    }
    return examples[arm]


def deterministic_screen() -> dict[str, Any]:
    corpus = make_corpus()
    eligibility = eligibility_manifest()
    round_trips = []
    for arm in ARMS:
        task = corpus["retained"]["comprehension-structure"][0]
        notes = task["source"]["notes"]
        text = render_events(arm, notes, task["source"])
        parsed, alignment = parse_events(arm, text)
        round_trips.append(
            {
                "arm": arm,
                "pass": projected(parsed, MUSICAL_FIELDS) == projected(notes, MUSICAL_FIELDS),
                "alignment": alignment,
                "bytes": len(text.encode()),
                "sha256": sha256_text(text),
            }
        )
    perfect_checks = []
    for arm in ARMS:
        for family in TASK_FAMILIES:
            if not is_eligible(arm, family):
                continue
            for cohort in ("development", "retained"):
                tasks = corpus[cohort][family][:1]
                for task in tasks:
                    score = score_response(arm, task, perfect_payload(arm, task))
                    perfect_checks.append({"arm": arm, "task": task["id"], "pass": score["musical_pass"]})
    result = {
        "schema": SCHEMA,
        "corpus": corpus_manifest(corpus),
        "eligibility": eligibility,
        "round_trips": round_trips,
        "perfect_response_checks": perfect_checks,
        "all_retained_screens_pass": all(value["pass"] for value in round_trips + perfect_checks),
    }
    result["sha256"] = digest(result)
    return result


def run_verifier_self_test() -> dict[str, Any]:
    from theory_verifiers import self_test as python_self_test

    python_result = python_self_test()
    process = subprocess.run(
        ["node", str(Path(__file__).with_name("tonal-verifier.mjs"))],
        check=True,
        capture_output=True,
        text=True,
    )
    tonal_result = json.loads(process.stdout)
    return {
        "python": python_result,
        "tonal": tonal_result,
        "pass": python_result["pass"] and tonal_result["pass"],
    }


def protocol_manifest() -> dict[str, Any]:
    corpus = make_corpus()
    package_root = Path(__file__).parent
    package_files = (
        "benchmark.py",
        "corpus.py",
        "formats.py",
        "scoring.py",
        "theory_verifiers.py",
        "tonal-verifier.mjs",
        "requirements-verifiers.txt",
    )
    prompts = {}
    grammar_bytes = {}
    for arm in ARMS:
        grammar_bytes[arm] = {}
        for family in TASK_FAMILIES:
            if not is_eligible(arm, family):
                continue
            prompt = prompt_for(arm, corpus["retained"][family][0])
            prompts[f"{arm}/{family}"] = sha256_text(prompt)
            grammar = output_grammar(arm, family)
            grammar_bytes[arm][family] = {"bytes": len(grammar.encode()), "sha256": sha256_text(grammar)}
    value = {
        "schema": SCHEMA,
        "protocol": "focused calls with a common payload-string JSON envelope",
        "models": MODELS,
        "settings": {
            "reasoning_or_effort": "low",
            "max_output_tokens": 3_000,
            "temperature": "provider default; no non-default sampling parameters",
            "retry_http_status": [429, 500, 502, 503, 504],
            "retry_delays_seconds": [2, 4, 8],
            "seeded_interleave": SEED,
        },
        "trial_rule": {
            "initial_variants": [1, 2, 3],
            "mixed_add": [4, 5],
            "still_mixed_add": [6, 7],
            "sentinel_arms": list(SENTINEL_ARMS),
            "sentinel_repeat_variant": 1,
        },
        "prices_usd_per_million_tokens": PRICES,
        "price_sources": PRICE_SOURCES,
        "package_file_sha256": {
            name: hashlib.sha256((package_root / name).read_bytes()).hexdigest()
            for name in package_files
        },
        "prompt_sha256": prompts,
        "grammar": grammar_bytes,
        "corpus": corpus_manifest(corpus),
    }
    value["sha256"] = digest(value)
    return value


def post_json(url: str, headers: dict[str, str], payload: dict[str, Any]) -> dict[str, Any]:
    request = urllib.request.Request(url, data=canonical(payload).encode(), method="POST", headers={"Content-Type": "application/json", **headers})
    with urllib.request.urlopen(request, timeout=240) as response:
        return json.load(response)


def parse_outer(text: str) -> dict[str, Any]:
    stripped = text.strip()
    if stripped.startswith("```"):
        stripped = stripped.strip("`")
        if stripped.startswith("json"):
            stripped = stripped[4:]
    start, end = stripped.find("{"), stripped.rfind("}")
    if start < 0 or end < start:
        return {"payload": stripped, "outer_schema_valid": False}
    try:
        value = json.loads(stripped[start : end + 1])
    except json.JSONDecodeError:
        return {"payload": stripped, "outer_schema_valid": False}
    valid = isinstance(value, dict) and set(value) == {"payload"} and isinstance(value.get("payload"), str)
    return {"payload": value.get("payload", stripped) if isinstance(value, dict) else stripped, "outer_schema_valid": valid}


def model_call(provider: str, key: str, prompt: str) -> tuple[dict[str, Any], dict[str, Any]]:
    messages = [{"role": "user", "content": prompt}]
    if provider == "openai":
        raw = post_json(
            "https://api.openai.com/v1/chat/completions",
            {"Authorization": f"Bearer {key}"},
            {
                "model": OPENAI_MODEL,
                "messages": messages,
                "response_format": {"type": "json_schema", "json_schema": {"name": "benchmark_payload", "strict": True, "schema": OUTER_SCHEMA}},
                "reasoning_effort": "low",
                "max_completion_tokens": 3_000,
            },
        )
        text = raw["choices"][0]["message"]["content"]
    elif provider == "gemini":
        raw = post_json(
            f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent",
            {"x-goog-api-key": key},
            {
                "contents": [{"role": "user", "parts": [{"text": prompt}]}],
                "generationConfig": {
                    "responseMimeType": "application/json",
                    "responseJsonSchema": OUTER_SCHEMA,
                    "maxOutputTokens": 3_000,
                    "thinkingConfig": {"thinkingLevel": "low"},
                },
            },
        )
        text = "".join(part.get("text", "") for part in raw["candidates"][0]["content"]["parts"])
    else:
        raw = post_json(
            "https://api.anthropic.com/v1/messages",
            {"x-api-key": key, "anthropic-version": "2023-06-01"},
            {
                "model": CLAUDE_MODEL,
                "max_tokens": 3_000,
                "messages": messages,
                "output_config": {"effort": "low", "format": {"type": "json_schema", "schema": OUTER_SCHEMA}},
            },
        )
        text = "".join(block.get("text", "") for block in raw["content"] if block.get("type") == "text")
    return parse_outer(text), raw


def usage(provider: str, raw: dict[str, Any]) -> dict[str, int]:
    if provider == "openai":
        value = raw.get("usage", {})
        return {
            "input_tokens": value.get("prompt_tokens", 0),
            "cached_input_tokens": value.get("prompt_tokens_details", {}).get("cached_tokens", 0),
            "output_tokens": value.get("completion_tokens", 0),
            "thinking_tokens": value.get("completion_tokens_details", {}).get("reasoning_tokens", 0),
        }
    if provider == "gemini":
        value = raw.get("usageMetadata", {})
        return {
            "input_tokens": value.get("promptTokenCount", 0),
            "cached_input_tokens": value.get("cachedContentTokenCount", 0),
            "output_tokens": value.get("candidatesTokenCount", 0) + value.get("thoughtsTokenCount", 0),
            "thinking_tokens": value.get("thoughtsTokenCount", 0),
        }
    value = raw.get("usage", {})
    return {
        "input_tokens": value.get("input_tokens", 0) + value.get("cache_creation_input_tokens", 0) + value.get("cache_read_input_tokens", 0),
        "cached_input_tokens": value.get("cache_read_input_tokens", 0),
        "output_tokens": value.get("output_tokens", 0),
        "thinking_tokens": value.get("output_tokens_details", {}).get("thinking_tokens", 0),
    }


def cost_usd(provider: str, measured: dict[str, int]) -> dict[str, float]:
    rates = PRICES[provider]
    cached = measured["cached_input_tokens"]
    uncached = max(0, measured["input_tokens"] - cached)
    parts = {
        "uncached_input": uncached * rates["input"] / 1_000_000,
        "cached_input": cached * rates["cached_input"] / 1_000_000,
        "output": measured["output_tokens"] * rates["output"] / 1_000_000,
    }
    parts["total"] = sum(parts.values())
    return {name: round(value, 8) for name, value in parts.items()}


def returned_model(provider: str, raw: dict[str, Any]) -> str | None:
    if provider == "gemini":
        return raw.get("modelVersion")
    return raw.get("model")


def stop_reason(provider: str, raw: dict[str, Any]) -> str | None:
    if provider == "openai":
        return raw.get("choices", [{}])[0].get("finish_reason")
    if provider == "gemini":
        return raw.get("candidates", [{}])[0].get("finishReason")
    return raw.get("stop_reason")


def call_with_retry(provider: str, key: str, prompt: str) -> tuple[dict[str, Any], dict[str, Any], float, int]:
    retries = 0
    started = time.perf_counter()
    for delay in (0, 2, 4, 8):
        if delay:
            time.sleep(delay)
        try:
            outer, raw = model_call(provider, key, prompt)
            return outer, raw, (time.perf_counter() - started) * 1_000, retries
        except urllib.error.HTTPError as error:
            if error.code not in {429, 500, 502, 503, 504} or retries == 3:
                raise
            retries += 1
        except (TimeoutError, urllib.error.URLError):
            if retries == 3:
                raise
            retries += 1
    raise AssertionError("Retry loop did not return or raise")


def core_jobs(cohort: str, variants: list[int], arms: tuple[str, ...] = ARMS) -> list[dict[str, Any]]:
    corpus = make_corpus()
    jobs = []
    for arm in arms:
        for family in TASK_FAMILIES:
            if not is_eligible(arm, family):
                continue
            for variant in variants:
                task = corpus[cohort][family][variant if cohort == "development" else variant - 1]
                jobs.append({"kind": cohort, "arm": arm, "family": family, "variant": variant, "task": task, "sentinel": False})
    return jobs


def call_job(provider: str, key: str, job: dict[str, Any]) -> dict[str, Any]:
    prompt = prompt_for(job["arm"], job["task"])
    try:
        outer, raw, latency_ms, retries = call_with_retry(provider, key, prompt)
        measured = usage(provider, raw)
        payload = outer["payload"]
        validation = score_response(job["arm"], job["task"], payload)
        return {
            "kind": job["kind"],
            "arm": job["arm"],
            "family": job["family"],
            "variant": job["variant"],
            "sentinel": job.get("sentinel", False),
            "prompt_sha256": sha256_text(prompt),
            "prompt_bytes": len(prompt.encode()),
            "response_payload": payload,
            "response_payload_bytes": len(payload.encode()),
            "response_payload_sha256": sha256_text(payload),
            "outer_schema_valid": outer["outer_schema_valid"],
            "validation": validation,
            "usage": measured,
            "cost_usd": cost_usd(provider, measured),
            "latency_ms": round(latency_ms, 3),
            "retries": retries,
            "returned_model": returned_model(provider, raw),
            "request_id": raw.get("id"),
            "stop_reason": stop_reason(provider, raw),
            "raw_response_sha256": digest(raw),
        }
    except Exception as error:  # Transport exhaustion must remain visible in the run.
        return {
            "kind": job["kind"],
            "arm": job["arm"],
            "family": job["family"],
            "variant": job["variant"],
            "sentinel": job.get("sentinel", False),
            "prompt_sha256": sha256_text(prompt),
            "prompt_bytes": len(prompt.encode()),
            "transport_error": f"{type(error).__name__}: {error}",
            "validation": {"syntax_pass": False, "musical_pass": False, "checks": {}},
            "usage": {"input_tokens": 0, "cached_input_tokens": 0, "output_tokens": 0, "thinking_tokens": 0},
            "cost_usd": {"uncached_input": 0, "cached_input": 0, "output": 0, "total": 0},
            "retries": 3,
        }


def execute_jobs(provider: str, key: str, jobs: list[dict[str, Any]], workers: int) -> list[dict[str, Any]]:
    ordered = list(jobs)
    random.Random(SEED + len(jobs)).shuffle(ordered)
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
        futures = [executor.submit(call_job, provider, key, job) for job in ordered]
        for index, future in enumerate(concurrent.futures.as_completed(futures), start=1):
            results.append(future.result())
            if index % 25 == 0 or index == len(futures):
                print(f"{provider}: completed {index}/{len(futures)} calls", file=sys.stderr, flush=True)
    return sorted(results, key=lambda value: (value["arm"], value["family"], value["variant"], value["sentinel"]))


def secondary_jobs() -> list[dict[str, Any]]:
    prompts = [
        ("malformed-repair", "compact-bar", "The note `N bad lead 0 ? 60 80` is malformed. Return payload `REJECT malformed`.", "REJECT malformed"),
        ("masked-refusal", "exact-json", "A required pitch is MASKED and cannot be inferred. Return payload `REFUSE missing-value`.", "REFUSE missing-value"),
        ("ledger-disagreement", "abc-2.1-composite", "The ABC pitch is C4 but its GN ledger pitch is 61. Return payload `REJECT ledger-disagreement`.", "REJECT ledger-disagreement"),
        ("duplicate-id", "compact-bar", "Two notes use ID dup. Return payload `REJECT duplicate-id`.", "REJECT duplicate-id"),
        ("unsupported-native", "abc-2.1-native", "Change Ghostnote note ID x without a side ledger. Return payload `UNSUPPORTED identity`.", "UNSUPPORTED identity"),
    ]
    return [{"id": name, "arm": arm, "prompt": "Return one JSON object with exactly one string field named payload. " + instruction, "expected": expected} for name, arm, instruction, expected in prompts]


def execute_secondary(provider: str, key: str) -> list[dict[str, Any]]:
    rows = []
    for job in secondary_jobs():
        outer, raw, latency_ms, retries = call_with_retry(provider, key, job["prompt"])
        measured = usage(provider, raw)
        rows.append(
            {
                "id": job["id"],
                "arm": job["arm"],
                "initial_response": outer["payload"],
                "initial_pass": outer["payload"].strip() == job["expected"],
                "usage": measured,
                "cost_usd": cost_usd(provider, measured),
                "latency_ms": round(latency_ms, 3),
                "retries": retries,
                "raw_response_sha256": digest(raw),
            }
        )
    repair_prompt = (
        "Return one JSON object with exactly one string field named payload. The prior compact row missed duration. "
        "Use this exact feedback: duration must be 1/2. Return payload `N fixed lead 0 1/2 60 80`."
    )
    outer, raw, latency_ms, retries = call_with_retry(provider, key, repair_prompt)
    measured = usage(provider, raw)
    repaired_score = score_response(
        "compact-bar",
        {"family": "comprehension-structure", "expected": [{"id": "fixed", "voice": "lead", "start": "0", "duration": "1/2", "pitch": 60, "velocity": 80}]},
        outer["payload"],
    )
    rows[0]["repair"] = {
        "response": outer["payload"],
        "pass": repaired_score["musical_pass"],
        "usage": measured,
        "cost_usd": cost_usd(provider, measured),
        "latency_ms": round(latency_ms, 3),
        "retries": retries,
        "raw_response_sha256": digest(raw),
    }
    return rows


def run_pilot(provider: str, env_file: Path, workers: int) -> dict[str, Any]:
    environment = load_env(env_file)
    key = environment.get(KEYS[provider])
    if not key:
        raise ValueError(f"{KEYS[provider]} is missing")
    screen = deterministic_screen()
    if not screen["all_retained_screens_pass"]:
        raise ValueError("Deterministic capability screen failed")
    jobs = core_jobs("development", [0], PILOT_ARMS)
    results = execute_jobs(provider, key, jobs, workers)
    total_cost = sum(row["cost_usd"]["total"] for row in results)
    value = {
        "schema": SCHEMA,
        "run_kind": "pilot",
        "provider": provider,
        "requested_model": MODELS[provider],
        "protocol_sha256": protocol_manifest()["sha256"],
        "screen_sha256": screen["sha256"],
        "results": results,
        "actual_cost_usd": round(total_cost, 6),
        "valid_calls": sum("transport_error" not in row for row in results),
    }
    value["sha256"] = digest(value)
    return value


def freeze_pilot(paths: list[Path]) -> dict[str, Any]:
    runs = [json.loads(path.read_text()) for path in paths]
    if {run["provider"] for run in runs} != set(PROVIDERS):
        raise ValueError("Pilot freeze needs one run for each provider")
    minimum_core = len(core_jobs("retained", [1, 2, 3]))
    sentinel_calls = sum(is_eligible(arm, family) for arm in SENTINEL_ARMS for family in TASK_FAMILIES)
    minimum_calls = minimum_core + sentinel_calls + 6
    projections = {}
    for run in runs:
        rows = run["results"]
        valid = [row for row in rows if "transport_error" not in row]
        average = sum(row["cost_usd"]["total"] for row in valid) / len(valid)
        projections[run["provider"]] = {
            "pilot_calls": len(rows),
            "average_cost_per_call_usd": round(average, 8),
            "minimum_retained_calls": minimum_calls,
            "projected_minimum_cost_usd": round(average * minimum_calls, 4),
            "exceeds_soft_ceiling": average * minimum_calls > 5,
        }
    value = {
        "schema": SCHEMA,
        "run_kind": "frozen-pilot-decision",
        "protocol_sha256": protocol_manifest()["sha256"],
        "non_inferiority_margin": 0.125,
        "margin_kind": "descriptive paired success-rate difference",
        "sample_support": "Twenty-seven minimum paired observations per full arm and provider resolve 3.7 percentage points. The result does not establish population equivalence.",
        "stopping_rule": "Stop a cell at three when all outcomes agree. Add variants 4 and 5 when mixed. Add 6 and 7 only when still mixed.",
        "compact_specific_repeat_rule": "Two compact-only failures in one task family and provider prevent a proceed decision.",
        "cost_projection": projections,
        "pilot_sha256": {run["provider"]: run["sha256"] for run in runs},
    }
    value["sha256"] = digest(value)
    return value


def mixed_cells(rows: list[dict[str, Any]], variants: set[int]) -> set[tuple[str, str]]:
    cells: dict[tuple[str, str], list[bool]] = defaultdict(list)
    for row in rows:
        if not row.get("sentinel") and row["variant"] in variants:
            cells[(row["arm"], row["family"])].append(row["validation"]["musical_pass"])
    return {cell for cell, outcomes in cells.items() if outcomes and any(outcomes) and not all(outcomes)}


def run_retained(provider: str, env_file: Path, frozen_path: Path, workers: int, allow_over_budget: bool) -> dict[str, Any]:
    frozen = json.loads(frozen_path.read_text())
    if frozen["protocol_sha256"] != protocol_manifest()["sha256"]:
        raise ValueError("Frozen pilot decision does not match this protocol")
    projection = frozen["cost_projection"][provider]
    if projection["exceeds_soft_ceiling"] and not allow_over_budget:
        raise ValueError(f"Projected {provider} cost is USD {projection['projected_minimum_cost_usd']}; operator notice is required")
    environment = load_env(env_file)
    key = environment.get(KEYS[provider])
    if not key:
        raise ValueError(f"{KEYS[provider]} is missing")
    screen = deterministic_screen()
    if not screen["all_retained_screens_pass"]:
        raise ValueError("Deterministic capability screen failed")
    results = execute_jobs(provider, key, core_jobs("retained", [1, 2, 3]), workers)
    first_mixed = mixed_cells(results, {1, 2, 3})
    if first_mixed:
        jobs = [job for job in core_jobs("retained", [4, 5]) if (job["arm"], job["family"]) in first_mixed]
        results.extend(execute_jobs(provider, key, jobs, workers))
    second_mixed = mixed_cells(results, {1, 2, 3, 4, 5}) & first_mixed
    if second_mixed:
        jobs = [job for job in core_jobs("retained", [6, 7]) if (job["arm"], job["family"]) in second_mixed]
        results.extend(execute_jobs(provider, key, jobs, workers))
    sentinel_jobs = []
    corpus = make_corpus()
    for arm in SENTINEL_ARMS:
        for family in TASK_FAMILIES:
            if is_eligible(arm, family):
                sentinel_jobs.append({"kind": "retained", "arm": arm, "family": family, "variant": 1, "task": corpus["retained"][family][0], "sentinel": True})
    results.extend(execute_jobs(provider, key, sentinel_jobs, workers))
    secondary = execute_secondary(provider, key)
    core_cost = sum(row["cost_usd"]["total"] for row in results)
    secondary_cost = sum(row["cost_usd"]["total"] + row.get("repair", {}).get("cost_usd", {}).get("total", 0) for row in secondary)
    value = {
        "schema": SCHEMA,
        "run_kind": "retained-provider",
        "provider": provider,
        "requested_model": MODELS[provider],
        "client": "Python urllib.request direct HTTPS",
        "settings": protocol_manifest()["settings"],
        "platform": f"{platform.system()} {platform.release()} {platform.machine()}",
        "python": platform.python_version(),
        "privacy": "Generated MIT symbolic notes only. No live project, MIDI file, audio, or API key was retained.",
        "protocol_sha256": protocol_manifest()["sha256"],
        "screen_sha256": screen["sha256"],
        "frozen_pilot_sha256": frozen["sha256"],
        "stopping": {"mixed_after_three": sorted([list(value) for value in first_mixed]), "mixed_after_five": sorted([list(value) for value in second_mixed])},
        "results": sorted(results, key=lambda row: (row["arm"], row["family"], row["variant"], row["sentinel"])),
        "secondary": secondary,
        "actual_cost_usd": round(core_cost + secondary_cost, 6),
        "complete": all("transport_error" not in row for row in results),
    }
    value["raw_run_sha256"] = digest([row.get("raw_response_sha256") for row in results] + [row["raw_response_sha256"] for row in secondary])
    value["manifest_sha256"] = digest(value)
    return value


def summarize(paths: list[Path], frozen_path: Path) -> dict[str, Any]:
    runs = [json.loads(path.read_text()) for path in paths]
    frozen = json.loads(frozen_path.read_text())
    if {run["provider"] for run in runs} != set(PROVIDERS):
        raise ValueError("Summary needs one retained run for each provider")
    provider_summaries = []
    comparison_rows = []
    proceed = all(run["complete"] for run in runs)
    for run in runs:
        regular = [row for row in run["results"] if not row["sentinel"]]
        by_arm: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for row in regular:
            by_arm[row["arm"]].append(row)
        arm_rows = []
        for arm in ARMS:
            rows = by_arm.get(arm, [])
            if not rows:
                continue
            arm_rows.append(
                {
                    "arm": arm,
                    "successes": sum(row["validation"]["musical_pass"] for row in rows),
                    "trials": len(rows),
                    "syntax_successes": sum(row["validation"]["syntax_pass"] for row in rows),
                    "input_tokens": sum(row["usage"]["input_tokens"] for row in rows),
                    "output_tokens": sum(row["usage"]["output_tokens"] for row in rows),
                    "output_bytes": sum(row.get("response_payload_bytes", 0) for row in rows),
                    "cost_usd": round(sum(row["cost_usd"]["total"] for row in rows), 6),
                    "alignment_failures": sum(row["validation"].get("alignment", {}).get("pass") is False for row in rows),
                }
            )
        sentinel_groups: dict[tuple[str, str], list[bool]] = defaultdict(list)
        for row in run["results"]:
            if row["arm"] in SENTINEL_ARMS and row["variant"] == 1:
                sentinel_groups[(row["arm"], row["family"])].append(row["validation"]["musical_pass"])
        sentinel_variation = [list(cell) for cell, values in sentinel_groups.items() if len(set(values)) > 1]
        for family in PAIR_FAMILIES:
            for condition in ("native", "composite"):
                comparator = f"{family}-{condition}"
                compact_map = {(row["family"], row["variant"]): row for row in by_arm["compact-bar"]}
                comparator_map = {(row["family"], row["variant"]): row for row in by_arm[comparator]}
                common = sorted(compact_map.keys() & comparator_map.keys())
                compact_success = sum(compact_map[key]["validation"]["musical_pass"] for key in common)
                comparator_success = sum(comparator_map[key]["validation"]["musical_pass"] for key in common)
                delta = (compact_success - comparator_success) / len(common) if common else 0
                repeated = []
                family_losses: dict[str, int] = defaultdict(int)
                for key in common:
                    if not compact_map[key]["validation"]["musical_pass"] and comparator_map[key]["validation"]["musical_pass"]:
                        family_losses[key[0]] += 1
                repeated = sorted(name for name, count in family_losses.items() if count >= 2)
                passes = delta >= -frozen["non_inferiority_margin"] and not repeated
                proceed &= passes
                comparison_rows.append(
                    {
                        "provider": run["provider"],
                        "comparison": f"compact-bar vs {comparator}",
                        "paired_trials": len(common),
                        "compact_successes": compact_success,
                        "comparator_successes": comparator_success,
                        "delta": round(delta, 4),
                        "margin": frozen["non_inferiority_margin"],
                        "repeated_compact_only_failure_families": repeated,
                        "passes": passes,
                    }
                )
        provider_summaries.append(
            {
                "provider": run["provider"],
                "requested_model": run["requested_model"],
                "returned_models": sorted({row.get("returned_model") for row in run["results"] if row.get("returned_model")}),
                "arms": arm_rows,
                "sentinel_variation": sentinel_variation,
                "secondary_initial_passes": sum(row["initial_pass"] for row in run["secondary"]),
                "secondary_initial_total": len(run["secondary"]),
                "repair_pass": run["secondary"][0].get("repair", {}).get("pass"),
                "actual_cost_usd": run["actual_cost_usd"],
                "stopping": run["stopping"],
            }
        )
    side_ledger = []
    for run in runs:
        arm_map = {row["arm"]: row for row in next(item for item in provider_summaries if item["provider"] == run["provider"])["arms"]}
        for family in PAIR_FAMILIES:
            native, composite = arm_map[f"{family}-native"], arm_map[f"{family}-composite"]
            side_ledger.append(
                {
                    "provider": run["provider"],
                    "family": family,
                    "success_delta": round(composite["successes"] / composite["trials"] - native["successes"] / native["trials"], 4),
                    "input_token_overhead": composite["input_tokens"] - native["input_tokens"],
                    "output_byte_overhead": composite["output_bytes"] - native["output_bytes"],
                    "alignment_failures": composite["alignment_failures"],
                }
            )
    if not all(run["complete"] for run in runs):
        decision = "block"
    elif proceed:
        decision = "proceed"
    else:
        decision = "revise"
    result = {
        "schema": SCHEMA,
        "run_kind": "retained-summary",
        "decision": decision,
        "claim": "descriptive non-inferiority" if decision == "proceed" else "material observed deficit" if decision == "revise" else "incomplete provider evidence",
        "population_equivalence": "not claimed",
        "frozen_margin": frozen["non_inferiority_margin"],
        "providers": provider_summaries,
        "comparisons": comparison_rows,
        "side_ledger": side_ledger,
        "raw_run_sha256": {run["provider"]: run["raw_run_sha256"] for run in runs},
    }
    result["sha256"] = digest(result)
    return result


def deterministic_package() -> dict[str, Any]:
    value = {
        "schema": SCHEMA,
        "run_kind": "deterministic",
        "screen": deterministic_screen(),
        "protocol": protocol_manifest(),
    }
    value["sha256"] = digest(value)
    return value


def deterministic_manifest(value: dict[str, Any]) -> dict[str, Any]:
    return {
        "schema": value["schema"],
        "sha256": value["sha256"],
        "screen_sha256": value["screen"]["sha256"],
        "protocol_sha256": value["protocol"]["sha256"],
        "corpus_sha256": value["screen"]["corpus"]["sha256"],
    }


def self_test() -> dict[str, Any]:
    screen = deterministic_screen()
    assert screen["all_retained_screens_pass"]
    assert len(screen["round_trips"]) == len(ARMS)
    corpus = make_corpus()
    assert corpus_manifest(corpus)["retained_fixtures"] == len(TASK_FAMILIES) * 7
    assert len(core_jobs("retained", [1, 2, 3])) == 336
    assert all(score_response(arm, task, perfect_payload(arm, task))["musical_pass"] for arm in ARMS for family, tasks in corpus["retained"].items() if is_eligible(arm, family) for task in tasks)
    result = {
        "schema": SCHEMA,
        "passed": 8 + len(ARMS),
        "corpus_sha256": corpus["sha256"],
        "deterministic_sha256": deterministic_package()["sha256"],
    }
    return result


def write_result(value: dict[str, Any], output: Path | None) -> None:
    rendered = json.dumps(value, indent=2, sort_keys=True, ensure_ascii=False) + "\n"
    if output:
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(rendered)
    else:
        print(rendered, end="")


def main() -> None:
    parser = argparse.ArgumentParser()
    actions = parser.add_mutually_exclusive_group(required=True)
    actions.add_argument("--self-test", action="store_true")
    actions.add_argument("--verifier-self-test", action="store_true")
    actions.add_argument("--deterministic", action="store_true")
    actions.add_argument("--check", type=Path)
    actions.add_argument("--pilot", choices=PROVIDERS)
    actions.add_argument("--freeze-pilot", nargs=3, type=Path)
    actions.add_argument("--provider", choices=PROVIDERS)
    actions.add_argument("--summarize", nargs=3, type=Path)
    parser.add_argument("--env-file", type=Path, default=Path("../.env"))
    parser.add_argument("--frozen-pilot", type=Path)
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--allow-over-budget", action="store_true")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if args.self_test:
        value = self_test()
    elif args.verifier_self_test:
        value = run_verifier_self_test()
    elif args.deterministic:
        value = deterministic_package()
    elif args.check:
        expected = json.loads(args.check.read_text())
        actual = deterministic_package()
        if deterministic_manifest(actual) != expected:
            print(canonical({"expected_sha256": expected.get("sha256"), "actual_sha256": actual.get("sha256")}), file=sys.stderr)
            raise SystemExit(1)
        value = {"schema": SCHEMA, "check": "pass", "sha256": actual["sha256"]}
    elif args.pilot:
        value = run_pilot(args.pilot, args.env_file, args.workers)
    elif args.freeze_pilot:
        value = freeze_pilot(args.freeze_pilot)
    elif args.provider:
        if not args.frozen_pilot:
            parser.error("--provider requires --frozen-pilot")
        value = run_retained(args.provider, args.env_file, args.frozen_pilot, args.workers, args.allow_over_budget)
    else:
        if not args.frozen_pilot:
            parser.error("--summarize requires --frozen-pilot")
        value = summarize(args.summarize, args.frozen_pilot)
    write_result(value, args.output)


if __name__ == "__main__":
    main()
