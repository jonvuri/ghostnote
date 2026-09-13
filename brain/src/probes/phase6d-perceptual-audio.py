#!/usr/bin/env python3
"""Evaluate perceptual audio providers on a blind controlled cohort."""

from __future__ import annotations

import argparse
import base64
import hashlib
import importlib.metadata
import json
import platform
import time
import urllib.error
import urllib.request
import wave
from pathlib import Path
from typing import Any

import numpy as np
from scipy.signal import butter, sosfilt


SAMPLE_RATE = 44_100
MODEL_SPECS = {
    "general": {
        "id": "laion/clap-htsat-unfused",
        "revision": "8fa0f1c6d0433df6e97c127f64b2a1d6c0dcda8a",
        "weight_sha256": "1cd3c601bc4afe0fa87be3de4c13dd2cfadd249fac1e29acf74a9b296c3219bb",
    },
    "music": {
        "id": "laion/larger_clap_music",
        "revision": "a0b4534a14f58e20944452dff00a22a06ce629d1",
        "weight_sha256": "5c289311f4a030d768af7ffbfdecd01b008aa64824211899a4e59f4f9d154fd1",
    },
}
CLASS_LABELS = [
    "digital silence",
    "a steady pitched tone",
    "short percussive bursts",
    "a repeating pulsing tone",
    "a short synthesizer melody",
]
REMOTE_MODELS = {
    "openai": "gpt-audio-1.5",
    "gemini": "gemini-3.8-flash",
}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def canonical_hash(value: Any) -> str:
    encoded = json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(encoded).hexdigest()


def write_pcm24(path: Path, audio: np.ndarray) -> None:
    """Write stable interleaved 24-bit PCM."""
    values = np.rint(np.clip(audio, -1.0, 1.0) * 8_388_607).astype(np.int32)
    unsigned = values.reshape(-1).astype(np.int64) & 0xFFFFFF
    packed = np.empty((unsigned.size, 3), dtype=np.uint8)
    packed[:, 0] = unsigned & 0xFF
    packed[:, 1] = (unsigned >> 8) & 0xFF
    packed[:, 2] = (unsigned >> 16) & 0xFF
    with wave.open(str(path), "wb") as target:
        target.setnchannels(audio.shape[1])
        target.setsampwidth(3)
        target.setframerate(SAMPLE_RATE)
        target.writeframes(packed.tobytes())


def read_pcm24(path: Path) -> tuple[np.ndarray, int]:
    with wave.open(str(path), "rb") as source:
        channels = source.getnchannels()
        rate = source.getframerate()
        width = source.getsampwidth()
        frames = source.getnframes()
        raw = source.readframes(frames)
    if width != 3:
        raise ValueError(f"expected 24-bit PCM, got {width * 8}-bit PCM")
    packed = np.frombuffer(raw, dtype=np.uint8).reshape(-1, 3).astype(np.int32)
    values = packed[:, 0] | (packed[:, 1] << 8) | (packed[:, 2] << 16)
    values = np.where(values & 0x800000, values - 0x1000000, values)
    return values.reshape(-1, channels).astype(np.float32) / 8_388_608, rate


def pulse(rate_hz: float) -> np.ndarray:
    t = np.arange(4 * SAMPLE_RATE, dtype=np.float64) / SAMPLE_RATE
    envelope = 0.45 * (1 + 0.8 * np.sin(2 * np.pi * rate_hz * t))
    mono = envelope * np.sin(2 * np.pi * 1_000 * t)
    return np.column_stack((mono, mono))


def bursts(count: int) -> np.ndarray:
    audio = np.zeros((2 * SAMPLE_RATE, 2), dtype=np.float64)
    starts = np.linspace(0.1, 1.8, count)
    t = np.arange(1_024, dtype=np.float64) / SAMPLE_RATE
    burst = 0.8 * np.sin(2 * np.pi * 2_000 * t) * np.hanning(t.size)
    for start in starts:
        sample = round(float(start) * SAMPLE_RATE)
        audio[sample:sample + burst.size, :] += burst[:, None]
    return audio


