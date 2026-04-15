#!/usr/bin/env python3
"""
Twitter Space / audio speaker diarization sidecar (PyInstaller one-file target).

Reads an audio file, runs pyannote/speaker-diarization-3.1, writes JSON segments.
Optionally extracts per-speaker voice embeddings for improved identity matching.

Progress lines (stdout, one per line) for the host app:
  DIARIZE_PROGRESS <pct_0_100> <current> <total> <message>

Output JSON: [ {"speaker": "SPEAKER_00", "start": 0.0, "end": 1.2}, ... ]

When --embeddings is given, also writes a companion file with per-speaker centroid
embeddings that the Rust host can use to match against known speaker voice samples.

Models are gated on Hugging Face — set HF_TOKEN or HUGGING_FACE_HUB_TOKEN.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from collections import defaultdict


def emit_progress(pct: float, cur: int, total: int, msg: str) -> None:
    pct = max(0.0, min(100.0, pct))
    line = f"DIARIZE_PROGRESS {pct:.1f} {cur} {total} {msg}"
    print(line, flush=True)


def extract_speaker_embeddings(
    audio_path: str,
    segments: list[dict],
    token: str | None,
) -> dict[str, list[float]] | None:
    """Extract centroid voice embeddings per speaker label using SpeechBrain ECAPA-TDNN."""
    try:
        import torch
        import torchaudio
        from speechbrain.inference.speaker import EncoderClassifier
    except ImportError:
        print("WARN: speechbrain not available, skipping embedding extraction", file=sys.stderr)
        return None

    try:
        classifier = EncoderClassifier.from_hparams(
            source="speechbrain/spkrec-ecapa-voxceleb",
            run_opts={"device": "cpu"},
        )
    except Exception as e:
        print(f"WARN: failed to load embedding model: {e}", file=sys.stderr)
        return None

    try:
        signal, sr = torchaudio.load(audio_path)
        if signal.shape[0] > 1:
            signal = signal.mean(dim=0, keepdim=True)
        if sr != 16000:
            signal = torchaudio.functional.resample(signal, sr, 16000)
            sr = 16000
    except Exception as e:
        print(f"WARN: failed to load audio for embeddings: {e}", file=sys.stderr)
        return None

    speaker_embeds: dict[str, list] = defaultdict(list)

    # Sample up to 5 segments per speaker (longest first for best quality)
    speaker_segs: dict[str, list[dict]] = defaultdict(list)
    for seg in segments:
        speaker_segs[seg["speaker"]].append(seg)

    for spk, segs in speaker_segs.items():
        segs_sorted = sorted(segs, key=lambda s: s["end"] - s["start"], reverse=True)
        for seg in segs_sorted[:5]:
            start_sample = int(seg["start"] * sr)
            end_sample = int(seg["end"] * sr)
            chunk = signal[:, start_sample:end_sample]
            if chunk.shape[1] < sr:  # skip segments shorter than 1 second
                continue
            try:
                emb = classifier.encode_batch(chunk)
                speaker_embeds[spk].append(emb.squeeze().tolist())
            except Exception:
                continue

    # Average embeddings per speaker to get centroid
    centroids: dict[str, list[float]] = {}
    for spk, embs in speaker_embeds.items():
        if not embs:
            continue
        dim = len(embs[0])
        avg = [sum(e[i] for e in embs) / len(embs) for i in range(dim)]
        centroids[spk] = avg

    return centroids if centroids else None


def main() -> int:
    p = argparse.ArgumentParser(description="Speaker diarization sidecar")
    p.add_argument("--audio", required=True, help="Path to audio file (e.g. mp3)")
    p.add_argument("--output", required=True, help="Path to write JSON segments")
    p.add_argument(
        "--num-speakers",
        type=int,
        default=None,
        help="Optional hint for cluster count (passed to pipeline when supported)",
    )
    p.add_argument(
        "--embeddings",
        action="store_true",
        default=False,
        help="Extract per-speaker voice embeddings for identity matching",
    )
    args = p.parse_args()

    audio_path = os.path.abspath(args.audio)
    out_path = os.path.abspath(args.output)

    if not os.path.isfile(audio_path):
        print(f"ERROR: audio file not found: {audio_path}", file=sys.stderr)
        return 2

    token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_HUB_TOKEN")

    total_steps = 5 if args.embeddings else 4
    emit_progress(5.0, 0, total_steps, "loading pyannote…")

    try:
        from pyannote.audio import Pipeline
    except ImportError as e:
        print(f"ERROR: pyannote.audio not available: {e}", file=sys.stderr)
        return 3

    emit_progress(15.0, 1, total_steps, "loading model (first run may download ~100MB)…")

    try:
        pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1",
            use_auth_token=token,
        )
    except Exception as e:
        print(
            "ERROR: Failed to load pyannote/speaker-diarization-3.1. "
            "Accept the model conditions on Hugging Face and set HF_TOKEN. "
            f"Detail: {e}",
            file=sys.stderr,
        )
        return 4

    emit_progress(30.0, 2, total_steps, "running diarization…")

    run_kw: dict = {}
    if args.num_speakers and args.num_speakers > 0:
        run_kw["num_speakers"] = args.num_speakers

    try:
        diarization = pipeline(audio_path, **run_kw)
    except TypeError:
        diarization = pipeline(audio_path)
    except Exception as e:
        print(f"ERROR: diarization failed: {e}", file=sys.stderr)
        return 5

    emit_progress(75.0, 3, total_steps, "serializing segments…")

    rows: list[dict] = []
    try:
        for segment, _track, label in diarization.itertracks(yield_label=True):
            rows.append(
                {
                    "speaker": str(label),
                    "start": float(segment.start),
                    "end": float(segment.end),
                }
            )
    except Exception as e:
        print(f"ERROR: could not iterate diarization output: {e}", file=sys.stderr)
        return 6

    rows.sort(key=lambda r: (r["start"], r["end"]))

    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(rows, f)

    # Extract speaker embeddings if requested
    if args.embeddings and rows:
        emit_progress(85.0, 4, total_steps, "extracting voice embeddings…")
        centroids = extract_speaker_embeddings(audio_path, rows, token)
        if centroids:
            emb_path = out_path.replace(".json", "_embeddings.json")
            with open(emb_path, "w", encoding="utf-8") as f:
                json.dump(centroids, f)
            emit_progress(95.0, 4, total_steps, f"wrote embeddings for {len(centroids)} speakers")
        else:
            emit_progress(95.0, 4, total_steps, "embedding extraction skipped")

    emit_progress(100.0, total_steps, total_steps, f"wrote {len(rows)} segments")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
