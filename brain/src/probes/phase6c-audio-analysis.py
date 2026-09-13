#!/usr/bin/env python3
"""Measure deterministic audio-analysis providers on a controlled cohort."""

from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import math
import re
import resource
import subprocess
import time
import wave
from pathlib import Path
from typing import Any, Callable

import numpy as np


SAMPLE_RATE = 44_100
FFMPEG = Path("/opt/homebrew/bin/ffmpeg")
FFPROBE = Path("/opt/homebrew/bin/ffprobe")


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_pcm24(path: Path, audio: np.ndarray) -> None:
    """Write stable interleaved 24-bit PCM without a codec dependency."""
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


def read_pcm(path: Path) -> tuple[np.ndarray, int]:
    with wave.open(str(path), "rb") as source:
        channels = source.getnchannels()
        sample_rate = source.getframerate()
        width = source.getsampwidth()
        frames = source.getnframes()
        raw = source.readframes(frames)
    if width != 3:
        raise ValueError(f"expected 24-bit PCM, got {width * 8}-bit PCM")
    packed = np.frombuffer(raw, dtype=np.uint8).reshape(-1, 3).astype(np.int32)
    values = packed[:, 0] | (packed[:, 1] << 8) | (packed[:, 2] << 16)
    values = np.where(values & 0x800000, values - 0x1000000, values)
    return values.reshape(-1, channels).astype(np.float64) / 8_388_608, sample_rate


