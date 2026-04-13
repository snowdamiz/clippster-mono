# Diarize sidecar (pyannote)

Frozen with **PyInstaller** into `client/src-tauri/binaries/diarize-<target-triple>[.exe]` so the Tauri app can run speaker diarization without a system Python install.

## Automatic install (development and production builds)

`client/src-tauri/build.rs` downloads the correct prebuilt for the **current** target from the public releases repo (same pattern as `yt-dlp`), unless a file already exists and is larger than the text placeholder (512+ bytes).

- Default: `https://github.com/snowdamiz/clippster-releases/releases/download/diarize-sidecar-v0.1.0/diarize-<triple>`
- Override full URL: `CLIPSTER_DIARIZE_URL`
- Override base URL (filename appended): `CLIPSTER_DIARIZE_DOWNLOAD_BASE`

Bump the tag in **both** `build.rs` (`DIARIZE_RELEASE_TAG`) and the workflow dispatch when publishing new binaries.

### Publishing prebuilt sidecars (maintainers)

1. In GitHub Actions, run workflow **Diarize sidecar** (`diarize-sidecar.yml`) with the tag matching `DIARIZE_RELEASE_TAG` (e.g. `diarize-sidecar-v0.1.0`). Requires `RELEASES_PAT` on `snowdamiz/clippster-releases` (same secret as the main release workflow).
2. After assets exist, any `cargo build` / `yarn tauri dev` / release pipeline will fetch them automatically.

### Local PyInstaller build (optional)

If you cannot use the hosted assets, run the scripts below and copy outputs into `binaries/`; that skips the download step when the file is already ≥512 bytes.

## Hugging Face token

`pyannote/speaker-diarization-3.1` is gated. Create a token at [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens), accept the model card conditions, then set before first run:

- `HF_TOKEN` or `HUGGING_FACE_HUB_TOKEN`

The app does not ship a token; end users who build from source set the env var once; models cache under the HF cache directory.

## Local dev (script entrypoint)

```bash
cd client/src-tauri/sidecars/diarize
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python diarize.py --audio /path/to/space.mp3 --output /tmp/out.json
```

## Build frozen binary

From repo root (Windows PowerShell):

```powershell
./client/src-tauri/scripts/build-diarize-sidecar.ps1
```

macOS / Linux:

```bash
./client/src-tauri/scripts/build-diarize-sidecar.sh
```

Outputs are copied next to other sidecars: `client/src-tauri/binaries/diarize-<triple>` (with `.exe` on Windows).
