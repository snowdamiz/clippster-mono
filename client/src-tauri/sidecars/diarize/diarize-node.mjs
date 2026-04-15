#!/usr/bin/env node
/**
 * Speaker diarization via @huggingface/transformers (pyannote-segmentation-3.0 ONNX).
 *
 * Usage:  node diarize-node.mjs --audio <path> --output <path.json> [--num-speakers N] [--ffmpeg <path>]
 *
 * Progress lines (stdout): DIARIZE_PROGRESS <pct> <cur> <total> <msg>
 * Result: JSON array written to --output path.
 */

import { AutoProcessor, AutoModelForAudioFrameClassification } from '@huggingface/transformers';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { parseArgs } from 'node:util';
import WaveFileModule from 'wavefile';
const { WaveFile } = WaveFileModule;

function emit(pct, cur, total, msg) {
  console.log(`DIARIZE_PROGRESS ${pct.toFixed(1)} ${cur} ${total} ${msg}`);
}

function findFfmpeg(hint) {
  if (hint && existsSync(hint)) return hint;

  const scriptDir = dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
  const candidates = [
    resolve(scriptDir, '../../binaries/ffmpeg-x86_64-pc-windows-msvc.exe'),
    resolve(scriptDir, '../../target/debug/ffmpeg.exe'),
    'ffmpeg',
  ];
  for (const c of candidates) {
    try {
      execSync(`"${c}" -version`, { stdio: 'ignore' });
      return c;
    } catch { /* next */ }
  }
  return 'ffmpeg';
}

function convertToWav(audioPath, ffmpegPath) {
  const wavPath = audioPath.replace(/\.[^.]+$/, '') + '.diarize_tmp.wav';
  try {
    execSync(
      `"${ffmpegPath}" -y -i "${audioPath}" -ar 16000 -ac 1 -f wav "${wavPath}"`,
      { stdio: 'pipe', timeout: 300_000 }
    );
  } catch (e) {
    throw new Error(`ffmpeg conversion failed: ${e.message}`);
  }
  return wavPath;
}

function readWavAsFloat32(wavPath) {
  const buf = readFileSync(wavPath);
  const wav = new WaveFile(buf);
  wav.toBitDepth('32f');
  const samples = wav.getSamples(false, Float32Array);
  const sampleRate = wav.fmt.sampleRate;
  return { samples, sampleRate };
}

async function main() {
  const { values } = parseArgs({
    options: {
      audio:        { type: 'string' },
      output:       { type: 'string' },
      'num-speakers': { type: 'string' },
      ffmpeg:       { type: 'string' },
    },
    strict: false,
  });

  const audioPath = values.audio;
  const outputPath = values.output;
  const numSpeakers = values['num-speakers'] ? parseInt(values['num-speakers'], 10) : undefined;
  const ffmpegHint = values.ffmpeg;

  if (!audioPath || !outputPath) {
    console.error('Usage: node diarize-node.mjs --audio <path> --output <path.json>');
    process.exit(2);
  }

  if (!existsSync(audioPath)) {
    console.error(`ERROR: audio file not found: ${audioPath}`);
    process.exit(2);
  }

  const totalSteps = 5;
  emit(5, 0, totalSteps, 'converting audio to WAV...');

  const ffmpeg = findFfmpeg(ffmpegHint);
  const wavPath = convertToWav(audioPath, ffmpeg);

  emit(15, 1, totalSteps, 'reading audio...');
  const { samples, sampleRate } = readWavAsFloat32(wavPath);
  try { unlinkSync(wavPath); } catch { /* ok */ }

  const durationSecs = samples.length / sampleRate;
  emit(20, 1, totalSteps, `loaded ${durationSecs.toFixed(0)}s audio at ${sampleRate}Hz`);

  emit(25, 2, totalSteps, 'loading pyannote segmentation model (first run downloads ~10MB)...');
  const modelId = 'onnx-community/pyannote-segmentation-3.0';
  const model = await AutoModelForAudioFrameClassification.from_pretrained(modelId, {
    dtype: 'fp32',
  });
  const processor = await AutoProcessor.from_pretrained(modelId);
  emit(35, 2, totalSteps, 'model loaded');

  // Process audio in chunks to handle long files
  // pyannote segmentation model expects 10-second windows at 16kHz
  const WINDOW_SAMPLES = 16000 * 10;
  const STEP_SAMPLES = Math.floor(16000 * 10 * 0.9); // 90% overlap step = 1s step
  const totalWindows = Math.max(1, Math.ceil((samples.length - WINDOW_SAMPLES) / STEP_SAMPLES) + 1);

  emit(40, 3, totalSteps, `running segmentation on ${totalWindows} windows...`);

  const allSegments = [];
  let windowsDone = 0;

  // For shorter audio, process in one shot
  if (samples.length <= WINDOW_SAMPLES * 2) {
    const inputs = await processor(new Float32Array(samples));
    const { logits } = await model(inputs);
    const result = processor.post_process_speaker_diarization(logits, samples.length);
    if (result && result[0]) {
      for (const seg of result[0]) {
        allSegments.push({
          speaker: `SPEAKER_${String(seg.id).padStart(2, '0')}`,
          start: seg.start,
          end: seg.end,
          confidence: seg.confidence,
        });
      }
    }
  } else {
    // For long audio, process in overlapping chunks and use built-in post-processing
    // Process the entire audio as one input (transformers.js handles windowing internally)
    const inputs = await processor(new Float32Array(samples));
    const { logits } = await model(inputs);

    emit(70, 3, totalSteps, 'post-processing speaker segments...');
    const result = processor.post_process_speaker_diarization(logits, samples.length, {
      num_speakers: numSpeakers,
    });

    if (result && result[0]) {
      for (const seg of result[0]) {
        allSegments.push({
          speaker: `SPEAKER_${String(seg.id).padStart(2, '0')}`,
          start: seg.start,
          end: seg.end,
          confidence: seg.confidence,
        });
      }
    }
  }

  emit(85, 4, totalSteps, `merging ${allSegments.length} raw segments...`);

  // Merge adjacent segments with the same speaker (within 0.5s gap)
  allSegments.sort((a, b) => a.start - b.start || a.end - b.end);
  const merged = [];
  for (const seg of allSegments) {
    const last = merged[merged.length - 1];
    if (last && last.speaker === seg.speaker && seg.start - last.end < 0.5) {
      last.end = Math.max(last.end, seg.end);
      last.confidence = Math.max(last.confidence, seg.confidence);
    } else {
      merged.push({ ...seg });
    }
  }

  // Filter low-confidence and very short segments
  const filtered = merged.filter(s => s.confidence > 0.3 && (s.end - s.start) > 0.3);

  writeFileSync(outputPath, JSON.stringify(filtered, null, 2));
  emit(100, totalSteps, totalSteps, `wrote ${filtered.length} segments`);
  return 0;
}

main().then(process.exit).catch(e => {
  console.error(`ERROR: ${e.message || e}`);
  process.exit(1);
});