def generate(work_dir: Path, capture: Path) -> dict[str, Any]:
    work_dir.mkdir(parents=True, exist_ok=True)
    t1 = np.arange(SAMPLE_RATE, dtype=np.float64) / SAMPLE_RATE
    t2 = np.arange(2 * SAMPLE_RATE, dtype=np.float64) / SAMPLE_RATE
    t4 = np.arange(4 * SAMPLE_RATE, dtype=np.float64) / SAMPLE_RATE

    silence = np.zeros((SAMPLE_RATE, 2), dtype=np.float64)
    tones = np.column_stack((
        0.5 * np.sin(2 * np.pi * 440 * t2),
        0.25 * np.sin(2 * np.pi * 880 * t2),
    ))
    transients = np.zeros((SAMPLE_RATE, 2), dtype=np.float64)
    transient_samples = [4_410, 17_640, 39_690]
    burst_t = np.arange(512, dtype=np.float64) / SAMPLE_RATE
    burst = 0.8 * np.sin(2 * np.pi * 2_000 * burst_t) * np.hanning(512)
    for sample in transient_samples:
        transients[sample:sample + 512, :] += burst[:, None]
    stereo_inverted = np.column_stack((
        0.4 * np.sin(2 * np.pi * 330 * t2),
        -0.4 * np.sin(2 * np.pi * 330 * t2),
    ))
    envelope = 0.45 * (1 + 0.8 * np.sin(2 * np.pi * 5 * t4))
    modulation = np.column_stack((
        envelope * np.sin(2 * np.pi * 1_000 * t4),
        envelope * np.sin(2 * np.pi * 1_000 * t4),
    ))

    definitions = {
        "silence": (silence, {"duration_s": 1.0, "peak_linear": 0.0}),
        "tones": (tones, {
            "duration_s": 2.0, "left_pitch_hz": 440.0, "right_pitch_hz": 880.0,
            "left_peak_linear": 0.5, "right_peak_linear": 0.25,
        }),
        "transients": (transients, {
            "duration_s": 1.0,
            "onset_s": [sample / SAMPLE_RATE for sample in transient_samples],
        }),
        "stereo_inverted": (stereo_inverted, {
            "duration_s": 2.0, "zero_lag_correlation": -1.0,
        }),
        "modulation": (modulation, {
            "duration_s": 4.0, "carrier_hz": 1_000.0, "modulation_hz": 5.0,
        }),
    }
    sources: list[dict[str, Any]] = []
    for name, (audio, known) in definitions.items():
        path = work_dir / f"{name}.wav"
        write_pcm24(path, audio)
        sources.append({
            "name": name,
            "path": str(path),
            "sha256": sha256(path),
            "known": known,
        })
    sources.append({
        "name": "bitwig_capture",
        "path": str(capture.resolve()),
        "sha256": sha256(capture),
        "known": {"source": "Bitwig MasterRecorder", "bounded_beats": 8},
    })
    manifest = {
        "schema": 1,
        "sample_rate_hz": SAMPLE_RATE,
        "encoding": "stereo signed 24-bit little-endian PCM WAV",
        "tolerances": {
            "sample_peak_linear": 2 / 8_388_608,
            "signal_aggregate_linear": 0.0000005,
            "spectral_rolloff_hz": 2 * SAMPLE_RATE / 8192,
            "pitch_cents": 5.1,
            "onset_s": 0.025,
            "stereo_correlation": 0.000001,
            "modulation_hz": 0.25,
        },
        "sources": sources,
    }
    (work_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    return manifest


def typed(value: Any, unit: str, kind: str, coverage: str) -> dict[str, Any]:
    return {"value": value, "unit": unit, "kind": kind, "coverage": coverage}


def base_facts(audio: np.ndarray, sample_rate: int) -> dict[str, Any]:
    samples = audio.shape[0]
    coverage = f"samples 0..{samples - 1}, each channel"
    return {
        "sample_rate": typed(sample_rate, "Hz", "exact", "stream"),
        "channels": typed(audio.shape[1], "count", "exact", "stream"),
        "sample_count": typed(samples, "samples_per_channel", "exact", "stream"),
        "duration": typed(samples / sample_rate, "s", "exact", "stream"),
        "peak": typed(np.max(np.abs(audio), axis=0).tolist(), "linear_full_scale", "exact", coverage),
        "rms": typed(np.sqrt(np.mean(audio * audio, axis=0)).tolist(), "linear_full_scale", "exact", coverage),
        "dc": typed(np.mean(audio, axis=0).tolist(), "linear_full_scale", "exact", coverage),
    }


def dominant_frequency(signal: np.ndarray, sample_rate: int) -> float:
    centered = signal - np.mean(signal)
    spectrum = np.abs(np.fft.rfft(centered * np.hanning(centered.size)))
    return float(np.argmax(spectrum[1:]) + 1) * sample_rate / centered.size


def modulation_frequency(signal: np.ndarray, sample_rate: int) -> float:
    hop = 441
    usable = signal[: signal.size - signal.size % hop]
    envelope = np.sqrt(np.mean(usable.reshape(-1, hop) ** 2, axis=1))
    envelope -= np.mean(envelope)
    spectrum = np.abs(np.fft.rfft(envelope * np.hanning(envelope.size)))
    return float(np.argmax(spectrum[1:]) + 1) * (sample_rate / hop) / envelope.size


def reference_source(source: dict[str, Any]) -> dict[str, Any]:
    path = Path(source["path"])
    audio, sample_rate = read_pcm(path)
    facts = base_facts(audio, sample_rate)
    name = source["name"]
    if name in {"tones", "modulation"}:
        facts["dominant_frequency"] = typed(
            [dominant_frequency(audio[:, channel], sample_rate) for channel in range(audio.shape[1])],
            "Hz", "estimate", "complete channel",
        )
    if name == "transients":
        active = np.max(np.abs(audio), axis=1) > 0.001
        candidates = np.flatnonzero(active & ~np.r_[False, active[:-1]])
        starts = np.asarray([
            sample for index, sample in enumerate(candidates)
            if index == 0 or sample - candidates[index - 1] >= int(0.05 * sample_rate)
        ])
        facts["onsets"] = typed((starts / sample_rate).tolist(), "s", "estimate", "complete mix")
    if name == "stereo_inverted":
        correlation = float(np.corrcoef(audio[:, 0], audio[:, 1])[0, 1])
        facts["stereo_correlation"] = typed(correlation, "coefficient", "estimate", "complete stream")
    if name == "modulation":
        facts["modulation_frequency"] = typed(
            modulation_frequency(np.mean(audio, axis=1), sample_rate),
            "Hz", "estimate", "20 ms RMS envelope, complete mix",
        )
    return {"name": name, "sha256": sha256(path), "facts": facts}


def librosa_source(source: dict[str, Any], librosa: Any) -> dict[str, Any]:
    path = Path(source["path"])
    loaded, sample_rate = librosa.load(path, sr=None, mono=False)
    audio = np.atleast_2d(loaded).T.astype(np.float64)
    facts = base_facts(audio, sample_rate)
    name = source["name"]
    if name in {"silence", "tones", "modulation"}:
        pitches = []
        voiced_fractions = []
        for channel in range(audio.shape[1]):
            values, voiced, _probability = librosa.pyin(
                audio[:, channel], fmin=50, fmax=2_000, sr=sample_rate,
                frame_length=4096, hop_length=512,
            )
            selected = values[voiced]
            pitches.append(float(np.median(selected)) if selected.size else None)
            voiced_fractions.append(float(np.mean(voiced)))
        facts["pitch"] = typed(
            pitches, "Hz_or_null", "estimate",
            "voiced 4096-sample frames, 512-sample hop, 0.1-semitone resolution"
        )
        facts["voiced_fraction"] = typed(
            voiced_fractions, "ratio", "estimate", "4096-sample frames, 512-sample hop"
        )
    if name == "transients":
        onsets = librosa.onset.onset_detect(
            y=np.mean(audio, axis=1), sr=sample_rate, hop_length=256,
            units="time", backtrack=False,
        )
        facts["onsets"] = typed(onsets.tolist(), "s", "estimate", "complete mix, 256-sample hop")
    if name == "stereo_inverted":
        facts["stereo_correlation"] = typed(
            float(np.corrcoef(audio[:, 0], audio[:, 1])[0, 1]),
            "coefficient", "estimate", "complete stream",
        )
    if name == "modulation":
        rms = librosa.feature.rms(
            y=np.mean(audio, axis=1), frame_length=882, hop_length=441, center=False
        )[0]
        facts["modulation_frequency"] = typed(
            dominant_frequency(rms, sample_rate / 441),
            "Hz", "estimate", "20 ms RMS envelope, 10 ms hop",
        )
    return {"name": name, "sha256": sha256(path), "facts": facts}


def essentia_source(source: dict[str, Any], es: Any) -> dict[str, Any]:
    path = Path(source["path"])
    stereo, sample_rate, channels, _md5, _bit_rate, _codec = es.AudioLoader(
        filename=str(path), computeMD5=True
    )()
    audio = np.asarray(stereo, dtype=np.float64)
    if audio.ndim == 1:
        audio = audio[:, None]
    facts = base_facts(audio, int(sample_rate))
    name = source["name"]
    if name in {"tones", "modulation"}:
        pitches = []
        for channel in range(audio.shape[1]):
            values = []
            window = es.Windowing(type="hann", size=4096)
            spectrum = es.Spectrum(size=4096)
            pitch = es.PitchYinFFT(frameSize=4096, sampleRate=sample_rate,
                                   minFrequency=50, maxFrequency=2_000)
            mono_channel = audio[:, channel].astype(np.float32)
            for frame in es.FrameGenerator(mono_channel, frameSize=4096, hopSize=512):
                value, confidence = pitch(spectrum(window(frame)))
                if confidence >= 0.5:
                    values.append(value)
            pitches.append(float(np.median(values)))
        facts["pitch"] = typed(pitches, "Hz", "estimate", "4096-sample frames, 512-sample hop")
    if name == "transients":
        onsets, _rate = es.OnsetRate()(np.mean(audio, axis=1).astype(np.float32))
        facts["onsets"] = typed(list(map(float, onsets)), "s", "estimate", "complete mix")
    if name == "stereo_inverted":
        cross = es.CrossCorrelation(minLag=0, maxLag=0)(
            audio[:, 0].astype(np.float32), audio[:, 1].astype(np.float32)
        )[0]
        scale = math.sqrt(float(np.sum(audio[:, 0] ** 2) * np.sum(audio[:, 1] ** 2)))
        facts["stereo_correlation"] = typed(
            float(cross / scale), "coefficient", "estimate", "complete stream, zero lag"
        )
    if name == "modulation":
        envelope = es.Envelope(
            sampleRate=sample_rate, attackTime=5, releaseTime=5
        )(np.mean(audio, axis=1).astype(np.float32))
        facts["modulation_frequency"] = typed(
            modulation_frequency(np.asarray(envelope), int(sample_rate)),
            "Hz", "estimate", "5 ms attack/release envelope, complete mix",
        )
    return {"name": name, "sha256": sha256(path), "facts": facts}


def ffmpeg_metadata(path: Path, filter_graph: str) -> list[dict[str, str]]:
    run = subprocess.run([
        str(FFMPEG), "-hide_banner", "-nostats", "-loglevel", "error", "-i", str(path),
        "-af", f"{filter_graph},ametadata=print:file=-", "-f", "null", "-",
    ], check=True, text=True, capture_output=True)
    frames: list[dict[str, str]] = []
    current: dict[str, str] = {}
    for line in run.stdout.splitlines():
        if line.startswith("frame:"):
            if current:
                frames.append(current)
            current = {}
        elif line.startswith("lavfi.") and "=" in line:
            key, value = line.split("=", 1)
            current[key] = value
    if current:
        frames.append(current)
    return frames


def ffmpeg_source(source: dict[str, Any], work_dir: Path) -> dict[str, Any]:
    path = Path(source["path"])
    probe = json.loads(subprocess.run([
        str(FFPROBE), "-v", "error", "-select_streams", "a:0",
        "-show_entries", "stream=codec_name,channels,sample_rate,duration_ts,time_base",
        "-of", "json", str(path),
    ], check=True, text=True, capture_output=True).stdout)["streams"][0]
    frames = ffmpeg_metadata(
        path,
        "astats=metadata=1:reset=0:measure_perchannel=DC_offset+Peak_level+RMS_level:measure_overall=none",
    )
    final = frames[-1]
    channels = int(probe["channels"])
    def values(key: str) -> list[float]:
        return [float(final[f"lavfi.astats.{channel}.{key}"]) for channel in range(1, channels + 1)]
    sample_rate = int(probe["sample_rate"])
    sample_count = int(probe["duration_ts"])
    coverage = f"samples 0..{sample_count - 1}, each channel"
    facts = {
        "sample_rate": typed(sample_rate, "Hz", "exact", "stream"),
        "channels": typed(channels, "count", "exact", "stream"),
        "sample_count": typed(sample_count, "samples_per_channel", "exact", "stream"),
        "duration": typed(sample_count / sample_rate, "s", "exact", "stream"),
        "peak": typed([10 ** (value / 20) for value in values("Peak_level")],
                      "linear_full_scale", "exact", coverage),
        "rms": typed([10 ** (value / 20) for value in values("RMS_level")],
                     "linear_full_scale", "exact", coverage),
        "dc": typed(values("DC_offset"), "linear_full_scale", "exact", coverage),
    }
    name = source["name"]
    if name in {"tones", "modulation"}:
        spectral = ffmpeg_metadata(
            path,
            "aspectralstats=win_size=8192:win_func=hann:overlap=0:measure=centroid+rolloff",
        )
        complete = spectral[:-1] if len(spectral) > 1 else spectral
        rolloff = []
        for channel in range(1, channels + 1):
            rolloff.append(float(np.median([
                float(frame[f"lavfi.aspectralstats.{channel}.rolloff"]) for frame in complete
            ])))
        facts["spectral_rolloff"] = typed(
            rolloff, "Hz", "estimate", "8192-sample Hann frames, no overlap, complete frames"
        )
    if name == "silence":
        run = subprocess.run([
            str(FFMPEG), "-hide_banner", "-nostats", "-i", str(path),
            "-af", "silencedetect=noise=-90dB:duration=0.05", "-f", "null", "-",
        ], text=True, capture_output=True)
        if run.returncode != 0:
            raise RuntimeError(run.stderr)
        starts = [float(value) for value in re.findall(r"silence_start: ([0-9.]+)", run.stderr)]
        ends = [float(value) for value in re.findall(r"silence_end: ([0-9.]+)", run.stderr)]
        facts["silence_intervals"] = typed(
            list(zip(starts, ends)), "s", "thresholded", "-90 dBFS, minimum 0.05 s, complete mix"
        )
    if name == "stereo_inverted":
        phase = ffmpeg_metadata(path, "aphasemeter=video=0")
        facts["stereo_correlation"] = typed(
            float(np.median([float(frame["lavfi.aphasemeter.phase"]) for frame in phase])),
            "coefficient", "estimate", "4096-sample frames, complete stream",
        )
    image = work_dir / f"{name}-spectrum.png"
    subprocess.run([
        str(FFMPEG), "-hide_banner", "-nostats", "-loglevel", "error", "-i", str(path),
        "-lavfi", "showspectrumpic=s=640x360:legend=0:color=viridis", "-frames:v", "1",
        "-y", str(image),
    ], check=True)
    image_hash = sha256(image)
    image.unlink()
    facts["spectrogram_sha256"] = typed(image_hash, "sha256", "rendered", "complete stream")
    return {"name": name, "sha256": sha256(path), "facts": facts}


def canonical_hash(value: Any) -> str:
    encoded = json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()
    return hashlib.sha256(encoded).hexdigest()


def verify_source(source: dict[str, Any]) -> None:
    path = Path(source["path"])
    if not path.is_file():
        raise FileNotFoundError(f"source is missing: {path}")
    actual_hash = sha256(path)
    if actual_hash != source["sha256"]:
        raise ValueError(f"source hash mismatch: {path}")
    with wave.open(str(path), "rb") as audio:
        observed = (
            audio.getnchannels(), audio.getsampwidth(), audio.getframerate(),
            audio.getcomptype(),
        )
    expected = (2, 3, SAMPLE_RATE, "NONE")
    if observed != expected:
        raise ValueError(f"unsupported audio format {observed}; expected {expected}")


def run_provider(provider: str, manifest: dict[str, Any], work_dir: Path) -> dict[str, Any]:
    for source in manifest["sources"]:
        verify_source(source)
    imported_at = time.perf_counter()
    if provider == "reference":
        analyze: Callable[[dict[str, Any]], dict[str, Any]] = reference_source
        version = np.__version__
    elif provider == "librosa":
        import librosa
        version = librosa.__version__
        analyze = lambda source: librosa_source(source, librosa)
    elif provider == "essentia":
        import essentia
        import essentia.standard as es
        version = importlib.metadata.version("essentia")
        analyze = lambda source: essentia_source(source, es)
    elif provider == "ffmpeg":
        version = subprocess.run(
            [str(FFMPEG), "-version"], check=True, text=True, capture_output=True
        ).stdout.splitlines()[0].split()[2]
        analyze = lambda source: ffmpeg_source(source, work_dir)
    else:
        raise ValueError(f"unknown provider: {provider}")
    import_ms = (time.perf_counter() - imported_at) * 1_000

    results: list[list[dict[str, Any]]] = []
    elapsed: list[float] = []
    for _ in range(3):
        started = time.perf_counter()
        results.append([analyze(source) for source in manifest["sources"]])
        elapsed.append((time.perf_counter() - started) * 1_000)
    hashes = [canonical_hash(result) for result in results]
    return {
        "provider": provider,
        "version": version,
        "source_manifest_sha256": canonical_hash(manifest),
        "import_ms": import_ms,
        "analysis_ms": elapsed,
        "peak_resident_bytes": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
        "peak_child_resident_bytes": resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss,
        "repeat_hashes": hashes,
        "deterministic": len(set(hashes)) == 1,
        "results": results[0],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--work-dir", required=True, type=Path)
    parser.add_argument("--capture", type=Path)
    parser.add_argument("--generate", action="store_true")
    parser.add_argument("--provider", choices=["reference", "ffmpeg", "librosa", "essentia"])
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if args.generate:
        if args.capture is None:
            parser.error("--generate needs --capture")
        manifest = generate(args.work_dir, args.capture)
        rendered = json.dumps(manifest, indent=2, sort_keys=True) + "\n"
        if args.output is not None:
            args.output.write_text(rendered, encoding="utf-8")
        else:
            print(rendered, end="")
        return
    if args.provider is None:
        parser.error("analysis needs --provider")
    manifest = json.loads((args.work_dir / "manifest.json").read_text(encoding="utf-8"))
    rendered = json.dumps(
        run_provider(args.provider, manifest, args.work_dir), indent=2, sort_keys=True
    ) + "\n"
    if args.output is not None:
        args.output.write_text(rendered, encoding="utf-8")
    else:
        print(rendered, end="")


if __name__ == "__main__":
    main()