def tone(frequency_hz: float) -> np.ndarray:
    t = np.arange(2 * SAMPLE_RATE, dtype=np.float64) / SAMPLE_RATE
    mono = 0.4 * np.sin(2 * np.pi * frequency_hz * t)
    return np.column_stack((mono, mono))


def add_source(
    work_dir: Path, sources: dict[str, dict[str, Any]], role: str,
    audio: np.ndarray, facts: dict[str, Any],
) -> str:
    provisional = work_dir / f"source-{len(sources):02d}.wav"
    write_pcm24(provisional, audio)
    digest = sha256(provisional)
    alias = f"clip-{digest[:12]}"
    final = work_dir / f"{alias}.wav"
    provisional.rename(final)
    sources[alias] = {
        "path": str(final),
        "sha256": digest,
        "range": f"samples 0..{audio.shape[0] - 1}, each channel",
        "duration_s": audio.shape[0] / SAMPLE_RATE,
        "deterministic_facts": facts,
        "role": role,
    }
    return alias


def prepare(work_dir: Path, capture_path: Path) -> dict[str, Any]:
    work_dir.mkdir(parents=True, exist_ok=True)
    capture, rate = read_pcm24(capture_path)
    if rate != SAMPLE_RATE or capture.shape[1] != 2:
        raise ValueError("capture must be stereo 44.1 kHz PCM")

    sources: dict[str, dict[str, Any]] = {}
    silence = add_source(work_dir, sources, "silence", np.zeros((SAMPLE_RATE, 2)), {
        "peak_linear": 0.0,
    })
    tone_440 = add_source(work_dir, sources, "tone_440", tone(440), {
        "frequency_hz": 440.0, "result_kind": "known construction",
    })
    tone_880 = add_source(work_dir, sources, "tone_880", tone(880), {
        "frequency_hz": 880.0, "result_kind": "known construction",
    })
    bursts_3 = add_source(work_dir, sources, "bursts_3", bursts(3), {
        "onset_count": 3, "result_kind": "known construction",
    })
    bursts_6 = add_source(work_dir, sources, "bursts_6", bursts(6), {
        "onset_count": 6, "result_kind": "known construction",
    })
    pulse_2 = add_source(work_dir, sources, "pulse_2", pulse(2), {
        "modulation_hz": 2.0, "result_kind": "known construction",
    })
    pulse_8 = add_source(work_dir, sources, "pulse_8", pulse(8), {
        "modulation_hz": 8.0, "result_kind": "known construction",
    })

    capture_digest = sha256(capture_path)
    capture_alias = add_source(work_dir, sources, "bitwig_capture", capture, {
        "source": "Bitwig MasterRecorder",
        "source_sha256": capture_digest,
        "bounded_beats": 8,
    })
    mono_capture = np.mean(capture, axis=1)
    low = sosfilt(butter(8, 700, btype="lowpass", fs=SAMPLE_RATE, output="sos"), mono_capture)
    lowpass_alias = add_source(
        work_dir, sources, "bitwig_lowpass", np.column_stack((low, low)), {
            "source_sha256": capture_digest, "lowpass_hz": 700,
            "result_kind": "declared transform",
        },
    )

    stereo_t = np.arange(2 * SAMPLE_RATE, dtype=np.float64) / SAMPLE_RATE
    stereo_mono = 0.4 * np.sin(2 * np.pi * 330 * stereo_t)
    correlated = add_source(
        work_dir, sources, "stereo_correlated", np.column_stack((stereo_mono, stereo_mono)),
        {"zero_lag_correlation": 1.0, "result_kind": "known construction"},
    )
    inverted = add_source(
        work_dir, sources, "stereo_inverted", np.column_stack((stereo_mono, -stereo_mono)),
        {"zero_lag_correlation": -1.0, "result_kind": "known construction"},
    )

    classifications = [
        {"id": "class-1", "clip": silence, "expected": "digital silence"},
        {"id": "class-2", "clip": tone_440, "expected": "a steady pitched tone"},
        {"id": "class-3", "clip": bursts_3, "expected": "short percussive bursts"},
        {"id": "class-4", "clip": pulse_2, "expected": "a repeating pulsing tone"},
        {"id": "class-5", "clip": capture_alias, "expected": "a short synthesizer melody"},
    ]
    directions = [
        {"id": "direction-1", "clips": [tone_440, tone_880],
         "prompt": "a high-pitched steady tone", "expected": tone_880, "property": "higher pitch"},
        {"id": "direction-2", "clips": [bursts_6, bursts_3],
         "prompt": "frequent short percussive attacks", "expected": bursts_6,
         "property": "more frequent attacks"},
        {"id": "direction-3", "clips": [pulse_2, pulse_8],
         "prompt": "a rapidly pulsing tone", "expected": pulse_8, "property": "faster pulse"},
        {"id": "direction-4", "clips": [capture_alias, lowpass_alias],
         "prompt": "a bright synthesizer timbre", "expected": capture_alias,
         "property": "brighter timbre"},
        {"id": "direction-5", "clips": [correlated, inverted],
         "prompt": "a wide stereo sound", "expected": "unknown",
         "property": "wider stereo image", "provider_refusals": {
             "clap": "CLAP input is mono.",
             "gemini": "Gemini combines audio channels to mono.",
             "openai": "The OpenAI endpoint does not document channel preservation.",
         }},
    ]
    manifest = {
        "schema": 1,
        "source_format": "stereo signed 24-bit little-endian PCM WAV at 44100 Hz",
        "capture": {"path": str(capture_path.resolve()), "sha256": capture_digest},
        "blind_rule": "Provider input uses only content-derived clip aliases. Roles stay outside prompts.",
        "classification_prompt": CLASS_LABELS,
        "classifications": classifications,
        "directions": directions,
        "sources": sources,
    }
    manifest["manifest_sha256"] = canonical_hash(manifest)
    (work_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    return manifest


def load_audio(source: dict[str, Any], librosa: Any) -> np.ndarray:
    path = Path(source["path"])
    audio, _ = librosa.load(path, sr=48_000, mono=True)
    return audio


def validate_sources(manifest: dict[str, Any]) -> None:
    for alias, source in manifest["sources"].items():
        path = Path(source["path"])
        if not path.is_file():
            raise ValueError(f"source missing: {alias}")
        if sha256(path) != source["sha256"]:
            raise ValueError(f"source changed: {alias}")
        with wave.open(str(path), "rb") as audio_file:
            actual = (
                audio_file.getnchannels(), audio_file.getsampwidth(),
                audio_file.getframerate(), audio_file.getnframes(),
            )
        expected_frames = int(round(source["duration_s"] * SAMPLE_RATE))
        if actual != (2, 3, SAMPLE_RATE, expected_frames):
            raise ValueError(f"unsupported source format: {alias}: {actual}")


def clap_run(work_dir: Path, repeats: int, model_key: str) -> dict[str, Any]:
    manifest = json.loads((work_dir / "manifest.json").read_text(encoding="utf-8"))
    validate_sources(manifest)
    model_spec = MODEL_SPECS[model_key]

    cold_started = time.perf_counter()
    import librosa
    import psutil
    import torch
    from transformers import ClapModel, ClapProcessor

    process = psutil.Process()
    loader_options = {
        "revision": model_spec["revision"],
        "local_files_only": True,
    }
    processor = ClapProcessor.from_pretrained(model_spec["id"], **loader_options)
    model = ClapModel.from_pretrained(
        model_spec["id"], use_safetensors=False, **loader_options,
    )
    model.eval()
    startup_ms = (time.perf_counter() - cold_started) * 1_000
    role_by_alias = {alias: row["role"] for alias, row in manifest["sources"].items()}
    aliases = sorted(manifest["sources"])
    audio = {alias: load_audio(manifest["sources"][alias], librosa) for alias in aliases}

    runs = []
    for repeat in range(repeats):
        run_started = time.perf_counter()
        choices = []
        for task in manifest["classifications"]:
            inputs = processor(
                text=CLASS_LABELS, audio=[audio[task["clip"]]], sampling_rate=48_000,
                return_tensors="pt", padding=True,
            )
            with torch.inference_mode():
                scores = model(**inputs).logits_per_audio[0].detach().cpu().tolist()
            selected = CLASS_LABELS[int(np.argmax(scores))]
            choices.append({
                "task": task["id"], "clip": task["clip"], "selected": selected,
                "expected": task["expected"], "correct": selected == task["expected"],
                "scores": dict(zip(CLASS_LABELS, scores, strict=True)),
            })

        directions = []
        for task in manifest["directions"]:
            refusal = task.get("provider_refusals", {}).get("clap")
            if refusal:
                directions.append({
                    "task": task["id"], "clips": task["clips"], "selected": "unknown",
                    "expected": "unknown", "correct": True,
                    "reason": refusal,
                })
                continue
            clips = task["clips"]
            inputs = processor(
                text=[task["prompt"]], audio=[audio[alias] for alias in clips],
                sampling_rate=48_000, return_tensors="pt", padding=True,
            )
            with torch.inference_mode():
                scores = model(**inputs).logits_per_audio[:, 0].detach().cpu().tolist()
            selected = clips[int(np.argmax(scores))]
            directions.append({
                "task": task["id"], "clips": clips, "selected": selected,
                "expected": task["expected"], "correct": selected == task["expected"],
                "prompt": task["prompt"], "scores": dict(zip(clips, scores, strict=True)),
            })
        decision = {
            "classifications": [{k: v for k, v in row.items() if k != "scores"} for row in choices],
            "directions": [{k: v for k, v in row.items() if k != "scores"} for row in directions],
        }
        scored_result = {"classifications": choices, "directions": directions}
        runs.append({
            "repeat": repeat + 1,
            "latency_ms": (time.perf_counter() - run_started) * 1_000,
            "resident_bytes": process.memory_info().rss,
            "decision_sha256": canonical_hash(decision),
            "score_sha256": canonical_hash(scored_result),
            "classifications": choices,
            "directions": directions,
        })

    decision_hashes = [run["decision_sha256"] for run in runs]
    score_hashes = [run["score_sha256"] for run in runs]
    result = {
        "schema": 1,
        "provider": "local Transformers CLAP",
        "model": model_spec["id"],
        "model_revision": model_spec["revision"],
        "weight_sha256": model_spec["weight_sha256"],
        "versions": {
            "python": platform.python_version(), "torch": torch.__version__,
            "transformers": importlib.metadata.version("transformers"),
            "librosa": librosa.__version__,
        },
        "platform": f"{platform.system()} {platform.release()} {platform.machine()}",
        "privacy": "All inference is local after checkpoint download.",
        "cost_usd": 0,
        "input_preprocessing": "librosa mono resample to 48000 Hz; CLAP processor defaults",
        "manifest_sha256": manifest["manifest_sha256"],
        "startup_ms": startup_ms,
        "agreement": {
            "repeats": repeats,
            "identical_decisions": len(set(decision_hashes)) == 1,
            "decision_sha256": decision_hashes[0] if len(set(decision_hashes)) == 1 else None,
            "identical_scores": len(set(score_hashes)) == 1,
            "score_sha256": score_hashes[0] if len(set(score_hashes)) == 1 else None,
        },
        "accuracy": {
            "classification": sum(row["correct"] for row in runs[0]["classifications"]),
            "classification_total": len(runs[0]["classifications"]),
            "direction": sum(
                row["correct"] for row in runs[0]["directions"] if "reason" not in row
            ),
            "direction_total": sum("reason" not in row for row in runs[0]["directions"]),
            "correct_capability_refusals": sum(
                row["correct"] for row in runs[0]["directions"] if "reason" in row
            ),
        },
        "runs": runs,
        "role_map_for_evaluation_only": role_by_alias,
    }
    result["result_sha256"] = canonical_hash(result)
    return result


def load_env(path: Path) -> dict[str, str]:
    """Load simple name-value pairs without shell evaluation."""
    values: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.removeprefix("export ").split("=", 1)
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "'\"":
            value = value[1:-1]
        values[name.strip()] = value
    return values


def post_json(url: str, headers: dict[str, str], payload: dict[str, Any]) -> dict[str, Any]:
    request = urllib.request.Request(
        url,
        data=json.dumps(payload, separators=(",", ":")).encode(),
        headers={"Content-Type": "application/json", **headers},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"provider HTTP {error.code}: {detail[:1_000]}") from error


def parse_model_json(text: str) -> dict[str, Any]:
    stripped = text.strip()
    if stripped.startswith("```"):
        lines = stripped.splitlines()
        stripped = "\n".join(lines[1:-1]).strip()
        if stripped.startswith("json"):
            stripped = stripped[4:].lstrip()
    try:
        value = json.loads(stripped)
    except json.JSONDecodeError:
        start = stripped.find("{")
        end = stripped.rfind("}")
        if start < 0 or end <= start:
            raise ValueError("provider response did not contain a JSON object")
        value = json.loads(stripped[start:end + 1])
    if not isinstance(value, dict):
        raise ValueError("provider response was not a JSON object")
    return value


def wav_part(path: Path, label: str, provider: str) -> list[dict[str, Any]]:
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    if provider == "openai":
        return [
            {"type": "text", "text": f"Audio {label}."},
            {"type": "input_audio", "input_audio": {"data": encoded, "format": "wav"}},
        ]
    return [
        {"text": f"Audio {label}."},
        {"inline_data": {"mime_type": "audio/wav", "data": encoded}},
    ]


def provider_call(
    provider: str, api_key: str, prompt: str,
    audio: list[tuple[str, Path]], choice_values: list[str],
) -> tuple[dict[str, Any], dict[str, Any]]:
    if provider == "openai":
        content: list[dict[str, Any]] = [{"type": "text", "text": prompt}]
        for label, path in audio:
            content.extend(wav_part(path, label, provider))
        payload = {
            "model": REMOTE_MODELS[provider],
            "messages": [{"role": "user", "content": content}],
            "temperature": 0,
            "max_completion_tokens": 300,
        }
        raw = post_json(
            "https://api.openai.com/v1/chat/completions",
            {"Authorization": f"Bearer {api_key}"}, payload,
        )
        parsed = parse_model_json(raw["choices"][0]["message"]["content"])
    else:
        parts: list[dict[str, Any]] = [{"text": prompt}]
        for label, path in audio:
            parts.extend(wav_part(path, label, provider))
        payload = {
            "contents": [{"role": "user", "parts": parts}],
            "generationConfig": {
                "temperature": 0,
                "responseMimeType": "application/json",
                "responseSchema": {
                    "type": "object",
                    "properties": {
                        "choice": {"type": "string", "enum": choice_values},
                        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                        "reason": {"type": "string"},
                    },
                    "required": ["choice", "confidence", "reason"],
                },
            },
        }
        raw = post_json(
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"{REMOTE_MODELS[provider]}:generateContent",
            {"x-goog-api-key": api_key}, payload,
        )
        text = raw["candidates"][0]["content"]["parts"][0]["text"]
        parsed = parse_model_json(text)
    if parsed.get("choice") not in choice_values:
        raise ValueError(f"provider returned an invalid choice: {parsed.get('choice')!r}")
    return parsed, raw


def classification_prompt(alias: str) -> str:
    labels = json.dumps([*CLASS_LABELS, "unknown"])
    return (
        f"You receive one audio clip named {alias}. The name is a blind content hash. "
        f"Choose exactly one label from {labels}. Choose unknown when the audio is "
        "insufficient. Return only JSON with choice, confidence from 0 to 1, and a "
        "brief reason. Do not infer from the file name."
    )


def direction_prompt(task: dict[str, Any]) -> str:
    first, second = task["clips"]
    return (
        f"You receive A={first} and B={second}. Which clip best matches "
        f"'{task['prompt']}'? Choose A, B, same, or unknown. Return only JSON with "
        "choice, confidence from 0 to 1, and a brief reason. Do not infer from the "
        "file names."
    )


def estimated_cost(provider: str, raw_responses: list[dict[str, Any]]) -> dict[str, Any]:
    if provider == "openai":
        prompt = completion = input_audio = output_audio = 0
        for raw in raw_responses:
            usage = raw.get("usage", {})
            prompt += usage.get("prompt_tokens", 0)
            completion += usage.get("completion_tokens", 0)
            input_audio += usage.get("prompt_tokens_details", {}).get("audio_tokens", 0)
            output_audio += usage.get("completion_tokens_details", {}).get("audio_tokens", 0)
        input_text = prompt - input_audio
        output_text = completion - output_audio
        cost = (
            input_text * 2.50 + input_audio * 32.00
            + output_text * 10.00 + output_audio * 64.00
        ) / 1_000_000
        return {
            "usd": cost, "input_text_tokens": input_text,
            "input_audio_tokens": input_audio, "output_text_tokens": output_text,
            "output_audio_tokens": output_audio,
        }
    prompt = output = 0
    for raw in raw_responses:
        usage = raw.get("usageMetadata", {})
        input_tokens = usage.get("promptTokenCount", 0)
        prompt += input_tokens
        output += max(0, usage.get("totalTokenCount", 0) - input_tokens)
    return {
        "usd": (prompt * 0.75 + output * 3.75) / 1_000_000,
        "input_tokens": prompt, "output_and_thinking_tokens": output,
    }


def remote_run(
    work_dir: Path, repeats: int, provider: str, env_file: Path,
) -> dict[str, Any]:
    manifest = json.loads((work_dir / "manifest.json").read_text(encoding="utf-8"))
    validate_sources(manifest)
    environment = load_env(env_file)
    key_name = "OPENAI_API_KEY" if provider == "openai" else "GEMINI_API_KEY"
    if not environment.get(key_name):
        raise ValueError(f"{key_name} is missing")
    sources = manifest["sources"]
    raw_responses: list[dict[str, Any]] = []
    runs = []
    for repeat in range(repeats):
        choices = []
        for task in manifest["classifications"]:
            alias = task["clip"]
            prompt = classification_prompt(alias)
            started = time.perf_counter()
            parsed, raw = provider_call(
                provider, environment[key_name], prompt,
                [(alias, Path(sources[alias]["path"]))], [*CLASS_LABELS, "unknown"],
            )
            raw_responses.append(raw)
            selected = parsed["choice"]
            choices.append({
                "task": task["id"], "clip": alias, "prompt": prompt,
                "input_sha256": sources[alias]["sha256"],
                "input_range": sources[alias]["range"], "selected": selected,
                "expected": task["expected"], "correct": selected == task["expected"],
                "confidence": parsed.get("confidence"), "reason": parsed.get("reason"),
                "latency_ms": (time.perf_counter() - started) * 1_000,
                "request_id": raw.get("id"),
                "returned_model": raw.get("model") or raw.get("modelVersion"),
                "usage": raw.get("usage") or raw.get("usageMetadata"),
                "raw_response": raw,
            })
        directions = []
        for task in manifest["directions"]:
            refusal = task.get("provider_refusals", {}).get(provider)
            if refusal:
                directions.append({
                    "task": task["id"], "clips": task["clips"], "selected": "unknown",
                    "expected": "unknown", "correct": True, "reason": refusal,
                    "result_kind": "adapter capability refusal",
                })
                continue
            first, second = task["clips"]
            prompt = direction_prompt(task)
            started = time.perf_counter()
            parsed, raw = provider_call(
                provider, environment[key_name], prompt,
                [("A", Path(sources[first]["path"])), ("B", Path(sources[second]["path"]))],
                ["A", "B", "same", "unknown"],
            )
            raw_responses.append(raw)
            selected = {"A": first, "B": second}.get(parsed["choice"], parsed["choice"])
            directions.append({
                "task": task["id"], "clips": task["clips"], "prompt": prompt,
                "inputs": [
                    {"alias": alias, "sha256": sources[alias]["sha256"],
                     "range": sources[alias]["range"]} for alias in task["clips"]
                ],
                "selected": selected, "raw_choice": parsed["choice"],
                "expected": task["expected"], "correct": selected == task["expected"],
                "confidence": parsed.get("confidence"), "reason": parsed.get("reason"),
                "latency_ms": (time.perf_counter() - started) * 1_000,
                "request_id": raw.get("id"),
                "returned_model": raw.get("model") or raw.get("modelVersion"),
                "usage": raw.get("usage") or raw.get("usageMetadata"),
                "raw_response": raw,
            })
        decision = {
            "classifications": [row["selected"] for row in choices],
            "directions": [row["selected"] for row in directions],
        }
        runs.append({
            "repeat": repeat + 1, "decision_sha256": canonical_hash(decision),
            "classifications": choices, "directions": directions,
        })
    decision_hashes = [run["decision_sha256"] for run in runs]
    returned_models = sorted({
        row["returned_model"] for run in runs
        for group in ("classifications", "directions") for row in run[group]
        if row.get("returned_model")
    })
    result = {
        "schema": 1, "provider": provider, "model": REMOTE_MODELS[provider],
        "returned_models": returned_models,
        "platform": f"{platform.system()} {platform.release()} {platform.machine()}",
        "privacy": (
            "Remote OpenAI API request; no Files API upload."
            if provider == "openai"
            else "Remote Gemini API request; billing plan is not exposed; no Files API upload."
        ),
        "manifest_sha256": manifest["manifest_sha256"],
        "agreement": {
            "repeats": repeats, "identical_decisions": len(set(decision_hashes)) == 1,
            "decision_sha256": decision_hashes[0] if len(set(decision_hashes)) == 1 else None,
            "decision_hashes": decision_hashes,
        },
        "accuracy": {
            "classification_by_repeat": [
                sum(row["correct"] for row in run["classifications"]) for run in runs
            ],
            "classification_total": len(manifest["classifications"]),
            "direction_by_repeat": [
                sum(row["correct"] for row in run["directions"] if "result_kind" not in row)
                for run in runs
            ],
            "direction_total": sum(
                not task.get("provider_refusals", {}).get(provider)
                for task in manifest["directions"]
            ),
            "correct_capability_refusals": sum(
                row["correct"] for row in runs[0]["directions"] if "result_kind" in row
            ),
        },
        "estimated_cost": estimated_cost(provider, raw_responses),
        "runs": runs,
    }
    result["result_sha256"] = canonical_hash(result)
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--work-dir", required=True, type=Path)
    parser.add_argument("--capture", type=Path)
    parser.add_argument("--prepare", action="store_true")
    parser.add_argument("--provider", choices=["clap", *sorted(REMOTE_MODELS)])
    parser.add_argument("--model", choices=sorted(MODEL_SPECS), default="general")
    parser.add_argument("--env-file", type=Path, default=Path(".env"))
    parser.add_argument("--repeats", type=int, default=3)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if args.prepare:
        if args.capture is None:
            parser.error("--prepare needs --capture")
        result = prepare(args.work_dir, args.capture)
    elif args.provider == "clap":
        result = clap_run(args.work_dir, args.repeats, args.model)
    elif args.provider in REMOTE_MODELS:
        result = remote_run(args.work_dir, args.repeats, args.provider, args.env_file)
    else:
        parser.error("select --prepare or --provider")
    rendered = json.dumps(result, indent=2, sort_keys=True) + "\n"
    if args.output:
        args.output.write_text(rendered, encoding="utf-8")
    else:
        print(rendered, end="")


if __name__ == "__main__":
    main()
