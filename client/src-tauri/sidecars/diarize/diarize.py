#!/usr/bin/env python3
"""
Twitter Space / audio speaker diarization sidecar (PyInstaller one-file target).

Reads an audio file, runs pyannote/speaker-diarization-3.1, writes JSON segments.

Progress lines (stdout, one per line) for the host app:
  DIARIZE_PROGRESS <pct_0_100> <current> <total> <message>

Output JSON: [ {"speaker": "SPEAKER_00", "start": 0.0, "end": 1.2}, ... ]

Models are gated on Hugging Face — set HF_TOKEN or HUGGING_FACE_HUB_TOKEN.
"""
from __future__ import annotations

import argparse
import json
import os
import sys


def emit_progress(pct: float, cur: int, total: int, msg: str) -> None:
    pct = max(0.0, min(100.0, pct))
    line = f"DIARIZE_PROGRESS {pct:.1f} {cur} {total} {msg}"
    print(line, flush=True)


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
    args = p.parse_args()

    audio_path = os.path.abspath(args.audio)
    out_path = os.path.abspath(args.output)

    if not os.path.isfile(audio_path):
        print(f"ERROR: audio file not found: {audio_path}", file=sys.stderr)
        return 2

    token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_HUB_TOKEN")

    emit_progress(5.0, 0, 4, "loading pyannote…")

    try:
        from pyannote.audio import Pipeline
    except ImportError as e:
        print(f"ERROR: pyannote.audio not available: {e}", file=sys.stderr)
        return 3

    emit_progress(15.0, 1, 4, "loading model (first run may download ~100MB)…")

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

    emit_progress(30.0, 2, 4, "running diarization…")

    # Optional instantiations for num_speakers when the installed API supports it.
    run_kw: dict = {}
    if args.num_speakers and args.num_speakers > 0:
        run_kw["num_speakers"] = args.num_speakers

    try:
        diarization = pipeline(audio_path, **run_kw)
    except TypeError:
        # Older API without num_speakers kwarg on __call__
        diarization = pipeline(audio_path)
    except Exception as e:
        print(f"ERROR: diarization failed: {e}", file=sys.stderr)
        return 5

    emit_progress(85.0, 3, 4, "serializing segments…")

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

    emit_progress(100.0, 4, 4, f"wrote {len(rows)} segments")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
