#!/usr/bin/env python3
"""Freeze and run the v16 OpenAI and Haiku directional supplement."""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import re
import urllib.error
from copy import deepcopy
from decimal import Decimal
from pathlib import Path
from statistics import median
from typing import Any


PACKAGE_ROOT = Path(__file__).resolve().parent
BENCHMARK_PATH = PACKAGE_ROOT / "benchmark.py"
RUN_ID = "phase8c4d-medium-difficulty-direction-other-providers-r1"
RUN_KIND_PROVIDER = "medium-difficulty-direction-other-provider"
RUN_KIND_SUMMARY = "medium-difficulty-direction-other-summary"
PROVIDERS = ("openai", "claude-haiku")
RECENT_COST_ESTIMATE = {
    "openai": Decimal("0.450000"),
    "claude-haiku": Decimal("1.250000"),
}
PROVIDER_COST_LIMITS = {
    "openai": Decimal("0.650000"),
    "claude-haiku": Decimal("1.750000"),
}
MAXIMUM_TOTAL_COST = Decimal("2.400000")
APPROVAL_PATH = PACKAGE_ROOT / "runs" / "direction-other-providers-r1-approval.json"


def load_benchmark() -> Any:
    spec = importlib.util.spec_from_file_location(
        "ghostnote_compact_format_v16_other_providers", BENCHMARK_PATH
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load module: {BENCHMARK_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


m = load_benchmark()
core = m.core
base = m.base
transport = m.transport
DIRECTION_PROTOCOL = m.protocol_manifest
DIRECTION_RUN_PLAN = m.run_plan
DIRECTION_SCREEN = m.deterministic_screen


def runner_sha256() -> str:
    return base.file_sha256(Path(__file__))


def configure_modules() -> None:
    values = {
        "RUN_ID": RUN_ID,
        "PROVIDERS": PROVIDERS,
        "RECENT_COST_ESTIMATE": RECENT_COST_ESTIMATE,
        "PROVIDER_COST_LIMITS": PROVIDER_COST_LIMITS,
        "MAXIMUM_TOKEN_COUNT_REQUESTS": m.MAXIMUM_CALLS,
        "APPROVAL_PATH": APPROVAL_PATH,
        "RUN_KIND_PROVIDER": RUN_KIND_PROVIDER,
        "RUN_KIND_SUMMARY": RUN_KIND_SUMMARY,
    }
    for module in (m, m.v15, m.v14):
        for name, value in values.items():
            setattr(module, name, value)


configure_modules()


def cost_guard_manifest() -> dict[str, Any]:
    return {
        "recent_cost_estimate_usd": {
            provider: float(RECENT_COST_ESTIMATE[provider]) for provider in PROVIDERS
        },
        "recent_cost_estimate_total_usd": float(
            sum(RECENT_COST_ESTIMATE.values(), Decimal(0))
        ),
        "maximum_provider_cost_usd": {
            provider: float(PROVIDER_COST_LIMITS[provider]) for provider in PROVIDERS
        },
        "maximum_total_cost_usd": float(MAXIMUM_TOTAL_COST),
        "maximum_call_cost_usd": {
            provider: base.rounded_usd(base.maximum_call_cost(provider))
            for provider in PROVIDERS
        },
        "input_token_ceiling_per_call": base.INPUT_TOKEN_CEILING,
        "output_token_ceiling_per_call": {
            provider: base.output_token_limit(provider) for provider in PROVIDERS
        },
        "request_byte_ceiling_per_call": base.REQUEST_BYTE_CEILING,
        "failed_reservation": "retained",
    }


def stage_manifest() -> dict[str, Any]:
    return {
        "name": "OpenAI and Haiku directional screen",
        "providers": list(PROVIDERS),
        "unique_prompts_per_arm_and_decision_family": 10,
        "repeats": 1,
        "maximum_messages_per_provider": m.MAXIMUM_CALLS,
        "maximum_messages_total": m.MAXIMUM_CALLS * len(PROVIDERS),
        "confirmation": "Requires a new frozen cohort and explicit approval.",
    }


def protocol_manifest() -> dict[str, Any]:
    value = DIRECTION_PROTOCOL()
    value["run_id"] = RUN_ID
    value["run_kind"] = "medium-difficulty-direction-other-providers-protocol"
    value["stage"] = stage_manifest()
    value["models"] = {provider: m.MODELS[provider] for provider in PROVIDERS}
    value["declared_settings"] = {
        provider: m.SETTINGS[provider] for provider in PROVIDERS
    }
    value["effective_request_settings"] = {
        provider: m.v15.effective_request_settings(provider) for provider in PROVIDERS
    }
    value["cost_guard"] = cost_guard_manifest()
    value["runner_sha256"] = runner_sha256()
    value["gemini"] = {
        "status": "excluded",
        "reason": "The operator is resolving regional provider availability.",
    }
    value["sha256"] = core.digest(
        {name: item for name, item in value.items() if name != "sha256"}
    )
    return value


def run_plan() -> dict[str, Any]:
    value = DIRECTION_RUN_PLAN()
    protocol = protocol_manifest()
    value["run_id"] = RUN_ID
    value["run_kind"] = "medium-difficulty-direction-other-providers-plan"
    value["protocol_sha256"] = protocol["sha256"]
    value["stage"] = stage_manifest()
    value["models"] = protocol["models"]
    value["declared_settings"] = protocol["declared_settings"]
    value["effective_request_settings"] = protocol["effective_request_settings"]
    value["cost_guard"] = protocol["cost_guard"]
    value["calls"] = {
        "maximum_per_provider": m.MAXIMUM_CALLS,
        "maximum_all_providers": m.MAXIMUM_CALLS * len(PROVIDERS),
        "maximum_haiku_token_count_requests": m.MAXIMUM_CALLS,
        "automatic_retries": 0,
        "repairs": 0,
    }
    value["runner_sha256"] = runner_sha256()
    value["approval"] = "pending"
    value["sha256"] = core.digest(
        {name: item for name, item in value.items() if name != "sha256"}
    )
    return value


def synthetic_raw(provider: str) -> dict[str, Any]:
    if provider == "openai":
        return {
            "id": "synthetic-openai",
            "model": m.MODELS[provider],
            "choices": [{"finish_reason": "stop", "message": {}}],
            "usage": {
                "prompt_tokens": 1,
                "completion_tokens": 0,
                "prompt_tokens_details": {"cached_tokens": 0},
                "completion_tokens_details": {"reasoning_tokens": 0},
            },
        }
    return {
        "id": "synthetic-haiku",
        "model": m.MODELS[provider],
        "stop_reason": "end_turn",
        "usage": {
            "input_tokens": 1,
            "cache_read_input_tokens": 0,
            "output_tokens": 0,
        },
        "content": [],
    }


def provider_accounting_screen() -> dict[str, Any]:
    checks = {}
    original = transport.post_json
    for provider in PROVIDERS:
        raw = synthetic_raw(provider)
        guard = m.v14.CostGuard(provider)
        captured = None

        def responder(url: str, *_args: Any, **_kwargs: Any) -> dict[str, Any]:
            if url.endswith("/count_tokens"):
                return {"input_tokens": 1}
            return raw

        try:
            transport.post_json = responder
            try:
                m.v15.one_call(
                    provider, "synthetic-key", m.v14.jobs(provider)[0], guard
                )
            except m.v14.ProviderCompletedError as error:
                captured = error.call
        finally:
            transport.post_json = original
        checks[f"{provider}:malformed-is-completed"] = captured is not None
        checks[f"{provider}:raw-is-retained"] = captured is not None and (
            captured.get("raw_response_sha256") == core.digest(raw)
        )
        checks[f"{provider}:usage-is-retained"] = captured is not None and (
            captured.get("usage", {}).get("input_tokens") == 1
        )
        checks[f"{provider}:reservation-is-settled"] = (
            guard.message_attempts == 1
            and guard.failed_reservations == 0
            and guard.settled_cost > 0
        )
        checks[f"{provider}:token-count-is-correct"] = (
            guard.token_count_attempts == (1 if provider == "claude-haiku" else 0)
        )
    return {"checks": checks, "all_pass": all(checks.values())}


def deterministic_screen() -> dict[str, Any]:
    value = DIRECTION_SCREEN()
    value["provider_accounting"] = provider_accounting_screen()
    value["runner_sha256"] = runner_sha256()
    value["gemini_excluded"] = True
    value["all_checks_pass"] = value["all_checks_pass"] and value[
        "provider_accounting"
    ]["all_pass"]
    value["sha256"] = core.digest(
        {name: item for name, item in value.items() if name != "sha256"}
    )
    return value


def deterministic_manifest() -> dict[str, Any]:
    screen = deterministic_screen()
    protocol = protocol_manifest()
    plan = run_plan()
    value = {
        "schema": m.SCHEMA,
        "screen_sha256": screen["sha256"],
        "protocol_sha256": protocol["sha256"],
        "run_plan_sha256": plan["sha256"],
        "cohort_sha256": protocol["cohort_audit"]["corpus_sha256"],
        "candidate_sha256": m.v15.candidate_hashes(),
        "runner_sha256": runner_sha256(),
        "job_count_per_provider": m.MAXIMUM_CALLS,
        "providers": list(PROVIDERS),
        "all_checks_pass": screen["all_checks_pass"],
    }
    value["sha256"] = core.digest(value)
    return value


def validate_approval(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text())
    plan = run_plan()
    expected = {
        "run_id": RUN_ID,
        "protocol_sha256": plan["protocol_sha256"],
        "run_plan_sha256": plan["sha256"],
        "cohort_sha256": plan["cohort_sha256"],
        "candidate_sha256": plan["candidate_sha256"],
        "runner_sha256": runner_sha256(),
        "maximum_provider_cost_usd": {
            provider: float(PROVIDER_COST_LIMITS[provider]) for provider in PROVIDERS
        },
        "maximum_total_cost_usd": float(MAXIMUM_TOTAL_COST),
    }
    if any(value.get(name) != item for name, item in expected.items()):
        raise ValueError("Approval does not match the other-provider plan")
    if (
        value.get("status") != "approved"
        or not isinstance(value.get("operator_statement"), str)
        or not value["operator_statement"].strip()
    ):
        raise ValueError("The other-provider run needs explicit approval")
    return value


class ProviderHttpError(RuntimeError):
    """Retain safe provider HTTP error evidence."""


ORIGINAL_POST_JSON = transport.post_json


def safe_http_error(
    status_code: int, body: bytes, headers: dict[str, str]
) -> dict[str, Any]:
    provider_status = None
    provider_reason = None
    message = None
    try:
        parsed = json.loads(body)
        error = parsed.get("error", {}) if isinstance(parsed, dict) else {}
        if isinstance(error, dict):
            provider_status = error.get("status") or error.get("type")
            provider_reason = error.get("code")
            message = error.get("message")
            details = error.get("details", [])
            if not provider_reason and isinstance(details, list):
                provider_reason = next(
                    (
                        item.get("reason")
                        for item in details
                        if isinstance(item, dict)
                        and isinstance(item.get("reason"), str)
                    ),
                    None,
                )
    except (json.JSONDecodeError, UnicodeDecodeError):
        pass
    if isinstance(message, str):
        for secret in headers.values():
            if secret:
                message = message.replace(secret, "[REDACTED]")
        message = re.sub(r"(?:sk|AIza)[0-9A-Za-z_-]+", "[REDACTED]", message)
        message = message[:500]
    return {
        "http_status": status_code,
        "provider_status": provider_status,
        "provider_reason": provider_reason,
        "message": message,
        "body_bytes": len(body),
        "body_sha256": hashlib.sha256(body).hexdigest(),
    }


def post_json_with_error_evidence(
    url: str, headers: dict[str, str], payload: dict[str, Any]
) -> dict[str, Any]:
    try:
        return ORIGINAL_POST_JSON(url, headers, payload)
    except urllib.error.HTTPError as error:
        evidence = safe_http_error(error.code, error.read(65_536), headers)
        raise ProviderHttpError(core.canonical(evidence)) from error


def provider_direction(provider: dict[str, Any]) -> dict[str, Any]:
    diagnostics = []
    for family in m.DECISION_FAMILIES:
        cells = [
            cell
            for cell in provider["by_family_difficulty_arm"]
            if cell["family"] == family
        ]
        accuracies = [cell["global_component_accuracy"] for cell in cells]
        structural = [cell["structural_parse_rate_scored"] for cell in cells]
        diagnostics.append(
            {
                "family": family,
                "arm_accuracy": {
                    cell["arm"]: cell["global_component_accuracy"] for cell in cells
                },
                "median_arm_accuracy": round(median(accuracies), 6),
                "minimum_structural_rate": min(structural),
            }
        )
    if not provider["completion_pass"] or not provider["cell_coverage_pass"]:
        decision = "invalid"
    elif any(row["minimum_structural_rate"] < 0.90 for row in diagnostics):
        decision = "invalid"
    elif any(row["median_arm_accuracy"] > 0.95 for row in diagnostics):
        decision = "revise-harder"
    elif any(row["median_arm_accuracy"] < 0.60 for row in diagnostics):
        decision = "revise-easier"
    else:
        decision = "expand-confirmation"
    return {"decision": decision, "family_diagnostics": diagnostics}


def summarize_runs(runs: list[dict[str, Any]]) -> dict[str, Any]:
    value = m._v15_summarize_runs(runs)
    value["run_id"] = RUN_ID
    value["run_kind"] = RUN_KIND_SUMMARY
    value["protocol_sha256"] = protocol_manifest()["sha256"]
    value["run_plan_sha256"] = run_plan()["sha256"]
    value["provider_directions"] = {
        item["provider"]: provider_direction(item) for item in value["providers"]
    }
    value["gemini"] = "excluded"
    value["selection_authority"] = m.decision_rule()["selection_authority"]
    value["sha256"] = core.digest(
        {name: item for name, item in value.items() if name != "sha256"}
    )
    return value


def install_overrides() -> None:
    overrides = {
        "protocol_manifest": protocol_manifest,
        "run_plan": run_plan,
        "deterministic_screen": deterministic_screen,
        "deterministic_manifest": deterministic_manifest,
        "provider_accounting_screen": provider_accounting_screen,
        "validate_approval": validate_approval,
        "summarize_runs": summarize_runs,
    }
    for module in (m, m.v15, m.v14):
        for name, value in overrides.items():
            setattr(module, name, value)


install_overrides()


def run_provider(provider: str, env_file: Path, approval_file: Path) -> dict[str, Any]:
    original = transport.post_json
    transport.post_json = post_json_with_error_evidence
    try:
        return m.run_provider(provider, env_file, approval_file)
    finally:
        transport.post_json = original


def load_manifest(path: Path) -> dict[str, Any]:
    return m.v15.load_manifest(path)


def write_new(value: dict[str, Any], output: Path | None) -> None:
    text = json.dumps(value, indent=2, sort_keys=True) + "\n"
    if output is None:
        print(text, end="")
        return
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
        "--summarize", nargs=2, type=Path, metavar=("OPENAI", "HAIKU")
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
        if actual != json.loads(args.check.read_text()):
            raise SystemExit("Deterministic mismatch")
        print(json.dumps({"pass": True, **actual}, indent=2, sort_keys=True))
        return
    if args.print_plan:
        write_new(run_plan(), args.output)
        return
    if args.provider:
        write_new(run_provider(args.provider, args.env_file, args.approval_file), args.output)
        return
    if args.summarize:
        write_new(summarize_runs([load_manifest(path) for path in args.summarize]), args.output)
        return
    raise SystemExit("Select --self-test, --check, --print-plan, --provider, or --summarize")


if __name__ == "__main__":
    main()
